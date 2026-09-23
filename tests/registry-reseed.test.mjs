/**
 * AD-17 bootstrap-once, AD-21's data-version counter, and the `getDb` step
 * order that keeps them from observing each other's half-finished state.
 *
 * Story 20.1 retires the old self-healing reseed entirely (AC-7): startup no
 * longer compares a stored row against a recorded seed hash and re-applies a
 * shipped correction to an untouched row on every boot. The seeder now runs
 * exactly once, gated on a bootstrap marker in `settings`, and after that it
 * writes nothing — not an insert, not a re-seed — so a row an administrator
 * deletes stays deleted through a restart. This file's shape follows: cases
 * that used to drive the self-heal guard through `reseeded` / `skipped-*`
 * outcomes are gone because that guard no longer exists; what remains proves
 * the one-time bootstrap, the AD-21 counter it stamps, the AC-8 fail-closed
 * guard, and the fixed `getDb` step order (startup DDL → data migrations →
 * corpus reconcile → first-boot bootstrap).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-reseed-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');

const { getDb, repairPreCounterArtifactRegistry } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href
);
const {
  getArtifactTemplate,
  updateArtifactTemplate,
  listArtifactSummaries,
  assertContiguousPositions,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'store.ts')).href
);
const {
  bootstrapArtifactRegistry,
  getSeedTemplateById,
  loadSeedTemplates,
  ARTIFACT_REGISTRY_BOOTSTRAP_KEY,
  DATA_VERSION_KEY,
  CURRENT_DATA_VERSION,
  BOOTSTRAP_DATA_VERSION,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'seed.ts')).href
);
const { parseRundown } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'parser.ts')).href
);
const { buildSlidePlan } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'slide-plan.ts')).href
);

const sample = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'sample-rundown.txt'),
  'utf8'
);

function readRow(db, id) {
  return db
    .prepare(
      `SELECT id, label, base_type, payload, updated_at, seed_hash, position
       FROM artifact_templates WHERE id = ?`
    )
    .get(id);
}

function settingsValue(db, key) {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
  return row?.value;
}

test('first boot inserts every shipped template once, positioned 0..N-1, and stamps the bootstrap marker + data version together', () => {
  const db = getDb();
  const templates = loadSeedTemplates();

  const row0 = readRow(db, templates[0].id);
  assert.ok(row0, 'expected the first seed row to exist');
  assert.equal(row0.position, 0);

  assertContiguousPositions(db);
  // DEC-004 3->4 deletes the generic `song-set` row (the retired dsMiddle
  // loop row), so the post-migration count is one less than the shipped seed.
  assert.equal(
    db.prepare(`SELECT COUNT(*) AS n FROM artifact_templates`).get().n,
    templates.length - 1
  );

  assert.equal(settingsValue(db, ARTIFACT_REGISTRY_BOOTSTRAP_KEY), '1');
  assert.equal(settingsValue(db, DATA_VERSION_KEY), String(CURRENT_DATA_VERSION));
  assert.equal(CURRENT_DATA_VERSION, 12);
});

/**
 * Inverts the old `tests/registry-reseed.test.mjs:337` case ("a missing row
 * is inserted with its seed hash recorded") per AC-7: once the marker is set,
 * a row deleted directly in SQL is never reinserted, and it stays gone
 * through the store *and* through a built plan (the resurrection this closes
 * happened at plan-build time, not at boot).
 */
test('a row deleted directly in SQL stays deleted — through a restart, through the store, through a built plan', () => {
  const db = getDb();

  const second = bootstrapArtifactRegistry(db);
  assert.equal(second, null, 'the marker is already set; a second call must write nothing');

  db.prepare(`DELETE FROM artifact_templates WHERE id = ?`).run('midweek-prayer');
  assert.equal(getArtifactTemplate(db, 'midweek-prayer'), null);

  // "Restart": call the bootstrap again, exactly what a real reboot would do.
  const afterRestart = bootstrapArtifactRegistry(db);
  assert.equal(afterRestart, null, 'the deleted row must not be reinserted on restart');
  assert.equal(getArtifactTemplate(db, 'midweek-prayer'), null);
  assert.ok(
    !listArtifactSummaries(db).some((s) => s.id === 'midweek-prayer'),
    'deleted row must not reappear in listArtifactSummaries'
  );

  const parsed = parseRundown(sample);
  const plan = buildSlidePlan('2026-07-11', parsed, []);
  assert.ok(
    !plan.some((s) => s.id === 'midweek-prayer'),
    'deleted row must not reappear in a built plan'
  );

  // Restore for later cases in this file.
  const seed = getSeedTemplateById('midweek-prayer');
  db.prepare(
    `INSERT INTO artifact_templates (id, label, base_type, payload, updated_at, seed_hash, position)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    seed.id,
    seed.label,
    seed.baseType,
    JSON.stringify(seed),
    new Date().toISOString(),
    null,
    loadSeedTemplates().findIndex((t) => t.id === 'midweek-prayer')
  );
});

/**
 * AC-8: a persisted row that fails validation gets no seed substitution. It
 * contributes no layout — the built plan omits the slide it would have
 * produced — and the rejection is logged, whether or not the id also happens
 * to be a shipped seed id.
 */
test('a row that fails validation is omitted from a built plan and logged, never substituted from the seed', () => {
  const db = getDb();
  const before = getArtifactTemplate(db, 'thank-you');
  assert.ok(before);

  db.prepare(
    `UPDATE artifact_templates SET payload = ? WHERE id = 'thank-you'`
  ).run(JSON.stringify({ not: 'a valid template' }));

  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.join(' '));
  let plan;
  try {
    const parsed = parseRundown(sample);
    plan = buildSlidePlan('2026-07-11', parsed, []);
  } finally {
    console.error = originalError;
  }

  assert.ok(
    !plan.some((s) => s.id === 'thank-you'),
    'the corrupt row must contribute no layout to the built plan'
  );
  assert.ok(
    logged.some((line) => line.includes('thank-you') && line.includes('rejected')),
    `expected a rejection log naming "thank-you"; got: ${JSON.stringify(logged)}`
  );
  assert.ok(
    logged.every((line) => !line.includes('falling back')),
    `a rejected row has no layout; it must not claim a fallback: ${JSON.stringify(logged)}`
  );
  assert.ok(
    logged.every((line) => !line.includes('absent from the shipped seed')),
    `a rejected row has no layout; it must not claim it is absent from the shipped seed: ${JSON.stringify(logged)}`
  );
  assert.equal(
    logged.length,
    1,
    `a rejected row must produce exactly one error line: ${JSON.stringify(logged)}`
  );

  // Restore so later cases in this file are unaffected.
  const { updatedAt, ...body } = before;
  updateArtifactTemplate(db, 'thank-you', body, before.updatedAt, {
    allowReadOnly: true,
  });
});

/**
 * `getDb()` runs its migrations once per process, so a boot has to *be* a
 * process. This runs the real startup path — DDL, migrations, corpus
 * reconcile, bootstrap — against `dbFile` and returns everything it logged.
 */
const BOOT_SCRIPT = path.join(tmp, 'boot-db.mjs');
fs.writeFileSync(
  BOOT_SCRIPT,
  [
    "import path from 'path';",
    "import { pathToFileURL } from 'url';",
    'const { getDb } = await import(',
    "  pathToFileURL(path.join(process.argv[2], 'src', 'lib', 'db', 'index.ts')).href",
    ');',
    'getDb();',
    '',
  ].join('\n')
);

function bootAgainst(dbFile) {
  try {
    return execFileSync(
      process.execPath,
      [
        '--import',
        pathToFileURL(path.join(root, 'tests', 'register-ts-resolve.mjs')).href,
        '--experimental-strip-types',
        BOOT_SCRIPT,
        root,
      ],
      {
        cwd: root,
        env: { ...process.env, DB_PATH: dbFile },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
  } catch (err) {
    throw new Error(
      `boot against ${dbFile} failed\n--- stdout ---\n${err.stdout ?? ''}\n--- stderr ---\n${err.stderr ?? ''}`
    );
  }
}

function openFile(dbFile) {
  return new Database(dbFile);
}

/**
 * A database shaped like one that ran the pre-20.1 seeder: it holds some
 * `artifact_templates` rows (the current schema, since AC-9 says only the
 * *value* — not the shape — of the AD-21 counter is what's new) but no
 * `settings` row for either the bootstrap marker or the data-version counter.
 * AD-4 records no deployment exists, so this is exactly a developer database
 * one boot away from the compacted version-1 reset (AC-10) — not a
 * historical replica of the real pre-Story-20.1 seed, which is no longer
 * loadable now that the seed file itself has moved on.
 */
function createPreCounterDatabase(name, ids) {
  const file = path.join(tmp, name);
  const legacy = new Database(file);
  legacy.exec(`
    CREATE TABLE artifact_templates (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      base_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      seed_hash TEXT,
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const insert = legacy.prepare(
    `INSERT INTO artifact_templates (id, label, base_type, payload, updated_at, position)
     VALUES (?, ?, ?, ?, ?, 0)`
  );
  const templates = loadSeedTemplates();
  for (const id of ids) {
    const template = templates.find((t) => t.id === id);
    insert.run(
      template.id,
      template.label,
      template.baseType,
      JSON.stringify(template),
      '2000-01-01T00:00:00.000Z'
    );
  }
  legacy.close();
  return file;
}

const PRE_COUNTER_IDS = ['welcome', 'thank-you', 'contact', 'sermon', 'song-set'];

/**
 * A bootstrap that encounters legacy rows must not make an inconsistent
 * registry current. `insertArtifactTemplateIfMissing` intentionally preserves
 * those rows, so the invariant check has to reject the mixed positions before
 * either settings stamp commits.
 */
test('failed bootstrap rolls back both settings stamps when ordered registry positions are malformed', () => {
  const file = createPreCounterDatabase('malformed-bootstrap.db', PRE_COUNTER_IDS);
  const db = openFile(file);

  assert.throws(
    () => bootstrapArtifactRegistry(db),
    /position is not well-formed/,
    'bootstrap must fail closed instead of stamping an inconsistent ordered registry'
  );
  assert.equal(settingsValue(db, ARTIFACT_REGISTRY_BOOTSTRAP_KEY), undefined);
  assert.equal(settingsValue(db, DATA_VERSION_KEY), undefined);

  db.close();
});

test('bootstrapping ahead of the pre-counter repair fails closed without stamping the malformed registry', () => {
  const file = createPreCounterDatabase('wrong-order.db', PRE_COUNTER_IDS);
  const db = openFile(file);

  // The wrong order: seed-from-zero runs first. It skips every id the
  // pre-counter rows already hold (`insertArtifactTemplateIfMissing` is a
  // no-op for them), so those five keep the meaningless position=0 every
  // pre-counter row was given, while the other 33 land on their real index —
  // a database with a duplicated position and a hole where the skipped ids'
  // real positions would have gone.
  assert.throws(() => bootstrapArtifactRegistry(db), /position is not well-formed/);
  assert.equal(settingsValue(db, ARTIFACT_REGISTRY_BOOTSTRAP_KEY), undefined);
  assert.equal(settingsValue(db, DATA_VERSION_KEY), undefined);
  assert.equal(
    db.prepare(`SELECT COUNT(*) AS n FROM artifact_templates`).get().n,
    PRE_COUNTER_IDS.length,
    'the failed immediate transaction must roll back every attempted seed insert'
  );
  for (const id of PRE_COUNTER_IDS) {
    assert.equal(
      readRow(db, id).position,
      0,
      `pre-counter row "${id}" bootstrap-first left untouched keeps its meaningless position`
    );
  }
  assert.throws(
    () => assertContiguousPositions(db),
    /position is not well-formed/,
    'five rows sharing position 0 is not a well-formed 0..N-1 set'
  );

  // The failed bootstrap rolls back without stamping `data_version`, so the
  // repair's guard stays open. On the next boot, the repair runs and wipes the
  // malformed rows, making the bootstrap-before-repair ordering self-healing.
  repairPreCounterArtifactRegistry(db);
  assert.doesNotThrow(
    () => assertContiguousPositions(db),
    /position is not well-formed/,
    'the repair can no longer fire — the wrong order leaves the database broken for good'
  );

  db.close();
});

test('repairing before bootstrapping compacts a pre-counter database into the correct version-1 shape', () => {
  const file = createPreCounterDatabase('right-order.db', PRE_COUNTER_IDS);
  const db = openFile(file);

  repairPreCounterArtifactRegistry(db);
  assert.equal(
    db.prepare(`SELECT COUNT(*) AS n FROM artifact_templates`).get().n,
    0,
    'the repair wipes the pre-counter rows before anything reseeds them'
  );

  bootstrapArtifactRegistry(db);
  const templates = loadSeedTemplates();
  // DEC-004 3->4 deletes the generic `song-set` row, but this test only runs
  // the bootstrap (no migration pass) — the count here is the full seed.
  assert.equal(
    db.prepare(`SELECT COUNT(*) AS n FROM artifact_templates`).get().n,
    templates.length
  );
  assertContiguousPositions(db);
  assert.equal(settingsValue(db, DATA_VERSION_KEY), String(BOOTSTRAP_DATA_VERSION));

  db.close();
});

test('the real getDb() wires the correct order against a pre-counter database', () => {
  const file = createPreCounterDatabase('real-boot.db', PRE_COUNTER_IDS);

  bootAgainst(file);

  const db = openFile(file);
  const templates = loadSeedTemplates();
  // DEC-004 3->4 deletes the generic `song-set` row.
  assert.equal(
    db.prepare(`SELECT COUNT(*) AS n FROM artifact_templates`).get().n,
    templates.length - 1,
    'getDb must compact the pre-counter rows into the fresh 38-row bootstrap, then 3->4 deletes the generic song-set row'
  );
  assertContiguousPositions(db);
  assert.equal(settingsValue(db, ARTIFACT_REGISTRY_BOOTSTRAP_KEY), '1');
  assert.equal(settingsValue(db, DATA_VERSION_KEY), String(CURRENT_DATA_VERSION));
  db.close();
});

test('a second real boot against an already-bootstrapped database changes nothing', () => {
  const file = createPreCounterDatabase('idempotent-boot.db', PRE_COUNTER_IDS);
  bootAgainst(file);

  const db = openFile(file);
  db.prepare(`DELETE FROM artifact_templates WHERE id = ?`).run('contact');
  db.close();

  bootAgainst(file);

  const after = openFile(file);
  assert.equal(getArtifactTemplate(after, 'contact'), null);
  const row = after
    .prepare(`SELECT id FROM artifact_templates WHERE id = 'contact'`)
    .get();
  assert.equal(row, undefined, 'a second real boot must not reinsert the deleted row');
  after.close();
});
