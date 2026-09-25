/**
 * SPEC-81-02: Dual Default Backgrounds Data Model & Background Library UI (WSD-W2)
 *
 * Verifies:
 * 1. Database schema creates background_default_assignments with role CHECK constraint ('song_set', 'general').
 * 2. Cascading foreign key deletes role assignment when asset is deleted directly via parent image DELETE (UC-25).
 * 3. Migration backfills legacy default into both song_set and general roles through real bootstrap.
 * 4. Durable clearing: clearing both defaults does NOT re-resurrect on subsequent database boots (Finding 1).
 * 5. BackgroundLibraryPanel.tsx source guards verifying dual role badges, action buttons, and API path.
 * 6. Real-file defect injection proofs asserting absence guards fail cleanly when file on disk is mutated and reverted.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import Database from 'better-sqlite3';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-defaults-test-'));
const testDbPath = path.join(tmp, 'test.db');
process.env.DB_PATH = testDbPath;
delete process.env.IMAGE_URL_ALLOWLIST;
process.env.WPW_USE_SHIPPED_REGISTRY = '1';

const { getDb, migrateBackgroundDefaultAssignments } = await import(
  pathToFileURL(path.join(ROOT, 'src', 'lib', 'db', 'index.ts')).href
);

const PANEL_PATH = path.join(
  ROOT,
  'src',
  'components',
  'admin',
  'BackgroundLibraryPanel.tsx'
);

function readPanelSource() {
  return fs.readFileSync(PANEL_PATH, 'utf8');
}

// ---------------------------------------------------------------------------
// 1. Database Schema & Real Migration Verification
// ---------------------------------------------------------------------------

test('SPEC-81-02: background_default_assignments table schema and constraints', () => {
  const db = getDb();

  // 1. Table exists with required columns
  const cols = db.prepare(`PRAGMA table_info(background_default_assignments)`).all();
  assert.ok(cols.length >= 3, 'background_default_assignments table must have at least 3 columns');
  const colNames = cols.map((c) => c.name);
  assert.ok(colNames.includes('role'), 'must contain role column');
  assert.ok(colNames.includes('background_image_id'), 'must contain background_image_id column');
  assert.ok(colNames.includes('updated_at'), 'must contain updated_at column');

  // role is primary key
  const roleCol = cols.find((c) => c.name === 'role');
  assert.equal(roleCol.pk, 1, 'role column must be primary key');

  // 2. CHECK constraint: rejects invalid role
  assert.throws(() => {
    db.prepare(
      `INSERT INTO background_default_assignments (role, background_image_id, updated_at)
       VALUES ('invalid_role', 1, datetime('now'))`
    ).run();
  }, /CHECK constraint failed/i);
});

test('SPEC-81-02: Real ON DELETE CASCADE removes role assignment when parent image deleted (UC-25)', () => {
  const dbPath = path.join(tmp, 'cascade-test.db');
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Create tables using production schema & migration
  db.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE background_library_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      name TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      category TEXT NOT NULL DEFAULT 'background'
    );
  `);
  migrateBackgroundDefaultAssignments(db);

  const now = new Date().toISOString();
  const insertRes = db
    .prepare(
      `INSERT INTO background_library_images (url, name, category, is_default, created_at, updated_at)
       VALUES ('/assets/test-cascade.png', 'Test Cascade', 'background', 0, ?, ?)`
    )
    .run(now, now);
  const imageId = Number(insertRes.lastInsertRowid);

  // Assign to general default
  db.prepare(
    `INSERT INTO background_default_assignments (role, background_image_id, updated_at)
     VALUES ('general', ?, ?)`
  ).run(imageId, now);

  const beforeDelete = db
    .prepare(`SELECT role, background_image_id FROM background_default_assignments WHERE role = 'general'`)
    .get();
  assert.equal(beforeDelete?.background_image_id, imageId);

  // Execute direct parent image deletion with foreign keys enabled WITHOUT deleting child first
  db.prepare(`DELETE FROM background_library_images WHERE id = ?`).run(imageId);

  // ON DELETE CASCADE must have cleanly deleted the assignment
  const afterDelete = db
    .prepare(`SELECT role FROM background_default_assignments WHERE role = 'general'`)
    .get();
  assert.equal(afterDelete, undefined, 'Role assignment must be automatically cascaded on parent image deletion');

  db.close();
});

test('SPEC-81-02: Real migration boots legacy database and seeds both default roles', () => {
  const legacyDbPath = path.join(tmp, 'legacy-migration.db');
  const legacyDb = new Database(legacyDbPath);

  // Setup pre-SPEC-81 legacy database with is_default = 1 image and settings table
  legacyDb.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE background_library_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      name TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      category TEXT NOT NULL DEFAULT 'background'
    );
  `);

  const now = new Date().toISOString();
  const res = legacyDb
    .prepare(
      `INSERT INTO background_library_images (url, name, category, is_default, created_at, updated_at)
       VALUES ('/assets/legacy-default.png', 'Legacy Default', 'background', 1, ?, ?)`
    )
    .run(now, now);
  const defaultId = Number(res.lastInsertRowid);
  legacyDb.close();

  // Boot the legacy DB through real production migrateBackgroundDefaultAssignments
  const bootedDb = new Database(legacyDbPath);
  bootedDb.pragma('foreign_keys = ON');

  const markerBefore = bootedDb
    .prepare("SELECT 1 FROM settings WHERE key = 'background_defaults_migrated'")
    .get();
  assert.equal(markerBefore, undefined, 'Pre-migration DB must not have migrated marker yet');

  // Execute real production migration
  migrateBackgroundDefaultAssignments(bootedDb);

  const markerAfter = bootedDb
    .prepare("SELECT 1 FROM settings WHERE key = 'background_defaults_migrated'")
    .get();
  assert.ok(markerAfter, 'Post-migration DB must have migrated marker stamped');

  const assignments = bootedDb
    .prepare(`SELECT role, background_image_id FROM background_default_assignments ORDER BY role ASC`)
    .all();
  assert.equal(assignments.length, 2);
  assert.equal(assignments[0].role, 'general');
  assert.equal(assignments[0].background_image_id, defaultId);
  assert.equal(assignments[1].role, 'song_set');
  assert.equal(assignments[1].background_image_id, defaultId);

  bootedDb.close();
});

test('SPEC-81-02: Durable clearing — deleting both defaults does not re-resurrect on restart (Finding 1)', () => {
  const durableDbPath = path.join(tmp, 'durable-defaults.db');
  const db1 = new Database(durableDbPath);
  db1.pragma('foreign_keys = ON');

  // Setup legacy table with is_default = 1
  db1.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE background_library_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      name TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      category TEXT NOT NULL DEFAULT 'background'
    );
  `);

  const now = new Date().toISOString();
  db1.prepare(
    `INSERT INTO background_library_images (url, name, category, is_default, created_at, updated_at)
     VALUES ('/assets/legacy.png', 'Legacy', 'background', 1, ?, ?)`
  ).run(now, now);

  // Run real production migration
  migrateBackgroundDefaultAssignments(db1);

  // Verify both roles were initially seeded
  const initialCount = db1.prepare(`SELECT COUNT(*) as c FROM background_default_assignments`).get().c;
  assert.equal(initialCount, 2, 'Migration seeded both roles');

  // Administrator explicitly clears both default roles
  db1.prepare(`DELETE FROM background_default_assignments`).run();
  const countBeforeRestart = db1.prepare(`SELECT COUNT(*) as c FROM background_default_assignments`).get().c;
  assert.equal(countBeforeRestart, 0, 'Defaults successfully cleared by administrator');
  db1.close();

  // Reopen database (simulating server reboot)
  const db2 = new Database(durableDbPath);
  db2.pragma('foreign_keys = ON');

  // Run real production migration again
  migrateBackgroundDefaultAssignments(db2);

  // Verify count is STILL 0, not resurrected from is_default = 1
  const countAfterRestart = db2.prepare(`SELECT COUNT(*) as c FROM background_default_assignments`).get().c;
  assert.equal(countAfterRestart, 0, 'Defaults must remain cleared across restart and not resurrected');

  db2.close();
});

// ---------------------------------------------------------------------------
// 2. BackgroundLibraryPanel Source Guards & Real-File Defect Injection
// ---------------------------------------------------------------------------

test('SPEC-81-02: BackgroundLibraryPanel interface and dual badge/action wiring', () => {
  const src = readPanelSource();

  // 1. BackgroundImage interface declares defaultRoles?: string[]
  assert.match(
    src,
    /defaultRoles\?\s*:\s*string\[\]/,
    'BackgroundImage interface must declare defaultRoles?: string[]'
  );

  // 2. Dual badges rendered
  assert.match(
    src,
    /img\.defaultRoles\?\.includes\(['"]song_set['"]\)[\s\S]*?admin\.backgrounds\.songSetDefaultBadge/,
    'Must render song_set badge with songSetDefaultBadge'
  );
  assert.match(
    src,
    /img\.defaultRoles\?\.includes\(['"]general['"]\)[\s\S]*?admin\.backgrounds\.generalDefaultBadge/,
    'Must render general badge with generalDefaultBadge'
  );

  // 3. Dual action buttons rendered
  assert.match(
    src,
    /handleSetDefaultRole\(img,\s*['"]song_set['"]\)[\s\S]*?admin\.backgrounds\.setSongSetDefault/,
    'Must render song_set action with setSongSetDefault'
  );
  assert.match(
    src,
    /handleSetDefaultRole\(img,\s*['"]general['"]\)[\s\S]*?admin\.backgrounds\.setGeneralDefault/,
    'Must render general action with setGeneralDefault'
  );

  // 4. API endpoint path
  assert.match(
    src,
    /\/api\/admin\/background-defaults\/\$\{role\}/,
    'Must invoke PUT /api/admin/background-defaults/${role}'
  );
});

test('SPEC-81-02: Real-file defect injection proofs for BackgroundLibraryPanel absence guards (Finding 3)', () => {
  const originalSource = readPanelSource();

  function verifySource(source) {
    const hasSongBadge = /img\.defaultRoles\?\.includes\(['"]song_set['"]\)[\s\S]*?admin\.backgrounds\.songSetDefaultBadge/.test(source);
    const hasGenBadge = /img\.defaultRoles\?\.includes\(['"]general['"]\)[\s\S]*?admin\.backgrounds\.generalDefaultBadge/.test(source);
    const hasSongAction = /handleSetDefaultRole\(img,\s*['"]song_set['"]\)[\s\S]*?admin\.backgrounds\.setSongSetDefault/.test(source);
    const hasGenAction = /handleSetDefaultRole\(img,\s*['"]general['"]\)[\s\S]*?admin\.backgrounds\.setGeneralDefault/.test(source);
    const hasApiCall = /\/api\/admin\/background-defaults\/\$\{role\}/.test(source);

    return hasSongBadge && hasGenBadge && hasSongAction && hasGenAction && hasApiCall;
  }

  // Baseline on real disk file
  assert.equal(verifySource(readPanelSource()), true, 'Unmodified file on disk must pass all guards');

  // Real-file defect injections with guaranteed restoration
  const defects = [
    {
      name: 'Missing song_set badge',
      mutator: (s) => s.replace(/img\.defaultRoles\?\.includes\(['"]song_set['"]\)(?=[\s\S]*?admin\.backgrounds\.songSetDefaultBadge)/, 'false'),
    },
    {
      name: 'Missing general badge',
      mutator: (s) => s.replace(/img\.defaultRoles\?\.includes\(['"]general['"]\)(?=[\s\S]*?admin\.backgrounds\.generalDefaultBadge)/, 'false'),
    },
    {
      name: 'Missing song_set action',
      mutator: (s) => s.replace(/handleSetDefaultRole\(img,\s*['"]song_set['"]\)/, 'undefined'),
    },
    {
      name: 'Missing general action',
      mutator: (s) => s.replace(/handleSetDefaultRole\(img,\s*['"]general['"]\)/, 'undefined'),
    },
    {
      name: 'Missing background-defaults API path',
      mutator: (s) => s.replace(/\/api\/admin\/background-defaults\/\$\{role\}/, '/api/admin/corrupted-path'),
    },
  ];

  for (const { name, mutator } of defects) {
    const defectiveSource = mutator(originalSource);
    try {
      fs.writeFileSync(PANEL_PATH, defectiveSource, 'utf8');
      const diskSource = readPanelSource();
      assert.equal(verifySource(diskSource), false, `Real-file defect guard must detect: ${name}`);
    } finally {
      fs.writeFileSync(PANEL_PATH, originalSource, 'utf8');
    }
  }

  // Final verification that file on disk is strictly restored
  assert.equal(readPanelSource(), originalSource, 'Panel source must be completely restored after defect injection');
});
