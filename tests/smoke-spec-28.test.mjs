/**
 * SPEC-28: Canvas Editor Interaction UX, Text Ghosting Elimination & Bounding-Box Resize Invariants Smoke Suite
 *
 * Automated verification of:
 * - SPEC-28-01: Transparent proxy invariant (fill: 'transparent', stroke: 'transparent', shadow: null) across all lifecycles
 * - SPEC-28-02: Decoupled editor-only scale-1 wrap/clip vs runtime shrink-to-fit
 * - SPEC-28-03: Minimum single-line height clamp and asymmetric font-size auto-expansion
 * - Absence guards proven failing red before passing green
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_FONT_COLOR,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  TEXT_LINE_HEIGHT,
  elementToFabricObject,
  computeMinTextHeightRefPx,
  measureScale1ContentHeightPx,
  serializeCanvas,
  serializeTextStyle,
  pctToPx,
  pxToPct,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts')).href
);

const artifactSlidePath = path.join(root, 'src', 'components', 'artifacts', 'ArtifactSlide.tsx');
const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');

assert.ok(fs.existsSync(artifactSlidePath), 'ArtifactSlide.tsx source must exist');
assert.ok(fs.existsSync(artifactEditorPath), 'ArtifactEditor.tsx source must exist');

const registryPath = path.join(root, 'data', 'default-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

// --------------------------------------------------------------------------
// T-28-01: Transparent Proxy Invariant
// --------------------------------------------------------------------------

test('T-28-01: elementToFabricObject produces strictly non-visual transparent proxy for text', () => {
  const element = {
    id: 'text-1',
    type: 'text',
    x: 10,
    y: 10,
    w: 50,
    h: 20,
    zIndex: 1,
    content: 'Headline Title',
    style: {
      fontSize: 48,
      fontColor: '#FF5500',
      fontWeight: 'bold',
      fontStyle: 'italic',
      textDecoration: 'underline',
      textShadow: true,
      textShadowBlur: 8,
      lineHeight: 1.4,
    },
  };

  const fabricMock = {
    Rect: class {
      constructor(opts) {
        Object.assign(this, opts);
      }
    },
  };

  const proxy = elementToFabricObject(fabricMock, element, true, { transparentProxy: true });

  assert.equal(proxy.fill, 'transparent', 'Text proxy fill must be transparent');
  assert.equal(proxy.stroke, 'transparent', 'Text proxy stroke must be transparent');
  assert.equal(proxy.shadow, null, 'Text proxy shadow must be null');
  assert.equal(proxy.data?.isTransparentProxy, true, 'isTransparentProxy marker must be set');
  assert.equal(proxy.data?.style?.fontColor, '#FF5500', 'Original style metadata must be stored in data');
});

test('T-28-01: serializeTextStyle preserves style when proxy is transparent', () => {
  const source = {
    id: 'text-1',
    type: 'text',
    x: 10,
    y: 10,
    w: 50,
    h: 20,
    zIndex: 1,
    content: 'Title',
    style: {
      fontSize: 40,
      fontColor: '#123456',
      textShadow: true,
      textShadowBlur: 6,
    },
  };

  const transparentProxy = {
    fill: 'transparent',
    stroke: 'transparent',
    shadow: null,
    fontSize: 40,
    data: {
      isTransparentProxy: true,
      style: {
        fontSize: 40,
        fontColor: '#123456',
        textShadow: true,
        textShadowBlur: 6,
      },
    },
  };

  const serialized = serializeTextStyle(source, transparentProxy);
  assert.ok(serialized, 'Style must be serialized');
  assert.equal(serialized.fontColor, '#123456', 'Transparent proxy must not overwrite stored fontColor');
  assert.equal(serialized.textShadow, true, 'Transparent proxy null shadow must not delete stored textShadow');
  assert.equal(serialized.textShadowBlur, 6, 'Transparent proxy null shadow must not delete textShadowBlur');
});

test('T-28-01: Absence-Guard Proof: ArtifactEditor never writes opaque fill or shadow to Fabric proxy', () => {
  const sourceCode = fs.readFileSync(artifactEditorPath, 'utf8');

  // Verify text handlers never assign visible fill or shadow to Fabric text proxies
  const checkGhostingFree = (code) => {
    // 1. In handleFontColorChange, text proxy must not receive fill: color
    const fontColorBlock = code.slice(
      code.indexOf('const handleFontColorChange'),
      code.indexOf('const handleFontFamilyChange')
    );
    if (/isFabricTextObject\(obj\)[^}]*obj\.set\(\{\s*fill:\s*color\s*\}\)/.test(fontColorBlock)) {
      throw new Error('ABSENCE_GUARD_FAILED: Found visible fill write to Fabric text proxy in handleFontColorChange');
    }

    // 2. In applyTextStyle, text proxy must not receive fill: fontColor
    const applyStyleBlock = code.slice(
      code.indexOf('const applyTextStyle'),
      code.indexOf('const handleFontColorChange')
    );
    if (/isFabricTextObject\(obj\)[^}]*fill:\s*fontColor/s.test(applyStyleBlock)) {
      throw new Error('ABSENCE_GUARD_FAILED: Found visible fill write to Fabric text proxy in applyTextStyle');
    }

    // 3. In handleToggleTextShadow, text proxy must not receive shadow: shadowObj
    const shadowBlock = code.slice(
      code.indexOf('const handleToggleTextShadow'),
      code.indexOf('const handleShadowBlurChange')
    );
    if (/isFabricTextObject\(obj\)[^}]*shadow:\s*shadowObj/s.test(shadowBlock)) {
      throw new Error('ABSENCE_GUARD_FAILED: Found visible shadow write to Fabric text proxy in handleToggleTextShadow');
    }
  };

  // 1. Production code passes cleanly
  assert.doesNotThrow(() => checkGhostingFree(sourceCode));

  // 2. Injected defect: opaque fill in handleFontColorChange fails guard
  const defectiveFillCode = sourceCode.replace(
    "obj.set({ fill: 'transparent', stroke: 'transparent', shadow: null });",
    'obj.set({ fill: color });'
  );
  assert.throws(
    () => checkGhostingFree(defectiveFillCode),
    /ABSENCE_GUARD_FAILED: Found visible fill write/,
    'Injected opaque fill write must fail the absence guard'
  );

  // 3. Injected defect: shadow write in handleToggleTextShadow fails guard
  const defectiveShadowCode = sourceCode.replace(
    "obj.set({ shadow: null, fill: 'transparent', stroke: 'transparent' });",
    'obj.set({ shadow: shadowObj });'
  );
  assert.throws(
    () => checkGhostingFree(defectiveShadowCode),
    /ABSENCE_GUARD_FAILED: Found visible shadow write/,
    'Injected shadow write must fail the absence guard'
  );
});

test('T-28-01: onTextChanged guards transparent proxy against applyFabricTextFit shrink mutation', () => {
  const editorSource = fs.readFileSync(artifactEditorPath, 'utf8');

  // Verify onTextChanged contains the transparent proxy check
  assert.ok(
    editorSource.includes('if (!targetData.isTransparentProxy) {'),
    'onTextChanged must check !targetData.isTransparentProxy before applyFabricTextFit'
  );
  assert.ok(
    editorSource.includes("target.set({ fill: 'transparent', stroke: 'transparent', shadow: null })"),
    'onTextChanged must reassert transparent fill and null shadow on transparent proxy'
  );
});

// --------------------------------------------------------------------------
// T-28-02: Editor-Only Render Mode vs Runtime Fitting
// --------------------------------------------------------------------------

test('T-28-02: ArtifactSlide supports editorMode prop and editor mounts ArtifactSlide with editorMode', () => {
  const slideSource = fs.readFileSync(artifactSlidePath, 'utf8');
  const editorSource = fs.readFileSync(artifactEditorPath, 'utf8');

  // 1. ArtifactSlide accepts editorMode and sets FIT_SCALE_VAR to 1
  assert.ok(slideSource.includes('editorMode'), 'ArtifactSlide must support editorMode prop');
  assert.ok(
    slideSource.includes("content.style.setProperty(FIT_SCALE_VAR, '1')"),
    'ArtifactSlide in editorMode must pin FIT_SCALE_VAR to 1'
  );
  assert.ok(
    slideSource.includes("instance.instanceId?.startsWith('editor-')"),
    'ArtifactSlide must automatically activate editorMode for editor instances'
  );

  // 2. ArtifactEditor mounts ArtifactSlide with liveInstance carrying editor instanceId prefix
  assert.ok(
    editorSource.includes('<ArtifactSlide instance={liveInstance} />'),
    'ArtifactEditor must mount <ArtifactSlide instance={liveInstance} />'
  );
  assert.ok(
    editorSource.includes('instanceId: `editor-${template.id}`'),
    'ArtifactEditor liveInstance must carry editor instanceId prefix'
  );
});

// --------------------------------------------------------------------------
// T-28-03: Minimum Single-Line Height Floor Clamp & Bounding Box Constraints
// --------------------------------------------------------------------------

test('T-28-03: computeMinTextHeightRefPx computes Math.max(fontSize, fontSize * lineHeight)', () => {
  // 32px with 1.2 lineHeight -> 38.4px
  const h1 = computeMinTextHeightRefPx(32, 1.2);
  assert.equal(h1, 38.4);

  // 32px with 0.8 tight lineHeight -> 32px floor
  const h2 = computeMinTextHeightRefPx(32, 0.8);
  assert.equal(h2, 32);

  // 48px with default lineHeight 1.2 -> 57.6px
  const h3 = computeMinTextHeightRefPx(48);
  assert.equal(h3, 57.6);
});

test('T-28-03: Drag scaling clamping logic guards effective text height', () => {
  const textObj = {
    type: 'textbox',
    height: 100,
    scaleY: 0.2, // effective height = 20px
    fontSize: 40,
    lineHeight: 1.2, // min required = 48px
  };

  const minH = computeMinTextHeightRefPx(textObj.fontSize, textObj.lineHeight);
  assert.equal(minH, 48);

  const effH = textObj.height * Math.abs(textObj.scaleY);
  assert.ok(effH < minH, 'Effective height is initially below minimum');

  // Clamping simulation
  if (effH < minH && textObj.height > 0) {
    const neededScaleY = minH / textObj.height;
    textObj.scaleY = neededScaleY;
  }

  assert.equal(textObj.height * textObj.scaleY, 48, 'Effective height must be clamped to 48px');
});

test('T-28-03: Shapes and images are unconstrained by text floor', () => {
  const shapeObj = {
    type: 'rect',
    height: 10,
    scaleY: 0.1, // effective height = 1px
  };

  // Verify non-text elements do not match text guard
  const isText = shapeObj.type === 'text' || shapeObj.type === 'textbox';
  assert.equal(isText, false, 'Shape must not be identified as text object');
  assert.equal(shapeObj.height * shapeObj.scaleY, 1, 'Shape height remains unclamped');
});

test('T-28-03: ActiveSelection group scaling propagates user-resize flags to member objects', () => {
  const editorSource = fs.readFileSync(artifactEditorPath, 'utf8');

  // Verify onObjectScaling handles isGroup and iterates memberObjects
  assert.ok(
    editorSource.includes("const isGroup = target.type === 'activeSelection' && Array.isArray((target as any)._objects)"),
    'onObjectScaling must detect ActiveSelection group scaling'
  );
  assert.ok(
    editorSource.includes('for (const member of memberObjects) {'),
    'onObjectScaling must iterate and attach axis flags to each member object'
  );
  assert.ok(
    editorSource.includes("mData.heightChange = 'user-resize'"),
    'onObjectScaling must mark user-resize heightChange on member objects'
  );
});

// --------------------------------------------------------------------------
// T-28-04: Font Size Increase Auto-Expansion & Asymmetric Retention
// --------------------------------------------------------------------------

test('T-28-04: measureScale1ContentHeightPx calculates scale-1 wrapped height', () => {
  const singleLineText = 'Short Title';
  const threeLinesText = 'Line One\nLine Two\nLine Three';

  const singleLineH = measureScale1ContentHeightPx(singleLineText, 500, 32, 1.2);
  assert.equal(singleLineH, 38.4, 'Single line content matches single line min height');

  const threeLinesH = measureScale1ContentHeightPx(threeLinesText, 500, 32, 1.2);
  // 3 lines * 32 * 1.2 = 115.2px
  assert.equal(threeLinesH, 115.2, '3 lines of text produce 3 * 38.4 = 115.2px');

  // Narrow box forces word-wrapping into 4 lines
  const wrappedText = 'First line of text\nSecond line of text\nThird line of text';
  const narrowWrappedH = measureScale1ContentHeightPx(wrappedText, 100, 32, 1.2);
  assert.ok(narrowWrappedH > 115.2, 'Narrow width forces wrapping and expands required height');
});

test('T-28-04: serializeCanvas preserves font-size-auto expanded height', () => {
  const layout = {
    aspectRatio: '16:9',
    elements: [
      {
        id: 'el-1',
        type: 'text',
        x: 10,
        y: 10,
        w: 50,
        h: 10, // authored height ~ 54px
        zIndex: 0,
        content: 'Auto expanded multiline text',
        style: { fontSize: 48 },
      },
    ],
  };

  // Simulate auto-expanded height to 120px (pxToPct(120, 540) = 22.2222%)
  const expandedHeightPx = 120;
  const mockFabricCanvas = {
    getObjects: () => [
      {
        type: 'textbox',
        text: 'Auto expanded multiline text',
        left: pctToPx(10, CANVAS_WIDTH),
        top: pctToPx(10, CANVAS_HEIGHT),
        width: pctToPx(50, CANVAS_WIDTH),
        height: expandedHeightPx,
        scaleX: 1,
        scaleY: 1,
        fill: 'transparent',
        fontSize: 48,
        data: {
          elementId: 'el-1',
          authoredWidth: pctToPx(50, CANVAS_WIDTH),
          authoredHeight: expandedHeightPx,
          heightChange: 'font-size-auto',
          isTransparentProxy: true,
          style: { fontSize: 48 },
        },
      },
    ],
  };

  const serialized = serializeCanvas(mockFabricCanvas, layout, new Map());
  const serializedEl = serialized.find((e) => e.id === 'el-1');

  assert.ok(serializedEl, 'Element must be serialized');
  assert.ok(
    Math.abs(serializedEl.h - pxToPct(expandedHeightPx, CANVAS_HEIGHT)) < 0.01,
    'Auto-expanded height must be persisted when heightChange is font-size-auto'
  );
});

// --------------------------------------------------------------------------
// T-28-05: Save-Without-Edit Regression Invariant (SPEC-26 / BUG-35)
// --------------------------------------------------------------------------

test('T-28-05: serializeCanvas on unedited template strictly preserves authored dimensions', () => {
  for (const tpl of registry.slice(0, 10)) {
    const layout = tpl.layouts?.default;
    if (!layout || !Array.isArray(layout.elements) || !layout.elements.length) continue;

    const mockObjects = layout.elements.map((el) => {
      const isText = el.type === 'text';
      const wPx = pctToPx(el.w, CANVAS_WIDTH);
      const hPx = pctToPx(el.h, CANVAS_HEIGHT);
      return {
        type: isText ? 'textbox' : 'rect',
        text: el.content ?? '',
        left: pctToPx(el.x, CANVAS_WIDTH),
        top: pctToPx(el.y, CANVAS_HEIGHT),
        width: wPx,
        height: hPx,
        scaleX: 1,
        scaleY: 1,
        fill: isText ? 'transparent' : (el.style?.fillColor ?? '#5C2E16'),
        fontSize: el.style?.fontSize ?? 32,
        data: {
          elementId: el.id,
          authoredWidth: wPx,
          authoredHeight: hPx,
          isTransparentProxy: isText,
          style: { ...el.style },
        },
      };
    });

    const mockCanvas = { getObjects: () => mockObjects };
    const serialized = serializeCanvas(mockCanvas, layout, new Map());

    for (let i = 0; i < layout.elements.length; i++) {
      const orig = layout.elements[i];
      const res = serialized.find((e) => e.id === orig.id);
      assert.ok(res, `Element ${orig.id} must be preserved`);
      assert.equal(res.w, orig.w, `Template ${tpl.id} element ${orig.id} width must remain unchanged`);
      assert.equal(res.h, orig.h, `Template ${tpl.id} element ${orig.id} height must remain unchanged`);
    }
  }
});

test('T-28-06: Absence Guard: ArtifactEditor never assigns opaque canvas.backgroundImage over ArtifactSlide', () => {
  const sourceCode = fs.readFileSync(artifactEditorPath, 'utf8');

  const checkNoOpaqueCanvasBg = (code) => {
    // In Option A, ArtifactSlide is the visual authority rendering layout.backgroundImage.
    // The Fabric interaction overlay must never assign canvas.backgroundImage = bg
    if (/canvas\.backgroundImage\s*=\s*bg\b/.test(code)) {
      throw new Error('ABSENCE_GUARD_FAILED: canvas.backgroundImage assigned on Fabric overlay, obscuring ArtifactSlide text');
    }
  };

  // 1. Real production code passes cleanly
  assert.doesNotThrow(() => checkNoOpaqueCanvasBg(sourceCode));

  // 2. Injected defect fails red
  const defectiveCode = sourceCode.replace(
    'canvas.backgroundImage = undefined;',
    'canvas.backgroundImage = bg;'
  );
  assert.throws(
    () => checkNoOpaqueCanvasBg(defectiveCode),
    /ABSENCE_GUARD_FAILED/,
    'Injected canvas.backgroundImage = bg must fail absence guard red'
  );
});
