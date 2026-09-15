import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveInitialSelectedId } from '../src/lib/registry/canvas-utils.ts';
import {
  reconcileSlideSelection,
  resolveMultiSelectClick,
} from '../src/lib/registry/slide-selection.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const editorSource = fs.readFileSync(
  path.join(repoRoot, 'src', 'components', 'admin', 'ArtifactEditor.tsx'),
  'utf8'
);

test('SPEC-34-01 Source Guard: Deck Sequence list is focusable with keyboard navigation wiring', () => {
  // ul is focusable keyboard control with tabIndex={0}
  assert.match(editorSource, /<ul[\s\S]*?tabIndex=\{0\}[\s\S]*?onKeyDown=\{handleDeckSequenceKeyDown\}/);

  // Keyboard handler implements Ctrl/Cmd+A, Escape, and Delete/Backspace
  assert.match(editorSource, /const handleDeckSequenceKeyDown =/);
  assert.match(editorSource, /e\.key\.toLowerCase\(\) === 'a'/);
  assert.match(editorSource, /e\.key === 'Escape'/);
  assert.match(editorSource, /e\.key === 'Delete' \|\| e\.key === 'Backspace'/);

  // Deck sequence key handler guards against typing in inputs, textareas, selects, or editable fields
  assert.match(
    editorSource,
    /tagName === 'input'[\s\S]*?tagName === 'textarea'[\s\S]*?tagName === 'select'/
  );

  // Deck sequence key handler respects defaultPrevented and IME composition
  assert.match(editorSource, /if\s*\(e\.defaultPrevented\)\s*return/);
  assert.match(editorSource, /isComposing/);
});

test('SPEC-34-01 Source Guard: Multi-selection block move integration in DnD and move controls', () => {
  // handleDrop delegates to moveSelectedBlock
  assert.match(editorSource, /handleDrop[\s\S]*?moveSelectedBlock\(\{/);

  // handleMoveTemplate delegates to moveSelectedBlock
  assert.match(editorSource, /handleMoveTemplate[\s\S]*?moveSelectedBlock\(\{/);

  // handleDragStart does not alter selection or active slide on unselected drag (SPEC-34 § 2.2)
  const dragStartMatch = editorSource.match(/const handleDragStart = [\s\S]*?\n  \};/);
  assert.ok(dragStartMatch, 'handleDragStart must be present');
  assert.doesNotMatch(
    dragStartMatch[0],
    /setSelectedIds|setSelectedId|setAnchorId/,
    'handleDragStart must not alter selection state'
  );
});

test('SPEC-34-01 Source Guard: All list-changing paths synchronize selection state', () => {
  // handleCreate synchronizes selection
  assert.match(editorSource, /handleCreate[\s\S]*?setSelectedIds\(new Set\(\[data\.id\]\)\)/);

  // handleCloneTemplate synchronizes selection
  assert.match(editorSource, /handleCloneTemplate[\s\S]*?setSelectedIds\(new Set\(\[created\.id\]\)\)/);

  // handleImportPptx synchronizes selection
  assert.match(editorSource, /handleImportPptx[\s\S]*?setSelectedIds\(new Set\(\[data\.firstTemplate\.id\]\)\)/);
});

test('SPEC-34-01 Source Guard: Reviewed selection visual styles and aria-selected state', () => {
  // aria-selected state on slide item
  assert.match(editorSource, /aria-selected=\{isSelected\}/);

  // Active slide styling (SPEC-34 § 2.1)
  assert.match(
    editorSource,
    /border-primary bg-primary\/20 ring-1 ring-primary\/40 font-semibold text-foreground/
  );

  // Co-selected slide styling (SPEC-34 § 2.1)
  assert.match(
    editorSource,
    /border-primary\/60 bg-primary\/10 ring-1 ring-primary\/20 text-foreground/
  );

  // Unselected slide styling (SPEC-34 § 2.1)
  assert.match(
    editorSource,
    /border-border\/60 bg-muted\/30 hover:bg-muted\/70 hover:border-border/
  );
});

test('SPEC-34-01 Absence Guard Proof: No checkbox inputs or checkbox roles in Deck Sequence list', () => {
  // Extract Deck Sequence section from ArtifactEditor
  const deckSequenceMatch = editorSource.match(/Deck Sequence[\s\S]*?<\/ul>/);
  assert.ok(deckSequenceMatch, 'Deck Sequence section must be found in ArtifactEditor.tsx');
  const deckSequenceSnippet = deckSequenceMatch[0];

  // Helper scanner function
  const scanForbiddenCheckboxes = (code) => {
    const hasCheckboxInput = /type=["']checkbox["']/i.test(code);
    const hasCheckboxRole = /role=["']checkbox["']/i.test(code);
    return { hasCheckboxInput, hasCheckboxRole };
  };

  // 1. In real file: strictly zero checkbox markup or roles
  const realScan = scanForbiddenCheckboxes(deckSequenceSnippet);
  assert.equal(realScan.hasCheckboxInput, false, 'Deck Sequence must contain no checkbox input');
  assert.equal(realScan.hasCheckboxRole, false, 'Deck Sequence must contain no checkbox role');

  // 2. Defect injection proof 1: Injected <input type="checkbox"> triggers failure
  const injectedInput = deckSequenceSnippet.replace(
    'role="button"',
    'role="button"><input type="checkbox" />'
  );
  assert.equal(scanForbiddenCheckboxes(injectedInput).hasCheckboxInput, true);

  // 3. Defect injection proof 2: Injected role="checkbox" triggers failure
  const injectedRole = deckSequenceSnippet.replace('role="button"', 'role="checkbox"');
  assert.equal(scanForbiddenCheckboxes(injectedRole).hasCheckboxRole, true);
});

test('SPEC-34-02 Source Guard: Header controls, single confirmation, and fresh token runner', () => {
  // Header shows selectedCount badge, deselect button, and deleteSelected action when selectedIds.size > 1
  assert.match(editorSource, /selectedIds\.size > 1/);
  assert.match(editorSource, /admin\.artifacts\.selectedCount/);
  assert.match(editorSource, /admin\.artifacts\.deselect/);
  assert.match(editorSource, /admin\.artifacts\.deleteSelected/);

  // Single shared confirmation before deletion loop
  assert.match(editorSource, /const handleDeleteSelectedTemplates = async/);
  assert.match(editorSource, /admin\.artifacts\.confirmDeleteBulk/);
  assert.match(editorSource, /admin\.artifacts\.confirmDeleteBulkDirty/);
  assert.match(editorSource, /window\.confirm\(warning\)/);

  // Consumes runBulkDelete pure engine
  assert.match(editorSource, /await runBulkDelete\(\{/);

  // Reconciles active slide using resolveNextActiveSlide
  assert.match(editorSource, /resolveNextActiveSlide\(result\.deletedIds, selectedId, templates\)/);

  // Row trash icon delegates to the same lifecycle
  assert.match(editorSource, /const handleDeleteTemplate = async \(item: ArtifactTemplateSummary\) => \{[\s\S]*?await handleDeleteSelectedTemplates\(item\);/);
});

test('SPEC-34-01 Source Guard: Deselecting final active slide clears template and dirty state', () => {
  // handleSlideClick clears template and dirty state when activeId becomes null
  assert.match(
    editorSource,
    /if\s*\(!result\.activeId\)\s*\{\s*setTemplate\(null\);\s*setIsDirty\(\(current\)\s*=>\s*nextDirtyState\(current,\s*'template-changed'\)\);/
  );

  // Escape clears template and dirty state when no slide is selected
  assert.match(
    editorSource,
    /if\s*\(e\.key === 'Escape'\)[\s\S]*?setTemplate\(null\);[\s\S]*?nextDirtyState\(current,\s*'template-changed'\)/
  );
});

test('SPEC-34-02 Source Guard: i18n keys are registered and used without hardcoded English', () => {
  const requiredKeys = [
    'admin.artifacts.selectedCount',
    'admin.artifacts.deselect',
    'admin.artifacts.confirmDeleteBulk',
    'admin.artifacts.confirmDeleteBulkDirty',
    'admin.artifacts.deletedBulk',
    'admin.artifacts.deletedBulkPartial',
  ];

  for (const key of requiredKeys) {
    assert.ok(
      editorSource.includes(key),
      `ArtifactEditor.tsx must use translated i18n key ${key}`
    );
  }
});

test('SPEC-34-01: initial load -> first slide active -> Ctrl/Cmd-click second slide -> both selected, first active', () => {
  const summaries = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
  const initialId = resolveInitialSelectedId(null, null, summaries);
  assert.equal(initialId, 's1');

  // Initial selection reconciled from initialId
  const initialSelection = reconcileSlideSelection(
    [initialId],
    initialId,
    initialId,
    summaries.map((s) => s.id)
  );
  assert.deepEqual(initialSelection.selectedIds, ['s1']);
  assert.equal(initialSelection.activeId, 's1');
  assert.equal(initialSelection.anchorId, 's1');

  // Ctrl/Cmd click second slide s2
  const toggleSecond = resolveMultiSelectClick({
    clickedId: 's2',
    isCtrlOrCmd: true,
    isShift: false,
    currentSelectedIds: initialSelection.selectedIds,
    currentAnchorId: initialSelection.anchorId,
    currentActiveId: initialSelection.activeId,
    orderedIds: summaries.map((s) => s.id),
  });

  assert.deepEqual(toggleSecond.selectedIds, ['s1', 's2']);
  assert.equal(toggleSecond.activeId, 's1', 'First slide must remain active');
  assert.equal(toggleSecond.anchorId, 's2');
  assert.equal(toggleSecond.requiresDiscardConfirmation, false);
});

test('SPEC-34-01 Source Guard: Initial load selection synchronization effect exists', () => {
  assert.match(
    editorSource,
    /useEffect\(\(\) => \{[\s\S]*?if \(selectedId\) \{[\s\S]*?setSelectedIds\(\(current\) => \{[\s\S]*?setAnchorId\(\(current\) => current \?\? selectedId\);[\s\S]*?\}, \[selectedId, templates\.length\]\);/
  );
});

