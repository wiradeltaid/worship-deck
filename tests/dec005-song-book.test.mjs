/**
 * DEC-005 / AD-36 — song-book bootstrap-once semantics.
 *
 * Proves the write-discipline change around `hymns`: the corpus file seeds a
 * book exactly once (marker-gated, insert-only-if-absent), an existing
 * install's rows are never overwritten or resurrected by a boot, and the
 * 5→6 migration stamps markers for books already present. The save-to-book
 * route that ships in the same data_version step is covered by
 * `tests/save-to-book-go-http.test.mjs`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dec005-song-book-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
delete process.env.IMAGE_URL_ALLOWLIST;
process.env.WPW_USE_SHIPPED_REGISTRY = '1';

const { getDb, upsertHymns, migrateSongBookBootstrapDec005, songBookBootstrapKey } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href
);
const { DATA_VERSION_KEY, CURRENT_DATA_VERSION } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'seed.ts')).href
);

const db = getDb();

function hymnCount() {
  return db.prepare(`SELECT COUNT(*) AS n FROM hymns`).get().n;
}

test('fresh boot reaches data_version 11 with the SDAH book bootstrapped', () => {
  const row = db
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(DATA_VERSION_KEY);
  assert.equal(row?.value, String(CURRENT_DATA_VERSION));
  assert.equal(CURRENT_DATA_VERSION, 12);
  const marker = db
    .prepare(`SELECT 1 AS ok FROM settings WHERE key = ?`)
    .get(songBookBootstrapKey('SDAH'));
  assert.ok(marker, 'SDAH bootstrap marker must be stamped after first seed');
  assert.ok(hymnCount() > 0, 'corpus file must have seeded hymn rows');
});

test('a boot never overwrites an edited lyric once the book is bootstrapped', () => {
  db.prepare(
    `UPDATE hymns SET lyrics = 'operator corrected text' WHERE book_code = 'SDAH' AND number = 1`
  ).run();
  upsertHymns(db);
  const row = db
    .prepare(`SELECT lyrics FROM hymns WHERE book_code = 'SDAH' AND number = 1`)
    .get();
  assert.equal(row.lyrics, 'operator corrected text');
});

test('a boot never resurrects a deleted hymn once the book is bootstrapped', () => {
  const before = hymnCount();
  db.prepare(`DELETE FROM hymns WHERE book_code = 'SDAH' AND number = 2`).run();
  upsertHymns(db);
  assert.equal(hymnCount(), before - 1, 'gap must stay a gap after bootstrap');
});

test('an un-bootstrapped book seeds from zero exactly once, gaps included', () => {
  // Simulate a database that has never seen the corpus: no marker, no rows.
  db.prepare(`DELETE FROM settings WHERE key = ?`).run(
    songBookBootstrapKey('SDAH')
  );
  const before = hymnCount();
  db.prepare(`DELETE FROM hymns WHERE book_code = 'SDAH' AND number = 3`).run();
  upsertHymns(db);
  const marker = db
    .prepare(`SELECT 1 AS ok FROM settings WHERE key = ?`)
    .get(songBookBootstrapKey('SDAH'));
  assert.ok(marker, 'bootstrap must stamp its marker');
  assert.equal(hymnCount(), before + 1, 'bootstrap fills the gap exactly once');
  // And a second pass changes nothing further.
  db.prepare(`DELETE FROM hymns WHERE book_code = 'SDAH' AND number = 4`).run();
  upsertHymns(db);
  assert.equal(
    hymnCount(),
    before,
    'post-bootstrap boots must not refill gaps'
  );
});

test('the 5→6 migration stamps markers for books already present and bumps the counter', () => {
  // Simulate a pre-6 database: version back to 5, markers cleared. The
  // migration must re-stamp a marker per present book and land on 6.
  db.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('data_version', '5')`
  ).run();
  db.prepare(`DELETE FROM settings WHERE key LIKE 'song_book_bootstrapped_%'`).run();
  const codesBefore = db
    .prepare(`SELECT DISTINCT book_code FROM hymns ORDER BY book_code`)
    .all()
    .map((r) => r.book_code);
  assert.ok(codesBefore.length > 0, 'precondition: at least one book present');

  migrateSongBookBootstrapDec005(db);

  for (const c of codesBefore) {
    const marker = db
      .prepare(`SELECT 1 AS ok FROM settings WHERE key = ?`)
      .get(songBookBootstrapKey(c));
    assert.ok(marker, `marker for ${c} must exist after migration`);
  }
  const version = db
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(DATA_VERSION_KEY);
  assert.equal(version.value, '6');
});

test('the 8→9 migration adds metadata columns, backfills locale and bumps version', async () => {
  const { migrateSongBookMetadata } = await import(
    pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href
  );

  const fixturePath = path.join(root, 'data', 'song-book', 'test_locale_fixture.json');
  fs.writeFileSync(
    fixturePath,
    JSON.stringify({
      book: {
        code: 'TEST_LOCALE_FIXTURE',
        name: 'Test Locale Fixture',
        locale: 'id-ID',
      },
    })
  );

  try {
    // Simulate v8 database: version at 8, NULL locale on a test book and fixture book
    db.prepare(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('data_version', '8')`
    ).run();
    db.prepare(
      `INSERT OR REPLACE INTO song_books (book_code, name, locale, is_default, updated_at) VALUES ('TEST_V8', 'Test V8', NULL, 0, '2026-08-20T00:00:00Z')`
    ).run();
    db.prepare(
      `INSERT OR REPLACE INTO song_books (book_code, name, locale, is_default, updated_at) VALUES ('TEST_LOCALE_FIXTURE', 'Test Locale Fixture', NULL, 0, '2026-08-20T00:00:00Z')`
    ).run();

    migrateSongBookMetadata(db);

    const ver = db
      .prepare(`SELECT value FROM settings WHERE key = ?`)
      .get(DATA_VERSION_KEY);
    assert.equal(ver.value, '9');

    const rowV8 = db
      .prepare(`SELECT locale FROM song_books WHERE book_code = 'TEST_V8'`)
      .get();
    assert.equal(rowV8?.locale, 'en', 'fallback without corpus must default to en');

    const rowFixture = db
      .prepare(`SELECT locale FROM song_books WHERE book_code = 'TEST_LOCALE_FIXTURE'`)
      .get();
    assert.equal(
      rowFixture?.locale,
      'id-ID',
      'locale must be backfilled from corpus file rather than fallback en'
    );

    // Idempotency: second call does not fail
    migrateSongBookMetadata(db);
  } finally {
    if (fs.existsSync(fixturePath)) {
      fs.unlinkSync(fixturePath);
    }
  }
});

test('the 5→6 migration is a no-op once data_version has reached 6', () => {
  db.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('data_version', '6')`
  ).run();
  db.prepare(`DELETE FROM settings WHERE key LIKE 'song_book_bootstrapped_%'`).run();
  migrateSongBookBootstrapDec005(db);
  const markers = db
    .prepare(`SELECT COUNT(*) AS n FROM settings WHERE key LIKE 'song_book_bootstrapped_%'`)
    .get();
  assert.equal(markers.n, 0, 'migration must not run again at version 6');
});

test('migration ladder does not downgrade or re-run when data_version reaches 10', async () => {
  const { migrateSongBookMetadata } = await import(
    pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href
  );
  db.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('data_version', '10')`
  ).run();

  migrateSongBookMetadata(db);

  const ver = db
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(DATA_VERSION_KEY);
  assert.equal(ver.value, '10', 'version 10 must not be downgraded by 8->9 migration');
});

test('the 9→10 migration removes ON DELETE CASCADE from announcement_items and preserves rows', async () => {
  const { migrateAnnouncementItemsCascade } = await import(
    pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href
  );

  // Re-create table with cascade to simulate v9 state
  db.exec(`
    DROP TABLE IF EXISTS announcement_items;
    CREATE TABLE announcement_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_url TEXT NOT NULL,
      service_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
    );
    INSERT OR REPLACE INTO settings (key, value) VALUES ('data_version', '9');
  `);

  const svcRes = db.prepare(`INSERT INTO services (date, raw_payload) VALUES ('2026-08-22', 'raw')`).run();
  const svcId = svcRes.lastInsertRowid;

  db.prepare(`
    INSERT INTO announcement_items (id, image_url, service_id, sort_order, created_at, updated_at)
    VALUES (201, '/api/uploads/ts_flyer.png', ?, 1, '2026-08-20 12:00:00', '2026-08-20 12:05:00')
  `).run(svcId);

  migrateAnnouncementItemsCascade(db);

  const ver = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(DATA_VERSION_KEY);
  assert.equal(ver.value, '10');

  const row = db.prepare(`SELECT * FROM announcement_items WHERE id = 201`).get();
  assert.equal(row.image_url, '/api/uploads/ts_flyer.png');
  assert.equal(row.service_id, svcId);
  assert.equal(row.sort_order, 1);
  assert.equal(row.created_at, '2026-08-20 12:00:00');
  assert.equal(row.updated_at, '2026-08-20 12:05:00');

  // Deleting service must NOT delete announcement_items
  db.prepare(`DELETE FROM services WHERE id = ?`).run(svcId);
  const afterDelete = db.prepare(`SELECT * FROM announcement_items WHERE id = 201`).get();
  assert.ok(afterDelete, 'announcement_items row must survive service deletion');
  assert.equal(afterDelete.service_id, svcId);
});

test('the 9→10 migration repairs an already-stamped-10 database with FK intact', async () => {
  const { migrateAnnouncementItemsCascade } = await import(
    pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href
  );

  // Re-create table with cascade but stamped 10 (the production defect state)
  db.exec(`
    DROP TABLE IF EXISTS announcement_items;
    CREATE TABLE announcement_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_url TEXT NOT NULL,
      service_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
    );
    INSERT OR REPLACE INTO settings (key, value) VALUES ('data_version', '10');
  `);

  const svcRes = db.prepare(`INSERT INTO services (date, raw_payload) VALUES ('2026-08-22', 'raw')`).run();
  const svcId = svcRes.lastInsertRowid;

  db.prepare(`
    INSERT INTO announcement_items (id, image_url, service_id, sort_order, created_at, updated_at)
    VALUES (501, '/api/uploads/repaired_flyer.png', ?, 1, '2026-08-20 12:00:00', '2026-08-20 12:05:00')
  `).run(svcId);

  // Run migration
  migrateAnnouncementItemsCascade(db);

  // Assert FK is gone
  const fks = db.prepare(`PRAGMA foreign_key_list(announcement_items)`).all();
  const hasFK = fks.some((fk) => fk.from?.toLowerCase() === 'service_id');
  assert.equal(hasFK, false, 'FK on service_id must be removed even if version was already 10');

  // Deleting service must NOT delete announcement_items
  db.prepare(`DELETE FROM services WHERE id = ?`).run(svcId);
  const afterDelete = db.prepare(`SELECT * FROM announcement_items WHERE id = 501`).get();
  assert.ok(afterDelete, 'announcement_items row must survive service deletion after repair');
  assert.equal(afterDelete.service_id, svcId);
});
