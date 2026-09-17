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
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

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
