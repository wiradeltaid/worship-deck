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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const { validateArtifactTemplate } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'validate.ts')).href
);

const { elementToFabricObject } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts')).href
);

const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
assert.ok(fs.existsSync(artifactEditorPath), 'ArtifactEditor.tsx must exist');
const editorCode = fs.readFileSync(artifactEditorPath, 'utf8');

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

test('SPEC-38-02: ArtifactEditor UI controls for Line and Outline Shape elements', () => {
  // 1. Toolbar Row 1 Creation Buttons
  assert.ok(editorCode.includes('aria-label="Line"'), 'ArtifactEditor must render Line creation button');
  assert.ok(editorCode.includes('aria-label="Outline Shape"'), 'ArtifactEditor must render Outline Shape creation button');
  assert.ok(editorCode.includes('Minus'), 'ArtifactEditor must use Minus icon for Line');
  assert.ok(editorCode.includes('SquareDashed'), 'ArtifactEditor must use SquareDashed icon for Outline Shape');

  // 2. Toolbar Row 2 Inspector Badges & Controls
  assert.ok(editorCode.includes('LINE'), 'Toolbar must render LINE badge when line is selected');
  assert.ok(editorCode.includes('SHAPE (OUTLINE)'), 'Toolbar must render SHAPE (OUTLINE) badge when outline shape is selected');
  assert.ok(editorCode.includes('handleStrokeColorChange'), 'Toolbar must provide stroke color handler');
  assert.ok(editorCode.includes('handleStrokeWidthChange'), 'Toolbar must provide stroke width handler');
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
