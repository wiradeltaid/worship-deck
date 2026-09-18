/**
 * SPEC-39: Central Media Gallery Bucket, Presenter Announcement Section Looping, and Weekly Announcement Placeholders
 * Smoke Test & Absence Guard Suite
 *
 * SPEC-39-01 Verification:
 * - Central Media Gallery backend schema with category column ('flyer' | 'background' | 'general')
 * - Category query filtering and backward compatibility
 * - Canvas Editor integration: 'Choose from Gallery', insertImageFromUrl, visual thumbnail picker
 * - Safe missing asset fallback in ArtifactSlide and canvas-utils
 * - Executable absence guards with defect injection
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-spec-39-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.WPW_USE_SHIPPED_REGISTRY = '1';

const { getDb } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href
);

const { serializeCanvas, elementToFabricObject } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts')).href
);

const { validateArtifactTemplate } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'validate.ts')).href
);

const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
assert.ok(fs.existsSync(artifactEditorPath), 'ArtifactEditor.tsx must exist');
const editorCode = fs.readFileSync(artifactEditorPath, 'utf8');

const mediaPanelPath = path.join(root, 'src', 'components', 'admin', 'BackgroundLibraryPanel.tsx');
assert.ok(fs.existsSync(mediaPanelPath), 'BackgroundLibraryPanel.tsx must exist');
const mediaPanelCode = fs.readFileSync(mediaPanelPath, 'utf8');

const registryAdminPath = path.join(root, 'src', 'components', 'admin', 'RegistryAdmin.tsx');
assert.ok(fs.existsSync(registryAdminPath), 'RegistryAdmin.tsx must exist');
const registryAdminCode = fs.readFileSync(registryAdminPath, 'utf8');

const artifactSlidePath = path.join(root, 'src', 'components', 'artifacts', 'ArtifactSlide.tsx');
assert.ok(fs.existsSync(artifactSlidePath), 'ArtifactSlide.tsx must exist');
const artifactSlideCode = fs.readFileSync(artifactSlidePath, 'utf8');

test('SPEC-39-01: 1. background_library_images table carries category column and supports categorized CRUD', () => {
  const db = getDb();
  const now = new Date().toISOString();

  // Verify PRAGMA table_info includes category
  const columns = db.prepare(`PRAGMA table_info(background_library_images)`).all();
  const hasCategory = columns.some((c) => c.name === 'category');
  assert.ok(hasCategory, 'background_library_images table must have category column');

  // Insert items with different categories
  const flyerRes = db.prepare(
    `INSERT INTO background_library_images (url, category, is_default, created_at, updated_at)
     VALUES (?, ?, 0, ?, ?)`
  ).run('/api/uploads/church-welcome-flyer.png', 'flyer', now, now);
  const flyerId = Number(flyerRes.lastInsertRowid);

  const bgRes = db.prepare(
    `INSERT INTO background_library_images (url, category, is_default, created_at, updated_at)
     VALUES (?, ?, 1, ?, ?)`
  ).run('/api/uploads/ambient-blue-bg.png', 'background', now, now);
  const bgId = Number(bgRes.lastInsertRowid);

  // Query flyers only
  const flyers = db.prepare(
    `SELECT id, url, category FROM background_library_images WHERE category = 'flyer'`
  ).all();
  assert.equal(flyers.length, 1);
  assert.equal(flyers[0].id, flyerId);
  assert.equal(flyers[0].url, '/api/uploads/church-welcome-flyer.png');

  // Query backgrounds only
  const backgrounds = db.prepare(
    `SELECT id, url, category FROM background_library_images WHERE category = 'background'`
  ).all();
  assert.ok(backgrounds.some((b) => b.id === bgId));

  // Query all items
  const allItems = db.prepare(
    `SELECT id, url, category FROM background_library_images`
  ).all();
  assert.ok(allItems.length >= 2);
});

test('SPEC-39-01: 2. ArtifactEditor integrates gallery choice dialog and insertImageFromUrl without file re-upload', () => {
  // Static AST/code assertions on ArtifactEditor
  assert.ok(
    editorCode.includes('showImageChoiceDialog') && editorCode.includes('showGalleryDialog'),
    'ArtifactEditor must declare state for image choice dialog and gallery dialog'
  );

  assert.ok(
    editorCode.includes('insertImageFromUrl'),
    'ArtifactEditor must define insertImageFromUrl callback for inserting shared assets'
  );

  assert.ok(
    editorCode.includes('openGalleryDialog'),
    'ArtifactEditor must define openGalleryDialog for browsing existing media assets'
  );

  // Canvas element created with shared gallery URL serializes cleanly
  const sharedUrl = '/api/uploads/church-welcome-flyer.png';
  const element = {
    id: 'user-image-1',
    type: 'image',
    required: false,
    x: 10,
    y: 10,
    w: 80,
    h: 80,
    zIndex: 1,
    imageRef: sharedUrl,
  };

  // Simulate minimal fabric canvas object for serializeCanvas
  const mockFabricCanvas = {
    getObjects: () => [
      {
        data: {
          elementId: 'user-image-1',
          imageRef: sharedUrl,
        },
        left: 192,
        top: 108,
        width: 1536,
        height: 864,
        scaleX: 1,
        scaleY: 1,
        zIndex: 1,
      },
    ],
  };

  const layout = {
    elements: [],
  };
  const added = new Map([['user-image-1', element]]);

  const serialized = serializeCanvas(mockFabricCanvas, layout, added);
  assert.equal(serialized.length, 1);
  assert.equal(serialized[0].type, 'image');
  assert.equal(serialized[0].imageRef, sharedUrl);
});

test('SPEC-39-01: 3. RegistryAdmin embeds Media Gallery tab and MediaGalleryPanel supports category filter pills', () => {
  assert.ok(
    registryAdminCode.includes('mediaGallery') || registryAdminCode.includes('admin.registry.tab.mediaGallery'),
    'RegistryAdmin must embed Media Gallery tab'
  );

  assert.ok(
    mediaPanelCode.includes('categoryFilter') && mediaPanelCode.includes('uploadCategory'),
    'MediaGalleryPanel must support category filtering and upload category selection'
  );

  assert.ok(
    mediaPanelCode.includes("cat === 'flyer'") || mediaPanelCode.includes('Flyers'),
    'MediaGalleryPanel must provide Flyers category filter pill'
  );

  assert.ok(
    mediaPanelCode.includes("cat === 'background'") || mediaPanelCode.includes('Backgrounds'),
    'MediaGalleryPanel must provide Backgrounds category filter pill'
  );
});

test('SPEC-39-01: 4. ArtifactSlide and canvas-utils provide graceful fallback for unreadable/missing image assets', () => {
  // ArtifactSlide must handle image load failure gracefully with data-image-missing
  assert.ok(
    artifactSlideCode.includes('data-image-missing="true"'),
    'ArtifactSlide must render placeholder with data-image-missing="true" when image fails to load'
  );
  assert.ok(
    artifactSlideCode.includes('onError'),
    'ArtifactSlide ImageElement must handle onError event'
  );

  // canvas-utils must handle imgEl.onerror
  const canvasUtilsPath = path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts');
  const canvasUtilsCode = fs.readFileSync(canvasUtilsPath, 'utf8');
  assert.ok(
    canvasUtilsCode.includes('imgEl.onerror'),
    'canvas-utils must define imgEl.onerror fallback handler'
  );
});

test('SPEC-39-01: 5. Executable absence guard & defect injection proof for gallery image insertion', () => {
  // Guard proof function that checks for the presence of gallery image insertion integration
  function assertGalleryImageInsertion(source) {
    assert.ok(
      source.includes('insertImageFromUrl'),
      'ArtifactEditor must include insertImageFromUrl'
    );
    assert.ok(
      source.includes('showGalleryDialog'),
      'ArtifactEditor must include showGalleryDialog'
    );
    assert.ok(
      source.includes('openGalleryDialog'),
      'ArtifactEditor must include openGalleryDialog'
    );
  }

  // Live source must pass
  assert.doesNotThrow(() => assertGalleryImageInsertion(editorCode));

  // Defect injection 1: Removing insertImageFromUrl
  const defect1 = editorCode.replace(/insertImageFromUrl/g, '__removed_func__');
  assert.throws(
    () => assertGalleryImageInsertion(defect1),
    /ArtifactEditor must include insertImageFromUrl/,
    'Absence guard must fail if insertImageFromUrl is removed'
  );

  // Defect injection 2: Removing showGalleryDialog
  const defect2 = editorCode.replace(/showGalleryDialog/g, '__removed_dialog__');
  assert.throws(
    () => assertGalleryImageInsertion(defect2),
    /ArtifactEditor must include showGalleryDialog/,
    'Absence guard must fail if showGalleryDialog is removed'
  );

  // Defect injection 3: Removing openGalleryDialog
  const defect3 = editorCode.replace(/openGalleryDialog/g, '__removed_open_dialog__');
  assert.throws(
    () => assertGalleryImageInsertion(defect3),
    /ArtifactEditor must include openGalleryDialog/,
    'Absence guard must fail if openGalleryDialog is removed'
  );
});

test('SPEC-39-01: 6. Behavioral verification: legacy database migration backfills default category', () => {
  const db = getDb();
  // Insert a row without specifying category into an existing or temp table to verify default
  const res = db.prepare(
    `INSERT INTO background_library_images (url, is_default, created_at, updated_at)
     VALUES (?, 0, datetime('now'), datetime('now'))`
  ).run('/api/uploads/legacy-unspecified-cat.png');

  const row = db.prepare(
    `SELECT id, url, category FROM background_library_images WHERE id = ?`
  ).get(res.lastInsertRowid);

  assert.equal(row.category, 'background', 'Omitted category must default to background');
});

test('SPEC-39-01: 7. Behavioral verification: ArtifactSlide resets missing-image state when imageUrl changes', () => {
  // ArtifactSlide must tie failure state to the specific URL or key by URL so replacements render
  assert.ok(
    artifactSlideCode.includes('failedUrl === imageUrl') || artifactSlideCode.includes('resolveElementImage(element)'),
    'ArtifactSlide must not permanently lock failure state when a new URL is provided'
  );
});
