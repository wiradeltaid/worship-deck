/**
 * SPEC-27: PPTX as Primary Anchor 1-to-1 Visual Parity Smoke Suite
 *
 * Automated verification of:
 * - SPEC-27-01: PPTX line spacing formula and baseline half-leading compensation
 * - SPEC-27-02: Canvas Editor Option A single DOM visual architecture and 16:9 stage framing
 * - SPEC-27-03: Embedded TrueType font packaging in PPTX export
 * - SPEC-27-04: Absence guards verified failing red before passing green
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  elementToFabricObject,
  serializeCanvas,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts')).href
);

const {
  TEXT_LINE_HEIGHT,
  estimateTextFitScale,
  toPptxGeometry,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'artifacts', 'render-model.ts')).href
);

const { generatePptxFromPlan } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'pptx-draw.ts')).href
);

const { embedPresentationFonts, getFontData } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'fonts', 'embed-fonts.ts')).href
);

// --------------------------------------------------------------------------
// SPEC-27-01 Tests: Line Spacing Normalization & Baseline Half-Leading
// --------------------------------------------------------------------------

test('T-27-01: Line spacing normalization in pptx-draw.ts emits val="100000" for 1.2 line-height', async () => {
  const planItem = {
    artifact: {
      runtimeVersion: 1,
      instanceId: 'i-norm-1',
      templateId: 't-norm-1',
      label: 'Normal Line Spacing',
      baseType: 'general',
      layoutKey: 'default',
      layout: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [
          {
            id: 't1',
            type: 'text',
            x: 10,
            y: 10,
            w: 80,
            h: 30,
            zIndex: 0,
            text: 'Testing normalized 1.2 line spacing',
            style: { fontSize: 32, lineHeight: 1.2 },
          },
        ],
      },
    },
  };

  const buf = await generatePptxFromPlan('2026-09-13', [planItem], 'none');
  const zip = await JSZip.loadAsync(buf);
  const slide1Xml = await zip.file('ppt/slides/slide1.xml')?.async('string');

  assert.ok(slide1Xml, 'ppt/slides/slide1.xml must exist');
  // (1.2 / 1.2) * 100000 = 100000 (100% of PowerPoint single line pitch = 1.2em matching CSS)
  assert.ok(
    slide1Xml.includes('<a:spcPct val="100000"/>'),
    'slide XML must contain <a:spcPct val="100000"/> for 1.2 line-height'
  );
});

test('T-27-02: Line spacing normalization reflects tight (<1.0) and wide (>1.0) line-heights accurately', async () => {
  const tightItem = {
    artifact: {
      runtimeVersion: 1,
      instanceId: 'i-tight',
      templateId: 't-tight',
      label: 'Tight Line Spacing',
      baseType: 'general',
      layoutKey: 'default',
      layout: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [
          {
            id: 't-tight',
            type: 'text',
            x: 10,
            y: 10,
            w: 80,
            h: 30,
            zIndex: 0,
            text: 'Tight line spacing',
            style: { fontSize: 32, lineHeight: 0.8 },
          },
        ],
      },
    },
  };

  const buf = await generatePptxFromPlan('2026-09-13', [tightItem], 'none');
  const zip = await JSZip.loadAsync(buf);
  const slide1Xml = await zip.file('ppt/slides/slide1.xml')?.async('string');

  assert.ok(slide1Xml, 'ppt/slides/slide1.xml must exist');
  // Line spacing normalization scales DrawingML line pitch proportionally (lineHeight / 1.2):
  // Math.round((0.8 / 1.2) * 100000) = 66670, matching CSS line-height across all values and keeping
  // bottom descenders strictly within slide boundaries in PowerPoint.
  assert.ok(
    slide1Xml.includes('<a:spcPct val="66670"/>'),
    'slide XML must contain <a:spcPct val="66670"/> for 0.8 line-height'
  );
});

test('T-27-03: ArtifactSlide compensates negative half-leading when lineHeight < 1.0 to prevent top ascender clipping', () => {
  const slidePath = path.join(root, 'src', 'components', 'artifacts', 'ArtifactSlide.tsx');
  const code = fs.readFileSync(slidePath, 'utf8');

  assert.ok(
    code.includes('topHalfLeadingComp') || code.includes('(1.0 - effectiveLineHeight) / 2'),
    'ArtifactSlide must calculate top half-leading compensation for lineHeight < 1.0'
  );
  assert.ok(
    code.includes('paddingTop'),
    'ArtifactSlide TextElement must apply paddingTop compensation'
  );
});

// --------------------------------------------------------------------------
// SPEC-27-02 Tests: Canvas Editor Option A Single Visual Engine & 16:9 Stage
// --------------------------------------------------------------------------

test('T-27-04: Canvas Editor mounts ArtifactSlide as single visual layer inside 16:9 stage (Option A)', () => {
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // Must import ArtifactSlide
  assert.ok(
    code.includes("import ArtifactSlide from '@/components/artifacts/ArtifactSlide'"),
    'ArtifactEditor must import ArtifactSlide component'
  );

  // Must mount ArtifactSlide inside stage container
  assert.ok(
    code.includes('<ArtifactSlide instance={liveInstance} />'),
    'ArtifactEditor must mount <ArtifactSlide instance={liveInstance} />'
  );

  // Must define 16:9 stage container with test ID and boundary styling
  assert.ok(
    code.includes('data-testid="editor-16-9-stage"'),
    'ArtifactEditor must define editor-16-9-stage container'
  );
  assert.ok(
    code.includes('border: \'1px solid rgba(255, 255, 255, 0.25)\''),
    '16:9 stage must have crisp 1px solid rgba(255, 255, 255, 0.25) boundary outline'
  );
  assert.ok(
    code.includes('overflow: \'hidden\'') && code.includes('boxShadow'),
    '16:9 stage must enforce overflow: hidden and drop shadow'
  );
});

test('T-27-05: elementToFabricObject produces transparent interaction proxy when transparentProxy is true', () => {
  const textEl = {
    id: 't-proxy',
    type: 'text',
    x: 10,
    y: 15,
    w: 40,
    h: 20,
    zIndex: 0,
    content: 'Proxy Headline',
    style: { fontSize: 36, fontColor: '#FFFFFF' },
  };

  const shapeEl = {
    id: 's-proxy',
    type: 'shape',
    x: 5,
    y: 5,
    w: 50,
    h: 30,
    zIndex: 0,
    style: { fillColor: '#5C2E16', opacity: 0.8 },
  };

  const imageEl = {
    id: 'img-proxy',
    type: 'image',
    x: 20,
    y: 20,
    w: 30,
    h: 30,
    zIndex: 0,
    imageRef: '/api/uploads/sample.png',
  };

  // Mock minimal Fabric
  const mockFabric = {
    Textbox: class {
      constructor(text, opts) {
        Object.assign(this, opts);
        this.type = 'textbox';
        this.text = text;
      }
      set(k, v) {
        if (typeof k === 'object') Object.assign(this, k);
        else this[k] = v;
      }
    },
    Rect: class {
      constructor(opts) {
        Object.assign(this, opts);
        this.type = 'rect';
      }
    },
  };

  const textObj = elementToFabricObject(mockFabric, textEl, true, { transparentProxy: true });
  assert.equal(textObj.fill, 'transparent', 'Text proxy must have transparent fill');
  assert.equal(textObj.borderColor, '#2563EB', 'Text proxy must carry #2563EB selection border');

  const shapeObj = elementToFabricObject(mockFabric, shapeEl, true, { transparentProxy: true });
  assert.equal(shapeObj.fill, 'transparent', 'Shape proxy must have transparent fill');
  assert.equal(shapeObj.borderColor, '#2563EB', 'Shape proxy must carry #2563EB selection border');

  const imgObj = elementToFabricObject(mockFabric, imageEl, true, { transparentProxy: true });
  assert.equal(imgObj.fill, 'transparent', 'Image proxy must have transparent fill');
});

// --------------------------------------------------------------------------
// SPEC-27-03 Tests: Embedded TrueType Font Packaging
// --------------------------------------------------------------------------

test('T-27-06: embedPresentationFonts packages TrueType fonts into PPTX archive', async () => {
  const testZip = new JSZip();
  testZip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
  testZip.file('ppt/presentation.xml', '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:notesSz cx="5143500" cy="9144000"/><p:defaultTextStyle/></p:presentation>');
  testZip.file('ppt/_rels/presentation.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="sample" Target="sample"/></Relationships>');

  const embedded = await embedPresentationFonts(testZip, ['Poppins']);
  assert.ok(embedded.includes('Poppins'), 'Poppins must be embedded');

  // Check fonts directory in zip has .odttf part
  const fontFiles = Object.keys(testZip.files).filter((k) => k.startsWith('ppt/fonts/') && k.endsWith('.odttf'));
  assert.ok(fontFiles.length > 0, 'ppt/fonts/*.odttf must exist in archive');

  // Check presentation.xml injection
  const presXml = await testZip.file('ppt/presentation.xml').async('string');
  assert.ok(presXml.includes('<p:embeddedFontLst>'), 'presentation.xml must contain <p:embeddedFontLst>');
  assert.ok(presXml.includes('<p:font typeface="Poppins"/>'), 'embeddedFontLst must declare typeface Poppins');

  // Check rels injection
  const relsXml = await testZip.file('ppt/_rels/presentation.xml.rels').async('string');
  assert.ok(
    relsXml.includes('Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font"'),
    'rels must declare font relationship'
  );

  // Check Content_Types
  const ctXml = await testZip.file('[Content_Types].xml').async('string');
  assert.ok(
    ctXml.includes('Extension="odttf"') &&
      ctXml.includes('ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"'),
    'Content_Types must declare application/vnd.openxmlformats-officedocument.obfuscatedFont for odttf'
  );
});

test('T-27-07: Universal system fonts (Arial, Calibri) skip font embedding', async () => {
  const testZip = new JSZip();
  testZip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
  testZip.file('ppt/presentation.xml', '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>');
  testZip.file('ppt/_rels/presentation.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');

  const embedded = await embedPresentationFonts(testZip, ['Arial', 'Calibri', 'Times New Roman']);
  assert.equal(embedded.length, 0, 'Universal system fonts must not be embedded');
  const fontFiles = Object.keys(testZip.files).filter((k) => k.startsWith('ppt/fonts/'));
  assert.equal(fontFiles.length, 0, 'No font files should be added for system fonts');
});

// --------------------------------------------------------------------------
// SPEC-27-04 Tests: Absence Guards Proven Failing Red Before Passing Green
// --------------------------------------------------------------------------

test('T-27-08: Absence Guard 1 — un-normalized line spacing bloat detection in pptx-draw.ts', () => {
  const drawPath = path.join(root, 'src', 'lib', 'pptx-draw.ts');
  const code = fs.readFileSync(drawPath, 'utf8');

  function scanLineSpacingNormalization(source) {
    const start = source.indexOf('lineSpacingMultiple =');
    if (start === -1) {
      throw new Error('ABSENCE GUARD FAILED: lineSpacingMultiple is not defined in pptx-draw.ts');
    }
    const snippet = source.slice(start, start + 250);
    if (!snippet.includes('/ 1.2')) {
      throw new Error('ABSENCE GUARD FAILED: lineSpacingMultiple is not normalized by dividing by 1.2 factor');
    }
    return true;
  }

  // 1. Defect injection: removing "/ 1.2" factor fails guard
  const defectiveCode = code.replace(
    /Math\.round\(\(effectiveLineHeight \/ 1\.2\) \* 10000\) \/ 10000;/,
    'effectiveLineHeight;'
  );
  assert.notEqual(defectiveCode, code, 'Defect replacement must modify code');
  assert.throws(
    () => scanLineSpacingNormalization(defectiveCode),
    /ABSENCE GUARD FAILED: lineSpacingMultiple is not normalized by dividing by 1.2 factor/,
    'Defective un-normalized line spacing in pptx-draw.ts must fail guard red'
  );

  // 2. Real code passes green
  assert.ok(scanLineSpacingNormalization(code), 'Real production pptx-draw.ts passes line spacing guard green');
});

test('T-27-09: Absence Guard 2 — stage overflow bleed clipping detection in ArtifactEditor.tsx', () => {
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  function scanStageClippingAndBoundary(source) {
    const stageStart = source.indexOf('data-testid="editor-16-9-stage"');
    if (stageStart === -1) {
      throw new Error('ABSENCE GUARD FAILED: editor-16-9-stage container is not defined');
    }
    const stageBlock = source.slice(stageStart, stageStart + 500);
    if (!stageBlock.includes("overflow: 'hidden'")) {
      throw new Error('ABSENCE GUARD FAILED: 16:9 stage does not enforce overflow: hidden for off-canvas bleed clipping');
    }
    if (!stageBlock.includes("border: '1px solid rgba(255, 255, 255, 0.25)'")) {
      throw new Error('ABSENCE GUARD FAILED: 16:9 stage does not define 1px solid rgba(255, 255, 255, 0.25) boundary line');
    }
    return true;
  }

  // 1. Defect injection: removing overflow: 'hidden' fails guard
  const defectiveOverflow = code.replace("overflow: 'hidden'", "overflow: 'visible'");
  assert.throws(
    () => scanStageClippingAndBoundary(defectiveOverflow),
    /overflow: hidden/,
    'Defect missing overflow: hidden must fail guard red'
  );

  // 2. Defect injection: removing boundary border fails guard
  const defectiveBorder = code.replace("border: '1px solid rgba(255, 255, 255, 0.25)'", "border: 'none'");
  assert.throws(
    () => scanStageClippingAndBoundary(defectiveBorder),
    /boundary line/,
    'Defect missing boundary line must fail guard red'
  );

  // 3. Real code passes green
  assert.ok(scanStageClippingAndBoundary(code), 'Real ArtifactEditor.tsx stage boundary passes guard green');
});

test('T-27-10: Absence Guard 3 — Google Fonts embedding detection in exported PPTX', async () => {
  async function verifyPptxFontEmbedding(buffer, expectedFont) {
    const zip = await JSZip.loadAsync(buffer);
    const presXml = await zip.file('ppt/presentation.xml')?.async('string');
    if (!presXml || !presXml.includes(`<p:font typeface="${expectedFont}"/>`)) {
      throw new Error(`ABSENCE GUARD FAILED: Font ${expectedFont} is not embedded in ppt/presentation.xml`);
    }
    const fontFiles = Object.keys(zip.files).filter(
      (k) => k.startsWith('ppt/fonts/') && (k.endsWith('.odttf') || k.endsWith('.fntdata'))
    );
    if (fontFiles.length === 0) {
      throw new Error(`ABSENCE GUARD FAILED: No font data files found under ppt/fonts/`);
    }
    return true;
  }

  const planItem = {
    artifact: {
      runtimeVersion: 1,
      instanceId: 'i-guard',
      templateId: 't-guard',
      label: 'Guard Test',
      baseType: 'general',
      layoutKey: 'default',
      layout: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [
          {
            id: 't-poppins',
            type: 'text',
            x: 10,
            y: 10,
            w: 80,
            h: 30,
            zIndex: 0,
            text: 'Poppins headline',
            style: { fontFamily: 'Poppins', fontSize: 32 },
          },
        ],
      },
    },
  };

  const buffer = await generatePptxFromPlan('2026-09-13', [planItem], 'none');

  // 1. Defect injection: stripping <p:embeddedFontLst> from generated archive fails guard red
  const zip = await JSZip.loadAsync(buffer);
  const presFile = zip.file('ppt/presentation.xml');
  const presXml = await presFile.async('string');
  const strippedXml = presXml.replace(/<p:embeddedFontLst>[\s\S]*?<\/p:embeddedFontLst>/, '');
  zip.file('ppt/presentation.xml', strippedXml);
  const defectiveBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  await assert.rejects(
    () => verifyPptxFontEmbedding(defectiveBuffer, 'Poppins'),
    /ABSENCE GUARD FAILED: Font Poppins is not embedded/,
    'Stripped font embedding must fail guard red'
  );

  // 2. Real generated PPTX buffer passes green
  const isEmbedded = await verifyPptxFontEmbedding(buffer, 'Poppins');
  assert.ok(isEmbedded, 'Real PPTX export with Poppins passes font embedding guard green');
});
