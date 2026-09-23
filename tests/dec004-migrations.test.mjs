/**
 * DEC-004 data migrations (data_version 3 → 4 → 5) — fresh-boot assertions.
 *
 * Proves a fresh boot lands at data_version 5 and the migrated shape is
 * what the rest of the registry code expects (AD-33 invariant, S1 mapping).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dec004-migrations-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
delete process.env.IMAGE_URL_ALLOWLIST;
process.env.WPW_USE_SHIPPED_REGISTRY = '1';

const { getDb } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href
);
const { DATA_VERSION_KEY, CURRENT_DATA_VERSION, loadSeedTemplates } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'seed.ts')).href
);

const OLD_KEYS = new Set([
  'date',
  'reference',
  'text',
  'performer',
  'title',
  'speaker',
  'imageUrl',
  'person',
  'familyText',
  'youthText',
  'familyPhoto',
  'youthPhoto',
]);

test('fresh boot reaches data_version 11', () => {
  const db = getDb();
  const row = db
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(DATA_VERSION_KEY);
  assert.equal(row?.value, String(CURRENT_DATA_VERSION));
  assert.equal(CURRENT_DATA_VERSION, 12);
});

test('fresh boot leaves no song_set_inputs rows (nothing to backfill)', () => {
  const db = getDb();
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM song_set_inputs`)
    .get();
  assert.equal(row.n, 0, 'a fresh install has no services to backfill from');
});

test('after migration, no artifact_templates row has base_type "song-set"', () => {
  const db = getDb();
  const remaining = db
    .prepare(
      `SELECT COUNT(*) AS n FROM artifact_templates WHERE base_type = 'song-set'`
    )
    .get();
  assert.equal(remaining.n, 0, 'all five shipped song-set rows must be gone');
});

test('seed verse-reading payload uses scripture_reference / scripture_text, not old placeholderKey', () => {
  const db = getDb();
  const row = db
    .prepare(`SELECT payload FROM artifact_templates WHERE id = 'verse-reading'`)
    .get();
  assert.ok(row?.payload, 'verse-reading row must exist after migration');
  const tmpl = JSON.parse(row.payload);
  const layout = tmpl.layouts.default;
  const elements = layout.elements;
  const hasOldKey = elements.some(
    (el) => el.placeholderKey === 'reference' || el.placeholderKey === 'text'
  );
  assert.equal(hasOldKey, false, 'verse-reading must have no old placeholderKey');
  const hasNewKey = elements.some(
    (el) =>
      el.placeholderKey === 'scripture_reference' ||
      el.placeholderKey === 'scripture_text' ||
      (typeof el.content === 'string' &&
        (el.content.includes('{scripture_reference}') ||
          el.content.includes('{scripture_text}')))
  );
  assert.ok(hasNewKey, 'verse-reading must bind scripture_reference / scripture_text');
});

test('song_set_layouts has exactly 3 rows after migration', () => {
  const db = getDb();
  const rows = db
    .prepare(`SELECT role FROM song_set_layouts ORDER BY role`)
    .all();
  assert.equal(rows.length, 3, 'exactly 3 song_set_layouts rows must exist');
  assert.deepEqual(
    rows.map((r) => r.role).sort(),
    ['reff', 'title', 'verse']
  );
});

test('four default song-set entries carry the DEC-004 S2 variable_names', () => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, variable_name FROM artifact_templates
        WHERE id IN ('bt-opening-song','bt-closing-song','ds-opening-song','ds-closing-song')`
    )
    .all();
  assert.equal(rows.length, 4);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r.variable_name]));
  assert.equal(byId['bt-opening-song'], 'opening_song_bt');
  assert.equal(byId['bt-closing-song'], 'closing_song_bt');
  assert.equal(byId['ds-opening-song'], 'opening_song_dw');
  assert.equal(byId['ds-closing-song'], 'closing_song_dw');
});

test('the generic song-set row is deleted (dsMiddle loop retired)', () => {
  const db = getDb();
  const row = db
    .prepare(`SELECT id FROM artifact_templates WHERE id = 'song-set'`)
    .get();
  assert.equal(row, undefined);
});

test('the shipped seed loads with the new vocabulary (no old keys left in placeholders)', () => {
  const templates = loadSeedTemplates();
  for (const t of templates) {
    for (const ph of t.placeholders ?? []) {
      assert.ok(
        !OLD_KEYS.has(ph.key),
        `${t.id}.placeholders[${ph.key}] still uses an old key`
      );
    }
  }
});
