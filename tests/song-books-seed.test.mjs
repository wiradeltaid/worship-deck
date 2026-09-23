/**
 * Tests for song_books bootstrap and migration (AD-17 / AD-21 / DEC-005).
 *
 * Covers:
 * - Fresh database: hymns and SDAH row both appear, with metadata from corpus and is_default = 1
 * - Existing database at data_version 10 with hymn marker stamped and no song_books row:
 *   migration 10->11 inserts it once and version reaches 11
 * - AD-17 case: database at data_version 11 where administrator deleted SDAH row —
 *   after boot, row is STILL absent (no resurrection)
 * - Another book is already is_default = 1: SDAH arrives with is_default = 0, other untouched
 * - Admin-edited SDAH row is never overwritten on boot
 * - Booting twice produces exactly 1 SDAH row and stamps version once
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'song-books-seed-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
delete process.env.IMAGE_URL_ALLOWLIST;
process.env.WPW_USE_SHIPPED_REGISTRY = '1';

const { getDb, bootstrap, upsertHymns, migrateSongBookRow, songBookBootstrapKey } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href
);
const { DATA_VERSION_KEY, CURRENT_DATA_VERSION } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'seed.ts')).href
);

const db = getDb();

test('fresh boot creates SDAH song_books row and hymns with corpus metadata and is_default = 1', () => {
  const row = db
    .prepare(
      `SELECT book_code, name, locale, licence, provenance, is_default
       FROM song_books
       WHERE book_code = 'SDAH'`
    )
    .get();

  assert.ok(row, 'SDAH row must exist in song_books');
  assert.equal(row.name, 'The Seventh-day Adventist Hymnal');
  assert.equal(row.locale, 'en');
  assert.match(row.licence, /An accepted risk recorded by the repository owner/);
  assert.match(row.provenance, /The Seventh-day Adventist Hymnal © 1985/);
  assert.equal(row.is_default, 1, 'first book must become default');

  const hymnCount = db
    .prepare(`SELECT COUNT(*) AS count FROM hymns WHERE book_code = 'SDAH'`)
    .get();
  assert.ok(hymnCount.count > 0, 'hymns must be seeded in same bootstrap transaction');

  const ver = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(DATA_VERSION_KEY);
  assert.equal(ver?.value, String(CURRENT_DATA_VERSION));
});

test('existing database at data_version 10 with marker stamped heals missing row via migration 10->11', () => {
  // Simulate an existing database at version 10 with marker stamped but empty song_books
  db.prepare(`DELETE FROM song_books`).run();
  db.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
  ).run(songBookBootstrapKey('SDAH'), '1');
  db.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
  ).run(DATA_VERSION_KEY, '10');

  const before = db.prepare(`SELECT COUNT(*) AS count FROM song_books`).get();
  assert.equal(before.count, 0);

  // Run migration 10->11
  migrateSongBookRow(db);

  const after = db
    .prepare(
      `SELECT book_code, name, locale, licence, provenance, is_default
       FROM song_books
       WHERE book_code = 'SDAH'`
    )
    .get();

  assert.ok(after, 'SDAH row must appear via migration 10->11');
  assert.equal(after.name, 'The Seventh-day Adventist Hymnal');
  assert.equal(after.locale, 'en');
  assert.equal(after.is_default, 1);

  const ver = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(DATA_VERSION_KEY);
  assert.equal(ver?.value, '11');
});

test('AD-17: deleted SDAH row stays absent on subsequent boot at data_version 11', () => {
  const ad17Tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'song-books-ad17-'));
  const ad17DbPath = path.join(ad17Tmp, 'ad17_deletion.db');
  const ad17Db = new Database(ad17DbPath);

  try {
    // 1. Boot fresh database through the bootstrap function
    bootstrap(ad17Db);

    const initialRow = ad17Db
      .prepare(`SELECT book_code FROM song_books WHERE book_code = 'SDAH'`)
      .get();
    assert.ok(initialRow, 'SDAH row must exist after first boot');

    const ver = ad17Db
      .prepare(`SELECT value FROM settings WHERE key = ?`)
      .get(DATA_VERSION_KEY);
    assert.equal(ver?.value, String(CURRENT_DATA_VERSION), 'expected data_version after first boot');

    // 2. Administrator deliberately deletes SDAH row
    ad17Db.prepare(`DELETE FROM song_books WHERE book_code = 'SDAH'`).run();

    // 3. Boot the same handle again through the bootstrap function
    bootstrap(ad17Db);

    // 4. Assert the row is still absent
    const after = ad17Db
      .prepare(`SELECT COUNT(*) AS count FROM song_books WHERE book_code = 'SDAH'`)
      .get();
    assert.equal(after.count, 0, 'AD-17: deleted SDAH row must NOT be resurrected on boot');
  } finally {
    ad17Db.close();
  }
});

test('when another book is already default, SDAH arrives with is_default = 0', () => {
  db.prepare(`DELETE FROM song_books`).run();
  db.prepare(`
    INSERT INTO song_books (book_code, name, locale, licence, provenance, is_default, updated_at)
    VALUES ('OTHER', 'Other Book', 'en', 'lic', 'prov', 1, '2026-08-20T00:00:00.000Z')
  `).run();

  // Clear marker and version so bootstrap / migration runs
  db.prepare(`DELETE FROM settings WHERE key = ?`).run(songBookBootstrapKey('SDAH'));
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, '10')`).run(DATA_VERSION_KEY);

  migrateSongBookRow(db);

  const sdah = db
    .prepare(`SELECT is_default FROM song_books WHERE book_code = 'SDAH'`)
    .get();
  const other = db
    .prepare(`SELECT is_default FROM song_books WHERE book_code = 'OTHER'`)
    .get();

  assert.equal(sdah?.is_default, 0, 'SDAH must not take over default if one already exists');
  assert.equal(other?.is_default, 1, 'Existing default must remain untouched');

  const totalDefaults = db
    .prepare(`SELECT COUNT(*) AS count FROM song_books WHERE is_default = 1`)
    .get();
  assert.equal(totalDefaults.count, 1, 'Exactly one default must exist');
});

test('an administrator-edited SDAH row is not overwritten on next boot', () => {
  db.prepare(`
    INSERT OR REPLACE INTO song_books (book_code, name, locale, licence, provenance, is_default, updated_at)
    VALUES ('SDAH', 'Admin Custom Title', 'en', 'Custom Licence', 'prov', 1, '2026-08-20T00:00:00.000Z')
  `).run();

  // Run bootstrap & migration
  upsertHymns(db);
  migrateSongBookRow(db);

  const row = db
    .prepare(`SELECT name, licence FROM song_books WHERE book_code = 'SDAH'`)
    .get();

  assert.equal(row?.name, 'Admin Custom Title');
  assert.equal(row?.licence, 'Custom Licence');
});

test('booting / migrating twice produces exactly one SDAH row', () => {
  migrateSongBookRow(db);
  migrateSongBookRow(db);

  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM song_books WHERE book_code = 'SDAH'`)
    .get();

  assert.equal(row?.count, 1, 'Exactly one SDAH row must exist');
});
