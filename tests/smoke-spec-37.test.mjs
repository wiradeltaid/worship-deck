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
import JSZip from 'jszip';

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

const {
  embedPresentationFonts,
  deriveObfuscationKey,
  obfuscateFont,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'fonts', 'embed-fonts.ts')).href
);

const {
  resolveFontFamily,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'artifacts', 'render-model.ts')).href
);

const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
assert.ok(fs.existsSync(artifactEditorPath), 'ArtifactEditor.tsx must exist');
const editorCode = fs.readFileSync(artifactEditorPath, 'utf8');

const pptxDrawPath = path.join(root, 'src', 'lib', 'pptx-draw.ts');
assert.ok(fs.existsSync(pptxDrawPath), 'pptx-draw.ts must exist');
const pptxDrawCode = fs.readFileSync(pptxDrawPath, 'utf8');

const { generatePptxFromPlan } = await import(
  pathToFileURL(pptxDrawPath).href
);

const fontsGoPath = path.join(root, 'internal', 'httpapi', 'fonts.go');
assert.ok(fs.existsSync(fontsGoPath), 'fonts.go must exist');
const fontsGoCode = fs.readFileSync(fontsGoPath, 'utf8');

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

// --------------------------------------------------------------------------
// SPEC-37-03: PPTX Font Embedding Variant Fallback, License Safety & Typeface Parity
// --------------------------------------------------------------------------

test('T-37-03: PPTX generator canonicalizes typeface across text runs and usedFonts', () => {
  // 1. Used fonts collection must use resolveFontFamily(el.style)
  assert.ok(
    pptxDrawCode.includes('const fam = resolveFontFamily(el.style);'),
    'pptx-draw.ts must use resolveFontFamily(el.style) when gathering usedFonts'
  );

  // 2. DrawingML text run options must use resolveFontFamily(style)
  assert.ok(
    pptxDrawCode.includes('fontFace: resolveFontFamily(style)'),
    'pptx-draw.ts must set fontFace: resolveFontFamily(style) for text runs'
  );

  // 3. Behavioral test of resolveFontFamily with pptxTypeface precedence
  assert.equal(
    resolveFontFamily({ fontFamily: 'Montserrat', pptxTypeface: 'Montserrat Light' }),
    'Montserrat Light',
    'resolveFontFamily must prioritize pptxTypeface when present'
  );
  assert.equal(
    resolveFontFamily({ fontFamily: 'Inter' }),
    'Inter',
    'resolveFontFamily must fall back to fontFamily'
  );
});

test('T-37-03: License-aware fallback embeds regular face into bold slot when bold face is unacquired', async () => {
  const testZip = new JSZip();
  testZip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
  );
  testZip.file(
    'ppt/presentation.xml',
    '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:notesSz cx="5143500" cy="9144000"/><p:defaultTextStyle/></p:presentation>'
  );
  testZip.file(
    'ppt/_rels/presentation.xml.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="sample" Target="sample"/></Relationships>'
  );

  const validTtfHeader = Buffer.from([
    0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x10,
    0x00, 0x00, 0x00, 0x00, 0x68, 0x65, 0x61, 0x64,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1c,
    0x00, 0x00, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x5F, 0x0F, 0x3C, 0xF5,
    0x00, 0x03, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);

  const tempDir = fs.mkdtempSync(path.join(root, 'tests', '.tmp-font-37-'));
  const regPath = path.join(tempDir, 'brand-regular.ttf');
  fs.writeFileSync(regPath, validTtfHeader);

  try {
    // Font manifest has ONLY regular face (no bold face uploaded)
    const fontManifest = [
      {
        family: 'BrandFallbackTest',
        weight: 'normal',
        style: 'normal',
        path: regPath,
        restricted: false,
      },
    ];

    // Slide text requests bold formatting
    const used = [
      {
        family: 'BrandFallbackTest',
        weight: '700',
        style: 'normal',
      },
    ];

    const embedded = await embedPresentationFonts(testZip, used, fontManifest);
    assert.ok(embedded.includes('BrandFallbackTest'), 'BrandFallbackTest must be embedded using regular fallback');

    const presXml = await testZip.file('ppt/presentation.xml').async('string');
    // Invariant: <p:font typeface="BrandFallbackTest"/> must be created
    assert.ok(
      presXml.includes('typeface="BrandFallbackTest"'),
      'presentation.xml must contain embeddedFont for BrandFallbackTest'
    );
    // Invariant: <p:bold r:id="..."/> must be mapped for the bold slot
    assert.ok(
      presXml.includes('<p:bold r:id='),
      'presentation.xml must map regular face buffer into <p:bold> slot'
    );

    // Verify .odttf file exists and can be round-trip de-obfuscated
    const odttfFiles = Object.keys(testZip.files).filter((f) => f.startsWith('ppt/fonts/') && f.endsWith('.odttf'));
    assert.equal(odttfFiles.length, 1, 'Exactly one .odttf file must be packaged');

    const fileName = path.basename(odttfFiles[0], '.odttf');
    const key = deriveObfuscationKey(fileName);
    assert.ok(key, 'Key must be derived from GUID filename');

    const obfuscatedBuf = await testZip.file(odttfFiles[0]).async('nodebuffer');
    const deobfuscatedBuf = obfuscateFont(obfuscatedBuf, key);
    assert.deepEqual(
      deobfuscatedBuf,
      validTtfHeader,
      'De-obfuscated font binary must match original font header byte-for-byte'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('T-37-03: Restricted fonts are never embedded as variant fallbacks', async () => {
  const testZip = new JSZip();
  testZip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
  );
  testZip.file(
    'ppt/presentation.xml',
    '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:notesSz cx="5143500" cy="9144000"/><p:defaultTextStyle/></p:presentation>'
  );
  testZip.file(
    'ppt/_rels/presentation.xml.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="sample" Target="sample"/></Relationships>'
  );

  const tempDir = fs.mkdtempSync(path.join(root, 'tests', '.tmp-font-37-restr-'));
  const regPath = path.join(tempDir, 'restr-regular.ttf');
  fs.writeFileSync(regPath, Buffer.alloc(64, 0xaa));

  try {
    // Font manifest has ONLY a restricted face
    const fontManifest = [
      {
        family: 'RestrictedBrandFont',
        weight: 'normal',
        style: 'normal',
        path: regPath,
        restricted: true,
      },
    ];

    const used = [
      {
        family: 'RestrictedBrandFont',
        weight: 'bold',
        style: 'normal',
      },
    ];

    const embedded = await embedPresentationFonts(testZip, used, fontManifest);
    assert.equal(embedded.length, 0, 'Restricted font must NOT be embedded as a fallback');

    const presXml = await testZip.file('ppt/presentation.xml').async('string');
    assert.ok(
      !presXml.includes('RestrictedBrandFont'),
      'presentation.xml must not contain embeddedFont for restricted font'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('T-37-03: Source typeface matching in fontManifest resolves custom family correctly', async () => {
  const testZip = new JSZip();
  testZip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
  );
  testZip.file(
    'ppt/presentation.xml',
    '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:notesSz cx="5143500" cy="9144000"/><p:defaultTextStyle/></p:presentation>'
  );
  testZip.file(
    'ppt/_rels/presentation.xml.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="sample" Target="sample"/></Relationships>'
  );

  const tempDir = fs.mkdtempSync(path.join(root, 'tests', '.tmp-font-37-src-'));
  const fontPath = path.join(tempDir, 'light.ttf');
  fs.writeFileSync(fontPath, Buffer.alloc(64, 0xbb));

  try {
    // Font manifest with distinct family and sourceTypeface
    const fontManifest = [
      {
        family: 'Montserrat',
        sourceTypeface: 'Montserrat Light',
        weight: '300',
        style: 'normal',
        path: fontPath,
        restricted: false,
      },
    ];

    // Text run used 'Montserrat Light' as the family
    const used = [
      {
        family: 'Montserrat Light',
        weight: 'normal',
        style: 'normal',
      },
    ];

    const embedded = await embedPresentationFonts(testZip, used, fontManifest);
    assert.ok(embedded.includes('Montserrat Light'), 'Must match via sourceTypeface');

    const presXml = await testZip.file('ppt/presentation.xml').async('string');
    assert.ok(
      presXml.includes('typeface="Montserrat Light"'),
      'presentation.xml must contain embeddedFont with matching typeface="Montserrat Light"'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('T-37-03: fonts.go includes SourceTypeface in FontManifestEntry and selects source_typeface from database', () => {
  assert.ok(
    fontsGoCode.includes('SourceTypeface string `json:"sourceTypeface"`'),
    'fonts.go must expose SourceTypeface in FontManifestEntry struct'
  );
  assert.ok(
    fontsGoCode.includes('SELECT id, family, source_typeface, weight, style, format, asset_path, is_restricted') &&
      fontsGoCode.includes('SourceTypeface: sourceTypeface,'),
    'fonts.go must select and map source_typeface from SQLite font_faces into manifest'
  );
});

test('T-37-03: Catalog font with all-restricted manifest candidates is never embedded and does not fall through to catalog', async () => {
  const testZip = new JSZip();
  testZip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
  );
  testZip.file(
    'ppt/presentation.xml',
    '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:notesSz cx="5143500" cy="9144000"/><p:defaultTextStyle/></p:presentation>'
  );
  testZip.file(
    'ppt/_rels/presentation.xml.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="sample" Target="sample"/></Relationships>'
  );

  const tempDir = fs.mkdtempSync(path.join(root, 'tests', '.tmp-font-37-cat-restr-'));
  const fontPath = path.join(tempDir, 'inter-restr.ttf');
  fs.writeFileSync(fontPath, Buffer.alloc(64, 0xcc));

  try {
    // Inter is a catalog font, but user manifest marks it restricted
    const fontManifest = [
      {
        family: 'Inter',
        weight: 'normal',
        style: 'normal',
        path: fontPath,
        restricted: true,
      },
    ];

    const used = [
      {
        family: 'Inter',
        weight: '700',
        style: 'normal',
      },
    ];

    const embedded = await embedPresentationFonts(testZip, used, fontManifest);
    assert.equal(embedded.length, 0, 'Restricted catalog font must NOT be embedded or downloaded');

    const presXml = await testZip.file('ppt/presentation.xml').async('string');
    assert.ok(
      !presXml.includes('typeface="Inter"'),
      'presentation.xml must NOT embed Inter when manifest candidates are restricted'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('T-37-03: End-to-end generatePptxFromPlan aligns DrawingML a:latin with p:font typeface when element has pptxTypeface', async () => {
  const tempDir = fs.mkdtempSync(path.join(root, 'tests', '.tmp-font-37-e2e-'));
  const fontPath = path.join(tempDir, 'montserrat-light.ttf');
  fs.writeFileSync(fontPath, Buffer.alloc(64, 0xdd));

  try {
    const fontManifest = [
      {
        id: 'font-face-e2e-1',
        family: 'Montserrat',
        sourceTypeface: 'Montserrat Light',
        weight: '300',
        style: 'normal',
        format: 'ttf',
        path: fontPath,
        restricted: false,
      },
    ];

    const plan = [
      {
        artifact: {
          schemaVersion: 1,
          runtimeVersion: 1,
          instanceId: 'inst-37-e2e',
          templateId: 'tmpl-37-e2e',
          label: 'Parity Test Slide',
          baseType: 'general',
          layoutKey: 'default',
          layout: {
            aspectRatio: '16:9',
            backgroundColor: '#000000',
            elements: [
              {
                id: 'el-text-e2e',
                type: 'text',
                x: 10,
                y: 10,
                w: 80,
                h: 20,
                text: 'Parity Typography Text',
                style: {
                  fontFamily: 'Montserrat',
                  pptxTypeface: 'Montserrat Light',
                  fontSize: 28,
                  fontColor: '#FFFFFF',
                },
              },
            ],
          },
        },
      },
    ];

    const buffer = await generatePptxFromPlan('2026-09-16', plan, 'none', fontManifest);
    assert.ok(buffer && buffer.length > 0, 'PPTX buffer must be generated');

    const zip = await JSZip.loadAsync(buffer);

    // 1. DrawingML in slide1.xml must use typeface="Montserrat Light"
    const slide1Xml = await zip.file('ppt/slides/slide1.xml').async('string');
    assert.ok(
      slide1Xml.includes('typeface="Montserrat Light"'),
      `slide1.xml DrawingML text run must use typeface="Montserrat Light", got: ${slide1Xml}`
    );

    // 2. Embedded font in presentation.xml must also use typeface="Montserrat Light"
    const presXml = await zip.file('ppt/presentation.xml').async('string');
    assert.ok(
      presXml.includes('<p:font typeface="Montserrat Light"/>'),
      `presentation.xml must declare <p:font typeface="Montserrat Light"/>, got: ${presXml}`
    );

    // 3. Exactly one relationship and .odttf file created for Montserrat Light
    const odttfFiles = Object.keys(zip.files).filter((f) => f.startsWith('ppt/fonts/') && f.endsWith('.odttf'));
    assert.equal(odttfFiles.length, 1, 'Exactly one font part must be embedded');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
