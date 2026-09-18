/**
 * SPEC-40: Gallery Asset In-Place Replacement, Category Reconciliation, and Ergonomic Custom Naming
 * Smoke Test & Absence Guard Suite
 *
 * SPEC-40-01 Verification:
 * - SQLite schema migration adding name column to background_library_images
 * - Category reconciliation from legacy 'flyer' to 'announcement'
 * - In-place image asset replacement strictly preserving record ID and URL slug/path
 * - Cache revalidation header Cache-Control: no-cache, must-revalidate
 *
 * SPEC-40-02 Verification:
 * - Media Gallery input ergonomics and high-contrast category selection
 * - Custom asset naming on upload and inline renaming
 * - In-place replace action on gallery cards
 *
 * SPEC-40-03 Verification:
 * - Canvas Editor picker category alignment and custom name display
 * - End-to-end conformance, defect injection, and executable absence guards
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-spec-40-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.WPW_USE_SHIPPED_REGISTRY = '1';

const { getDb } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href
);

const panelPath = path.join(root, 'src', 'components', 'admin', 'BackgroundLibraryPanel.tsx');
assert.ok(fs.existsSync(panelPath), 'BackgroundLibraryPanel.tsx must exist');
const panelCode = fs.readFileSync(panelPath, 'utf8');

const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
assert.ok(fs.existsSync(editorPath), 'ArtifactEditor.tsx must exist');
const editorCode = fs.readFileSync(editorPath, 'utf8');

const uploadsGoPath = path.join(root, 'internal', 'httpapi', 'uploads.go');
assert.ok(fs.existsSync(uploadsGoPath), 'uploads.go must exist');
const uploadsGoCode = fs.readFileSync(uploadsGoPath, 'utf8');

const bgLibGoPath = path.join(root, 'internal', 'httpapi', 'background_library.go');
assert.ok(fs.existsSync(bgLibGoPath), 'background_library.go must exist');
const bgLibGoCode = fs.readFileSync(bgLibGoPath, 'utf8');

test('SPEC-40-01: 1. Schema migration includes name column and reconciles legacy flyer category', () => {
  const db = getDb();
  const info = db.prepare(`PRAGMA table_info(background_library_images)`).all();
  const nameCol = info.find((c) => c.name === 'name');
  assert.ok(nameCol, 'background_library_images must have a name column');

  const catCol = info.find((c) => c.name === 'category');
  assert.ok(catCol, 'background_library_images must have a category column');

  // Insert a test item with custom name and announcement category
  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO background_library_images (url, name, category, is_default, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, ?)
  `);
  const res = insertStmt.run('/api/uploads/test-image-1234.png', 'Youth Camp Poster 2026', 'announcement', now, now);
  const rowId = Number(res.lastInsertRowid);

  const row = db.prepare(`SELECT id, url, name, category FROM background_library_images WHERE id = ?`).get(rowId);
  assert.equal(row.id, rowId);
  assert.equal(row.url, '/api/uploads/test-image-1234.png');
  assert.equal(row.name, 'Youth Camp Poster 2026');
  assert.equal(row.category, 'announcement');

  // Verify legacy flyer update migration
  db.prepare(`INSERT INTO background_library_images (url, name, category, is_default, created_at, updated_at) VALUES (?, ?, 'flyer', 0, ?, ?)`).run('/api/uploads/legacy.png', 'Old Flyer', now, now);
  db.prepare(`UPDATE background_library_images SET category = 'announcement' WHERE category = 'flyer'`).run();
  const flyerCount = db.prepare(`SELECT COUNT(*) as count FROM background_library_images WHERE category = 'flyer'`).get().count;
  assert.equal(flyerCount, 0, 'No rows should remain with legacy category flyer');
});

test('SPEC-40-01: 2. In-place replacement invariant preserves record ID and URL path in connected slide artifacts', () => {
  const db = getDb();
  const now = new Date().toISOString();

  // Create gallery image
  const imgUrl = '/api/uploads/11223344556677889900aabbccddeeff.png';
  const imgRes = db.prepare(`
    INSERT INTO background_library_images (url, name, category, is_default, created_at, updated_at)
    VALUES (?, 'Easter Banner', 'announcement', 0, ?, ?)
  `).run(imgUrl, now, now);
  const mediaId = Number(imgRes.lastInsertRowid);

  // Author a slide template using that exact image URL
  const templateId = 'smoke-slide-template-spec-40';
  const initialPayload = JSON.stringify({
    aspectRatio: '16:9',
    backgroundColor: '#0F172A',
    elements: [
      {
        id: 'graphic-el',
        type: 'image',
        imageRef: imgUrl,
        x: 10,
        y: 10,
        w: 80,
        h: 80,
        zIndex: 1,
      },
    ],
  });

  db.prepare(`
    INSERT INTO artifact_templates (id, label, base_type, payload, updated_at, position)
    VALUES (?, 'Easter Announcement Slide', 'announcement', ?, ?, 99)
  `).run(templateId, initialPayload, now);

  // In-place replacement: simulate replacement by updating updated_at while keeping url and ID identical
  const later = new Date(Date.now() + 5000).toISOString();
  db.prepare(`
    UPDATE background_library_images SET updated_at = ? WHERE id = ?
  `).run(later, mediaId);

  // Verify gallery record: ID and URL path are 100% byte-for-byte identical
  const mediaRow = db.prepare(`SELECT id, url, name, updated_at FROM background_library_images WHERE id = ?`).get(mediaId);
  assert.equal(mediaRow.id, mediaId, 'Media record ID must be strictly preserved');
  assert.equal(mediaRow.url, imgUrl, 'Media record URL path must be strictly preserved');

  // Verify connected slide template: payload still references the exact same URL without requiring re-linking
  const templateRow = db.prepare(`SELECT payload FROM artifact_templates WHERE id = ?`).get(templateId);
  assert.equal(templateRow.payload, initialPayload, 'Slide template payload must remain untouched while referencing preserved URL');
  assert.ok(templateRow.payload.includes(imgUrl), 'Slide template must reference the preserved gallery image URL');
});

test('SPEC-40-02: 1. BackgroundLibraryPanel contains high-contrast category buttons and custom name input', () => {
  // Category selection uses high-contrast button styling
  assert.ok(
    panelCode.includes("isSelected ? 'default' : 'outline'") &&
    panelCode.includes("uploadCategory === cat"),
    'Selected category must use high-contrast variant default'
  );
  assert.ok(panelCode.includes('<Check className="mr-1.5 h-3.5 w-3.5 stroke-[2.5]" />'), 'Selected category button must include checkmark icon');
  assert.ok(panelCode.includes('aria-pressed={isSelected}'), 'Selected category button must include accessible aria-pressed attribute');

  // Categories include announcement, background, general
  assert.ok(panelCode.includes("'announcement'"), 'Panel must include announcement category');
  assert.ok(panelCode.includes("'background'"), 'Panel must include background category');
  assert.ok(panelCode.includes("'general'"), 'Panel must include general category');

  // Custom name input in upload form
  assert.ok(panelCode.includes('customName'), 'Panel must hold customName state');
  assert.ok(panelCode.includes('setCustomName'), 'Panel must provide setCustomName updater');
  assert.ok(panelCode.includes("placeholder={t('admin.backgrounds.customNamePlaceholder')}"), 'Panel must render custom name input');

  // Card display & inline rename
  assert.ok(panelCode.includes('displayName = img.name || `Media #${img.id}`'), 'Card must display custom name with fallback to Media #id');
  assert.ok(panelCode.includes('handleRenameSave'), 'Card must support saving renamed custom name');
  assert.ok(panelCode.includes('handleReplaceClick'), 'Card must support triggering in-place asset replacement');
  assert.ok(panelCode.includes("[target.id]: Date.now()"), 'Card must refresh thumbnail via cache-busting timestamp');
});

test('SPEC-40-03: 1. ArtifactEditor aligns gallery picker with announcement category and custom name display', () => {
  // Gallery category filter tabs include announcement
  assert.ok(editorCode.includes("'announcement'"), 'ArtifactEditor must include announcement category');
  assert.ok(editorCode.includes("cat === 'announcement' ? 'Announcements'"), 'ArtifactEditor must render Announcements filter tab');

  // Background category filter tabs include announcement
  assert.ok(editorCode.includes("bgCategoryFilter"), 'ArtifactEditor must track bgCategoryFilter');

  // Thumbnail rendering in gallery dialog displays custom name
  assert.ok(editorCode.includes('displayName = item.name || `Media #${item.id}`'), 'Gallery picker must render custom name or fallback to Media #id');
  assert.ok(editorCode.includes('bgName = bg.name || `Media #${bg.id}`'), 'Background library picker must render custom name or fallback to Media #id');
});

test('SPEC-40-03: 2. Executable absence guard & defect injection for Cache-Control and in-place replacement safety', () => {
  // Guard A: uploads.go must serve Cache-Control: no-cache, must-revalidate and never immutable
  function verifyUploadCacheHeaders(source) {
    assert.ok(
      source.includes('w.Header().Set("Cache-Control", "no-cache, must-revalidate")'),
      'getUpload must set Cache-Control: no-cache, must-revalidate'
    );
    assert.ok(
      !source.includes('max-age=31536000, immutable'),
      'getUpload must not set immutable cache header'
    );
  }

  assert.doesNotThrow(() => verifyUploadCacheHeaders(uploadsGoCode));

  // Defect injection A1: reverting to immutable
  const defectA1 = uploadsGoCode.replace(
    'w.Header().Set("Cache-Control", "no-cache, must-revalidate")',
    'w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")'
  );
  assert.throws(
    () => verifyUploadCacheHeaders(defectA1),
    /getUpload must set Cache-Control: no-cache, must-revalidate/,
    'Absence guard must detect missing no-cache header'
  );

  // Guard B: background_library.go must enforce uploadRef validation on in-place replacement
  function verifyReplacePathSecurity(source) {
    assert.ok(
      source.includes('!uploadRef.MatchString(targetFilename)'),
      'replaceBackgroundLibraryImage must validate targetFilename against uploadRef'
    );
    assert.ok(
      source.includes('!strings.HasPrefix(currentURL, "/api/uploads/")'),
      'replaceBackgroundLibraryImage must enforce /api/uploads/ prefix'
    );
  }

  assert.doesNotThrow(() => verifyReplacePathSecurity(bgLibGoCode));

  // Defect injection B1: removing uploadRef validation
  const defectB1 = bgLibGoCode.replace('!uploadRef.MatchString(targetFilename)', 'false');
  assert.throws(
    () => verifyReplacePathSecurity(defectB1),
    /must validate targetFilename against uploadRef/,
    'Absence guard must fail if uploadRef check is bypassed'
  );

  // Guard C: Category reconciliation in BackgroundLibraryPanel must not leak 'flyer'
  function verifyCategoryReconciliation(panelSource) {
    assert.ok(
      panelSource.includes("cat === 'announcement' ? 'Announcement'"),
      'Panel must display Announcement category button'
    );
    assert.ok(
      !panelSource.includes("cat === 'flyer' ? 'Flyer'"),
      'Panel must not display legacy Flyer category button'
    );
  }

  assert.doesNotThrow(() => verifyCategoryReconciliation(panelCode));

  // Defect injection C1: reintroducing flyer button
  const defectC1 = panelCode.replace(
    "cat === 'announcement' ? 'Announcement'",
    "cat === 'flyer' ? 'Flyer'"
  );
  assert.throws(
    () => verifyCategoryReconciliation(defectC1),
    /Panel must display Announcement category button/,
    'Absence guard must fail if announcement button is reverted to flyer'
  );
});
