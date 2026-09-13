/**
 * SPEC-24: Canvas Healing Dirty-State & Persistence Isolation Smoke Suite
 *
 * Automated verification of:
 * - Decouple background healing from navigation dirty-state guard (SPEC-24-01: T-24-01, T-24-02)
 * - Reset healing ref on user interactions (SPEC-24-02: T-24-03)
 * - Non-destructive canvas serialization (SPEC-24-03: T-24-04, T-24-05, T-24-06)
 * - Absence guards & verification (SPEC-24-04: T-24-07, T-24-08)
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
  serializeCanvas,
  pxToPct,
  pctToPx,
  isElementUnmeasured,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts')).href
);

const {
  mayDiscard,
  nextDirtyState,
  CANVAS_MUTATION_EVENTS,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'canvas-dirty-guard.ts')).href
);

// Mock minimal Fabric objects for testing serializeCanvas
class MockFabricObject {
  constructor(options = {}) {
    this.type = options.type || 'rect';
    this.left = options.left ?? 0;
    this.top = options.top ?? 0;
    this.width = options.width ?? 100;
    this.height = options.height ?? 100;
    this.scaleX = options.scaleX ?? 1;
    this.scaleY = options.scaleY ?? 1;
    this.data = options.data || {};
    this.fill = options.fill;
    this.opacity = options.opacity;
  }
  get(key) {
    if (key === 'data') return this.data;
    return this[key];
  }
  set(keyOrObj, val) {
    if (typeof keyOrObj === 'object') {
      Object.assign(this, keyOrObj);
    } else {
      this[keyOrObj] = val;
    }
    return this;
  }
}

class MockFabricText extends MockFabricObject {
  constructor(text = '', options = {}) {
    super({ ...options, type: 'text' });
    this.text = text;
    this.fontSize = options.fontSize ?? 32;
    this.fontFamily = options.fontFamily ?? 'Arial';
    this.fontWeight = options.fontWeight ?? 'normal';
    this.fontStyle = options.fontStyle ?? 'normal';
    this.dynamicMinWidth = options.dynamicMinWidth;
    this.textLines = options.textLines;
  }
  _initDimensions() {
    this.reWrapped = true;
  }
}

class MockCanvas {
  constructor(objects = []) {
    this._objects = [...objects];
  }
  getObjects() {
    return [...this._objects];
  }
}

// --------------------------------------------------------------------------
// SPEC-24-01 Tests
// --------------------------------------------------------------------------

test('T-24-01: Mounting a template with unmeasured text elements leaves isDirty: false', () => {
  // Legacy template fixture F-1 with unmeasured elements
  const legacyElement = {
    id: 'elem-1',
    type: 'text',
    x: 10,
    y: 10,
    w: 60,
    h: 15,
    content: 'Sample Title',
    // Missing longestWordPx, wrapLines, measuredWith
  };

  assert.equal(isElementUnmeasured(legacyElement), true, 'legacy element is recognized as unmeasured');

  // Source guard: ArtifactEditor.tsx must NOT call markDirty() in mountCanvas for unmeasured elements
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const editorCode = fs.readFileSync(editorPath, 'utf8');

  // Verify that mountCanvas has no call to markDirty() after checking unmeasured or healing
  const mountStart = editorCode.indexOf('async function mountCanvas()');
  assert.ok(mountStart !== -1, 'mountCanvas must be present in ArtifactEditor.tsx');
  const mountEnd = editorCode.indexOf('mountCanvas().catch(', mountStart);
  assert.ok(mountEnd !== -1, 'mountCanvas boundary must be found');

  const mountBody = editorCode.slice(mountStart, mountEnd);

  // Assert that markDirty() is NOT executed as a statement inside mountCanvas
  const mountMarkDirtyStatements = mountBody.match(/\n\s*markDirty\(\);/g);
  assert.equal(
    mountMarkDirtyStatements,
    null,
    'mountCanvas must NOT execute markDirty() on mount (would prematurely dirty clean slides)'
  );

  // Assert nextDirtyState on mount/template switch returns false
  assert.equal(nextDirtyState(false, 'template-changed'), false);
  assert.equal(nextDirtyState(true, 'template-changed'), false);
});

test('T-24-02: mayDiscard(isDirty && isEditable) returns true immediately without triggering confirm when isDirty is false', () => {
  let confirmCalls = 0;
  const mockConfirm = (message) => {
    confirmCalls++;
    return true;
  };

  // Case 1: isDirty is false, isEditable is true (freshly mounted unmeasured slide)
  const isDirty = false;
  const isEditable = true;
  const proceed = mayDiscard(
    isDirty && isEditable,
    'Discard unsaved changes?',
    mockConfirm
  );

  assert.equal(proceed, true, 'Navigation proceeds immediately');
  assert.equal(confirmCalls, 0, 'Confirm callback was NOT invoked for clean slide');

  // Case 2: isDirty is true, isEditable is true (actually mutated slide)
  const dirtyProceed = mayDiscard(
    true && isEditable,
    'Discard unsaved changes?',
    mockConfirm
  );
  assert.equal(dirtyProceed, true, 'Confirmed discard proceeds');
  assert.equal(confirmCalls, 1, 'Confirm callback WAS invoked for dirty slide');
});

// --------------------------------------------------------------------------
// SPEC-24-02 Tests
// --------------------------------------------------------------------------

test('T-24-03: User interactions on canvas and direct control actions reset isHealingOnlyRef.current = false', () => {
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const editorCode = fs.readFileSync(editorPath, 'utf8');

  // 1. markUserDirty helper must exist and clear isHealingOnlyRef.current = false
  assert.ok(
    editorCode.includes('const markUserDirty = useCallback(() => {'),
    'markUserDirty helper must be declared'
  );
  assert.ok(
    editorCode.includes('isHealingOnlyRef.current = false;'),
    'isHealingOnlyRef.current = false must be set on mutation'
  );
  assert.ok(
    editorCode.includes('const markDirty = markUserDirty;'),
    'markDirty must alias or call markUserDirty'
  );

  // 2. onObjectMoving, onObjectScaling, onObjectModified, onTextChanged must invoke markUserDirty
  const movingIdx = editorCode.indexOf('const onObjectMoving =');
  assert.ok(movingIdx !== -1);
  const movingBody = editorCode.slice(movingIdx, editorCode.indexOf('};', movingIdx));
  assert.ok(movingBody.includes('markUserDirty()'), 'onObjectMoving must call markUserDirty()');

  const scalingIdx = editorCode.indexOf('const onObjectScaling =');
  assert.ok(scalingIdx !== -1);
  const scalingBody = editorCode.slice(scalingIdx, editorCode.indexOf('};', scalingIdx));
  assert.ok(scalingBody.includes('markUserDirty()'), 'onObjectScaling must call markUserDirty()');

  const modifiedIdx = editorCode.indexOf('const onObjectModified =');
  assert.ok(modifiedIdx !== -1);
  const modifiedBody = editorCode.slice(modifiedIdx, editorCode.indexOf('};', modifiedIdx));
  assert.ok(modifiedBody.includes('markUserDirty()'), 'onObjectModified must call markUserDirty()');

  const textChangedIdx = editorCode.indexOf('const onTextChanged =');
  assert.ok(textChangedIdx !== -1);
  const textChangedBody = editorCode.slice(textChangedIdx, editorCode.indexOf('};', textChangedIdx));
  assert.ok(textChangedBody.includes('markUserDirty()'), 'onTextChanged must call markUserDirty()');

  // 3. object:resizing must be hooked to markUserDirty
  assert.ok(
    editorCode.includes("canvas.on('object:resizing', markUserDirty)"),
    'object:resizing must be registered on canvas'
  );
});

// --------------------------------------------------------------------------
// SPEC-24-03 Tests
// --------------------------------------------------------------------------

test('T-24-04: serializeCanvas preserves updated x and y when an element is moved, even if isHealingSave: true is passed', () => {
  // Fixture F-2: Element originally at x: 10, y: 10 (left: 96px, top: 54px)
  const sourceElement = {
    id: 'text-moved',
    type: 'text',
    x: 10,
    y: 10,
    w: 40,
    h: 20,
    zIndex: 1,
    content: 'Movable Text',
  };

  const layout = {
    elements: [sourceElement],
  };

  // User dragged element to left: 300px (31.25%), top: 400px (74.074%)
  const fabricText = new MockFabricText('Movable Text', {
    left: 300,
    top: 400,
    width: pctToPx(40, CANVAS_WIDTH),
    height: pctToPx(20, CANVAS_HEIGHT),
    data: { elementId: 'text-moved', originalIndex: 1 },
  });

  const canvas = new MockCanvas([fabricText]);

  // Serialize with isHealingSave: true
  const serialized = serializeCanvas(canvas, layout, new Map(), { isHealingSave: true });
  assert.equal(serialized.length, 1);
  const result = serialized[0];

  const expectedX = pxToPct(300, CANVAS_WIDTH); // 31.25
  const expectedY = pxToPct(400, CANVAS_HEIGHT); // 74.074...

  assert.equal(
    result.x,
    expectedX,
    `x must be updated to ${expectedX} despite isHealingSave: true (was ${result.x})`
  );
  assert.equal(
    result.y,
    expectedY,
    `y must be updated to ${expectedY} despite isHealingSave: true (was ${result.y})`
  );
  assert.notEqual(result.x, sourceElement.x, 'x must not revert to source.x');
  assert.notEqual(result.y, sourceElement.y, 'y must not revert to source.y');
});

test('T-24-05: serializeCanvas preserves updated content and style even if isHealingSave: true is passed', () => {
  // Fixture F-3: Text element whose content and style were edited
  const sourceElement = {
    id: 'text-styled',
    type: 'text',
    x: 15,
    y: 20,
    w: 50,
    h: 15,
    zIndex: 1,
    content: 'Original Headline',
    style: {
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: 'normal',
      fontColor: '#FFFFFF',
    },
  };

  const layout = {
    elements: [sourceElement],
  };

  // Fabric object has edited text and updated styles
  const fabricText = new MockFabricText('Updated Headline', {
    left: pctToPx(15, CANVAS_WIDTH),
    top: pctToPx(20, CANVAS_HEIGHT),
    width: pctToPx(50, CANVAS_WIDTH),
    height: pctToPx(15, CANVAS_HEIGHT),
    fontFamily: 'Roboto',
    fontSize: 32,
    fontWeight: 'bold',
    fontStyle: 'italic',
    fill: '#FFCC00',
    data: { elementId: 'text-styled', originalIndex: 1 },
  });

  const canvas = new MockCanvas([fabricText]);

  const serialized = serializeCanvas(canvas, layout, new Map(), { isHealingSave: true });
  assert.equal(serialized.length, 1);
  const result = serialized[0];

  assert.equal(result.content, 'Updated Headline', 'content must reflect updated Fabric text');
  assert.notEqual(result.content, sourceElement.content, 'content must not revert to source.content');

  assert.ok(result.style, 'style must be serialized');
  assert.equal(result.style.fontWeight, 'bold', 'fontWeight must be bold');
  assert.equal(result.style.fontStyle, 'italic', 'fontStyle must be italic');
  assert.equal(result.style.fontColor, '#FFCC00', 'fontColor must reflect updated fill');
});

test('T-24-06: Untouched elements in isHealingSave: true preserve source.h and source.zIndex while adding longestWordPx, wrapLines, and measuredWith', () => {
  const sourceElement = {
    id: 'text-untouched',
    type: 'text',
    x: 10,
    y: 10,
    w: 60,
    h: 25,
    zIndex: 3,
    content: 'Unchanging Content For Healing',
    style: {
      fontFamily: 'Inter',
      fontSize: 28,
    },
  };

  const layout = {
    elements: [sourceElement],
  };

  const authoredWidthPx = pctToPx(60, CANVAS_WIDTH);
  const authoredHeightPx = pctToPx(25, CANVAS_HEIGHT);

  const fabricText = new MockFabricText('Unchanging Content For Healing', {
    left: pctToPx(10, CANVAS_WIDTH),
    top: pctToPx(10, CANVAS_HEIGHT),
    width: authoredWidthPx,
    height: authoredHeightPx + 40, // Fabric measured height exceeds source.h
    fontFamily: 'Inter',
    fontSize: 28,
    dynamicMinWidth: 120,
    textLines: ['Unchanging Content', 'For Healing'],
    data: {
      elementId: 'text-untouched',
      originalIndex: 3,
      authoredHeight: authoredHeightPx,
    },
  });

  const canvas = new MockCanvas([fabricText]);

  const serialized = serializeCanvas(canvas, layout, new Map(), { isHealingSave: true });
  assert.equal(serialized.length, 1);
  const result = serialized[0];

  // Invariant 1: source.x and source.y preserved
  assert.equal(result.x, 10);
  assert.equal(result.y, 10);

  // Invariant 2: source.h preserved (healing save avoids auto-expanding height)
  assert.equal(result.h, 25, 'source.h must be preserved without auto-expansion in healing save');

  // Invariant 3: source.zIndex preserved
  assert.equal(result.zIndex, 3, 'source.zIndex must be preserved in healing save');

  // Invariant 4: Measurements stamped accurately
  assert.equal(typeof result.longestWordPx, 'number');
  assert.ok(result.longestWordPx > 0, 'longestWordPx must be stamped');
  assert.ok(Array.isArray(result.wrapLines), 'wrapLines must be stamped');
  assert.deepEqual(result.wrapLines, ['Unchanging Content', 'For Healing']);
  assert.ok(result.measuredWith, 'measuredWith must be stamped');
  assert.equal(result.measuredWith.fontFamily, 'Inter');
});

// --------------------------------------------------------------------------
// SPEC-24-04 Tests (Absence Guards & Injection Proofs)
// --------------------------------------------------------------------------

test('T-24-07: Absence guard: premature dirtying check in ArtifactEditor.tsx fails if markDirty() is injected on mount', () => {
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const cleanCode = fs.readFileSync(editorPath, 'utf8');

  // Clean code check must pass: mountCanvas must NOT execute markDirty()
  const cleanMountStart = cleanCode.indexOf('async function mountCanvas()');
  const cleanMountEnd = cleanCode.indexOf('mountCanvas().catch(', cleanMountStart);
  const cleanMountBody = cleanCode.slice(cleanMountStart, cleanMountEnd);
  assert.equal(
    cleanMountBody.match(/\n\s*markDirty\(\);/g),
    null,
    'Clean code has zero markDirty() execution statements in mountCanvas'
  );

  // Simulate injection of defect into mountCanvas:
  const targetComment = '// An unmeasured template does NOT call markDirty() on mount, preserving clean navigation.';
  assert.ok(cleanCode.includes(targetComment), 'target comment exists in ArtifactEditor.tsx');
  const injectedCode = cleanCode.replace(
    targetComment,
    'markDirty();'
  );
  assert.notEqual(injectedCode, cleanCode, 'Defect injected');

  // The guard asserting absence of markDirty() in mountCanvas must catch the injection
  const injMountStart = injectedCode.indexOf('async function mountCanvas()');
  const injMountEnd = injectedCode.indexOf('mountCanvas().catch(', injMountStart);
  const injMountBody = injectedCode.slice(injMountStart, injMountEnd);
  const injStatements = injMountBody.match(/\n\s*markDirty\(\);/g);

  assert.ok(injStatements && injStatements.length > 0, 'Injection causes markDirty() statement in mountCanvas');
  assert.throws(
    () => {
      assert.equal(injStatements, null, 'mountCanvas must NOT call markDirty() on mount');
    },
    /AssertionError/,
    'Absence guard successfully fails red when premature dirtying is injected'
  );
});

test('T-24-08: Absence guard: coordinate overwriting in serializeCanvas fails if isHealing forcing source.x is injected', () => {
  const canvasUtilsPath = path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts');
  const cleanCode = fs.readFileSync(canvasUtilsPath, 'utf8');

  // Clean code check: computedX must not contain "isHealing || left === authoredLeft"
  assert.ok(
    !cleanCode.includes('computedX = isHealing || left === authoredLeft'),
    'Clean code does not force source.x on isHealing'
  );

  // Simulate injection of defect:
  const injectedCode = cleanCode.replace(
    'const computedX = left === authoredLeft ? source.x : pxToPct(left, CANVAS_WIDTH);',
    'const computedX = isHealing || left === authoredLeft ? source.x : pxToPct(left, CANVAS_WIDTH);'
  );
  assert.notEqual(injectedCode, cleanCode, 'Defect injected');

  assert.throws(
    () => {
      assert.ok(
        !injectedCode.includes('computedX = isHealing || left === authoredLeft'),
        'Must not force source.x on isHealing'
      );
    },
    /AssertionError/,
    'Absence guard successfully fails red when coordinate overwriting defect is injected'
  );
});
