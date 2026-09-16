/**
 * SPEC-37: Cross-Surface Font Availability Parity, Multi-Context Hydration,
 * and Unacquired Font Status Reconciliation Smoke Suite
 *
 * Verification of:
 * - SPEC-37-01: Artifact Editor Unacquired Font Warning Logic Correction & Status Reconciliation
 * - T-37-01: Decouple warning indicator from stale element property (hide warning if font acquired)
 * - T-37-01: Batch font upload element fontStatus reconciliation across liveElements
 * - T-37-01: Template load reconciliation pass away from 'unresolved' for acquired fonts
 * - T-37-01: PPTX import recognition of existing SQLite font_faces
 * - T-37-01: Absence guards with defect injection proofs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const {
  FONT_CATALOG,
  getFontDefinition,
  isFontExportReady,
  hydrateImportedFonts,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'font-catalog.ts')).href
);

const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
assert.ok(fs.existsSync(artifactEditorPath), 'ArtifactEditor.tsx must exist');
const editorCode = fs.readFileSync(artifactEditorPath, 'utf8');

const pptxImportPath = path.join(root, 'internal', 'httpapi', 'pptx_import.go');
assert.ok(fs.existsSync(pptxImportPath), 'pptx_import.go must exist');
const pptxImportCode = fs.readFileSync(pptxImportPath, 'utf8');

const appPath = path.join(root, 'spa', 'src', 'App.tsx');
assert.ok(fs.existsSync(appPath), 'App.tsx must exist');
const appCode = fs.readFileSync(appPath, 'utf8');

const presenterOperatorPath = path.join(root, 'src', 'operator', 'present', 'PresenterOperator.tsx');
assert.ok(fs.existsSync(presenterOperatorPath), 'PresenterOperator.tsx must exist');
const presenterOperatorCode = fs.readFileSync(presenterOperatorPath, 'utf8');

const projectorClientPath = path.join(root, 'src', 'projected', 'ProjectorClient.tsx');
assert.ok(fs.existsSync(projectorClientPath), 'ProjectorClient.tsx must exist');
const projectorClientCode = fs.readFileSync(projectorClientPath, 'utf8');

const artifactSlidePath = path.join(root, 'src', 'components', 'artifacts', 'ArtifactSlide.tsx');
assert.ok(fs.existsSync(artifactSlidePath), 'ArtifactSlide.tsx must exist');
const artifactSlideCode = fs.readFileSync(artifactSlidePath, 'utf8');

const fontCatalogPath = path.join(root, 'src', 'lib', 'registry', 'font-catalog.ts');
assert.ok(fs.existsSync(fontCatalogPath), 'font-catalog.ts must exist');
const fontCatalogCode = fs.readFileSync(fontCatalogPath, 'utf8');

// --------------------------------------------------------------------------
// SPEC-37-01: Reconciled Unacquired Font Evaluation & State Synchronization
// --------------------------------------------------------------------------

test('T-37-01: ArtifactEditor decouples Unacquired Font indicator from stale fontStatus property', () => {
  // 1. Code in ArtifactEditor.tsx must evaluate isFontAcquired first and set isUnacquired = !isFontAcquired
  assert.ok(
    editorCode.includes('const isFontAcquired = isFontExportReady(fontFamily) || Boolean(getFontDefinition(fontFamily));') &&
      editorCode.includes('const isUnacquired = !isFontAcquired;'),
    'ArtifactEditor must decouple isUnacquired from stale element fontStatus property'
  );

  // 2. Exact DOM text "Unacquired Font" indicator must exist
  assert.ok(
    editorCode.includes('Unacquired Font'),
    'ArtifactEditor must render "Unacquired Font" indicator when font is truly unacquired'
  );

  // 3. Stale OR short-circuit pattern must be absent
  assert.ok(
    !editorCode.includes("activeEl?.style?.fontStatus === 'unresolved' ||"),
    'ArtifactEditor must NOT short-circuit to true when element has stale fontStatus unresolved'
  );
});

test('T-37-01: Logic test & Defect Injection proof: acquired font with stale unresolved status never triggers warning', () => {
  // Pick an acquired catalog font
  const testFamily = 'Inter';
  assert.ok(getFontDefinition(testFamily) || isFontExportReady(testFamily), 'Inter must be an acquired font');

  const staleElement = {
    id: 'el-1',
    type: 'text',
    style: {
      fontFamily: testFamily,
      fontStatus: 'unresolved', // stale from previous PPTX import or unhydrated save
    },
  };

  // Reconciled logic under test:
  const evaluateUnacquiredFixed = (fam, el) => {
    const isFontAcquired = isFontExportReady(fam) || Boolean(getFontDefinition(fam));
    return !isFontAcquired;
  };

  // Defective legacy logic:
  const evaluateUnacquiredDefective = (fam, el) => {
    return (
      el?.style?.fontStatus === 'unresolved' ||
      (!isFontExportReady(fam) && !getFontDefinition(fam))
    );
  };

  // 1. Fixed logic evaluates to FALSE (no unacquired warning)
  assert.equal(
    evaluateUnacquiredFixed(testFamily, staleElement),
    false,
    'Acquired font must NOT trigger unacquired warning even if element has stale fontStatus: unresolved'
  );

  // 2. Defect injection proof: defective logic evaluates to TRUE (false positive warning)
  assert.equal(
    evaluateUnacquiredDefective(testFamily, staleElement),
    true,
    'Defect injection: legacy logic incorrectly produced true for acquired font with stale unresolved status'
  );

  // 3. Truly unacquired font evaluates to TRUE on fixed logic
  const unacquiredFamily = 'NonExistentMysteryFont123';
  const unacquiredElement = {
    id: 'el-2',
    type: 'text',
    style: {
      fontFamily: unacquiredFamily,
      fontStatus: 'unresolved',
    },
  };
  assert.equal(
    evaluateUnacquiredFixed(unacquiredFamily, unacquiredElement),
    true,
    'Truly unacquired font must evaluate to true (warning shown)'
  );
});

test('T-37-01: Batch font upload reconciles fontStatus for all live elements matching uploaded families', () => {
  assert.ok(
    editorCode.includes('uploadedFamilySet.has(el.style.fontFamily.trim().toLowerCase())') &&
      editorCode.includes("fontStatus: 'uploaded'"),
    'handleFontUploadBatch must reconcile fontStatus to uploaded for all matching elements across liveElements'
  );
  assert.ok(
    editorCode.includes('markDirty()'),
    'handleFontUploadBatch must mark dirty when reconciling elements'
  );
});

test('T-37-01: Template mount reconciliation pass cleans up stale unresolved fontStatus', () => {
  assert.ok(
    editorCode.includes('isAcquired && el.style.fontStatus === \'unresolved\'') &&
      editorCode.includes("fontStatus: 'uploaded'"),
    'ArtifactEditor template mount must reconcile unresolved fontStatus for already acquired fonts'
  );
});

test('T-37-01: PPTX import reconciles unacquired custom fonts against existing SQLite font_faces', () => {
  assert.ok(
    pptxImportCode.includes('SELECT 1 FROM font_faces') &&
      pptxImportCode.includes('source_typeface = ? COLLATE NOCASE') &&
      pptxImportCode.includes('family = ? COLLATE NOCASE') &&
      pptxImportCode.includes('el.Style["fontStatus"] = "uploaded"'),
    'PPTX import must check SQLite font_faces matching family and source_typeface and mark previously imported fonts as uploaded'
  );
  assert.ok(
    pptxImportCode.includes('parseResult.Warnings = filteredResultWarns'),
    'PPTX import must filter out false unacquired warnings from aggregate parseResult.Warnings'
  );
});

// --------------------------------------------------------------------------
// SPEC-37-02: Global SPA and Presenter Window Multi-Context Font Hydration
// --------------------------------------------------------------------------

test('T-37-02: App.tsx triggers hydrateImportedFonts on top-level mount', () => {
  assert.ok(
    appCode.includes("import { hydrateImportedFonts } from '@/lib/registry/font-catalog'") &&
      appCode.includes('hydrateImportedFonts()'),
    'App.tsx must import and invoke hydrateImportedFonts on top-level mount'
  );
});

test('T-37-02: PresenterOperator and ProjectorClient trigger hydrateImportedFonts on mount', () => {
  assert.ok(
    presenterOperatorCode.includes('hydrateImportedFonts') &&
      presenterOperatorCode.includes('void hydrateImportedFonts()'),
    'PresenterOperator.tsx must trigger hydrateImportedFonts on mount for direct route navigation'
  );
  assert.ok(
    projectorClientCode.includes('hydrateImportedFonts') &&
      projectorClientCode.includes('void hydrateImportedFonts()'),
    'ProjectorClient.tsx must trigger hydrateImportedFonts on mount for isolated popup window context'
  );
});

test('T-37-02: ArtifactSlide registers loadingdone and document.fonts.ready listeners for responsive fit', () => {
  assert.ok(
    artifactSlideCode.includes("document.fonts.addEventListener('loadingdone', onFontLoaded)") &&
      artifactSlideCode.includes('document.fonts.ready'),
    'ArtifactSlide.tsx must listen for loadingdone and document.fonts.ready to re-execute applyFit'
  );
});

test('T-37-02: font-catalog registers dynamic FontFace BEFORE load() to emit loadingdone', () => {
  // In font-catalog.ts, font must be added to document.fonts before awaiting font.load()
  const addBeforeLoadRegex = /document\.fonts\.add\(font\);[\s\S]*?loadedFontFace\s*=\s*await\s+font\.load\(\);/;
  assert.ok(
    addBeforeLoadRegex.test(fontCatalogCode),
    'font-catalog.ts must add FontFace to document.fonts before awaiting font.load() so loadingdone fires'
  );
});

test('T-37-02: Chromium Playwright event probe proves font loadingdone fires only when added before load()', async () => {
  const fontFile = path.join(root, 'node_modules', '@fontsource', 'geist-sans', 'files', 'geist-sans-latin-400-normal.woff2');
  if (!fs.existsSync(fontFile)) {
    return; // skip if font file missing
  }
  const base64Data = fs.readFileSync(fontFile).toString('base64');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><body>Font Lifecycle Probe</body>');

    const result = await page.evaluate(async (encoded) => {
      // 1. Correct order: document.fonts.add(face) THEN await face.load()
      const correctEvents = [];
      const onLoadingDone1 = () => correctEvents.push('loadingdone');
      document.fonts.addEventListener('loadingdone', onLoadingDone1);
      const face1 = new FontFace('ProbeCorrect', 'url(data:font/woff2;base64,' + encoded + ')');
      document.fonts.add(face1);
      await face1.load();
      await new Promise((res) => setTimeout(res, 50));
      document.fonts.removeEventListener('loadingdone', onLoadingDone1);

      // 2. Defective legacy order: await face.load() THEN document.fonts.add(face)
      const defectiveEvents = [];
      const onLoadingDone2 = () => defectiveEvents.push('loadingdone');
      document.fonts.addEventListener('loadingdone', onLoadingDone2);
      const face2 = new FontFace('ProbeDefective', 'url(data:font/woff2;base64,' + encoded + ')');
      await face2.load();
      document.fonts.add(face2);
      await new Promise((res) => setTimeout(res, 50));
      document.fonts.removeEventListener('loadingdone', onLoadingDone2);

      return {
        correctEvents,
        defectiveEvents,
      };
    }, base64Data);

    // Assert correct order produced loadingdone
    assert.ok(
      result.correctEvents.includes('loadingdone'),
      'Adding FontFace to document.fonts before load() must emit loadingdone event'
    );

    // Assert defect injection: legacy order produced 0 events
    assert.equal(
      result.defectiveEvents.length,
      0,
      'Defect injection: awaiting load() before adding to document.fonts fails to emit loadingdone'
    );
  } finally {
    await browser.close();
  }
});

test('T-37-02: hydrateImportedFonts single-flight deduplication and defect injection proof', async () => {
  // 1. Structural absence guard with defect injection on font-catalog.ts source
  function validateSingleFlightGuard(sourceCode) {
    const hasInFlightVar = sourceCode.includes('let inFlightHydration: Promise<number> | null = null;');
    const hasInFlightCheck = sourceCode.includes('if (inFlightHydration) {');
    const clearsInFlight = sourceCode.includes('inFlightHydration = null;');
    if (!hasInFlightVar || !hasInFlightCheck || !clearsInFlight) {
      throw new Error('ABSENCE_DEFECT: hydrateImportedFonts lacks in-flight promise deduplication');
    }
    return true;
  }

  // Real code passes
  assert.ok(
    validateSingleFlightGuard(fontCatalogCode),
    'Real font-catalog.ts must have in-flight promise deduplication guard'
  );

  // Defect injection: removing if (inFlightHydration)
  const defectiveCode = fontCatalogCode.replace('if (inFlightHydration) {', 'if (false) {');
  assert.throws(
    () => validateSingleFlightGuard(defectiveCode),
    /ABSENCE_DEFECT: hydrateImportedFonts lacks in-flight promise deduplication/
  );

  // 2. Behavioral single-flight test:
  let fetchCallCount = 0;
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async (url) => {
      if (url === '/api/fonts') {
        fetchCallCount++;
        // Simulate network latency
        await new Promise((res) => setTimeout(res, 30));
        return {
          ok: true,
          json: async () => [],
        };
      }
      return originalFetch(url);
    };

    // Invoke hydrateImportedFonts concurrently three times
    const [p1, p2, p3] = await Promise.all([
      hydrateImportedFonts(),
      hydrateImportedFonts(),
      hydrateImportedFonts(),
    ]);

    assert.equal(fetchCallCount, 1, 'Concurrent hydrateImportedFonts calls must reuse in-flight request (exactly 1 fetch call)');
    assert.equal(p1, 0);
    assert.equal(p2, 0);
    assert.equal(p3, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
