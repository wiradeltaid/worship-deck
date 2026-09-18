/**
 * SPEC-42: Deck Sequence Song Set Deletion and Master Data Decoupling Assurance
 * Smoke Test & Absence Guard Suite
 *
 * SPEC-42-01 Verification:
 * - Delete button in ArtifactEditor rendered uniformly for all items without baseType suppression
 * - Confirmation warning uses distinct reassuring copy for song-set-entry (clean vs dirty)
 * - Main spine deletion never invokes song-set-entries master data endpoints
 *
 * SPEC-42-02 Verification:
 * - Master data decoupling: deleting template leaves song_set_entries strictly invariant
 * - Multi-instance resilience: deleting one song set instance leaves duplicate instances intact
 * - Executable absence guards with defect-injection proofs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Set up temporary database for testing
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-spec-42-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.WPW_USE_SHIPPED_REGISTRY = '1';

const { getDb } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href
);

const { deleteArtifactTemplate } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'store.ts')).href
);

const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
assert.ok(fs.existsSync(editorPath), 'ArtifactEditor.tsx must exist');
const editorCode = fs.readFileSync(editorPath, 'utf8');

test('SPEC-42-01: 1. ArtifactEditor exposes per-row delete button for all items without song-set-entry suppression', () => {
  // Verify that the per-row delete button is NOT wrapped in a conditional suppressing song-set-entry
  assert.ok(
    !editorCode.includes("item.baseType === 'song-set-entry' ? null"),
    'ArtifactEditor must not suppress the delete button for song-set-entry slides'
  );

  // Verify informative confirmation copy is used when deleting song-set-entry
  assert.ok(
    editorCode.includes("item?.baseType === 'song-set-entry'"),
    'handleDeleteSelectedTemplates must check for song-set-entry to show master data reassurance'
  );
  assert.ok(
    editorCode.includes("t('admin.artifacts.confirmDeleteSongSet')"),
    'Must use admin.artifacts.confirmDeleteSongSet for clean song set slides'
  );
  assert.ok(
    editorCode.includes("t('admin.artifacts.confirmDeleteSongSetDirty')"),
    'Must use admin.artifacts.confirmDeleteSongSetDirty for dirty song set slides'
  );
});

test('SPEC-42-02: 1. Master data decoupling: deleting template leaves song_set_entries strictly invariant', () => {
  const db = getDb();
  const now = new Date().toISOString();

  // Create master song set entry
  const vn = 'smoke_test_song_set';
  const masterRes = db
    .prepare(
      `INSERT INTO song_set_entries (variable_name, title, position, updated_at) VALUES (?, ?, 10, ?)`
    )
    .run(vn, 'Test Song Set Decoupling', now);
  const masterId = Number(masterRes.lastInsertRowid);

  // Snapshot master record before template deletion
  const snap = db.prepare(`SELECT variable_name, title, position, updated_at FROM song_set_entries WHERE id = ?`).get(masterId);

  // Insert deck sequence template referencing this song set
  const tmplId = 'deck-slide-song-set-1';
  db.prepare(
    `INSERT INTO artifact_templates (id, label, base_type, variable_name, position, updated_at)
     VALUES (?, 'Test Song Set Slide', 'song-set-entry', ?, 95, ?)`
  ).run(tmplId, vn, now);

  try {
    // Delete the template from the deck sequence
    const survivors = deleteArtifactTemplate(db, tmplId, now);
    assert.ok(Array.isArray(survivors), 'deleteArtifactTemplate must succeed and return survivors');

    // Template row is gone from artifact_templates
    const tmplRow = db.prepare(`SELECT id FROM artifact_templates WHERE id = ?`).get(tmplId);
    assert.equal(tmplRow, undefined, 'Template must be deleted from artifact_templates');

    // Master record in song_set_entries must remain 100% strictly invariant (zero mutation)
    const post = db.prepare(`SELECT variable_name, title, position, updated_at FROM song_set_entries WHERE id = ?`).get(masterId);
    assert.ok(post, 'Master song set entry must survive template deletion');
    assert.equal(post.variable_name, snap.variable_name);
    assert.equal(post.title, snap.title);
    assert.equal(post.position, snap.position);
    assert.equal(post.updated_at, snap.updated_at);
  } finally {
    db.prepare(`DELETE FROM artifact_templates WHERE id = ?`).run(tmplId);
    db.prepare(`DELETE FROM song_set_entries WHERE id = ?`).run(masterId);
  }
});

test('SPEC-42-02: 2. Multi-instance resilience: deleting one song set instance leaves duplicate instances intact', () => {
  const db = getDb();
  const now = new Date().toISOString();

  const vn = 'multi_inst_song_set';
  db.prepare(`INSERT INTO song_set_entries (variable_name, title, position, updated_at) VALUES (?, ?, 12, ?)`).run(vn, 'Multi Instance Song Set', now);

  const inst1Id = 'inst-slide-1';
  const inst2Id = 'inst-slide-2';
  db.prepare(`INSERT INTO artifact_templates (id, label, base_type, variable_name, position, updated_at) VALUES (?, 'Instance 1', 'song-set-entry', ?, 80, ?)`).run(inst1Id, vn, now);
  db.prepare(`INSERT INTO artifact_templates (id, label, base_type, variable_name, position, updated_at) VALUES (?, 'Instance 2', 'song-set-entry', ?, 81, ?)`).run(inst2Id, vn, now);

  try {
    // Delete instance 1
    const delSurvivors = deleteArtifactTemplate(db, inst1Id, now);
    assert.ok(Array.isArray(delSurvivors));

    // Verify instance 1 deleted, instance 2 still exists
    const r1 = db.prepare(`SELECT id FROM artifact_templates WHERE id = ?`).get(inst1Id);
    const r2 = db.prepare(`SELECT id FROM artifact_templates WHERE id = ?`).get(inst2Id);
    assert.equal(r1, undefined, 'Instance 1 must be deleted');
    assert.ok(r2, 'Instance 2 must remain in deck sequence');

    // Master record is still intact
    const master = db.prepare(`SELECT variable_name FROM song_set_entries WHERE variable_name = ?`).get(vn);
    assert.ok(master, 'Master data must remain intact');
  } finally {
    db.prepare(`DELETE FROM artifact_templates WHERE id IN (?, ?)`).run(inst1Id, inst2Id);
    db.prepare(`DELETE FROM song_set_entries WHERE variable_name = ?`).run(vn);
  }
});

test('SPEC-42-02: 3. Executable absence guard & defect-injection proof for unconditional delete button', () => {
  function verifyUnconditionalDelete(source) {
    // Assert no baseType suppression of delete button (ternary, &&, or conditional)
    assert.ok(
      !/item\.baseType\s*===\s*['"]song-set-entry['"]\s*\?\s*null/.test(source),
      'Delete button must not be suppressed for song-set-entry via ternary null'
    );
    assert.ok(
      !/item\.baseType\s*!==\s*['"]song-set-entry['"]\s*&&/.test(source),
      'Delete button must not be guarded by item.baseType !== song-set-entry'
    );
    // Find the delete button block in the template list
    const btnBlockMatch = source.match(/<Button[^>]*title=\{t\('admin\.artifacts\.delete'\)\}[^>]*>[\s\S]*?<\/Button>/);
    assert.ok(btnBlockMatch, 'Must render delete Button invoking handleDeleteTemplate(item)');
    const btnBlock = btnBlockMatch[0];
    assert.ok(!btnBlock.includes('baseType'), 'Delete button block must not contain baseType conditionals');
  }

  assert.doesNotThrow(() => verifyUnconditionalDelete(editorCode));

  // Defect injection 1: ternary suppression
  const defect1 = editorCode.replace(
    'void handleDeleteTemplate(item);',
    "void handleDeleteTemplate(item);\nitem.baseType === 'song-set-entry' ? null : null"
  );
  assert.throws(
    () => verifyUnconditionalDelete(defect1),
    /Delete button must not be suppressed for song-set-entry via ternary null/
  );

  // Defect injection 2: guard condition in delete button block
  const defect2 = editorCode.replace(
    'void handleDeleteTemplate(item);',
    "if (item.baseType !== 'song-set-entry') void handleDeleteTemplate(item);"
  );
  assert.throws(
    () => verifyUnconditionalDelete(defect2),
    /Delete button block must not contain baseType conditionals/
  );
});
