/**
 * SPEC-35: PPTX Modern 16:9 Widescreen Parity (33.867 cm x 19.05 cm) & 1:1 Canvas Font Alignment Smoke Suite
 *
 * Automated verification of:
 * - T-35-01: Modern widescreen slide dimensions OOXML conformance (LAYOUT_WIDE, 12,192,000 x 6,858,000 EMU)
 * - T-35-02: 1:1 Canvas font size to PPTX point geometry parity (PX_TO_PT = 1.0)
 * - T-35-03: Character spacing export parity on OOXML runs (* 100 conversion contract)
 * - T-35-04: Dynamic Go import scaling conformance for modern (540pt) and legacy (405pt) slides
 * - T-35-05: Absence guards and structural defect invariant proofs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const {
  PPTX_SLIDE_HEIGHT_IN,
  PPTX_SLIDE_WIDTH_IN,
  PX_TO_PT,
  toPptxGeometry,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'artifacts', 'render-model.ts')).href
);

const { generatePptxFromPlan } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'pptx-draw.ts')).href
);

const renderModelSourcePath = path.join(root, 'src', 'lib', 'artifacts', 'render-model.ts');
assert.ok(fs.existsSync(renderModelSourcePath), 'render-model.ts must exist');

const pptxDrawSourcePath = path.join(root, 'src', 'lib', 'pptx-draw.ts');
assert.ok(fs.existsSync(pptxDrawSourcePath), 'pptx-draw.ts must exist');

const textExtractGoPath = path.join(root, 'internal', 'pptximport', 'text_extract.go');
assert.ok(fs.existsSync(textExtractGoPath), 'internal/pptximport/text_extract.go must exist');

const parserGoPath = path.join(root, 'internal', 'pptximport', 'parser.go');
assert.ok(fs.existsSync(parserGoPath), 'internal/pptximport/parser.go must exist');

// --------------------------------------------------------------------------
// T-35-01: Modern Widescreen Slide Dimensions OOXML Conformance
// --------------------------------------------------------------------------

test('T-35-01: Generated PPTX archive declares LAYOUT_WIDE slide dimensions (12192000 x 6858000 EMU)', async () => {
  const plan = [
    {
      artifact: {
        runtimeVersion: 1,
        instanceId: 'wide-dim-inst',
        templateId: 'wide-dim-tmpl',
        label: 'Modern Widescreen Test',
        baseType: 'general',
        layoutKey: 'default',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: '#1E293B',
          elements: [
            {
              id: 'title-wide',
              type: 'text',
              x: 10,
              y: 10,
              w: 80,
              h: 30,
              text: 'Modern 16:9 Widescreen Parity',
              style: {
                fontFamily: 'Arial',
                fontSize: 24,
                fontColor: '#FFFFFF',
              },
            },
          ],
        },
      },
    },
  ];

  const buffer = await generatePptxFromPlan('2026-09-15', plan, 'none');
  assert.ok(buffer && buffer.length > 0, 'PPTX buffer must be generated');

  const zip = await JSZip.loadAsync(buffer);
  const presXml = await zip.file('ppt/presentation.xml').async('string');

  // Must declare modern widescreen dimensions: cx="12192000" cy="6858000" (960 pt x 540 pt)
  assert.ok(
    presXml.includes('cx="12192000"') && presXml.includes('cy="6858000"'),
    `presentation.xml must declare cx="12192000" cy="6858000", got: ${presXml}`
  );

  // Must NOT declare legacy 10in x 5.625in dimensions: cx="9144000" cy="5143500"
  assert.ok(
    !presXml.includes('cx="9144000"') && !presXml.includes('cy="5143500"'),
    'presentation.xml must NOT declare legacy 9144000 x 5143500 EMU dimensions'
  );
});

// --------------------------------------------------------------------------
// T-35-02: 1:1 Canvas Font Size to PPTX Point Geometry Parity
// --------------------------------------------------------------------------

test('T-35-02: 1:1 Canvas font size to PPTX point geometry parity (PX_TO_PT = 1.0)', () => {
  assert.equal(PX_TO_PT, 1.0, 'PX_TO_PT must be exactly 1.0 in modern widescreen contract');
  assert.equal(PPTX_SLIDE_WIDTH_IN, 960 / 72, 'PPTX_SLIDE_WIDTH_IN must be exact 960 / 72');
  assert.equal(PPTX_SLIDE_HEIGHT_IN, 7.5, 'PPTX_SLIDE_HEIGHT_IN must be exact 7.5 (540 / 72)');

  const testElement = (fontSize) => ({
    id: 'el-font-test',
    type: 'text',
    x: 10,
    y: 10,
    w: 80,
    h: 40,
    text: 'Typography Test',
    style: { fontSize, fontFamily: 'Arial' },
  });

  // Font 12 must map to 12 pt, NOT 9 pt
  const geom12 = toPptxGeometry(testElement(12));
  assert.equal(geom12.fontSize, 12, 'Canvas font 12 must map to 12 pt in PPTX geometry');

  // Font 24 must map to 24 pt, NOT 18 pt
  const geom24 = toPptxGeometry(testElement(24));
  assert.equal(geom24.fontSize, 24, 'Canvas font 24 must map to 24 pt in PPTX geometry');

  // Font 32 must map to 32 pt, NOT 24 pt
  const geom32 = toPptxGeometry(testElement(32));
  assert.equal(geom32.fontSize, 32, 'Canvas font 32 must map to 32 pt in PPTX geometry');
});

// --------------------------------------------------------------------------
// T-35-03: Character Spacing Export Parity on OOXML Runs
// --------------------------------------------------------------------------

test('T-35-03: Character spacing export parity on OOXML runs (* 100 conversion formula)', async () => {
  const plan = [
    {
      artifact: {
        runtimeVersion: 1,
        instanceId: 'spc-inst',
        templateId: 'spc-tmpl',
        label: 'Character Spacing Parity Test',
        baseType: 'general',
        layoutKey: 'default',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: '#000000',
          elements: [
            {
              id: 'spc-pos',
              type: 'text',
              x: 10,
              y: 10,
              w: 80,
              h: 20,
              text: 'Positive Spacing Line',
              style: { fontFamily: 'Montserrat', fontSize: 32, letterSpacing: 1.5 },
            },
            {
              id: 'spc-neg',
              type: 'text',
              x: 10,
              y: 35,
              w: 80,
              h: 20,
              text: 'Negative Spacing Line',
              style: { fontFamily: 'Montserrat', fontSize: 32, letterSpacing: -0.5 },
            },
            {
              id: 'spc-zero',
              type: 'text',
              x: 10,
              y: 60,
              w: 80,
              h: 20,
              text: 'Zero Spacing Line',
              style: { fontFamily: 'Montserrat', fontSize: 32, letterSpacing: 0 },
            },
            {
              id: 'spc-none',
              type: 'text',
              x: 10,
              y: 80,
              w: 80,
              h: 15,
              text: 'Omitted Spacing Line',
              style: { fontFamily: 'Montserrat', fontSize: 32 },
            },
          ],
        },
      },
    },
  ];

  const buffer = await generatePptxFromPlan('2026-09-15', plan, 'none');
  const zip = await JSZip.loadAsync(buffer);
  const slide1Xml = await zip.file('ppt/slides/slide1.xml').async('string');

  // 1. letterSpacing: 1.5 must emit spc="150" (1.5 * 100)
  assert.ok(
    slide1Xml.includes('spc="150"'),
    'slide1.xml must contain spc="150" for letterSpacing: 1.5'
  );

  // 2. letterSpacing: -0.5 must emit spc="-50" (-0.5 * 100)
  assert.ok(
    slide1Xml.includes('spc="-50"'),
    'slide1.xml must contain spc="-50" for letterSpacing: -0.5'
  );

  // 3. Shapes with zero or omitted letterSpacing must not emit spc attribute
  const shapes = slide1Xml.split('<p:sp>');
  for (const shape of shapes) {
    if (shape.includes('Zero Spacing Line') || shape.includes('Omitted Spacing Line')) {
      assert.ok(
        !shape.includes('spc='),
        'runs for Zero or Omitted Spacing Line must NOT contain spc attribute'
      );
    }
  }
});

test('T-35-03B: Ordinal-shift resilience against unavailable images and blank text elements', async () => {
  const plan = [
    {
      artifact: {
        runtimeVersion: 1,
        instanceId: 'shift-resilience-inst',
        templateId: 'shift-resilience-tmpl',
        label: 'Shift Resilience Test',
        baseType: 'general',
        layoutKey: 'default',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: '#000000',
          elements: [
            {
              id: 'unresolved-img',
              type: 'image',
              x: 0,
              y: 0,
              w: 50,
              h: 40,
              imageUrl: '/assets/non-existent-fallback.jpg',
              style: {},
            },
            {
              id: 'blank-text',
              type: 'text',
              x: 10,
              y: 10,
              w: 20,
              h: 10,
              text: '   ',
              style: {},
            },
            {
              id: 'tracked-text',
              type: 'text',
              x: 10,
              y: 50,
              w: 80,
              h: 30,
              text: 'Target Tracked Element',
              style: { fontFamily: 'Montserrat', fontSize: 32, letterSpacing: 1.5 },
            },
          ],
        },
      },
    },
  ];

  const buffer = await generatePptxFromPlan('2026-09-15', plan, 'none');
  const zip = await JSZip.loadAsync(buffer);
  const slide1Xml = await zip.file('ppt/slides/slide1.xml').async('string');

  const shapes = slide1Xml.split('<p:sp>').filter((s) => s.includes('<p:txBody>'));
  assert.equal(shapes.length, 2, 'slide must contain fallback image shape and target text shape');

  // Fallback shape (Image unavailable) must NOT carry spc
  assert.ok(shapes[0].includes('Image unavailable'), 'shape 0 must be Image unavailable');
  assert.ok(!shapes[0].includes('spc='), 'Image unavailable fallback shape must NOT carry spc attribute');

  // Target text shape must carry spc="150"
  assert.ok(shapes[1].includes('Target Tracked Element'), 'shape 1 must be Target Tracked Element');
  assert.ok(shapes[1].includes('spc="150"'), 'Target Tracked Element shape must carry spc="150"');
});

// --------------------------------------------------------------------------
// T-35-04: Dynamic Go Import Scaling Conformance
// --------------------------------------------------------------------------

test('T-35-04: Dynamic Go import scaling passes full test suite for modern and legacy slides', () => {
  const output = execSync('go test -v ./internal/pptximport -run TestDynamicSlideDimensionsAndTypographyScaling', {
    encoding: 'utf8',
    cwd: root,
  });

  assert.ok(
    output.includes('--- PASS: TestDynamicSlideDimensionsAndTypographyScaling'),
    'TestDynamicSlideDimensionsAndTypographyScaling must pass'
  );
});

// --------------------------------------------------------------------------
// T-35-05: Absence Guards & Defect Invariant Proofs
// --------------------------------------------------------------------------

test('T-35-05: Absence Guard 1 — render-model.ts declares exact widescreen constants and excludes legacy dimensions', () => {
  const renderModelCode = fs.readFileSync(renderModelSourcePath, 'utf8');

  // Must declare exact modern constants
  assert.ok(
    renderModelCode.includes('export const PPTX_SLIDE_WIDTH_IN = 960 / 72;'),
    'render-model.ts must declare PPTX_SLIDE_WIDTH_IN = 960 / 72'
  );
  assert.ok(
    renderModelCode.includes('export const PPTX_SLIDE_HEIGHT_IN = 540 / 72;'),
    'render-model.ts must declare PPTX_SLIDE_HEIGHT_IN = 540 / 72'
  );
  assert.ok(
    renderModelCode.includes('const PPTX_SLIDE_HEIGHT_PT = 540;'),
    'render-model.ts must declare PPTX_SLIDE_HEIGHT_PT = 540'
  );
  assert.ok(
    renderModelCode.includes('export const PX_TO_PT = PPTX_SLIDE_HEIGHT_PT / REFERENCE_CANVAS.height;'),
    'render-model.ts must derive PX_TO_PT from 540pt / 540px'
  );

  // Absence guards: legacy values must be completely absent
  assert.ok(
    !renderModelCode.includes('PPTX_SLIDE_WIDTH_IN = 10;'),
    'Legacy PPTX_SLIDE_WIDTH_IN = 10 must be absent'
  );
  assert.ok(
    !renderModelCode.includes('PPTX_SLIDE_HEIGHT_IN = 5.625;'),
    'Legacy PPTX_SLIDE_HEIGHT_IN = 5.625 must be absent'
  );
  assert.ok(
    !renderModelCode.includes('PPTX_SLIDE_HEIGHT_PT = 405;'),
    'Legacy PPTX_SLIDE_HEIGHT_PT = 405 must be absent'
  );
});

test('T-35-05: Absence Guard 2 — pptx-draw.ts sets LAYOUT_WIDE and 1:1 character spacing', () => {
  const pptxDrawCode = fs.readFileSync(pptxDrawSourcePath, 'utf8');

  // Must use LAYOUT_WIDE
  assert.ok(
    pptxDrawCode.includes("pres.layout = 'LAYOUT_WIDE';"),
    "pptx-draw.ts must set pres.layout = 'LAYOUT_WIDE'"
  );
  assert.ok(
    !pptxDrawCode.includes("pres.layout = 'LAYOUT_16x9';"),
    "Legacy pres.layout = 'LAYOUT_16x9' must be absent"
  );

  // Must use * 100 character spacing formula
  assert.ok(
    pptxDrawCode.includes('Math.round(el.style.letterSpacing * 100)'),
    'pptx-draw.ts must compute letterSpacing * 100'
  );
  assert.ok(
    !pptxDrawCode.includes('Math.round(el.style.letterSpacing * 75)'),
    'Legacy letterSpacing * 75 formula must be absent'
  );
});

test('T-35-05: Absence Guard 3 — pptximport excludes hardcoded PxToPt = 0.75 and derives dynamic scale', () => {
  const textExtractCode = fs.readFileSync(textExtractGoPath, 'utf8');
  const parserCode = fs.readFileSync(parserGoPath, 'utf8');

  // Legacy hardcoded PxToPt constant must be absent
  assert.ok(
    !textExtractCode.includes('const PxToPt = 0.75'),
    'Legacy const PxToPt = 0.75 must be absent from text_extract.go'
  );

  // Dynamic scale calculation must be present in parser.go
  assert.ok(
    parserCode.includes('slideHeightPt := float64(cy) / 12700.0') &&
      parserCode.includes('pxToPt := slideHeightPt / 540.0'),
    'parser.go must derive dynamic pxToPt scale from slideHeightPt / 540.0'
  );
});
