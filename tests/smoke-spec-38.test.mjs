/**
 * SPEC-38: Canvas Session Undo / Redo History Stack and Line & Outline Shape Elements
 * Smoke Test & Absence Guard Suite
 *
 * Verification of:
 * - SPEC-38-01: Session-Scoped Undo & Redo History Stack with Boundary Isolation
 *   1. CanvasHistorySnapshot type definition and state capture
 *   2. Undo / Redo toolbar controls with disabled state on empty stack
 *   3. Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z) with text editing guards
 *   4. Zero cross-slide leakage: stack cleared on slide switch and reset/discard
 *   5. Snapshot restoration suppression: isRestoringHistoryRef prevents mutation loops
 *   6. Absence guards with executable defect injection proofs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const { validateArtifactTemplate } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'validate.ts')).href
);

const { elementToFabricObject, serializeCanvas } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts')).href
);

const { generatePptxFromPlan } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'pptx-draw.ts')).href
);

const { toPptxStrokeWidth } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'artifacts', 'render-model.ts')).href
);

const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
assert.ok(fs.existsSync(artifactEditorPath), 'ArtifactEditor.tsx must exist');
const editorCode = fs.readFileSync(artifactEditorPath, 'utf8');

const pptxDrawPath = path.join(root, 'src', 'lib', 'pptx-draw.ts');
assert.ok(fs.existsSync(pptxDrawPath), 'pptx-draw.ts must exist');
const pptxDrawCode = fs.readFileSync(pptxDrawPath, 'utf8');

const artifactSlidePath = path.join(root, 'src', 'components', 'artifacts', 'ArtifactSlide.tsx');
assert.ok(fs.existsSync(artifactSlidePath), 'ArtifactSlide.tsx must exist');
const artifactSlideCode = fs.readFileSync(artifactSlidePath, 'utf8');

// ============================================================================
// SPEC-38-01: Session-Scoped Undo & Redo History Stack Source Guards
// ============================================================================

test('SPEC-38-01: ArtifactEditor defines CanvasHistorySnapshot structure and refs', () => {
  // 1. Snapshot definition
  assert.ok(
    editorCode.includes('type CanvasHistorySnapshot') || editorCode.includes('interface CanvasHistorySnapshot'),
    'ArtifactEditor must define CanvasHistorySnapshot'
  );
  assert.ok(editorCode.includes('elements: CanvasElement[]'), 'Snapshot must capture CanvasElement[]');
  assert.ok(editorCode.includes('addedElements: Map<string, CanvasElement>'), 'Snapshot must capture addedElements map');
  assert.ok(
    editorCode.includes('addedPlaceholders: Map<string, PlaceholderDefinition>'),
    'Snapshot must capture addedPlaceholders map'
  );
  assert.ok(editorCode.includes('backgroundColor: string'), 'Snapshot must capture backgroundColor');
  assert.ok(editorCode.includes('isDirty: boolean'), 'Snapshot must capture isDirty boolean');

  // 2. State & Stack Refs
  assert.ok(editorCode.includes('undoStackRef'), 'ArtifactEditor must maintain undoStackRef');
  assert.ok(editorCode.includes('redoStackRef'), 'ArtifactEditor must maintain redoStackRef');
  assert.ok(editorCode.includes('isRestoringHistoryRef'), 'ArtifactEditor must maintain isRestoringHistoryRef');
  assert.ok(editorCode.includes('undoStack'), 'ArtifactEditor must maintain undoStack state');
  assert.ok(editorCode.includes('redoStack'), 'ArtifactEditor must maintain redoStack state');
});

test('SPEC-38-01: Toolbar contains Undo and Redo buttons with Lucide icons and disabled rules', () => {
  // 1. Lucide icon imports
  assert.ok(editorCode.includes('Undo2'), 'ArtifactEditor must import Undo2 icon');
  assert.ok(editorCode.includes('Redo2'), 'ArtifactEditor must import Redo2 icon');

  // 2. Undo button wiring and disabled condition
  assert.ok(
    editorCode.includes('undoStack.length === 0'),
    'Undo button must be disabled when undoStack.length === 0'
  );
  assert.ok(
    editorCode.includes('onClick={handleUndo}'),
    'Undo button must call handleUndo'
  );
  assert.ok(
    editorCode.includes('aria-label="Undo"'),
    'Undo button must have accessible aria-label'
  );

  // 3. Redo button wiring and disabled condition
  assert.ok(
    editorCode.includes('redoStack.length === 0'),
    'Redo button must be disabled when redoStack.length === 0'
  );
  assert.ok(
    editorCode.includes('onClick={handleRedo}'),
    'Redo button must call handleRedo'
  );
  assert.ok(
    editorCode.includes('aria-label="Redo"'),
    'Redo button must have accessible aria-label'
  );
});

test('SPEC-38-01: Keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Y, Ctrl/Cmd+Shift+Z) with input & text editing guards', () => {
  // Shortcut checks
  assert.ok(
    editorCode.includes('isUndo') || (editorCode.includes('ctrlKey') && editorCode.includes('key === \'z\'')),
    'Keydown handler must check for Undo key combination'
  );
  assert.ok(
    editorCode.includes('isRedo') || (editorCode.includes('ctrlKey') && (editorCode.includes('key === \'y\'') || editorCode.includes('shiftKey'))),
    'Keydown handler must check for Redo key combination'
  );

  // Native input & textarea guards
  assert.ok(
    editorCode.includes('HTMLInputElement') && editorCode.includes('HTMLTextAreaElement'),
    'Keydown handler must guard against input/textarea active elements'
  );

  // Fabric text active editing guard
  assert.ok(
    editorCode.includes('isEditing') || editorCode.includes('getActiveObjects'),
    'Keydown handler must guard against Fabric active text editing mode'
  );
});

test('SPEC-38-01: Slide boundary isolation and discard changes reset history stacks', () => {
  // In loadTemplate (template switch)
  assert.ok(
    editorCode.includes('loadTemplate') && editorCode.includes('setUndoStack([])'),
    'loadTemplate must reset undoStack'
  );
  assert.ok(
    editorCode.includes('loadTemplate') && editorCode.includes('setRedoStack([])'),
    'loadTemplate must reset redoStack'
  );

  // In handleReset (discard changes)
  assert.ok(
    editorCode.includes('handleReset') && editorCode.includes('undoStackRef.current = []'),
    'handleReset must clear undoStackRef'
  );
  assert.ok(
    editorCode.includes('handleReset') && editorCode.includes('redoStackRef.current = []'),
    'handleReset must clear redoStackRef'
  );
});

// ============================================================================
// SPEC-38-01: In-Memory History Stack Transitions & Capacity Invariant
// ============================================================================

test('SPEC-38-01: History Stack Engine simulates undo, redo, capacity clamp (50), and clear on action', () => {
  class HistoryManager {
    constructor(maxDepth = 50) {
      this.maxDepth = maxDepth;
      this.undoStack = [];
      this.redoStack = [];
    }

    pushSnapshot(snapshot) {
      this.undoStack.push(snapshot);
      if (this.undoStack.length > this.maxDepth) {
        this.undoStack.shift();
      }
      this.redoStack = [];
    }

    undo(currentSnapshot) {
      if (this.undoStack.length === 0) return null;
      const target = this.undoStack.pop();
      this.redoStack.push(currentSnapshot);
      return target;
    }

    redo(currentSnapshot) {
      if (this.redoStack.length === 0) return null;
      const target = this.redoStack.pop();
      this.undoStack.push(currentSnapshot);
      return target;
    }

    reset() {
      this.undoStack = [];
      this.redoStack = [];
    }
  }

  const manager = new HistoryManager(50);
  assert.equal(manager.undoStack.length, 0);
  assert.equal(manager.redoStack.length, 0);

  // 1. Push 55 changes -> stack capped at 50
  for (let i = 1; i <= 55; i++) {
    manager.pushSnapshot({ state: `v${i}` });
  }
  assert.equal(manager.undoStack.length, 50, 'Undo stack must be capped at 50');
  assert.equal(manager.undoStack[0].state, 'v6', 'Oldest entries beyond 50 must be shifted');
  assert.equal(manager.undoStack[49].state, 'v55', 'Latest entry must be v55');

  // 2. Undo step
  const restored1 = manager.undo({ state: 'v56' });
  assert.equal(restored1.state, 'v55');
  assert.equal(manager.undoStack.length, 49);
  assert.equal(manager.redoStack.length, 1);
  assert.equal(manager.redoStack[0].state, 'v56');

  // 3. Redo step
  const restored2 = manager.redo({ state: 'v55' });
  assert.equal(restored2.state, 'v56');
  assert.equal(manager.undoStack.length, 50);
  assert.equal(manager.redoStack.length, 0);

  // 4. New action clears redo
  manager.undo({ state: 'v56' });
  assert.equal(manager.redoStack.length, 1);
  manager.pushSnapshot({ state: 'v57' });
  assert.equal(manager.redoStack.length, 0, 'New action must clear redo stack');

  // 5. Slide reset clears both
  manager.reset();
  assert.equal(manager.undoStack.length, 0);
  assert.equal(manager.redoStack.length, 0);
});

// ============================================================================
// SPEC-38-01: Executable Absence Guards with Defect Injection Proofs
// ============================================================================

test('SPEC-38-01: Absence Guard 1 — Keydown must not execute undo/redo while text is editing (defect injection proof)', () => {
  function validateTextEditingGuard(code) {
    const undoRedoBlock = code.match(/if\s*\(\s*isUndo\s*\|\|\s*isRedo\s*\)\s*\{[\s\S]*?void handleRedo\(\);[\s\S]*?return;\s*\}/);
    if (!undoRedoBlock) throw new Error('ABSENCE_DEFECT: isUndo/isRedo block not found in keydown handler');
    const snippet = undoRedoBlock[0];
    if (!snippet.includes('isEditing') || !snippet.includes('if (isTextEditing) return;')) {
      throw new Error('ABSENCE_DEFECT: undo/redo keydown handler lacks isEditing active text guard');
    }
    return true;
  }

  // Real code passes
  assert.ok(validateTextEditingGuard(editorCode), 'Real editor code must guard against isEditing in undo/redo keydown handler');

  // Defect Injection Proof: verify that stripping the isEditing check causes validator to throw
  const defectWithoutEditingGuard = editorCode.replace(
    /const isTextEditing\s*=\s*activeObjects\.some[\s\S]*?if\s*\(isTextEditing\)\s*return;/,
    '/* defect: omitted isEditing guard */'
  );
  assert.throws(
    () => validateTextEditingGuard(defectWithoutEditingGuard),
    /ABSENCE_DEFECT: undo\/redo keydown handler lacks isEditing active text guard/
  );
});

test('SPEC-38-01: Absence Guard 2 — Slide change & Discard must clear history stacks (defect injection proof)', () => {
  function validateBoundaryHistoryClearing(code) {
    const loadTemplateMatch = code.match(/const loadTemplate =[\s\S]*?adapter\.getOne\(id\);[\s\S]*?setTemplate\(data\);/);
    if (!loadTemplateMatch || !loadTemplateMatch[0].includes('setUndoStack([])')) {
      throw new Error('ABSENCE_DEFECT: loadTemplate does not clear undoStack on slide change');
    }
    const handleResetMatch = code.match(/const handleReset =[\s\S]*?adapter\.getOne\(template\.id\);[\s\S]*?addedElementsRef\.current/);
    if (!handleResetMatch || !handleResetMatch[0].includes('setUndoStack([])')) {
      throw new Error('ABSENCE_DEFECT: handleReset does not clear undoStack on discard');
    }
    return true;
  }

  // Real code passes
  assert.ok(validateBoundaryHistoryClearing(editorCode), 'Real editor code must clear history stacks on slide change and reset');

  // Defect Injection Proof: verify that removing setUndoStack([]) from loadTemplate fails the assertion
  const defectWithoutSlideClear = editorCode.replace(
    /const loadTemplate = useCallback\(async \(id: string\) => {[\s\S]*?setTemplate\(data\);/,
    (match) => match.replaceAll('setUndoStack([]);', '/* defect: retained history */')
  );
  assert.throws(
    () => validateBoundaryHistoryClearing(defectWithoutSlideClear),
    /ABSENCE_DEFECT: loadTemplate does not clear undoStack on slide change/
  );
});

// ============================================================================
// SPEC-38-02: Line & Unfilled Shape Elements, Schema Validation, and Property Inspector
// ============================================================================

test('SPEC-38-02: Schema validation accepts line element (including h=0) and outline shape', () => {
  const validTemplate = {
    schemaVersion: 1,
    id: 'test-spec38-template',
    label: 'Test Spec 38',
    baseType: 'general',
    placeholders: [],
    layouts: {
      default: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [
          {
            id: 'line-1',
            type: 'line',
            x: 10,
            y: 20,
            w: 80,
            h: 0, // Horizontal line with zero height
            zIndex: 1,
            style: {
              strokeColor: '#FFFFFF',
              strokeWidth: 2,
            },
          },
          {
            id: 'outline-shape-1',
            type: 'shape',
            x: 15,
            y: 25,
            w: 70,
            h: 50,
            zIndex: 2,
            style: {
              fillColor: 'transparent',
              strokeColor: '#FF5500',
              strokeWidth: 4,
              opacity: 0.9,
            },
          },
        ],
      },
    },
  };

  // Valid template passes
  const parsed = validateArtifactTemplate(validTemplate);
  assert.equal(parsed.layouts.default.elements.length, 2);
  assert.equal(parsed.layouts.default.elements[0].type, 'line');
  assert.equal(parsed.layouts.default.elements[0].h, 0);
  assert.equal(parsed.layouts.default.elements[1].type, 'shape');
  assert.equal(parsed.layouts.default.elements[1].style.fillColor, 'transparent');
  assert.equal(parsed.layouts.default.elements[1].style.strokeColor, '#FF5500');
  assert.equal(parsed.layouts.default.elements[1].style.strokeWidth, 4);
});

test('SPEC-38-02: Schema validation rejects invalid stroke styles and non-line zero height', () => {
  const base = {
    schemaVersion: 1,
    id: 'test-invalid-template',
    label: 'Test Invalid',
    baseType: 'general',
    placeholders: [],
    layouts: {
      default: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [],
      },
    },
  };

  // 1. Rejects shape with h = 0
  assert.throws(() => {
    validateArtifactTemplate({
      ...base,
      layouts: {
        default: {
          ...base.layouts.default,
          elements: [
            {
              id: 'shape-zero-h',
              type: 'shape',
              x: 10,
              y: 10,
              w: 50,
              h: 0,
              zIndex: 1,
            },
          ],
        },
      },
    });
  }, /must be positive/);

  // 2. Rejects invalid strokeColor (non-hex)
  assert.throws(() => {
    validateArtifactTemplate({
      ...base,
      layouts: {
        default: {
          ...base.layouts.default,
          elements: [
            {
              id: 'line-bad-color',
              type: 'line',
              x: 10,
              y: 10,
              w: 50,
              h: 0,
              zIndex: 1,
              style: { strokeColor: 'invalid-red' },
            },
          ],
        },
      },
    });
  }, /strokeColor is invalid/);

  // 3. Rejects strokeWidth exceeding 50
  assert.throws(() => {
    validateArtifactTemplate({
      ...base,
      layouts: {
        default: {
          ...base.layouts.default,
          elements: [
            {
              id: 'line-huge-width',
              type: 'line',
              x: 10,
              y: 10,
              w: 50,
              h: 0,
              zIndex: 1,
              style: { strokeWidth: 99 },
            },
          ],
        },
      },
    });
  }, /strokeWidth exceeds max 50/);

  // 4. Rejects negative strokeWidth
  assert.throws(() => {
    validateArtifactTemplate({
      ...base,
      layouts: {
        default: {
          ...base.layouts.default,
          elements: [
            {
              id: 'line-neg-width',
              type: 'line',
              x: 10,
              y: 10,
              w: 50,
              h: 0,
              zIndex: 1,
              style: { strokeWidth: -5 },
            },
          ],
        },
      },
    });
  }, /must be positive/);

  // 5. Rejects line with h = -1 (must be non-negative)
  assert.throws(() => {
    validateArtifactTemplate({
      ...base,
      layouts: {
        default: {
          ...base.layouts.default,
          elements: [
            {
              id: 'line-neg-h',
              type: 'line',
              x: 10,
              y: 10,
              w: 50,
              h: -1,
              zIndex: 1,
            },
          ],
        },
      },
    });
  }, /must be non-negative/);
});

test('SPEC-38-02: elementToFabricObject assigns stroke properties and perPixelTargetFind: false', () => {
  // 1. Line element
  const lineEl = {
    id: 'test-line',
    type: 'line',
    x: 10,
    y: 10,
    w: 50,
    h: 0,
    zIndex: 1,
    style: {
      strokeColor: '#00FF00',
      strokeWidth: 3,
    },
  };
  const lineObj = elementToFabricObject(null, lineEl, true, { transparentProxy: true });
  assert.equal(lineObj.type, 'line');
  assert.equal(lineObj.stroke, '#00FF00');
  assert.equal(lineObj.strokeWidth, 3);
  assert.equal(lineObj.perPixelTargetFind, false, 'Line must have perPixelTargetFind: false for hit testing');

  // 2. Outline shape element
  const outlineShapeEl = {
    id: 'test-outline-shape',
    type: 'shape',
    x: 10,
    y: 10,
    w: 50,
    h: 30,
    zIndex: 2,
    style: {
      fillColor: 'transparent',
      strokeColor: '#0000FF',
      strokeWidth: 5,
    },
  };
  const outlineObj = elementToFabricObject(null, outlineShapeEl, true, { transparentProxy: true });
  assert.equal(outlineObj.type, 'shape');
  assert.equal(outlineObj.fill, 'transparent');
  assert.equal(outlineObj.stroke, '#0000FF');
  assert.equal(outlineObj.strokeWidth, 5);
  assert.equal(outlineObj.perPixelTargetFind, false, 'Outline shape must have perPixelTargetFind: false for hit testing');
});

test('BUG-041 / SPEC-38: serializeCanvas preserves filled shape fillColor from transparent proxy', () => {
  const layout = {
    aspectRatio: '16:9',
    backgroundColor: '#000000',
    elements: [
      {
        id: 'shape-fill-1',
        type: 'shape',
        x: 10,
        y: 10,
        w: 30,
        h: 20,
        zIndex: 1,
        style: {
          fillColor: '#5C2E16',
          opacity: 1,
        },
      },
      {
        id: 'shape-outline-1',
        type: 'shape',
        x: 50,
        y: 10,
        w: 30,
        h: 20,
        zIndex: 2,
        style: {
          fillColor: 'transparent',
          strokeColor: '#FFFFFF',
          strokeWidth: 2,
          opacity: 1,
        },
      },
    ],
  };

  // Mock Fabric objects produced by elementToFabricObject with transparentProxy: true
  const fillProxyObj = {
    type: 'rect',
    left: 96,
    top: 54,
    width: 288,
    height: 108,
    scaleX: 1,
    scaleY: 1,
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    data: {
      isTransparentProxy: true,
      elementId: 'shape-fill-1',
      authoredWidth: 288,
      authoredHeight: 108,
      style: {
        fillColor: '#5C2E16',
        opacity: 1,
      },
    },
  };

  const outlineProxyObj = {
    type: 'rect',
    left: 480,
    top: 54,
    width: 288,
    height: 108,
    scaleX: 1,
    scaleY: 1,
    fill: 'transparent',
    stroke: '#FFFFFF',
    strokeWidth: 2,
    opacity: 1,
    data: {
      isTransparentProxy: true,
      elementId: 'shape-outline-1',
      authoredWidth: 288,
      authoredHeight: 108,
      style: {
        fillColor: 'transparent',
        strokeColor: '#FFFFFF',
        strokeWidth: 2,
        opacity: 1,
      },
    },
  };

  const mockCanvas = {
    getObjects: () => [fillProxyObj, outlineProxyObj],
  };

  const serialized = serializeCanvas(mockCanvas, layout, new Map());
  const serializedFill = serialized.find((e) => e.id === 'shape-fill-1');
  const serializedOutline = serialized.find((e) => e.id === 'shape-outline-1');

  assert.ok(serializedFill, 'Must serialize filled shape');
  assert.equal(serializedFill.style?.fillColor, '#5C2E16', 'Filled shape must preserve solid fillColor and NOT become transparent');
  assert.equal(serializedFill.style?.strokeColor, undefined, 'Filled shape must not have strokeColor assigned');

  assert.ok(serializedOutline, 'Must serialize outline shape');
  assert.equal(serializedOutline.style?.fillColor, 'transparent', 'Outline shape must have transparent fillColor');
  assert.equal(serializedOutline.style?.strokeColor, '#FFFFFF', 'Outline shape must have strokeColor #FFFFFF');
  assert.equal(serializedOutline.style?.strokeWidth, 2, 'Outline shape must have strokeWidth 2');
});

test('BUG-041 / SPEC-38: ArtifactEditor correctly discriminates filled shapes from outline shapes in proxy mode', () => {
  // Re-read latest editor code
  const freshEditorCode = fs.readFileSync(artifactEditorPath, 'utf8');

  // Verify syncSelection outlineShapes discrimination does not rely blindly on (obj as any).fill === 'transparent'
  assert.ok(
    !freshEditorCode.includes("(obj as any).fill === 'transparent' || liveEl?.style?.fillColor === 'transparent'"),
    'ArtifactEditor syncSelection must not blindly treat all transparent proxy shapes as outline shapes'
  );

  // Verify proxy awareness in shape outline discrimination
  assert.ok(
    freshEditorCode.includes('isTransparentProxy') && freshEditorCode.includes('effFill'),
    'ArtifactEditor must be proxy-aware when determining outline vs filled shapes'
  );
});

test('SPEC-38-02: ArtifactEditor UI controls for Line and Outline Shape elements', () => {
  const currentEditorCode = fs.readFileSync(artifactEditorPath, 'utf8');

  // 1. Toolbar Row 1 Creation Buttons
  assert.ok(currentEditorCode.includes('aria-label="Line"'), 'ArtifactEditor must render Line creation button');
  assert.ok(currentEditorCode.includes('aria-label="Outline Shape"'), 'ArtifactEditor must render Outline Shape creation button');
  assert.ok(currentEditorCode.includes('aria-label="Filled Shape"'), 'ArtifactEditor must render Filled Shape creation button');
  assert.ok(currentEditorCode.includes('Minus'), 'ArtifactEditor must use Minus icon for Line');
  assert.ok(currentEditorCode.includes('fill-current'), 'ArtifactEditor must use fill-current for solid filled shape icon');
  assert.ok(!currentEditorCode.includes('SquareDashed'), 'ArtifactEditor must not use dashed square icon');

  // 2. Toolbar Row 2 Inspector Badges & Controls
  assert.ok(currentEditorCode.includes('LINE'), 'Toolbar must render LINE badge when line is selected');
  assert.ok(currentEditorCode.includes('SHAPE (OUTLINE)'), 'Toolbar must render SHAPE (OUTLINE) badge when outline shape is selected');
  assert.ok(currentEditorCode.includes('handleStrokeColorChange'), 'Toolbar must provide stroke color handler');
  assert.ok(currentEditorCode.includes('handleStrokeWidthChange'), 'Toolbar must provide stroke width handler');
});

test('BUG-041 / SPEC-38: elementToFabricObject populates isTransparentProxy and authored style on Shape Fabric object', () => {
  const filledEl = {
    id: 'test-shape-filled',
    type: 'shape',
    x: 10,
    y: 10,
    w: 30,
    h: 20,
    zIndex: 1,
    style: {
      fillColor: '#5C2E16',
      opacity: 1,
    },
  };

  const obj = elementToFabricObject(null, filledEl, true, { transparentProxy: true });
  assert.ok(obj.data, 'Fabric object must carry data payload');
  assert.equal(obj.data.isTransparentProxy, true, 'Fabric object in proxy mode must flag isTransparentProxy: true');
  assert.equal(obj.data.style?.fillColor, '#5C2E16', 'Fabric object in proxy mode must retain authored fillColor');

  // When serialized, the real object from elementToFabricObject must NOT become an outline
  const layout = {
    aspectRatio: '16:9',
    backgroundColor: '#000000',
    elements: [filledEl],
  };
  const mockCanvas = { getObjects: () => [obj] };
  const serialized = serializeCanvas(mockCanvas, layout, new Map());
  assert.equal(serialized.length, 1);
  assert.equal(serialized[0].style?.fillColor, '#5C2E16');
  assert.equal(serialized[0].style?.strokeColor, undefined);
});

test('BUG-042 / SPEC-38: Layer ordering synchronizes liveElements zIndex and ArtifactSlide CSS zIndex', () => {
  const freshEditorCode = fs.readFileSync(artifactEditorPath, 'utf8');
  const freshSlideCode = fs.readFileSync(artifactSlidePath, 'utf8');

  // 1. ArtifactSlide must apply CSS zIndex in boxStyle
  assert.ok(
    freshSlideCode.includes('zIndex: typeof element.zIndex === \'number\' ? element.zIndex : undefined') ||
    freshSlideCode.includes('zIndex: element.zIndex'),
    'ArtifactSlide boxStyle must assign CSS zIndex for proper browser stacking'
  );

  // 2. ArtifactSlide must sort elements by zIndex
  assert.ok(
    freshSlideCode.includes('.zIndex') && freshSlideCode.includes('sort('),
    'ArtifactSlide must sort elements by zIndex before rendering'
  );

  // 3. ArtifactEditor handleReorderLayer must update liveElements with projected canvas zIndex
  assert.ok(
    freshEditorCode.includes('setLiveElements') &&
    freshEditorCode.includes('canvasObjects.findIndex') &&
    freshEditorCode.includes('zIndex: objIdx'),
    'ArtifactEditor handleReorderLayer must synchronize liveElements with updated zIndex'
  );

  // 4. ArtifactEditor handleReorderLayer must maintain multi-selection sort
  assert.ok(
    freshEditorCode.includes("action === 'forward' || action === 'front' ? idxB - idxA : idxA - idxB"),
    'handleReorderLayer must sort active objects by stack index'
  );
});

test('SPEC-38-02: Absence Guard 1 — h === 0 allowed only for type "line" (defect injection proof)', () => {
  function validateLineHeightRule(validatorFn) {
    const lineRes = validatorFn({
      schemaVersion: 1,
      id: 'test-line-h0',
      label: 'Line H0',
      baseType: 'general',
      placeholders: [],
      layouts: {
        default: {
          aspectRatio: '16:9',
          backgroundColor: '#000000',
          elements: [{ id: 'l1', type: 'line', x: 0, y: 0, w: 10, h: 0, zIndex: 0 }],
        },
      },
    });
    if (lineRes.layouts.default.elements[0].h !== 0) {
      throw new Error('ABSENCE_DEFECT: line with h=0 was rejected or mutated');
    }

    try {
      validatorFn({
        schemaVersion: 1,
        id: 'test-shape-h0',
        label: 'Shape H0',
        baseType: 'general',
        placeholders: [],
        layouts: {
          default: {
            aspectRatio: '16:9',
            backgroundColor: '#000000',
            elements: [{ id: 's1', type: 'shape', x: 0, y: 0, w: 10, h: 0, zIndex: 0 }],
          },
        },
      });
      throw new Error('ABSENCE_DEFECT: shape with h=0 was erroneously accepted');
    } catch (err) {
      if (!err.message.includes('must be positive')) {
        throw err;
      }
    }
    return true;
  }

  // Real validator passes
  assert.ok(validateLineHeightRule(validateArtifactTemplate), 'Real validator must allow h=0 only for line');

  // Defect injection: mock validator that allows h=0 for shapes
  const defectiveValidator = (template) => {
    const el = template.layouts.default.elements[0];
    if (el.h < 0) throw new Error('must be positive');
    return template;
  };
  assert.throws(
    () => validateLineHeightRule(defectiveValidator),
    /ABSENCE_DEFECT: shape with h=0 was erroneously accepted/
  );
});

test('SPEC-38-02: Absence Guard 2 — perPixelTargetFind: false required for outline shape / line (defect injection proof)', () => {
  function validateTargetFindRule(factoryFn) {
    const lineObj = factoryFn(null, { id: 'l', type: 'line', x: 0, y: 0, w: 10, h: 0, zIndex: 0 }, true);
    if (lineObj.perPixelTargetFind !== false) {
      throw new Error('ABSENCE_DEFECT: line lacks perPixelTargetFind: false');
    }
    const shapeObj = factoryFn(
      null,
      { id: 's', type: 'shape', x: 0, y: 0, w: 10, h: 10, zIndex: 0, style: { fillColor: 'transparent', strokeColor: '#FFF' } },
      true
    );
    if (shapeObj.perPixelTargetFind !== false) {
      throw new Error('ABSENCE_DEFECT: outline shape lacks perPixelTargetFind: false');
    }
    return true;
  }

  // Real factory passes
  assert.ok(validateTargetFindRule(elementToFabricObject), 'Real elementToFabricObject must set perPixelTargetFind: false');

  // Defect injection: factory that sets perPixelTargetFind: true
  const defectiveFactory = (fabric, el, editable) => {
    const res = elementToFabricObject(fabric, el, editable);
    res.perPixelTargetFind = true; // defect
    return res;
  };
  assert.throws(
    () => validateTargetFindRule(defectiveFactory),
    /ABSENCE_DEFECT: line lacks perPixelTargetFind: false/
  );
});

// ============================================================================
// SPEC-38-03: Presenter & PPTX Export Parity, Conformance Tests, and Absence Guards
// ============================================================================

test('SPEC-38-03: Unified stroke width conversion in render-model.ts', () => {
  // 1 px -> 0.75 pt
  assert.equal(toPptxStrokeWidth(1), 0.75);
  // 2 px -> 1.5 pt
  assert.equal(toPptxStrokeWidth(2), 1.5);
  // 4 px -> 3 pt
  assert.equal(toPptxStrokeWidth(4), 3);
  // Default and negative handling
  assert.equal(toPptxStrokeWidth(undefined), 1.5);
  assert.equal(toPptxStrokeWidth(-2), 1.5);
  assert.equal(toPptxStrokeWidth(0), 1.5);
});

test('SPEC-38-03: PPTX generator emits native line and outline rectangle shapes without errors', async () => {
  const planItems = [
    {
      artifact: {
        runtimeVersion: 1,
        instanceId: 'test-spec38-inst',
        templateId: 'test-spec38-tmpl',
        label: 'SPEC-38 Test',
        baseType: 'general',
        layoutKey: 'default',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: '#1E1E2E',
          elements: [
            {
              id: 'el-line-1',
              type: 'line',
              x: 10,
              y: 20,
              w: 80,
              h: 0,
              zIndex: 1,
              style: {
                strokeColor: '#00FF00',
                strokeWidth: 4,
                opacity: 0.8,
              },
            },
            {
              id: 'el-shape-1',
              type: 'shape',
              x: 15,
              y: 25,
              w: 70,
              h: 40,
              zIndex: 2,
              style: {
                fillColor: 'transparent',
                strokeColor: '#FF0055',
                strokeWidth: 3,
                opacity: 0.9,
              },
            },
          ],
        },
      },
      fade: true,
    },
  ];

  const buffer = await generatePptxFromPlan('2026-09-17', planItems, 'fade');
  assert.ok(buffer instanceof Buffer, 'generatePptxFromPlan must return a Buffer');
  assert.ok(buffer.length > 1000, 'PPTX buffer must be non-empty zip');

  // Inspect generated OpenXML DrawingML structure
  const zip = await JSZip.loadAsync(buffer);
  const slide1Xml = await zip.file('ppt/slides/slide1.xml')?.async('text');
  assert.ok(slide1Xml, 'slide1.xml must exist in PPTX archive');

  // Parse individual shape elements from DrawingML <p:spTree>
  const spBlocks = slide1Xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) || [];
  assert.equal(spBlocks.length, 2, 'slide1.xml must contain exactly two shapes');

  // Line shape assertions
  const lineShapeXml = spBlocks.find((sp) => sp.includes('00FF00'));
  assert.ok(lineShapeXml, 'Must find line shape by stroke color 00FF00');
  assert.ok(lineShapeXml.includes('prst="line"'), 'Line shape must have prst="line"');
  assert.ok(lineShapeXml.includes('w="38100"'), 'Line shape must have 3pt stroke width (w="38100")');
  assert.ok(lineShapeXml.includes('val="80000"'), 'Line shape must have 80% opacity (val="80000")');

  // Outline rectangle shape assertions
  const outlineShapeXml = spBlocks.find((sp) => sp.includes('FF0055'));
  assert.ok(outlineShapeXml, 'Must find outline shape by stroke color FF0055');
  assert.ok(outlineShapeXml.includes('prst="rect"'), 'Outline shape must have prst="rect"');
  assert.ok(outlineShapeXml.includes('w="28575"'), 'Outline shape must have 2.25pt stroke width (w="28575")');
  assert.ok(outlineShapeXml.includes('val="90000"'), 'Outline shape must have 90% opacity (val="90000")');
  const bodyXmlWithoutLine = outlineShapeXml.replace(/<a:ln[\s\S]*?<\/a:ln>/, '');
  assert.ok(
    !bodyXmlWithoutLine.includes('<a:solidFill>'),
    'Outline shape must not have a solid body fill'
  );
});

test('SPEC-38-03: ArtifactSlide HTML structure renders SVG line and bordered outline box', () => {
  // Source guard: LineElement renders SVG <line>
  assert.ok(artifactSlideCode.includes('function LineElement'), 'ArtifactSlide must declare LineElement');
  assert.ok(artifactSlideCode.includes('<svg') && artifactSlideCode.includes('<line'), 'LineElement must render SVG <line>');
  assert.ok(artifactSlideCode.includes('case \'line\':'), 'ArtifactElement switch must handle type line');

  // Source guard: ShapeElement supports outline border
  assert.ok(artifactSlideCode.includes('strokeColor'), 'ShapeElement must use strokeColor');
  assert.ok(artifactSlideCode.includes('strokeWidth'), 'ShapeElement must use strokeWidth');
  assert.ok(artifactSlideCode.includes('border:'), 'ShapeElement must apply CSS border');
});

test('SPEC-38-03: Absence Guard 1 — pptx-draw.ts must handle type "line" (defect injection proof)', () => {
  function validatePptxLineRenderer(code) {
    if (!code.includes('case \'line\':') || !code.includes('renderLineElement')) {
      throw new Error('ABSENCE_DEFECT: pptx-draw does not handle type line in slide render switch');
    }
    return true;
  }

  // Real code passes
  assert.ok(validatePptxLineRenderer(pptxDrawCode), 'Real pptx-draw code must handle type line');

  // Defect injection proof
  const defectiveCode = pptxDrawCode.replace(
    /case\s*'line':[\s\S]*?renderLineElement\(slide,\s*element\);[\s\S]*?break;/,
    '/* defect: omitted line element handling */'
  );
  assert.throws(
    () => validatePptxLineRenderer(defectiveCode),
    /ABSENCE_DEFECT: pptx-draw does not handle type line in slide render switch/
  );
});

test('SPEC-38-03: Absence Guard 2 — pptx-draw.ts must use toPptxStrokeWidth and toPptxTransparency (defect injection proof)', () => {
  function validateStrokeAndTransparency(code) {
    if (!code.includes('toPptxStrokeWidth(')) {
      throw new Error('ABSENCE_DEFECT: pptx-draw lacks toPptxStrokeWidth unit conversion');
    }
    if (!code.includes('toPptxTransparency(element.style)')) {
      throw new Error('ABSENCE_DEFECT: pptx-draw lacks toPptxTransparency outline transparency mapping');
    }
    return true;
  }

  // Real code passes
  assert.ok(validateStrokeAndTransparency(pptxDrawCode), 'Real pptx-draw code must use toPptxStrokeWidth and toPptxTransparency');

  // Defect injection 1: missing toPptxStrokeWidth
  const defectNoStrokeWidth = pptxDrawCode.replaceAll('toPptxStrokeWidth(', 'unconverted_pixels(');
  assert.throws(
    () => validateStrokeAndTransparency(defectNoStrokeWidth),
    /ABSENCE_DEFECT: pptx-draw lacks toPptxStrokeWidth unit conversion/
  );

  // Defect injection 2: missing toPptxTransparency
  const defectNoTransparency = pptxDrawCode.replaceAll('toPptxTransparency(element.style)', '0');
  assert.throws(
    () => validateStrokeAndTransparency(defectNoTransparency),
    /ABSENCE_DEFECT: pptx-draw lacks toPptxTransparency outline transparency mapping/
  );
});

test('SPEC-38-03: Absence Guard 3 — serializeCanvas must persist strokeColor and strokeWidth for lines and outlines (defect injection proof)', () => {
  const canvasUtilsPath = path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts');
  const canvasUtilsCode = fs.readFileSync(canvasUtilsPath, 'utf8');

  function validateSerializeStroke(code) {
    if (
      !code.includes("if (source.type === 'shape')") ||
      !code.includes("if (source.type === 'line')") ||
      !code.includes('strokeColor') ||
      !code.includes('strokeWidth')
    ) {
      throw new Error('ABSENCE_DEFECT: serializeCanvas lacks strokeColor/strokeWidth persistence for lines/shapes');
    }
    return true;
  }

  // Real code passes
  assert.ok(validateSerializeStroke(canvasUtilsCode), 'Real canvas-utils code must serialize stroke properties');

  // Defect injection
  const defectiveCode = canvasUtilsCode.replace(
    "if (source.type === 'line')",
    "if (false && source.type === 'line')"
  );
  assert.throws(
    () => validateSerializeStroke(defectiveCode),
    /ABSENCE_DEFECT: serializeCanvas lacks strokeColor\/strokeWidth persistence for lines\/shapes/
  );
});
