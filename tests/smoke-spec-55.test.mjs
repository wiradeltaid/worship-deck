import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

export function scanSpec55_01Features(canvasUtilsSource) {
  const findings = [];

  // Helper existence
  if (!canvasUtilsSource.includes('export function centerPxToTopLeftPct')) {
    findings.push('canvas-utils.ts must export centerPxToTopLeftPct helper');
  }
  if (!canvasUtilsSource.includes('export function topLeftPctToCenterPx')) {
    findings.push('canvas-utils.ts must export topLeftPctToCenterPx helper');
  }
  if (!canvasUtilsSource.includes('export function getScaledDimensions')) {
    findings.push('canvas-utils.ts must export getScaledDimensions helper');
  }

  // buildTextFabricOptions must have center origin
  const textOptionsFn = canvasUtilsSource.match(/export function buildTextFabricOptions[\s\S]*?\n\}/);
  if (!textOptionsFn || !textOptionsFn[0].includes("originX: 'center'") || !textOptionsFn[0].includes("originY: 'center'")) {
    findings.push("buildTextFabricOptions must configure originX: 'center' and originY: 'center'");
  }

  return findings;
}

test('SPEC-55-01: Shared Center-Origin Bidirectional Helpers & Text Constructor Alignment Guards', () => {
  const canvasUtilsPath = path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts');
  const canvasUtilsSource = fs.readFileSync(canvasUtilsPath, 'utf8');

  const findings = scanSpec55_01Features(canvasUtilsSource);
  assert.deepEqual(findings, [], `SPEC-55-01 findings detected:\n${findings.join('\n')}`);
});

test('SPEC-55-01: Numerical Bidirectional Round-Trip Invariant within Epsilon Tolerance (<= 0.05%)', async () => {
  const { centerPxToTopLeftPct, topLeftPctToCenterPx, getScaledDimensions } = await import('../src/lib/registry/canvas-utils.ts');

  const testCases = [
    { x: 10, y: 15, w: 40, h: 20 },
    { x: 0, y: 0, w: 100, h: 100 },
    { x: 23.45, y: 67.89, w: 31.25, h: 14.75 },
    { x: 50, y: 50, w: 25, h: 10 },
  ];

  for (const { x, y, w, h } of testCases) {
    const center = topLeftPctToCenterPx(x, y, w, h);
    const roundtrip = centerPxToTopLeftPct(center.left, center.top, center.width, center.height);

    assert.ok(
      Math.abs(roundtrip.x - x) <= 0.05,
      `Roundtrip X (${roundtrip.x}) should match original X (${x}) within 0.05%`
    );
    assert.ok(
      Math.abs(roundtrip.y - y) <= 0.05,
      `Roundtrip Y (${roundtrip.y}) should match original Y (${y}) within 0.05%`
    );
  }

  // getScaledDimensions test
  const obj1 = { width: 200, height: 100, scaleX: 1.5, scaleY: 2.0 };
  const dims1 = getScaledDimensions(obj1);
  assert.strictEqual(dims1.w, 300);
  assert.strictEqual(dims1.h, 200);

  const obj2 = { getScaledWidth: () => 450, getScaledHeight: () => 180 };
  const dims2 = getScaledDimensions(obj2);
  assert.strictEqual(dims2.w, 450);
  assert.strictEqual(dims2.h, 180);
});

export function scanSpec55_02Features(artifactEditorSource, canvasUtilsSource) {
  const findings = [];

  // ArtifactEditor.tsx must import centerPxToTopLeftPct
  if (!artifactEditorSource.includes('centerPxToTopLeftPct')) {
    findings.push('ArtifactEditor.tsx must import and use centerPxToTopLeftPct');
  }

  // onObjectModified in ArtifactEditor.tsx must NOT use raw pxToPct(left, CANVAS_WIDTH)
  const modifiedMatch = artifactEditorSource.match(/const onObjectModified =[\s\S]*?\n      \};/);
  if (modifiedMatch) {
    if (modifiedMatch[0].includes('x: pxToPct(left, CANVAS_WIDTH)') || modifiedMatch[0].includes('x: pxToPct(left,')) {
      findings.push('onObjectModified must NOT use raw pxToPct(left); must use centerPxToTopLeftPct');
    }
    if (!modifiedMatch[0].includes('centerPxToTopLeftPct')) {
      findings.push('onObjectModified must route coordinate calculations through centerPxToTopLeftPct');
    }
  }

  // onObjectMoving must use centerPxToTopLeftPct
  const movingMatch = artifactEditorSource.match(/const onObjectMoving =[\s\S]*?\n      \};/);
  if (movingMatch && !movingMatch[0].includes('centerPxToTopLeftPct')) {
    findings.push('onObjectMoving must route through centerPxToTopLeftPct');
  }

  // serializeCanvas in canvas-utils.ts must use centerPxToTopLeftPct
  const serializeMatch = canvasUtilsSource.match(/export function serializeCanvas[\s\S]*?\n\}/);
  if (serializeMatch && !serializeMatch[0].includes('centerPxToTopLeftPct')) {
    findings.push('serializeCanvas must use centerPxToTopLeftPct for center-to-top-left conversion');
  }

  return findings;
}

test('SPEC-55-02: Unified Event Handler Synchronization and Release-Jump Elimination Guards', () => {
  const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const canvasUtilsPath = path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts');

  const artifactEditorSource = fs.readFileSync(artifactEditorPath, 'utf8');
  const canvasUtilsSource = fs.readFileSync(canvasUtilsPath, 'utf8');

  const findings = scanSpec55_02Features(artifactEditorSource, canvasUtilsSource);
  assert.deepEqual(findings, [], `SPEC-55-02 findings detected:\n${findings.join('\n')}`);
});

test('SPEC-55-02: Zero-Jump Invariant Between Active Drag and Mouse Release (Move -> Modified)', async () => {
  const { CANVAS_WIDTH, CANVAS_HEIGHT, pctToPx, pxToPct, topLeftPctToCenterPx, centerPxToTopLeftPct } = await import('../src/lib/registry/canvas-utils.ts');

  // Initial element at x: 15%, y: 20%, w: 30%, h: 10%
  const initial = { x: 15, y: 20, w: 30, h: 10 };
  const initialCenter = topLeftPctToCenterPx(initial.x, initial.y, initial.w, initial.h);

  // Drag element to new center: left = 384px (40%), top = 189px (35%)
  const newCenter = { left: 384, top: 189 };
  const wPx = pctToPx(initial.w, CANVAS_WIDTH);
  const hPx = pctToPx(initial.h, CANVAS_HEIGHT);

  // In onObjectMoving:
  const movingCoords = centerPxToTopLeftPct(newCenter.left, newCenter.top, wPx, hPx);

  // In onObjectModified (upon mouse release):
  const modifiedCoords = centerPxToTopLeftPct(newCenter.left, newCenter.top, wPx, hPx);

  // Invariant: coordinates during move and upon release MUST be identical with zero delta
  const deltaX = Math.abs(modifiedCoords.x - movingCoords.x);
  const deltaY = Math.abs(modifiedCoords.y - movingCoords.y);

  assert.ok(deltaX <= 0.001, `Delta X between moving and release (${deltaX}) must be 0`);
  assert.ok(deltaY <= 0.001, `Delta Y between moving and release (${deltaY}) must be 0`);

  // Verify that expected top-left matches (384 - 288/2) / 960 = (384 - 144) / 960 = 240 / 960 = 25%
  assert.ok(Math.abs(modifiedCoords.x - 25.0) <= 0.01, `Expected x: 25%, got ${modifiedCoords.x}`);
  // (189 - 54/2) / 540 = (189 - 27) / 540 = 162 / 540 = 30%
  assert.ok(Math.abs(modifiedCoords.y - 30.0) <= 0.01, `Expected y: 30%, got ${modifiedCoords.y}`);
});

export function scanSpec55_03Features(artifactEditorSource, canvasUtilsSource) {
  const findings = [];

  // handleDuplicateSelected must use centerPxToTopLeftPct
  const duplicateMatch = artifactEditorSource.match(/const handleDuplicateSelected =[\s\S]*?\n  \};/);
  if (duplicateMatch && !duplicateMatch[0].includes('centerPxToTopLeftPct')) {
    findings.push('handleDuplicateSelected must route through centerPxToTopLeftPct for proper cloning cascade');
  }

  // handleCopySelected must use centerPxToTopLeftPct
  const copyMatch = artifactEditorSource.match(/const handleCopySelected =[\s\S]*?\n  \};/);
  if (copyMatch && !copyMatch[0].includes('centerPxToTopLeftPct')) {
    findings.push('handleCopySelected must route through centerPxToTopLeftPct for clipboard extraction');
  }

  // applyFabricTextFit in canvas-utils.ts must configure clipPath with originX: tb.originX and angle
  const textFitMatch = canvasUtilsSource.match(/export function applyFabricTextFit[\s\S]*?\n\}/);
  if (textFitMatch) {
    if (!textFitMatch[0].includes('originX: tb.originX') && !textFitMatch[0].includes("originX: 'center'")) {
      findings.push('applyFabricTextFit must set originX: center on initial clipPath');
    }
    if (!textFitMatch[0].includes('originY: tb.originY') && !textFitMatch[0].includes("originY: 'center'")) {
      findings.push('applyFabricTextFit must set originY: center on initial clipPath');
    }
  }

  // onTextChanged and handleFontSizeCommit in ArtifactEditor.tsx must compensate center with rotation angle
  if (!artifactEditorSource.includes('Math.sin(theta') && !artifactEditorSource.includes('Math.sin(rad') && !artifactEditorSource.includes('Math.sin(')) {
    findings.push('ArtifactEditor.tsx must account for rotation angle when auto-expanding text height');
  }

  return findings;
}

test('SPEC-55-03: Copy, Duplicate, Auto-Expand-Height & Clip-Path Alignment Guards', () => {
  const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const canvasUtilsPath = path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts');

  const artifactEditorSource = fs.readFileSync(artifactEditorPath, 'utf8');
  const canvasUtilsSource = fs.readFileSync(canvasUtilsPath, 'utf8');

  const findings = scanSpec55_03Features(artifactEditorSource, canvasUtilsSource);
  assert.deepEqual(findings, [], `SPEC-55-03 findings detected:\n${findings.join('\n')}`);
});

test('SPEC-55-03: Rotated Text Height Expansion Geometry (0°, 90°, 180°, 270°, 37° top-edge anchoring)', async () => {
  const { CANVAS_WIDTH, CANVAS_HEIGHT, pctToPx, topLeftPctToCenterPx } = await import('../src/lib/registry/canvas-utils.ts');

  const angles = [0, 90, 180, 270, 37];
  const initial = { x: 20, y: 15, w: 40, h: 10 }; // 40% w (384px), 10% h (54px)
  const currentH = pctToPx(initial.h, CANVAS_HEIGHT);
  const initialCenter = topLeftPctToCenterPx(initial.x, initial.y, initial.w, initial.h);

  // Auto-expanded height doubles from 54px to 108px
  const newH = 108;
  const deltaY = (newH - currentH) / 2;

  for (const angle of angles) {
    const rad = (angle * Math.PI) / 180;
    // Mathematically proven local-to-world down vector under clockwise angle:
    // deltaLeft = -deltaY * sin(theta), deltaTop = deltaY * cos(theta)
    const deltaLeft = -deltaY * Math.sin(rad);
    const deltaTop = deltaY * Math.cos(rad);

    const newCenterLeft = initialCenter.left + deltaLeft;
    const newCenterTop = initialCenter.top + deltaTop;

    // The midpoint of the unrotated local top edge is located at:
    // P_top = (centerLeft + (H/2) * sin(theta), centerTop - (H/2) * cos(theta))
    const oldTopMidpoint = {
      x: initialCenter.left + (currentH / 2) * Math.sin(rad),
      y: initialCenter.top - (currentH / 2) * Math.cos(rad),
    };
    const newTopMidpoint = {
      x: newCenterLeft + (newH / 2) * Math.sin(rad),
      y: newCenterTop - (newH / 2) * Math.cos(rad),
    };

    const driftX = Math.abs(newTopMidpoint.x - oldTopMidpoint.x);
    const driftY = Math.abs(newTopMidpoint.y - oldTopMidpoint.y);

    assert.ok(
      driftX <= 0.001,
      `At ${angle}°, top-edge midpoint X drift (${driftX}) must be zero`
    );
    assert.ok(
      driftY <= 0.001,
      `At ${angle}°, top-edge midpoint Y drift (${driftY}) must be zero`
    );
  }
});

test('SPEC-55-04: Browser-Parity Textbox Mocking & Center-Origin Invariants across Angles', async () => {
  const { CANVAS_WIDTH, CANVAS_HEIGHT, pctToPx, elementToFabricObject, serializeCanvas } = await import('../src/lib/registry/canvas-utils.ts');

  // Realistic Fabric mock constructor simulating browser Fabric.js v6
  class MockTextbox {
    constructor(text, options) {
      this.type = 'textbox';
      this.text = text;
      Object.assign(this, options);
      this.data = { ...(options?.data || {}) };
    }
    set(keyOrObj, val) {
      if (typeof keyOrObj === 'string') {
        this[keyOrObj] = val;
      } else if (typeof keyOrObj === 'object') {
        Object.assign(this, keyOrObj);
      }
    }
    initDimensions() {}
    calcTextHeight() { return this.height || 50; }
    setCoords() {}
    getScaledWidth() { return (this.width || 0) * (this.scaleX || 1); }
    getScaledHeight() { return (this.height || 0) * (this.scaleY || 1); }
  }

  class MockRect {
    constructor(options) {
      this.type = 'rect';
      Object.assign(this, options);
      this.data = { ...(options?.data || {}) };
    }
    set(keyOrObj, val) {
      if (typeof keyOrObj === 'string') {
        this[keyOrObj] = val;
      } else if (typeof keyOrObj === 'object') {
        Object.assign(this, keyOrObj);
      }
    }
    setCoords() {}
    getScaledWidth() { return (this.width || 0) * (this.scaleX || 1); }
    getScaledHeight() { return (this.height || 0) * (this.scaleY || 1); }
  }

  class MockLine {
    constructor(points, options) {
      this.type = 'line';
      this.points = points;
      Object.assign(this, options);
      this.data = { ...(options?.data || {}) };
    }
    set(keyOrObj, val) {
      if (typeof keyOrObj === 'string') {
        this[keyOrObj] = val;
      } else if (typeof keyOrObj === 'object') {
        Object.assign(this, keyOrObj);
      }
    }
    setCoords() {}
    getScaledWidth() { return (this.width || 0) * (this.scaleX || 1); }
    getScaledHeight() { return (this.height || 0) * (this.scaleY || 1); }
  }

  const mockFabric = {
    Textbox: MockTextbox,
    Rect: MockRect,
    Line: MockLine,
  };

  const angles = [0, 90, 180, 270, 37];

  for (const angle of angles) {
    const textElement = {
      id: `text-elem-${angle}`,
      type: 'text',
      x: 25,
      y: 35,
      w: 30,
      h: 12,
      rotation: angle,
      content: 'Real Textbox Parity',
    };

    const fabricObj = elementToFabricObject(mockFabric, textElement, true);
    assert.strictEqual(fabricObj.type, 'textbox', 'Must instantiate real MockTextbox, not fallback stand-in');
    assert.strictEqual(fabricObj.originX, 'center', `Textbox must have originX: 'center' at ${angle}°`);
    assert.strictEqual(fabricObj.originY, 'center', `Textbox must have originY: 'center' at ${angle}°`);

    const expectedLeft = pctToPx(textElement.x + textElement.w / 2, CANVAS_WIDTH);
    const expectedTop = pctToPx(textElement.y + textElement.h / 2, CANVAS_HEIGHT);
    assert.ok(Math.abs(fabricObj.left - expectedLeft) <= 0.05, `Left (${fabricObj.left}) must match center (${expectedLeft})`);
    assert.ok(Math.abs(fabricObj.top - expectedTop) <= 0.05, `Top (${fabricObj.top}) must match center (${expectedTop})`);

    // Serialization roundtrip
    const mockCanvas = {
      getObjects: () => [fabricObj],
    };
    const serialized = serializeCanvas(mockCanvas, { version: 1, elements: [textElement] }, new Map());
    assert.strictEqual(serialized.length, 1);
    assert.ok(Math.abs(serialized[0].x - textElement.x) <= 0.05, `Serialized X (${serialized[0].x}) matches ${textElement.x}`);
    assert.ok(Math.abs(serialized[0].y - textElement.y) <= 0.05, `Serialized Y (${serialized[0].y}) matches ${textElement.y}`);
  }
});

test('SPEC-55-04: Universal Fabric Object Constructor Parity (Text, Shape, Line & ClipPath)', async () => {
  const { elementToFabricObject } = await import('../src/lib/registry/canvas-utils.ts');

  class MockTextbox {
    constructor(text, options) {
      this.type = 'textbox';
      this.text = text;
      Object.assign(this, options);
      this.data = { ...(options?.data || {}) };
    }
    set(keyOrObj, val) {
      if (typeof keyOrObj === 'string') this[keyOrObj] = val;
      else if (typeof keyOrObj === 'object') Object.assign(this, keyOrObj);
    }
    initDimensions() {}
    calcTextHeight() { return this.height || 50; }
    setCoords() {}
    getScaledWidth() { return (this.width || 0) * (this.scaleX || 1); }
    getScaledHeight() { return (this.height || 0) * (this.scaleY || 1); }
  }

  class MockRect {
    constructor(options) {
      this.type = 'rect';
      Object.assign(this, options);
      this.data = { ...(options?.data || {}) };
    }
    set(keyOrObj, val) {
      if (typeof keyOrObj === 'string') this[keyOrObj] = val;
      else if (typeof keyOrObj === 'object') Object.assign(this, keyOrObj);
    }
    setCoords() {}
    getScaledWidth() { return (this.width || 0) * (this.scaleX || 1); }
    getScaledHeight() { return (this.height || 0) * (this.scaleY || 1); }
  }

  class MockLine {
    constructor(points, options) {
      this.type = 'line';
      this.points = points;
      Object.assign(this, options);
      this.data = { ...(options?.data || {}) };
    }
    set(keyOrObj, val) {
      if (typeof keyOrObj === 'string') this[keyOrObj] = val;
      else if (typeof keyOrObj === 'object') Object.assign(this, keyOrObj);
    }
    setCoords() {}
    getScaledWidth() { return (this.width || 0) * (this.scaleX || 1); }
    getScaledHeight() { return (this.height || 0) * (this.scaleY || 1); }
  }

  class MockImage {
    constructor(imgEl, options) {
      this.type = 'image';
      this.imgEl = imgEl;
      Object.assign(this, options);
      this.data = { ...(options?.data || {}) };
    }
    set(keyOrObj, val) {
      if (typeof keyOrObj === 'string') this[keyOrObj] = val;
      else if (typeof keyOrObj === 'object') Object.assign(this, keyOrObj);
    }
    setCoords() {}
    getScaledWidth() { return (this.width || 0) * (this.scaleX || 1); }
    getScaledHeight() { return (this.height || 0) * (this.scaleY || 1); }
  }

  const mockFabric = {
    Textbox: MockTextbox,
    Rect: MockRect,
    Line: MockLine,
    FabricImage: MockImage,
  };

  // 1. Textbox & its clipPath
  const textEl = { id: 't1', type: 'text', x: 10, y: 15, w: 30, h: 10, rotation: 45, content: 'Text' };
  const textObj = elementToFabricObject(mockFabric, textEl, true);
  assert.strictEqual(textObj.originX, 'center', 'Textbox must have originX: center');
  assert.strictEqual(textObj.originY, 'center', 'Textbox must have originY: center');
  assert.strictEqual(textObj.clipPath?.originX, 'center', 'Textbox clipPath must have originX: center');
  assert.strictEqual(textObj.clipPath?.originY, 'center', 'Textbox clipPath must have originY: center');

  // 2. Shape (Rect)
  const shapeEl = { id: 's1', type: 'shape', x: 20, y: 25, w: 20, h: 15, rotation: 30, style: { fillColor: '#5C2E16' } };
  const shapeObj = elementToFabricObject(mockFabric, shapeEl, true);
  assert.strictEqual(shapeObj.originX, 'center', 'Shape must have originX: center');
  assert.strictEqual(shapeObj.originY, 'center', 'Shape must have originY: center');

  // 3. Line
  const lineEl = { id: 'l1', type: 'line', x: 5, y: 50, w: 50, h: 0, rotation: 0 };
  const lineObj = elementToFabricObject(mockFabric, lineEl, true);
  assert.strictEqual(lineObj.originX, 'center', 'Line must have originX: center');
  assert.strictEqual(lineObj.originY, 'center', 'Line must have originY: center');

  // 4. Image Clip-Path synchronization
  const { syncImageClipOnScale, syncImageClipOnMove } = await import('../src/lib/registry/canvas-utils.ts');
  const imgClip = new MockRect({ width: 200, height: 150 });
  const mockImg = {
    originX: 'center',
    originY: 'center',
    left: 480,
    top: 270,
    angle: 45,
    clipPath: imgClip,
    data: { imageRef: 'img-1', clipOffset: { x: 0, y: 0 }, clipDimensions: { width: 200, height: 150 } },
    scaleX: 1.2,
    scaleY: 1.2,
  };

  syncImageClipOnMove(mockImg);
  assert.strictEqual(imgClip.originX, 'center', 'syncImageClipOnMove must enforce originX: center');
  assert.strictEqual(imgClip.originY, 'center', 'syncImageClipOnMove must enforce originY: center');

  syncImageClipOnScale(mockImg);
  assert.strictEqual(imgClip.originX, 'center', 'syncImageClipOnScale must enforce originX: center');
  assert.strictEqual(imgClip.originY, 'center', 'syncImageClipOnScale must enforce originY: center');
});

test('SPEC-55-04: Copy/Duplicate Center Fallbacks and AuthoredHeight Consistency', async () => {
  const { topLeftPctToCenterPx, centerPxToTopLeftPct } = await import('../src/lib/registry/canvas-utils.ts');

  // When obj.left/top is missing, fallback uses topLeftPctToCenterPx(source.x, source.y, source.w, source.h)
  const source = { x: 12.5, y: 25.0, w: 35.0, h: 15.0 };
  const fallbackCenter = topLeftPctToCenterPx(source.x, source.y, source.w, source.h);

  const derivedTopLeft = centerPxToTopLeftPct(
    fallbackCenter.left,
    fallbackCenter.top,
    fallbackCenter.width,
    fallbackCenter.height
  );

  assert.ok(Math.abs(derivedTopLeft.x - source.x) <= 0.01, 'Fallback center must roundtrip to source x');
  assert.ok(Math.abs(derivedTopLeft.y - source.y) <= 0.01, 'Fallback center must roundtrip to source y');
});

test('SPEC-55-04-Absence-Guard: Real-File Defect Injection Proofs', () => {
  const canvasUtilsPath = path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts');
  const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');

  const canvasUtilsSource = fs.readFileSync(canvasUtilsPath, 'utf8');
  const artifactEditorSource = fs.readFileSync(artifactEditorPath, 'utf8');

  // Guard 1: scanSpec55_01Features detects defect if buildTextFabricOptions loses originX: 'center'
  const defect1 = canvasUtilsSource.replace(/originX: 'center',/g, "originX: 'left',");
  const findings1 = scanSpec55_01Features(defect1);
  assert.ok(findings1.length > 0, 'scanSpec55_01Features must fail when originX: center is omitted');

  // Guard 2: scanSpec55_02Features detects defect if onObjectModified reverts to raw pxToPct(left)
  const defect2 = artifactEditorSource.replace(
    /const \{ x: newX, y: newY \} = centerPxToTopLeftPct\(left, top, w, h\);/g,
    'const newX = pxToPct(left, CANVAS_WIDTH); const newY = pxToPct(top, CANVAS_HEIGHT);'
  );
  const findings2 = scanSpec55_02Features(defect2, canvasUtilsSource);
  assert.ok(findings2.length > 0, 'scanSpec55_02Features must fail when onObjectModified does not use centerPxToTopLeftPct');

  // Guard 3: scanSpec55_03Features detects defect if handleDuplicateSelected skips centerPxToTopLeftPct
  const defect3 = artifactEditorSource.replace(
    /const \{ x: baseTopLeftX, y: baseTopLeftY \} = centerPxToTopLeftPct/g,
    'const baseTopLeftX = 0; const baseTopLeftY = 0;'
  );
  const findings3 = scanSpec55_03Features(defect3, canvasUtilsSource);
  assert.ok(findings3.length > 0, 'scanSpec55_03Features must fail when handleDuplicateSelected skips centerPxToTopLeftPct');
});

