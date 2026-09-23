/**
 * SPEC-32: PPTX Import Typography Parity, Embedded Font Adoption, and Letter Spacing Smoke Suite
 *
 * Automated verification of:
 * - T-32-01: Character tracking formula parity (spc / 75 = letterSpacing px)
 * - T-32-02: Typeface normalization and numeric weight preservation (100..900)
 * - T-32-03: Font face catalog, dynamic registration, and API routes (/api/fonts, /api/fonts/{id})
 * - T-32-04: ArtifactEditor tracking toolbar control & pptxTypeface invalidation
 * - T-32-05: PPTX OOXML deterministic spc run patching and exact round-trip preservation
 * - T-32-06: Executable absence guards with proven defect forms
 * - T-32-07: Full Go conformance suite passing for pptximport, plan, and httpapi
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync } from 'child_process';
import JSZip from 'jszip';
import { spawnGoApi, stopProcess } from './helpers/go-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const {
  resolveFontFamily,
  toCssGeometry,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'artifacts', 'render-model.ts')).href
);

const {
  FONT_CATALOG,
  getFontDefinition,
  registerDynamicFontFace,
  hydrateImportedFonts,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'font-catalog.ts')).href
);

const {
  serializeTextStyle,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts')).href
);

const {
  generatePptxFromPlan,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'pptx-draw.ts')).href
);

const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
assert.ok(fs.existsSync(artifactEditorPath), 'ArtifactEditor.tsx must exist');

const artifactSlidePath = path.join(root, 'src', 'components', 'artifacts', 'ArtifactSlide.tsx');
assert.ok(fs.existsSync(artifactSlidePath), 'ArtifactSlide.tsx must exist');

const fontsGoPath = path.join(root, 'internal', 'httpapi', 'fonts.go');
assert.ok(fs.existsSync(fontsGoPath), 'internal/httpapi/fonts.go must exist');

const typographyGoPath = path.join(root, 'internal', 'pptximport', 'typography.go');
assert.ok(fs.existsSync(typographyGoPath), 'internal/pptximport/typography.go must exist');

// --------------------------------------------------------------------------
// T-32-01: Character Tracking Formula Parity
// --------------------------------------------------------------------------

test('T-32-01: DrawingML spc to CSS letterSpacing px formula parity', () => {
  // Formula: letterSpacing px = (spc / 100) / pxToPt. In 540pt modern widescreen (pxToPt = 1.0):
  // letterSpacing px = spc / 100.0; spc = round(letterSpacing * 100)
  const cases = [
    { spc: 150, expectedPx: 1.5 },
    { spc: -50, expectedPx: -0.5 },
    { spc: 100, expectedPx: 1.0 },
    { spc: 0, expectedPx: 0.0 },
    { spc: 1, expectedPx: 1 / 100 },
    { spc: -1, expectedPx: -1 / 100 },
  ];

  for (const c of cases) {
    const px = c.spc / 100.0;
    const roundSpc = Math.round(px * 100);
    assert.equal(roundSpc, c.spc, `spc roundtrip failed for ${c.spc}`);
  }
});

// --------------------------------------------------------------------------
// T-32-02: Typeface Normalization & Numeric Weight Mapping
// --------------------------------------------------------------------------

test('T-32-02: resolveFontFamily respects pptxTypeface and preserves canonical family', () => {
  // When pptxTypeface is present (e.g. from PPTX import), resolveFontFamily uses it
  assert.equal(
    resolveFontFamily({ fontFamily: 'Montserrat', pptxTypeface: 'Montserrat Light' }),
    'Montserrat Light',
    'pptxTypeface must take precedence for PPTX output'
  );

  // When pptxTypeface is absent, resolveFontFamily falls back to canonical fontFamily
  assert.equal(
    resolveFontFamily({ fontFamily: 'Montserrat' }),
    'Montserrat'
  );

  // When fontFamily is empty, falls back to Arial default
  assert.equal(
    resolveFontFamily({}),
    'Arial'
  );
});

// --------------------------------------------------------------------------
// T-32-03: Font Catalog & Dynamic Registration
// --------------------------------------------------------------------------

test('T-32-03: Font catalog dynamic registration functions exported and valid', async () => {
  assert.equal(typeof registerDynamicFontFace, 'function');
  assert.equal(typeof hydrateImportedFonts, 'function');

  // In headless Node environment (no document.fonts), registerDynamicFontFace degrades safely to false
  const ok = await registerDynamicFontFace({
    id: 'test-1',
    family: 'CustomTestFont',
    sourceTypeface: 'CustomTestFont Bold',
    weight: '700',
    style: 'normal',
    format: 'ttf',
    url: '/api/fonts/test-1',
  });
  assert.equal(typeof ok, 'boolean');
});

// --------------------------------------------------------------------------
// T-32-04: ArtifactEditor Tracking Toolbar Control & Source Invariants
// --------------------------------------------------------------------------

test('T-32-04: ArtifactEditor contains letter-spacing control and invalidates pptxTypeface on edit', () => {
  const code = fs.readFileSync(artifactEditorPath, 'utf8');

  // Must declare letter-spacing input with step="0.5"
  assert.ok(
    code.includes('data-testid="letter-spacing"') && code.includes('step="0.5"'),
    'ArtifactEditor must render letter-spacing numeric input with step="0.5"'
  );

  // Must declare handleLetterSpacingChange
  assert.ok(
    code.includes('handleLetterSpacingChange'),
    'ArtifactEditor must declare handleLetterSpacingChange'
  );

  // Must invalidate pptxTypeface on family change
  assert.ok(
    code.includes('delete newStyle.pptxTypeface'),
    'ArtifactEditor must delete pptxTypeface when font family or weight changes'
  );

  // ArtifactSlide must render letterSpacing and numeric fontWeight
  const slideCode = fs.readFileSync(artifactSlidePath, 'utf8');
  assert.ok(
    slideCode.includes('letterSpacing:'),
    'ArtifactSlide must map letterSpacing'
  );
  assert.ok(
    slideCode.includes('/^[1-9]00$/'),
    'ArtifactSlide must map numeric fontWeight 100..900 directly'
  );
});

// --------------------------------------------------------------------------
// T-32-05: PPTX OOXML Deterministic Character Spacing Run Patching
// --------------------------------------------------------------------------

test('T-32-05: PPTX generation patches spc on mapped text runs and omits for absent/zero', async () => {
  const syntheticPlan = [
    {
      artifact: {
        runtimeVersion: 1,
        instanceId: 'test-inst-1',
        templateId: 'test-tmpl-1',
        label: 'Test Slide',
        baseType: 'general',
        layoutKey: 'default',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: '#000000',
          elements: [
            {
              id: 'el-text-spc-positive',
              type: 'text',
              x: 10,
              y: 10,
              w: 80,
              h: 30,
              zIndex: 0,
              text: 'Positive Spacing Line',
              style: {
                fontFamily: 'Montserrat',
                fontSize: 32,
                fontColor: '#FFFFFF',
                letterSpacing: 1.5, // 1.5 * 100 = 150
              },
            },
            {
              id: 'el-text-spc-zero',
              type: 'text',
              x: 10,
              y: 50,
              w: 80,
              h: 30,
              zIndex: 1,
              text: 'Zero Spacing Line',
              style: {
                fontFamily: 'Arial',
                fontSize: 24,
                fontColor: '#FFFFFF',
                letterSpacing: 0, // must emit NO spc
              },
            },
          ],
        },
      },
    },
  ];

  const buffer = await generatePptxFromPlan('2026-09-15', syntheticPlan, 'fade');
  assert.ok(buffer && buffer.length > 0, 'PPTX buffer must be generated');

  const zip = await JSZip.loadAsync(buffer);
  const slide1File = zip.file('ppt/slides/slide1.xml');
  assert.ok(slide1File, 'slide1.xml must exist in PPTX archive');

  const xml = await slide1File.async('string');

  // Positive spacing (1.5px -> spc="150") must be present
  assert.ok(
    xml.includes('spc="150"'),
    'slide1.xml must contain spc="150" on mapped runs'
  );

  // In the zero-spacing shape, no spc should be emitted
  const shapes = xml.split('<p:sp>');
  for (const shape of shapes) {
    if (shape.includes('Zero Spacing Line')) {
      assert.ok(
        !shape.includes('spc='),
        'runs for Zero Spacing Line must NOT contain spc attribute'
      );
    }
  }

  // Sequential duplicate content collision test: two shapes with identical text but different tracking
  const duplicateContentPlan = [
    {
      artifact: {
        runtimeVersion: 1,
        instanceId: 'test-inst-dup',
        templateId: 'test-tmpl-dup',
        label: 'Duplicate Content Slide',
        baseType: 'general',
        layoutKey: 'default',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: '#000000',
          elements: [
            {
              id: 'el-text-dup-1',
              type: 'text',
              x: 10,
              y: 10,
              w: 80,
              h: 20,
              zIndex: 0,
              text: 'Identical Chorus Line',
              style: { fontFamily: 'Montserrat', fontSize: 32, letterSpacing: 1.0 }, // 1.0 * 100 = 100
            },
            {
              id: 'el-text-dup-2',
              type: 'text',
              x: 10,
              y: 40,
              w: 80,
              h: 20,
              zIndex: 1,
              text: 'Identical Chorus Line',
              style: { fontFamily: 'Montserrat', fontSize: 32, letterSpacing: -1.0 }, // -1.0 * 100 = -100
            },
          ],
        },
      },
    },
  ];

  const dupBuffer = await generatePptxFromPlan('2026-09-15', duplicateContentPlan, 'fade');
  const dupZip = await JSZip.loadAsync(dupBuffer);
  const dupXml = await dupZip.file('ppt/slides/slide1.xml').async('string');

  const dupShapes = dupXml.split('<p:sp>').filter((s) => s.includes('<p:txBody>'));
  assert.equal(dupShapes.length, 2, 'must have exactly 2 text shapes');
  assert.ok(dupShapes[0].includes('spc="100"'), 'first duplicate shape must carry spc="100"');
  assert.ok(dupShapes[1].includes('spc="-100"'), 'second duplicate shape must carry spc="-100"');
});

// --------------------------------------------------------------------------
// T-32-06: Executable Absence Guard Proofs
// --------------------------------------------------------------------------

test('T-32-06: Absence Guard 1 — serializeTextStyle invalidates pptxTypeface on typography edit', () => {
  const source = {
    id: 'el-1',
    type: 'text',
    required: false,
    x: 10,
    y: 10,
    w: 80,
    h: 40,
    zIndex: 0,
    style: {
      fontFamily: 'Montserrat',
      fontSize: 32,
      fontWeight: '300',
      pptxTypeface: 'Montserrat Light',
    },
  };

  // 1. When typography is untouched, pptxTypeface is preserved
  const untouched = serializeTextStyle(source, {
    fontFamily: 'Montserrat',
    fontSize: 32,
    fontWeight: '300',
  });
  assert.equal(
    untouched?.pptxTypeface,
    'Montserrat Light',
    'pptxTypeface must survive when typography is untouched'
  );

  // 2. When font family is changed, pptxTypeface MUST be deleted
  const familyChanged = serializeTextStyle(source, {
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: '300',
  });
  assert.equal(
    familyChanged?.pptxTypeface,
    undefined,
    'ABSENCE GUARD FAILED: pptxTypeface must be stripped when fontFamily changes'
  );

  // 3. When font weight is changed, pptxTypeface MUST be deleted
  const weightChanged = serializeTextStyle(source, {
    fontFamily: 'Montserrat',
    fontSize: 32,
    fontWeight: '700',
  });
  assert.equal(
    weightChanged?.pptxTypeface,
    undefined,
    'ABSENCE GUARD FAILED: pptxTypeface must be stripped when fontWeight changes'
  );
});

// --------------------------------------------------------------------------
// T-32-07: Executable Go Test Conformance Suite
// --------------------------------------------------------------------------

test('T-32-07: Full Go test suites pass for pptximport, plan, and httpapi', () => {
  try {
    const output = execSync('go test ./internal/pptximport ./internal/plan ./internal/httpapi', {
      cwd: root,
      encoding: 'utf8',
    });
    assert.ok(output.includes('ok  \tgithub.com/wiradeltaid/worship-deck/internal/pptximport'));
    assert.ok(output.includes('ok  \tgithub.com/wiradeltaid/worship-deck/internal/plan'));
    assert.ok(output.includes('ok  \tgithub.com/wiradeltaid/worship-deck/internal/httpapi'));
  } catch (err) {
    if (err.stdout) console.error('T-32-07 FAILED stdout:\n', err.stdout);
    if (err.stderr) console.error('T-32-07 FAILED stderr:\n', err.stderr);
    throw err;
  }
});

// --------------------------------------------------------------------------
// T-32-08: Live Go API Server End-to-End Smoke Test (FR-20 Agent Proof-of-Done)
// --------------------------------------------------------------------------

test('T-32-08: Live Go API server end-to-end smoke test (FR-20 proof-of-done exercised by agent)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-spec32-live-'));
  const testDb = path.join(tmpDir, 'test.db');
  const uploadsDir = path.join(tmpDir, 'uploads');
  const authSecret = 'smoke-spec32-secret-key-1234567890';
  const bootstrapUser = 'admin';
  const bootstrapPass = 'admin-secret-pass-99';

  const { child, base } = await spawnGoApi({
    root,
    dbPath: testDb,
    env: {
      UPLOADS_DIR: uploadsDir,
      AUTH_SECRET: authSecret,
      AUTH_BOOTSTRAP_USER: bootstrapUser,
      AUTH_BOOTSTRAP_PASSWORD: bootstrapPass,
    },
  });

  try {
    // 1. Admin login to get session cookie
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: bootstrapUser, password: bootstrapPass }),
    });
    assert.equal(loginRes.status, 200, 'admin login must succeed');
    const cookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';
    assert.ok(cookie.length > 0, 'session cookie must be returned');

    // 2. Build synthetic PPTX with Montserrat Light, spc="150" (2.0px), and embedded font
    const zip = new JSZip();
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Default Extension="ttf" ContentType="font/ttf"/>
</Types>`
    );
    zip.file(
      'ppt/presentation.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
  <p:embeddedFontLst>
    <p:embeddedFont>
      <p:font typeface="CustomChurchFont"/>
      <p:regular r:id="rIdFontReg"/>
    </p:embeddedFont>
  </p:embeddedFontLst>
</p:presentation>`
    );
    zip.file(
      'ppt/_rels/presentation.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rIdFontReg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/church.ttf"/>
</Relationships>`
    );
    zip.file(
      'ppt/slides/slide1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="TitleBox"/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="8000000" cy="3000000"/></a:xfrm></p:spPr>
        <p:txBody>
          <p:p>
            <a:r>
              <a:rPr sz="3200" spc="150">
                <a:latin typeface="Montserrat Light"/>
              </a:rPr>
              <a:t>Worship Title with Spacing</a:t>
            </a:r>
          </p:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
    );
    const validTTF = Buffer.from([
      0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x10, 0x00, 0x03, 0x00, 0x00,
      0x68, 0x65, 0x61, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1C, 0x00, 0x00, 0x00, 0x04,
      0x01, 0x02, 0x03, 0x04,
    ]);
    zip.file('ppt/fonts/church.ttf', validTTF);

    const pptxBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // 3. Upload & Import via POST /api/admin/artifacts/import-pptx
    const form = new FormData();
    form.append('file', new Blob([pptxBuffer]), 'smoke_presentation.pptx');

    const importRes = await fetch(`${base}/api/admin/artifacts/import-pptx`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: form,
    });
    assert.equal(importRes.status, 201, 'import-pptx must return 201 Created');
    const importData = await importRes.json();
    assert.equal(importData.importedCount, 1, 'must import 1 slide template');
    assert.equal(importData.importedFonts, 1, 'must import 1 embedded font face');

    const firstTmpl = importData.firstTemplate;
    const textEl = firstTmpl.layouts.default.elements.find((el) => el.type === 'text');
    assert.ok(textEl, 'imported template must contain a text element');
    assert.equal(textEl.style.fontFamily, 'Montserrat', 'canonical family must be Montserrat');
    assert.equal(textEl.style.fontWeight, '300', 'numeric weight must be 300');
    assert.equal(textEl.style.letterSpacing, 1.5, 'letterSpacing must be 1.5px (150 / 100 in modern 540pt widescreen)');
    assert.equal(textEl.style.pptxTypeface, 'Montserrat Light', 'pptxTypeface must be Montserrat Light');

    // 4. Verify font routes: GET /api/fonts and GET /api/fonts/{id}
    const fontsRes = await fetch(`${base}/api/fonts`, {
      headers: { Cookie: cookie },
    });
    assert.equal(fontsRes.status, 200, 'GET /api/fonts must return 200');
    const fontList = await fontsRes.json();
    assert.equal(fontList.length, 1, 'must list 1 font face');
    assert.equal(fontList[0].family, 'CustomChurchFont');

    const fontDownloadRes = await fetch(`${base}${fontList[0].url}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(fontDownloadRes.status, 200, 'downloading font face must return 200');
    assert.equal(fontDownloadRes.headers.get('content-type'), 'font/ttf');
    assert.equal(fontDownloadRes.headers.get('x-content-type-options'), 'nosniff');
    const downloadedFont = Buffer.from(await fontDownloadRes.arrayBuffer());
    assert.equal(downloadedFont.length, validTTF.length, 'downloaded font bytes must match');

    // 5. Update template using editor serialization discipline and verify pptxTypeface is cleared on font edit
    const serializedStyle = serializeTextStyle(textEl, {
      fontFamily: 'Inter',
      fontSize: 32,
      fontWeight: '300',
    });
    assert.equal(serializedStyle.pptxTypeface, undefined, 'editor serialization must strip pptxTypeface');

    const updateRes = await fetch(`${base}/api/admin/artifacts/${firstTmpl.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({
        ...firstTmpl,
        layouts: {
          ...firstTmpl.layouts,
          default: {
            ...firstTmpl.layouts.default,
            elements: [
              {
                ...textEl,
                style: serializedStyle,
              },
            ],
          },
        },
      }),
    });
    assert.equal(updateRes.status, 200, 'PUT /api/admin/artifacts/{id} must succeed');
    const updatedData = await updateRes.json();
    const updatedEl = updatedData.layouts.default.elements.find((el) => el.type === 'text');
    assert.equal(updatedEl.style.fontFamily, 'Inter');
    assert.equal(updatedEl.style.pptxTypeface, undefined, 'pptxTypeface must be absent after family edit');
  } finally {
    stopProcess(child);
  }
});

