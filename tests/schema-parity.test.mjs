/**
 * Schema Parity Guard (SPEC-57):
 * Verifies that a bootstrapped Node database matches the Go schema.sql declaration
 * across tables, columns, indexes, and foreign keys.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dbModuleUrl = pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href;

const { bootstrap, resolveSchemaSqlPath } = await import(dbModuleUrl);

/**
 * Named exceptions from SPEC-57-01 inventory:
 * - song_set_entries.extraction_regex: Go executes `ALTER TABLE song_set_entries ADD COLUMN extraction_regex TEXT`
 *   at runtime in `internal/db/form_layout.go`, but `internal/db/schema.sql` does not declare it directly.
 */
const ALLOWED_EXTRA_NODE_COLUMNS = {
  song_set_entries: ['extraction_regex'],
};

function getTables(db) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name);
}

function getTableColumns(db, table) {
  return db.prepare(`PRAGMA table_info("${table}")`).all();
}

function getTableIndexes(db, table) {
  const indexList = db.prepare(`PRAGMA index_list("${table}")`).all();
  return indexList
    .map((idx) => {
      const info = db.prepare(`PRAGMA index_info("${idx.name}")`).all();
      return {
        name: idx.name,
        unique: idx.unique,
        columns: info.map((c) => c.name).sort(),
      };
    })
    .sort((a, b) => a.columns.join(',').localeCompare(b.columns.join(',')));
}

function getTableForeignKeys(db, table) {
  return db
    .prepare(`PRAGMA foreign_key_list("${table}")`)
    .all()
    .map((fk) => ({
      table: fk.table,
      from: fk.from,
      to: fk.to,
      on_delete: fk.on_delete,
      on_update: fk.on_update,
    }))
    .sort((a, b) => `${a.table}:${a.from}:${a.to}`.localeCompare(`${b.table}:${b.from}:${b.to}`));
}

export function compareSchemas(dbGo, dbNode, allowedExtraColumns = ALLOWED_EXTRA_NODE_COLUMNS) {
  const tablesGo = getTables(dbGo);
  const tablesNode = getTables(dbNode);

  const missingTables = tablesGo.filter((t) => !tablesNode.includes(t));
  const extraTables = tablesNode.filter((t) => !tablesGo.includes(t));

  if (missingTables.length > 0 || extraTables.length > 0) {
    throw new Error(
      `Table mismatch: missing in Node: [${missingTables.join(', ')}], extra in Node: [${extraTables.join(', ')}]`
    );
  }

  for (const table of tablesGo) {
    // 1. Columns
    const colsGo = getTableColumns(dbGo, table);
    const colsNode = getTableColumns(dbNode, table);

    const mapGo = new Map(colsGo.map((c) => [c.name, c]));
    const mapNode = new Map(colsNode.map((c) => [c.name, c]));

    const allowedExtra = new Set(allowedExtraColumns[table] || []);

    for (const [colName, col] of mapGo.entries()) {
      const nodeCol = mapNode.get(colName);
      if (!nodeCol) {
        throw new Error(`Table "${table}": missing column "${colName}" in Node database`);
      }
      if (nodeCol.type.toUpperCase() !== col.type.toUpperCase()) {
        throw new Error(
          `Table "${table}" column "${colName}": type mismatch Go=${col.type} vs Node=${nodeCol.type}`
        );
      }
      if (nodeCol.pk !== col.pk) {
        throw new Error(
          `Table "${table}" column "${colName}": primary key mismatch Go=${col.pk} vs Node=${nodeCol.pk}`
        );
      }
    }

    for (const colName of mapNode.keys()) {
      if (!mapGo.has(colName) && !allowedExtra.has(colName)) {
        throw new Error(
          `Table "${table}": unexpected extra column "${colName}" in Node database (not in Go schema and not on allowed list)`
        );
      }
    }

    // 2. Indexes & Unique constraints
    const idxGo = getTableIndexes(dbGo, table);
    const idxNode = getTableIndexes(dbNode, table);

    // Filter out internal index names for comparison of unique column sets
    const sigGo = idxGo.map((idx) => `${idx.unique}:${idx.columns.join(',')}`).sort();
    const sigNode = idxNode.map((idx) => `${idx.unique}:${idx.columns.join(',')}`).sort();

    if (sigGo.join('|') !== sigNode.join('|')) {
      throw new Error(
        `Table "${table}": index/unique constraint mismatch. Go=[${sigGo.join('; ')}] vs Node=[${sigNode.join('; ')}]`
      );
    }

    // 3. Foreign keys
    const fksGo = getTableForeignKeys(dbGo, table);
    const fksNode = getTableForeignKeys(dbNode, table);

    const sigFkGo = fksGo.map((fk) => `${fk.table}(${fk.from}->${fk.to}):DEL=${fk.on_delete}`).sort();
    const sigFkNode = fksNode.map((fk) => `${fk.table}(${fk.from}->${fk.to}):DEL=${fk.on_delete}`).sort();

    if (sigFkGo.join('|') !== sigFkNode.join('|')) {
      throw new Error(
        `Table "${table}": foreign key constraint mismatch. Go=[${sigFkGo.join('; ')}] vs Node=[${sigFkNode.join('; ')}]`
      );
    }
  }

  return true;
}

test('SPEC-57: Node database bootstrap matches Go schema.sql', () => {
  const schemaPath = resolveSchemaSqlPath ? resolveSchemaSqlPath() : path.join(root, 'internal', 'db', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const dbGo = new Database(':memory:');
  dbGo.exec(schemaSql);

  const dbNode = new Database(':memory:');
  bootstrap(dbNode);

  assert.doesNotThrow(() => {
    compareSchemas(dbGo, dbNode);
  });
});

test('SPEC-57: Absence Guard & Defect Injection proofs for schema parity comparator', () => {
  const schemaPath = resolveSchemaSqlPath ? resolveSchemaSqlPath() : path.join(root, 'internal', 'db', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Defect 1: Missing column
  const db1Go = new Database(':memory:');
  db1Go.exec(schemaSql);
  const db1Node = new Database(':memory:');
  db1Node.exec(schemaSql);
  db1Go.exec('ALTER TABLE accounts ADD COLUMN injected_extra_col TEXT');
  assert.throws(
    () => compareSchemas(db1Go, db1Node),
    /missing column "injected_extra_col" in Node database/
  );

  // Defect 2: Missing table
  const db2Go = new Database(':memory:');
  db2Go.exec(schemaSql);
  const db2Node = new Database(':memory:');
  db2Node.exec(schemaSql);
  db2Go.exec('CREATE TABLE test_injected_table (id TEXT PRIMARY KEY)');
  assert.throws(
    () => compareSchemas(db2Go, db2Node),
    /Table mismatch: missing in Node: \[test_injected_table\]/
  );

  // Defect 3: Mismatched index / unique constraint
  const db3Go = new Database(':memory:');
  db3Go.exec(schemaSql);
  const db3Node = new Database(':memory:');
  db3Node.exec(schemaSql);
  db3Go.exec('CREATE UNIQUE INDEX idx_injected_uniq ON accounts (role, created_at)');
  assert.throws(
    () => compareSchemas(db3Go, db3Node),
    /index\/unique constraint mismatch/
  );

  // Defect 4: Mismatched foreign key constraint
  const db4Go = new Database(':memory:');
  db4Go.exec(schemaSql);
  const db4Node = new Database(':memory:');
  db4Node.exec(schemaSql);
  db4Node.exec(`
    CREATE TABLE fk_mismatch_test (
      id INTEGER PRIMARY KEY,
      account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE
    );
  `);
  db4Go.exec(`
    CREATE TABLE fk_mismatch_test (
      id INTEGER PRIMARY KEY,
      account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL
    );
  `);
  assert.throws(
    () => compareSchemas(db4Go, db4Node),
    /foreign key constraint mismatch/
  );
});
