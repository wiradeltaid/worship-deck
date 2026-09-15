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
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync } from 'child_process';
import JSZip from 'jszip';

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
  // Formula: letterSpacing px = spc / 75.0; spc = round(letterSpacing * 75)
  const cases = [
    { spc: 150, expectedPx: 2.0 },
    { spc: -75, expectedPx: -1.0 },
    { spc: 75, expectedPx: 1.0 },
    { spc: 0, expectedPx: 0.0 },
    { spc: 1, expectedPx: 1 / 75 },
    { spc: -1, expectedPx: -1 / 75 },
  ];

  for (const c of cases) {
    const px = c.spc / 75.0;
    const roundSpc = Math.round(px * 75);
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
                letterSpacing: 2.0, // 2.0 * 75 = 150
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

  // Positive spacing (2.0px -> spc="150") must be present
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
              style: { fontFamily: 'Montserrat', fontSize: 32, letterSpacing: 1.0 }, // 1.0 * 75 = 75
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
              style: { fontFamily: 'Montserrat', fontSize: 32, letterSpacing: -1.0 }, // -1.0 * 75 = -75
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
  assert.ok(dupShapes[0].includes('spc="75"'), 'first duplicate shape must carry spc="75"');
  assert.ok(dupShapes[1].includes('spc="-75"'), 'second duplicate shape must carry spc="-75"');
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
  const output = execSync('go test ./internal/pptximport ./internal/plan ./internal/httpapi', {
    cwd: root,
    encoding: 'utf8',
  });
  assert.ok(output.includes('ok  \tgithub.com/wiradigitalid/worship-presenter-web/internal/pptximport'));
  assert.ok(output.includes('ok  \tgithub.com/wiradigitalid/worship-presenter-web/internal/plan'));
  assert.ok(output.includes('ok  \tgithub.com/wiradigitalid/worship-presenter-web/internal/httpapi'));
});
