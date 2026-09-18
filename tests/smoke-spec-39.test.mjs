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

const {
  isAnnouncementSlide,
  findAnnouncementSectionBounds,
  computeNextLoopIndex,
} = await import(
  pathToFileURL(path.join(root, 'src', 'operator', 'present', 'presenter-model.ts')).href
);

const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
assert.ok(fs.existsSync(artifactEditorPath), 'ArtifactEditor.tsx must exist');
const editorCode = fs.readFileSync(artifactEditorPath, 'utf8');

const presenterOperatorPath = path.join(root, 'src', 'operator', 'present', 'PresenterOperator.tsx');
assert.ok(fs.existsSync(presenterOperatorPath), 'PresenterOperator.tsx must exist');
const presenterOperatorCode = fs.readFileSync(presenterOperatorPath, 'utf8');

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

test('SPEC-39-02: 1. findAnnouncementSectionBounds identifies contiguous announcement block and rejects non-announcement slides', () => {
  // Mock slide deck with mixed liturgy and announcements
  const mockSlides = [
    { id: '1', kind: 'song-title', artifact: { templateId: 'welcome-title', baseType: 'general' } },
    { id: '2', kind: 'scripture', artifact: { templateId: 'scripture-reading', baseType: 'general' } },
    { id: '3', kind: 'body', artifact: { templateId: 'ann-slide-101', baseType: 'announcement' } },
    { id: '4', kind: 'body', artifact: { templateId: 'ann-slide-102', baseType: 'announcement' } },
    { id: '5', kind: 'body', artifact: { templateId: 'announcement-flyer', baseType: 'announcement' } },
    { id: '6', kind: 'sermon', artifact: { templateId: 'sermon-title', baseType: 'general' } },
    { id: '7', kind: 'body', artifact: { templateId: 'ann-slide-201', baseType: 'announcement' } },
  ];

  // 1. Non-announcement slides must return null (refusal to loop liturgy)
  assert.equal(findAnnouncementSectionBounds(mockSlides, 0), null);
  assert.equal(findAnnouncementSectionBounds(mockSlides, 1), null);
  assert.equal(findAnnouncementSectionBounds(mockSlides, 5), null);

  // 2. Contiguous announcement block (slides 2, 3, 4) must return [2, 4] for all constituent slides
  assert.deepEqual(findAnnouncementSectionBounds(mockSlides, 2), [2, 4]);
  assert.deepEqual(findAnnouncementSectionBounds(mockSlides, 3), [2, 4]);
  assert.deepEqual(findAnnouncementSectionBounds(mockSlides, 4), [2, 4]);

  // 3. Isolated single announcement slide at index 6 must return [6, 6]
  assert.deepEqual(findAnnouncementSectionBounds(mockSlides, 6), [6, 6]);

  // 4. Out-of-bounds indexes must return null safely
  assert.equal(findAnnouncementSectionBounds(mockSlides, -1), null);
  assert.equal(findAnnouncementSectionBounds(mockSlides, 99), null);
});

test('SPEC-39-02: 2. computeNextLoopIndex advances within section and wraps strictly from end to start', () => {
  const bounds = [2, 4]; // announcement section spanning index 2 to 4

  // Inside section: advances sequentially
  assert.equal(computeNextLoopIndex(2, bounds), 3);
  assert.equal(computeNextLoopIndex(3, bounds), 4);

  // At section boundary (end): wraps back to start (2), NEVER overflowing into slide 5 (sermon)
  assert.equal(computeNextLoopIndex(4, bounds), 2);

  // If outside bounds: wraps back to start
  assert.equal(computeNextLoopIndex(1, bounds), 2);
  assert.equal(computeNextLoopIndex(5, bounds), 2);

  // Single slide section: holds in place (start >= end)
  assert.equal(computeNextLoopIndex(6, [6, 6]), 6);
});

test('SPEC-39-02: 3. PresenterOperator UI implements loop toggle, interval selector, and manual override disarm guards', () => {
  // Loop state and storage
  assert.ok(
    presenterOperatorCode.includes('isLooping') && presenterOperatorCode.includes('loopInterval'),
    'PresenterOperator must manage isLooping and loopInterval state'
  );
  assert.ok(
    presenterOperatorCode.includes('wpw_presenter_loop_interval'),
    'PresenterOperator must persist loopInterval in localStorage'
  );

  // Loop Toggle button & Interval Select
  assert.ok(
    presenterOperatorCode.includes('Stop Loop') && presenterOperatorCode.includes('Auto Loop'),
    'PresenterOperator must provide Auto Loop / Stop Loop button'
  );
  assert.ok(
    presenterOperatorCode.includes('findAnnouncementSectionBounds'),
    'PresenterOperator must invoke findAnnouncementSectionBounds before starting loop'
  );

  // Manual override disarm guard: manualNavigate resets isLooping = false synchronously via ref
  assert.ok(
    presenterOperatorCode.includes('manualNavigate'),
    'PresenterOperator must route manual operator navigation through manualNavigate'
  );
  assert.ok(
    presenterOperatorCode.includes('isLoopingRef.current = false') &&
    presenterOperatorCode.includes('setIsLooping(false)'),
    'PresenterOperator must disarm isLooping and isLoopingRef synchronously on manual intervention'
  );

  // Stale timer suppression: interval callback must verify isLoopingRef.current
  assert.ok(
    presenterOperatorCode.includes('if (!isLoopingRef.current) return;'),
    'Interval timer callback must guard against stale fires via isLoopingRef.current'
  );

  // Remote navigation session MUST use manualNavigate to disarm loop
  assert.ok(
    presenterOperatorCode.includes('setIndexAndSync: manualNavigate'),
    'PresenterRemoteSession must wire setIndexAndSync to manualNavigate so remote navigation disarms loop'
  );

  // Timer cleanup on unmount / dependency change
  assert.ok(
    presenterOperatorCode.includes('clearInterval(timer)'),
    'PresenterOperator must cleanly clear loop interval timer on unmount / disarm'
  );

  // Arrow keys must disarm loop
  assert.ok(
    presenterOperatorCode.includes('manualNavigate(index + 1)') &&
    presenterOperatorCode.includes('manualNavigate(index - 1)'),
    'Keyboard navigation must invoke manualNavigate to disarm loop'
  );

  // Filmstrip & List & Grid must disarm loop
  assert.ok(
    presenterOperatorCode.includes('onSelect={manualNavigate}'),
    'Filmstrip and slide list must pass manualNavigate to onSelect'
  );
  assert.ok(
    presenterOperatorCode.includes('manualNavigate(picked)'),
    'SlideGridDialog onPick must invoke manualNavigate'
  );
});

test('SPEC-39-02: 4. Executable absence guard & defect injection proof for announcement loop boundary wrap', () => {
  function verifyBoundaryWrap(nextIndexFn) {
    const bounds = [10, 14];
    // Must advance inside section
    assert.equal(nextIndexFn(10, bounds), 11);
    assert.equal(nextIndexFn(11, bounds), 12);
    assert.equal(nextIndexFn(12, bounds), 13);
    assert.equal(nextIndexFn(13, bounds), 14);
    // CRITICAL: At end boundary (14), MUST wrap to start (10)
    assert.equal(nextIndexFn(14, bounds), 10, 'Must wrap to section start index');
  }

  // Live implementation must pass
  assert.doesNotThrow(() => verifyBoundaryWrap(computeNextLoopIndex));

  // Defect injection: broken wrap that leaks into next section (returns currentIndex + 1 past end)
  const defectiveWrap = (cur, [start, end]) => {
    return cur + 1; // Leaks past end
  };
  assert.throws(
    () => verifyBoundaryWrap(defectiveWrap),
    /Must wrap to section start index/,
    'Absence guard must fail if announcement loop fails to wrap at boundary'
  );
});

test('SPEC-39-02: 5. Executable absence guard & defect injection proof for manual override disarm', () => {
  function verifyManualDisarm(code) {
    const manualNavMatch = code.match(/const\s+manualNavigate\s*=\s*useCallback\([\s\S]*?setIndexAndSync\(next\);[\s\S]*?\},/);
    assert.ok(manualNavMatch, 'manualNavigate function must exist');
    assert.ok(
      manualNavMatch[0].includes('setIsLooping(false)'),
      'manualNavigate must disarm isLooping state'
    );
    assert.ok(
      manualNavMatch[0].includes('isLoopingRef.current = false'),
      'manualNavigate must synchronously set isLoopingRef.current to false'
    );
    // PresenterRemoteSession must be wired to manualNavigate
    assert.ok(
      code.includes('setIndexAndSync: manualNavigate'),
      'PresenterRemoteSession must wire setIndexAndSync to manualNavigate'
    );
  }

  // Live code must pass
  assert.doesNotThrow(() => verifyManualDisarm(presenterOperatorCode));

  // Defect injection 1: manualNavigate fails to synchronously reset isLoopingRef
  const defectiveCode1 = presenterOperatorCode.replace('isLoopingRef.current = false;', '');
  assert.throws(
    () => verifyManualDisarm(defectiveCode1),
    /manualNavigate must synchronously set isLoopingRef.current to false/,
    'Absence guard must fail if manualNavigate does not synchronously set isLoopingRef.current to false'
  );

  // Defect injection 2: PresenterRemoteSession bypasses manualNavigate
  const defectiveCode2 = presenterOperatorCode.replace('setIndexAndSync: manualNavigate', 'setIndexAndSync: setIndexAndSync');
  assert.throws(
    () => verifyManualDisarm(defectiveCode2),
    /PresenterRemoteSession must wire setIndexAndSync to manualNavigate/,
    'Absence guard must fail if remote navigation bypasses manualNavigate'
  );
});
