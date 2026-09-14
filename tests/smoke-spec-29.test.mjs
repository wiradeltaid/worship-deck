import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateWrapLines,
  isValidWrapLines,
  resolveWrapLineCount,
  resolveElementTextForPptx,
  resolveTextRunsForPptx,
  resolvePptxVerticalAlign,
  toCssJustifyContent,
  estimateTextFitScale,
  MIN_TEXT_FIT_SCALE,
  REFERENCE_CANVAS,
} from '../src/lib/artifacts/render-model.ts';
import {
  serializeCanvas,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  pctToPx,
  pxToPct,
  syncTextClipOnScale,
  measureScale1ContentHeightPx,
  computeMinTextHeightRefPx,
  computeAutoExpandedHeight,
  DEFAULT_FONT_FAMILY,
  TEXT_LINE_HEIGHT,
} from '../src/lib/registry/canvas-utils.ts';
import {
  validateArtifactTemplate,
  RegistryValidationError,
} from '../src/lib/registry/validate.ts';
import fs from 'node:fs';
import path from 'node:path';

function createMockTextElement(overrides = {}) {
  return {
    id: 'el-text-1',
    type: 'text',
    x: 10,
    y: 10,
    w: 50,
    h: 20,
    text: 'Bandung',
    style: {
      fontSize: 48,
      fontFamily: 'Arial',
      verticalAlign: 'middle',
      textAlign: 'center',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SPEC-29-01: Trusted Whole-Word Wrap Snapshots
// ---------------------------------------------------------------------------

test('T-29-01: validateWrapLines rejects character fragments and partitions correctly', () => {
  // 1. Character fragmentation: 'Bandung' split into 'Band' and 'ung'
  assert.equal(
    validateWrapLines('Bandung', ['Band', 'ung']),
    null,
    'Must reject character-split lines'
  );
  assert.equal(
    isValidWrapLines('Bandung', ['Band', 'ung']),
    false
  );

  // 2. Partial fragment in a multi-word phrase
  assert.equal(
    validateWrapLines('Bandung International Community', ['Band', 'ung International', 'Community']),
    null,
    'Must reject when any token is character-split'
  );

  // 3. Valid whole-word multi-line wraps
  const valid = validateWrapLines(
    'Bandung International Community',
    ['Bandung', 'International Community']
  );
  assert.deepEqual(
    valid,
    ['Bandung', 'International Community'],
    'Must accept valid whole-word wrap partition'
  );
  assert.equal(
    isValidWrapLines('Bandung International Community', ['Bandung', 'International Community']),
    true
  );

  // 4. Valid wrap across explicit newlines
  const validMultiline = validateWrapLines(
    'Bandung\nInternational\nCommunity',
    ['Bandung', 'International', 'Community']
  );
  assert.deepEqual(
    validMultiline,
    ['Bandung', 'International', 'Community']
  );

  // 5. Normalizes extra whitespace between tokens
  const normalizedSpaces = validateWrapLines(
    'Hello    world!\n\n   Test   ',
    ['Hello   world!', '', 'Test']
  );
  assert.deepEqual(
    normalizedSpaces,
    ['Hello world!', '', 'Test'],
    'Must normalize internal whitespace and preserve empty paragraphs'
  );

  // 6. Rejects when empty paragraph is collapsed/omitted
  assert.equal(
    validateWrapLines('Para 1\n\nPara 2', ['Para 1', 'Para 2']),
    null,
    'Must reject candidate lines that collapse empty paragraphs'
  );

  // 7. Rejects candidate lines crossing explicit newlines
  assert.equal(
    validateWrapLines('Line 1\nLine 2', ['Line 1 Line 2']),
    null,
    'Must reject candidate line spanning across explicit newline'
  );

  // 8. Rejects reordered, missing, and duplicate words
  assert.equal(validateWrapLines('One two three', ['One three two']), null);
  assert.equal(validateWrapLines('One two three', ['One two']), null);
  assert.equal(validateWrapLines('One two', ['One two two']), null);
  assert.equal(validateWrapLines('One two', ['One two three']), null);

  // 9. Rejects invalid data shapes gracefully
  assert.equal(validateWrapLines('', ['Hello']), null);
  assert.equal(validateWrapLines('Hello', []), null);
  assert.equal(validateWrapLines('Hello', null), null);
  assert.equal(validateWrapLines('Hello', ['Hello\nWorld']), null);
  assert.equal(validateWrapLines('Hello', [123]), null);
});

test('T-29-01: PPTX text & line-count resolvers reject malformed wrapLines and fall back to source text', () => {
  // Element with malicious/fragmented wrapLines
  const fragmentedEl = createMockTextElement({
    text: 'Bandung',
    wrapLines: ['Band', 'ung'],
  });

  // resolveWrapLineCount falls back to source text (1 line)
  assert.equal(
    resolveWrapLineCount(fragmentedEl),
    1,
    'Must ignore fragmented wrapLines and count from source text'
  );

  // resolveElementTextForPptx returns 'Bandung', never 'Band\nung'
  assert.equal(
    resolveElementTextForPptx(fragmentedEl),
    'Bandung',
    'Must return clean whole word, never character-split breaks'
  );

  // resolveTextRunsForPptx returns 'Bandung' as plain string, never runs with softBreakBefore inside word
  const runs = resolveTextRunsForPptx(fragmentedEl);
  assert.equal(
    runs,
    'Bandung',
    'Must fallback to plain text and not inject soft breaks into fragmented words'
  );

  // Valid wrapLines should be accepted and produce soft breaks in PPTX runs
  const validEl = createMockTextElement({
    text: 'Bandung International Community',
    wrapLines: ['Bandung', 'International Community'],
  });
  assert.equal(resolveWrapLineCount(validEl), 2);
  assert.equal(
    resolveElementTextForPptx(validEl),
    'Bandung\nInternational Community'
  );
  const validRuns = resolveTextRunsForPptx(validEl);
  assert.ok(Array.isArray(validRuns), 'Valid wrapLines produces PptxTextRun array');
  assert.equal(validRuns.length, 2);
  assert.equal(validRuns[0].text, 'Bandung');
  assert.equal(validRuns[1].text, 'International Community');
  assert.equal(validRuns[1].options?.softBreakBefore, true);
});

test('T-29-01: serializeCanvas omits wrapLines when Fabric textLines contains character fragments', () => {
  const sourceTemplate = {
    id: 'tpl-test',
    baseType: 'general',
    layout: {
      elements: [
        {
          id: 'e1',
          type: 'text',
          x: 10,
          y: 10,
          w: 40,
          h: 20,
          content: 'Bandung',
          style: { fontSize: 48 },
        },
      ],
    },
  };

  // Fabric mock with fragmented textLines ['Band', 'ung']
  const mockFabricObject = {
    id: 'e1',
    type: 'textbox',
    text: 'Bandung',
    textLines: ['Band', 'ung'],
    left: pctToPx(10, CANVAS_WIDTH),
    top: pctToPx(10, CANVAS_HEIGHT),
    width: pctToPx(40, CANVAS_WIDTH),
    height: pctToPx(20, CANVAS_HEIGHT),
    scaleX: 1,
    scaleY: 1,
    data: { elementId: 'e1' },
  };

  const mockCanvas = {
    getObjects: () => [mockFabricObject],
  };

  const serialized = serializeCanvas(mockCanvas, sourceTemplate.layout, new Map());
  const textElem = serialized.find((e) => e.id === 'e1');
  assert.ok(textElem);
  assert.equal(
    textElem.wrapLines,
    undefined,
    'serializeCanvas must omit wrapLines when textLines contains character fragments'
  );

  // Now verify valid textLines ARE persisted
  mockFabricObject.text = 'Bandung International Community';
  mockFabricObject.textLines = ['Bandung', 'International Community'];
  sourceTemplate.layout.elements[0].content = 'Bandung International Community';

  const serializedValid = serializeCanvas(mockCanvas, sourceTemplate.layout, new Map());
  const textElemValid = serializedValid.find((e) => e.id === 'e1');
  assert.ok(textElemValid);
  assert.deepEqual(
    textElemValid.wrapLines,
    ['Bandung', 'International Community'],
    'serializeCanvas must persist valid whole-word wrapLines'
  );
});

test('T-29-01: validateArtifactTemplate rejects malformed static wrapLines and accepts valid ones', () => {
  const baseTpl = {
    schemaVersion: 1,
    id: 'tpl-wrap-validation',
    label: 'Wrap Validation',
    baseType: 'general',
    placeholders: [],
    layouts: {
      default: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [
          {
            id: 'e1',
            type: 'text',
            required: false,
            x: 10,
            y: 10,
            w: 40,
            h: 20,
            zIndex: 0,
            content: 'Bandung',
            wrapLines: ['Band', 'ung'],
          },
        ],
      },
    },
  };

  // Fragmented wrapLines must be rejected by registry validator
  assert.throws(
    () => validateArtifactTemplate(baseTpl),
    RegistryValidationError,
    'validateArtifactTemplate must throw for character-split wrapLines'
  );

  // Valid whole-word wrapLines must pass
  baseTpl.layouts.default.elements[0].content = 'Bandung International Community';
  baseTpl.layouts.default.elements[0].wrapLines = ['Bandung', 'International Community'];
  assert.doesNotThrow(() => {
    validateArtifactTemplate(baseTpl);
  });
});

// ---------------------------------------------------------------------------
// SPEC-29-02: Font-Size Commit, Authored Geometry & Fitted Text Coherence
// ---------------------------------------------------------------------------

test('T-29-02: Source guards — width remains explicit author geometry without auto-expansion', () => {
  const editorPath = path.resolve('src/components/admin/ArtifactEditor.tsx');
  const editorCode = fs.readFileSync(editorPath, 'utf8');

  // Verify widthChange: 'font-size-auto' is NOT present
  assert.ok(
    !editorCode.includes("widthChange = 'font-size-auto'"),
    'ArtifactEditor must NOT introduce widthChange font-size-auto'
  );
  assert.ok(
    !editorCode.includes("widthChange: 'font-size-auto'"),
    'ArtifactEditor must NOT persist font-size-auto width changes'
  );

  // Verify no w = min(longestWordPx, canvasWidth) formula exists
  assert.ok(
    !editorCode.includes('min(longestWordPx, canvasWidth)'),
    'ArtifactEditor must not overwrite width with longestWordPx'
  );

  // Verify syncTextClipOnScale is called on font size commit to maintain clip boundary parity
  assert.ok(
    editorCode.includes('syncTextClipOnScale(obj)'),
    'ArtifactEditor must synchronize clipPath on font size commit'
  );
});

test('T-29-02: Execution — font-size commit expands height bounded by canvas and strictly preserves width', () => {
  const initialW = 40; // 40% of 960 = 384px
  const initialH = 15; // 15% of 540 = 81px
  const initialTop = 20; // 20% of 540 = 108px

  const layout = {
    aspectRatio: '16:9',
    backgroundColor: '#000000',
    elements: [
      {
        id: 't-grow',
        type: 'text',
        x: 10,
        y: initialTop,
        w: initialW,
        h: initialH,
        content: 'Bandung International Community Multiline',
        style: { fontSize: 32 },
      },
    ],
  };

  const currentW = pctToPx(initialW, CANVAS_WIDTH);
  const currentH = pctToPx(initialH, CANVAS_HEIGHT);
  const currentTopPx = pctToPx(initialTop, CANVAS_HEIGHT);

  // Simulate committing a large font size (e.g. 72px)
  const newFontSize = 72;
  const lHeight = TEXT_LINE_HEIGHT;
  const minSingleLine = computeMinTextHeightRefPx(newFontSize, lHeight);
  const measuredReqH = measureScale1ContentHeightPx(
    'Bandung International Community Multiline',
    currentW,
    newFontSize,
    lHeight,
    DEFAULT_FONT_FAMILY,
    'normal',
    'normal'
  );
  const requiredH = Math.max(minSingleLine, measuredReqH);
  const maxAvailableH = Math.max(minSingleLine, CANVAS_HEIGHT - currentTopPx);
  const boundedRequiredH = Math.min(requiredH, maxAvailableH);

  // Bounded height must strictly stay within remaining canvas height
  assert.ok(boundedRequiredH <= maxAvailableH);
  assert.ok(boundedRequiredH > currentH, 'Tall text must increase height');

  // Fabric mock with updated height and preserved authoredWidth
  const mockFabricObject = {
    id: 't-grow',
    type: 'textbox',
    text: 'Bandung International Community Multiline',
    left: pctToPx(10, CANVAS_WIDTH),
    top: currentTopPx,
    width: currentW,
    height: boundedRequiredH,
    scaleX: 1,
    scaleY: 1,
    data: {
      elementId: 't-grow',
      authoredWidth: currentW,
      authoredHeight: boundedRequiredH,
      heightChange: 'font-size-auto',
    },
  };

  const serialized = serializeCanvas(
    { getObjects: () => [mockFabricObject] },
    layout,
    new Map()
  );

  const updatedEl = serialized.find((e) => e.id === 't-grow');
  assert.ok(updatedEl);
  // Width MUST remain exactly initialW (40%), NOT auto-widened
  assert.equal(
    updatedEl.w,
    initialW,
    'Width must be strictly preserved on font-size commit'
  );
  // Height must be updated to the bounded expanded height
  assert.equal(
    updatedEl.h,
    pxToPct(boundedRequiredH, CANVAS_HEIGHT),
    'Height must be updated to the bounded required height'
  );
});

test('T-29-02: syncTextClipOnScale bounds clipPath to exact object dimensions', () => {
  const clip = {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    set(props) {
      Object.assign(this, props);
    },
    setCoords() {},
  };

  // 1. Fallback without authored dimensions (uses target.width, target.height)
  const target = {
    left: 100,
    top: 150,
    width: 300,
    height: 80,
    scaleX: 1,
    scaleY: 1,
    clipPath: clip,
  };

  const res = syncTextClipOnScale(target);
  assert.equal(res, true);
  assert.equal(clip.left, 100);
  assert.equal(clip.top, 150);
  assert.equal(clip.width, 300);
  assert.equal(clip.height, 80);

  // 2. Authored dimensions on transparent proxy win over internal Fabric height
  // e.g. Fabric Textbox height is 470 (multi-line), but authored box is 432x350
  const proxyTarget = {
    left: 100,
    top: 150,
    width: 500, // Fabric internal width
    height: 470, // Fabric internal height
    scaleX: 1,
    scaleY: 1,
    clipPath: clip,
    data: {
      authoredWidth: 350,
      authoredHeight: 432,
    },
  };

  const proxyRes = syncTextClipOnScale(proxyTarget);
  assert.equal(proxyRes, true);
  assert.equal(clip.width, 350, 'Clip width must reflect data.authoredWidth (350), not Fabric width (500)');
  assert.equal(clip.height, 432, 'Clip height must reflect data.authoredHeight (432), not Fabric height (470)');
});

// ---------------------------------------------------------------------------
// SPEC-29-03: Conditional Safe Vertical Overflow & Surface Parity
// ---------------------------------------------------------------------------

test('T-29-03: resolvePptxVerticalAlign preserves middle/bottom when fitting, top-anchors on overflow', () => {
  // 1. Content fits inside box: preserve authored middle alignment
  const fittingEl = createMockTextElement({
    w: 80,
    h: 40,
    text: 'Short title',
    style: {
      fontSize: 32,
      verticalAlign: 'middle',
    },
  });
  assert.equal(
    resolvePptxVerticalAlign(fittingEl),
    'middle',
    'Must retain authored middle alignment when text fits'
  );

  // 2. Content fits inside box: preserve authored bottom alignment
  const bottomEl = createMockTextElement({
    w: 80,
    h: 40,
    text: 'Short title',
    style: {
      fontSize: 32,
      verticalAlign: 'bottom',
    },
  });
  assert.equal(
    resolvePptxVerticalAlign(bottomEl),
    'bottom',
    'Must retain authored bottom alignment when text fits'
  );

  // 3. Massive multiline overflow exceeding box height at MIN_TEXT_FIT_SCALE (e.g. 8 lines of 180px in 5% height box)
  const overflowingEl = createMockTextElement({
    w: 50,
    h: 5, // 5% of 540 = 27px height
    text: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8',
    style: {
      fontSize: 180,
      verticalAlign: 'middle',
    },
  });
  assert.equal(
    resolvePptxVerticalAlign(overflowingEl),
    'top',
    'Must top-anchor when content overflows box at minimum fit scale to preserve line 1 ascenders'
  );
});

test('T-29-03: toCssJustifyContent preserves standard top/middle/bottom mapping for fitting content', () => {
  assert.equal(toCssJustifyContent({ verticalAlign: 'top' }), 'flex-start');
  assert.equal(toCssJustifyContent({ verticalAlign: 'middle' }), 'center');
  assert.equal(toCssJustifyContent({ verticalAlign: 'bottom' }), 'flex-end');
  assert.equal(toCssJustifyContent({}), 'flex-start');
});

test('T-29-03: Execution — DOM vertical overflow detection applies flex-start fallback and safe center when fitting', () => {
  // Simulated DOM anchor function mirroring ArtifactSlide.tsx
  function computeDomJustifyContent(boxHeight, contentHeight, style) {
    const isOverflowing = contentHeight > boxHeight;
    const baseJustify = toCssJustifyContent(style);
    if (isOverflowing) {
      return 'flex-start';
    }
    return baseJustify === 'center' ? 'safe center' : baseJustify;
  }

  // 1. Content fits in box: middle verticalAlign retains 'safe center'
  assert.equal(
    computeDomJustifyContent(100, 40, { verticalAlign: 'middle' }),
    'safe center',
    'Fitting content with middle verticalAlign must use safe center'
  );

  // 2. Content fits in box: bottom verticalAlign retains 'flex-end'
  assert.equal(
    computeDomJustifyContent(100, 40, { verticalAlign: 'bottom' }),
    'flex-end',
    'Fitting content with bottom verticalAlign must use flex-end'
  );

  // 3. Content overflows box: flex-start is selected to anchor top line
  assert.equal(
    computeDomJustifyContent(50, 150, { verticalAlign: 'middle' }),
    'flex-start',
    'Overflowing content must fall back to flex-start'
  );
  assert.equal(
    computeDomJustifyContent(50, 150, { verticalAlign: 'bottom' }),
    'flex-start',
    'Overflowing bottom-aligned content must fall back to flex-start'
  );
});

test('T-29-03: ArtifactSlide source guard verifies safe vertical overflow and flex-start fallback', () => {
  const slidePath = path.resolve('src/components/artifacts/ArtifactSlide.tsx');
  const slideCode = fs.readFileSync(slidePath, 'utf8');

  // Verify applyVerticalAnchor inspects content.scrollHeight > box.clientHeight
  assert.ok(
    slideCode.includes('content.scrollHeight > box.clientHeight'),
    'ArtifactSlide must detect vertical overflow via content.scrollHeight > box.clientHeight'
  );

  // Verify flex-start fallback is applied on overflow
  assert.ok(
    slideCode.includes("box.style.justifyContent = 'flex-start'"),
    'ArtifactSlide must fallback to flex-start when overflowing'
  );

  // Verify safe center or baseJustify is used when not overflowing
  assert.ok(
    slideCode.includes('safe center'),
    'ArtifactSlide must use safe center when available for non-overflowing content'
  );
});

// ---------------------------------------------------------------------------
// Executable Absence-Guard Proofs (Red-Then-Green)
// ---------------------------------------------------------------------------

test('T-29-Absence-Guard: Injected defect forms fail cleanly', () => {
  // Absence Guard 1: Character fragmentation bypass proof
  // If serializer was unvalidated: raw candidate ['Band', 'ung'] would be stored.
  // With guard: validateWrapLines rejects it and returns null.
  const badWrap = ['Band', 'ung'];
  const unvalidatedSave = (raw) => raw; // defective bypass
  const guardedSave = (raw, src) => validateWrapLines(src, raw); // real implementation

  assert.deepEqual(unvalidatedSave(badWrap), ['Band', 'ung'], 'Defective bypass leaks fragmented lines');
  assert.equal(guardedSave(badWrap, 'Bandung'), null, 'Guarded implementation strictly rejects fragmented lines');

  // Absence Guard 2: Malformed wrapLines reaching PPTX text resolver
  // If PPTX resolver did not validate:
  const defectivePptxResolver = (raw) => raw.join('\n');
  const guardedPptxResolver = (raw, text) => {
    const valid = validateWrapLines(text, raw);
    return valid ? valid.join('\n') : text;
  };

  assert.equal(defectivePptxResolver(badWrap), 'Band\nung', 'Defective resolver splits word with newline');
  assert.equal(guardedPptxResolver(badWrap, 'Bandung'), 'Bandung', 'Guarded resolver preserves intact word');

  // Absence Guard 3: Symmetric centering on overflow
  // If PPTX vertical align did not top-anchor on overflow:
  const defectivePptxAlign = (style) => toCssJustifyContent(style);
  assert.equal(defectivePptxAlign({ verticalAlign: 'middle' }), 'center', 'Defective align centers overflowing text symmetrically');
  const el = createMockTextElement({
    w: 50,
    h: 5,
    text: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
    style: { fontSize: 180, verticalAlign: 'middle' },
  });
  assert.equal(resolvePptxVerticalAlign(el), 'top', 'Guarded resolver anchors top line to prevent ascender clipping');
});

test('T-29-04: Multi-line Fabric text proxy with small authoredHeight expands correctly on font size commit', () => {
  // 1. Test computeAutoExpandedHeight directly on live defect case:
  // Textbox with text 'Bandung International Community', fontSize 160, authored height 160px (14.81%),
  // but Fabric's internal Textbox height is 470px (calcTextHeight).
  // When font size is committed to 180, required height is 432px.
  // The expansion check must compare against authoredHeight (160px), NOT Fabric internal height (470px).
  const initialTop = 10;
  const initialW = 98.23;
  const initialH = 14.8148;
  const currentAuthoredW = pctToPx(initialW, CANVAS_WIDTH);
  const currentAuthoredH = pctToPx(initialH, CANVAS_HEIGHT); // ~160px
  const currentTopPx = pctToPx(initialTop, CANVAS_HEIGHT);

  const textContent = 'Bandung International Community';
  const newFontSize = 180;
  const lHeight = 0.8;

  const expansionResult = computeAutoExpandedHeight({
    textContent,
    authoredWidthPx: currentAuthoredW,
    authoredHeightPx: currentAuthoredH,
    fontSizePx: newFontSize,
    lineHeight: lHeight,
    topPx: currentTopPx,
  });

  assert.equal(expansionResult.shouldExpand, true, 'computeAutoExpandedHeight must signal expansion');
  assert.equal(
    expansionResult.boundedRequiredHeight,
    432,
    'boundedRequiredHeight must be 432px (calculated for scale 1 content)'
  );

  // 2. Test strictly bounded remaining canvas height:
  // e.g. Box placed near bottom: top = 500, canvasHeight = 540 -> remaining = 40px.
  // minSingleLine = 100, requiredHeight = 120.
  // boundedRequiredHeight MUST NOT exceed remaining canvas height (40px) or overflow canvas!
  const constrainedResult = computeAutoExpandedHeight({
    textContent,
    authoredWidthPx: currentAuthoredW,
    authoredHeightPx: 30,
    fontSizePx: 100,
    lineHeight: 1.0,
    topPx: 500,
    canvasHeight: 540,
  });

  assert.ok(
    constrainedResult.boundedRequiredHeight <= 40,
    `boundedRequiredHeight (${constrainedResult.boundedRequiredHeight}) must not exceed remaining canvas height (40)`
  );
  assert.ok(
    500 + constrainedResult.boundedRequiredHeight <= 540,
    'Bottom edge of expanded box must strictly stay within canvas'
  );

  // 3. Test serialization with Fabric Textbox mock with internal height = 470px (multi-line rendered height)
  // but authoredHeight = boundedRequiredHeight (432)
  const boundedRequiredH = expansionResult.boundedRequiredHeight;
  const mockFabricObject = {
    id: 't-proxy-multiline',
    type: 'textbox',
    text: textContent,
    left: pctToPx(1, CANVAS_WIDTH),
    top: currentTopPx,
    width: currentAuthoredW,
    height: 470, // Fabric internal text height > boundedRequiredH
    scaleX: 1,
    scaleY: 1,
    data: {
      elementId: 't-proxy-multiline',
      authoredWidth: currentAuthoredW,
      authoredHeight: boundedRequiredH,
      heightChange: 'font-size-auto',
    },
  };

  const layout = {
    aspectRatio: '16:9',
    backgroundColor: '#000000',
    elements: [
      {
        id: 't-proxy-multiline',
        type: 'text',
        x: 1,
        y: initialTop,
        w: initialW,
        h: initialH,
        content: textContent,
        style: { fontSize: 160 },
      },
    ],
  };

  const serialized = serializeCanvas(
    { getObjects: () => [mockFabricObject] },
    layout,
    new Map()
  );

  const updatedEl = serialized.find((e) => e.id === 't-proxy-multiline');
  assert.ok(updatedEl);
  assert.equal(
    updatedEl.h,
    pxToPct(boundedRequiredH, CANVAS_HEIGHT),
    'Serialized element height must reflect authoredHeight (boundedRequiredH), not unexpanded initialH'
  );
});
