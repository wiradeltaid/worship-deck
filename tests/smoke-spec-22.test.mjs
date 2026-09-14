import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { validateArtifactTemplate } from '../src/lib/registry/validate.ts';
import {
  serializeCanvas,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  pctToPx,
} from '../src/lib/registry/canvas-utils.ts';
import {
  resolveWrapLineCount,
  resolveElementTextForPptx,
  estimateTextFitScale,
} from '../src/lib/artifacts/render-model.ts';
import { generatePptxFromPlan } from '../src/lib/pptx-draw.ts';

class MockFabricText {
  constructor(options = {}) {
    this.type = 'textbox';
    this.text = options.text || 'Sample text';
    this.data = options.data || {};
    this.left = options.left ?? 0;
    this.top = options.top ?? 0;
    this.width = options.width ?? 100;
    this.height = options.height ?? 50;
    this.scaleX = options.scaleX ?? 1;
    this.scaleY = options.scaleY ?? 1;
    this.fill = options.fill ?? '#FFFFFF';
    this.fontSize = options.fontSize ?? 32;
    this.fontFamily = options.fontFamily ?? 'Arial';
    this.fontWeight = options.fontWeight ?? 'normal';
    this.fontStyle = options.fontStyle ?? 'normal';
    this.underline = options.underline ?? false;
    this.textAlign = options.textAlign ?? 'left';
    this.lineHeight = options.lineHeight ?? 1.2;
    this.shadow = options.shadow ?? null;
    this.textLines = options.textLines;
  }

  get(key) {
    return this[key];
  }

  set(props) {
    Object.assign(this, props);
  }
}

class MockCanvas {
  constructor(objects = []) {
    this.objects = objects;
  }

  getObjects() {
    return this.objects;
  }
}

test('T-22-01: PPTX Zero-Margin Source Guard in pptx-draw.ts', () => {
  const drawPath = path.resolve('src/lib/pptx-draw.ts');
  const code = fs.readFileSync(drawPath, 'utf8');

  // Verify renderTextElement passes margin: 0
  const renderTextStart = code.indexOf('function renderTextElement');
  assert.ok(renderTextStart !== -1, 'Must define renderTextElement');
  const renderTextEnd = code.indexOf('\nfunction renderImageElement', renderTextStart);
  const renderTextBody = code.slice(renderTextStart, renderTextEnd !== -1 ? renderTextEnd : renderTextStart + 3500);

  assert.ok(
    /^\s*margin:\s*0\b/m.test(renderTextBody),
    'renderTextElement must pass margin: 0 to slide.addText'
  );
  assert.ok(
    renderTextBody.includes('resolveElementTextForPptx'),
    'renderTextElement must call resolveElementTextForPptx'
  );

  // Verify addImageUnavailable passes margin: 0
  const fallbackStart = code.indexOf('function addImageUnavailable');
  assert.ok(fallbackStart !== -1, 'Must define addImageUnavailable');
  const fallbackBody = code.slice(fallbackStart, fallbackStart + 400);
  assert.ok(
    /^\s*margin:\s*0\b/m.test(fallbackBody),
    'addImageUnavailable must pass margin: 0'
  );
});

test('T-22-02: OOXML Body Inset Guard (lIns="0" tIns="0" rIns="0" bIns="0")', async () => {
  const mockArtifact = {
    runtimeVersion: 1,
    instanceId: 'test-inst-1',
    templateId: 'tpl-1',
    label: 'Test Slide',
    baseType: 'general',
    layoutKey: 'default',
    layout: {
      aspectRatio: '16:9',
      backgroundColor: '#000000',
      elements: [
        {
          id: 'text-1',
          type: 'text',
          x: 10,
          y: 20,
          w: 40,
          h: 15,
          zIndex: 0,
          text: 'Bandung international community',
          wrapLines: ['Bandung', 'international', 'community'],
          style: {
            fontSize: 32,
            fontFamily: 'Arial',
            fontColor: '#FFFFFF',
          },
        },
      ],
    },
  };

  const buffer = await generatePptxFromPlan('2026-09-10', [{ artifact: mockArtifact }], 'none');
  const zip = await JSZip.loadAsync(buffer);
  const slide1Xml = await zip.file('ppt/slides/slide1.xml')?.async('string');

  assert.ok(slide1Xml, 'ppt/slides/slide1.xml must exist in PPTX archive');

  // Check bodyPr attributes: lIns="0" rIns="0" tIns="0" bIns="0"
  assert.ok(
    slide1Xml.includes('lIns="0"') &&
    slide1Xml.includes('rIns="0"') &&
    slide1Xml.includes('tIns="0"') &&
    slide1Xml.includes('bIns="0"'),
    `slide1.xml bodyPr must have zero insets, found: ${slide1Xml.match(/<a:bodyPr[^>]*>/)?.[0]}`
  );
});

test('T-22-03: wrapLines Persisted on serializeCanvas', () => {
  const sourceElement = {
    id: 'e1',
    type: 'text',
    required: false,
    x: 10,
    y: 10,
    w: 40,
    h: 20,
    zIndex: 0,
    content: 'Bandung international community',
  };

  const mockObj = new MockFabricText({
    text: 'Bandung international community',
    textLines: ['Bandung', 'international', 'community'],
    left: pctToPx(10, CANVAS_WIDTH),
    top: pctToPx(10, CANVAS_HEIGHT),
    width: pctToPx(40, CANVAS_WIDTH),
    height: pctToPx(20, CANVAS_HEIGHT),
    data: { elementId: 'e1' },
  });

  const canvas = new MockCanvas([mockObj]);
  const layout = {
    aspectRatio: '16:9',
    backgroundColor: '#000000',
    elements: [sourceElement],
  };
  const serialized = serializeCanvas(canvas, layout, new Map());

  assert.equal(serialized.length, 1);
  assert.deepEqual(serialized[0].wrapLines, ['Bandung', 'international', 'community']);
  assert.equal(serialized[0].content, 'Bandung international community');
});

test('T-22-04: Legacy Backward Compatibility (No wrapLines when textLines absent)', () => {
  const sourceElement = {
    id: 'e1',
    type: 'text',
    required: false,
    x: 10,
    y: 10,
    w: 40,
    h: 20,
    zIndex: 0,
    content: 'Simple text',
  };

  const mockObj = new MockFabricText({
    text: 'Simple text',
    textLines: undefined, // Legacy or un-measured
    left: pctToPx(10, CANVAS_WIDTH),
    top: pctToPx(10, CANVAS_HEIGHT),
    width: pctToPx(40, CANVAS_WIDTH),
    height: pctToPx(20, CANVAS_HEIGHT),
    data: { elementId: 'e1' },
  });

  const canvas = new MockCanvas([mockObj]);
  const layout = {
    aspectRatio: '16:9',
    backgroundColor: '#000000',
    elements: [sourceElement],
  };
  const serialized = serializeCanvas(canvas, layout, new Map());

  assert.equal(serialized.length, 1);
  assert.equal(serialized[0].wrapLines, undefined);
  assert.equal('wrapLines' in serialized[0], false);
});

test('T-22-05: resolveElementTextForPptx Hard Breaks from wrapLines', () => {
  const elWithWrap = {
    id: 'e1',
    type: 'text',
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    zIndex: 0,
    text: 'Bandung international community',
    wrapLines: ['Bandung', 'international', 'community'],
    style: {},
  };

  assert.equal(
    resolveElementTextForPptx(elWithWrap),
    'Bandung\ninternational\ncommunity'
  );

  const elWithoutWrap = {
    id: 'e1',
    type: 'text',
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    zIndex: 0,
    text: 'Bandung international community',
    style: {},
  };

  assert.equal(
    resolveElementTextForPptx(elWithoutWrap),
    'Bandung international community'
  );
});

test('T-22-06: estimateTextFitScale Uses wrapLines Count', () => {
  const el = {
    id: 'e1',
    type: 'text',
    x: 5,
    y: 10,
    w: 40,
    h: 12,
    zIndex: 0,
    text: 'Bandung international community',
    wrapLines: ['Bandung', 'international', 'community'],
    style: { fontSize: 48 },
  };

  const lineCount = resolveWrapLineCount(el);
  assert.equal(lineCount, 3);

  const scale = estimateTextFitScale(el);
  assert.ok(scale < 1.0, `Must scale down for 3 lines in 12% box height, got ${scale}`);

  // Without wrapLines, a single paragraph would report 1 line
  const elWithoutWrap = { ...el, wrapLines: undefined };
  const singleLineCount = resolveWrapLineCount(elWithoutWrap);
  assert.equal(singleLineCount, 1);
});

test('T-22-07: PPTX End-to-End Line Integrity (BIC-TITLE-WRAP Fixture)', async () => {
  const fixtureArtifact = {
    runtimeVersion: 1,
    instanceId: 'bic-title-wrap-inst',
    templateId: 'tpl-bic-title',
    label: 'BIC Title Wrap Fixture',
    baseType: 'general',
    layoutKey: 'default',
    layout: {
      aspectRatio: '16:9',
      backgroundColor: '#1E293B',
      elements: [
        {
          id: 'title-el',
          type: 'text',
          x: 15,
          y: 20,
          w: 40,
          h: 25,
          zIndex: 1,
          text: 'Bandung international community',
          wrapLines: ['Bandung', 'international', 'community'],
          style: {
            fontSize: 32,
            fontFamily: 'Arial',
            fontColor: '#FFFFFF',
            textAlign: 'left',
          },
        },
      ],
    },
  };

  const buffer = await generatePptxFromPlan('2026-09-10', [{ artifact: fixtureArtifact }], 'none');
  const zip = await JSZip.loadAsync(buffer);
  const slide1Xml = await zip.file('ppt/slides/slide1.xml')?.async('string');

  assert.ok(slide1Xml, 'Slide XML must be generated');

  // Verify that "international" is NOT split across tags as "internationa" and "l"
  assert.equal(
    /internationa[\s\S]*?<\/a:t>\s*<a:t>l/.test(slide1Xml),
    false,
    'Word "international" must not suffer mid-word grapheme split in OOXML text runs'
  );

  // Verify all 3 whole words appear as text runs
  assert.ok(slide1Xml.includes('Bandung'), 'Must include Bandung');
  assert.ok(slide1Xml.includes('international'), 'Must include international intact');
  assert.ok(slide1Xml.includes('community'), 'Must include community intact');
});

test('T-22-08: Documentation Guard in canvas-authoring-controls.md', () => {
  const docPath = path.resolve('.how/registry/06-flows/canvas-authoring-controls.md');
  const doc = fs.readFileSync(docPath, 'utf8');

  assert.ok(
    doc.includes('SPEC-22'),
    'Doc must document SPEC-22'
  );
  assert.ok(
    doc.includes('margin: 0'),
    'Doc must document margin: 0 zero-margin text container'
  );
  assert.ok(
    doc.includes('wrapLines'),
    'Doc must document wrapLines canvas soft-wrap snapshot'
  );
  assert.ok(
    doc.includes('line-break authority'),
    'Doc must document Canvas as line-break authority for export'
  );
});

test('T-22-09: Schema and Validator Conformance for wrapLines', () => {
  const validTemplate = {
    schemaVersion: 1,
    id: 'test-wrap-schema',
    label: 'Test Wrap Schema',
    baseType: 'general',
    placeholders: [],
    layouts: {
      default: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [
          {
            id: 't1',
            type: 'text',
            required: false,
            x: 10,
            y: 10,
            w: 50,
            h: 20,
            zIndex: 0,
            content: 'Multi line text',
            wrapLines: ['Multi', 'line', 'text'],
          },
        ],
      },
    },
  };

  // Valid template with wrapLines must pass
  assert.doesNotThrow(() => {
    validateArtifactTemplate(validTemplate);
  });

  // Invalid non-array wrapLines must throw
  const invalidTemplate = {
    ...validTemplate,
    layouts: {
      default: {
        ...validTemplate.layouts.default,
        elements: [
          {
            ...validTemplate.layouts.default.elements[0],
            wrapLines: 'not an array',
          },
        ],
      },
    },
  };
  assert.throws(() => {
    validateArtifactTemplate(invalidTemplate);
  });
});

test('T-22-10: Token Placeholders Skip wrapLines and Safely Export Substituted Text', () => {
  // 1. serializeCanvas skips wrapLines for placeholder elements
  const tokenElement = {
    id: 'e-token',
    type: 'text',
    required: false,
    x: 10,
    y: 10,
    w: 50,
    h: 20,
    zIndex: 0,
    content: '{sermon_title}',
  };

  const mockTokenObj = new MockFabricText({
    text: '{sermon_title}',
    textLines: ['{sermon_title}'],
    left: pctToPx(10, CANVAS_WIDTH),
    top: pctToPx(10, CANVAS_HEIGHT),
    width: pctToPx(50, CANVAS_WIDTH),
    height: pctToPx(20, CANVAS_HEIGHT),
    data: { elementId: 'e-token' },
  });

  const canvas = new MockCanvas([mockTokenObj]);
  const layout = {
    aspectRatio: '16:9',
    backgroundColor: '#000000',
    elements: [tokenElement],
  };
  const serialized = serializeCanvas(canvas, layout, new Map());

  assert.equal(serialized.length, 1);
  assert.equal(
    serialized[0].wrapLines,
    undefined,
    'serializeCanvas must not persist wrapLines for placeholder tokens'
  );

  // 2. resolveElementTextForPptx falls back to substituted text if wrapLines ever diverged
  const substitutedElement = {
    id: 'e-sub',
    type: 'text',
    x: 10,
    y: 10,
    w: 50,
    h: 20,
    zIndex: 0,
    text: 'Rooted And Rising',
    wrapLines: ['{sermon_title}'], // stale or literal token
    style: {},
  };

  assert.equal(
    resolveElementTextForPptx(substitutedElement),
    'Rooted And Rising',
    'resolveElementTextForPptx must export substituted text when wrapLines diverge'
  );
  assert.equal(
    resolveWrapLineCount(substitutedElement),
    1,
    'resolveWrapLineCount must count lines from substituted text when wrapLines diverge'
  );
});
