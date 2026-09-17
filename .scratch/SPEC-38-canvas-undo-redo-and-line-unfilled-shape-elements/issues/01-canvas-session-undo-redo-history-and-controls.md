# SPEC-38-01 — Canvas Session Undo / Redo History Stack and Toolbar Controls

**What to build:**
Provide an in-memory session undo and redo history mechanism in `src/components/admin/ArtifactEditor.tsx` that allows operators to revert and re-apply visual layout modifications (moving elements, adding elements, deleting elements, duplicating, layer reordering, background modifications, and updating element properties/content) with disabled-state toolbar buttons and keyboard shortcut support, resetting automatically whenever the active slide changes or when changes are discarded.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Define comprehensive snapshot state in `ArtifactEditor.tsx`:
  ```ts
  type CanvasHistorySnapshot = {
    elements: CanvasElement[];
    addedElements: Map<string, CanvasElement>;
    addedPlaceholders: Map<string, PlaceholderDefinition>;
    backgroundColor: string;
    backgroundImage?: string;
    isDirty: boolean;
  };
  ```
- [ ] Maintain `undoStackRef` and `redoStackRef` storing immutable snapshots (capped at 50 depth).
- [ ] Capture baseline state prior to transform modifications (`mouse:down` on canvas target / `before:transform`) so `object:modified` commits a complete discrete undoable change.
- [ ] Push a snapshot to `undoStack` on discrete user actions:
  - Element added (`insertElement`, `insertDrawnElement`)
  - Element deleted (Del key or context menu `handleDeleteElement`)
  - Element duplicated (`handleDuplicateSelected`)
  - Element geometry/transform committed (`object:modified`)
  - Element properties changed (fill color, font size, stroke width, text alignment, bold/italic/underline, etc.)
  - Text content committed (on blur / exit edit)
  - Layer reordered (`handleReorderLayer`)
  - Slide background changed (`handleChangeBackgroundUrl`, color change)
- [ ] Clear `redoStack` whenever a new user change occurs after an undo.
- [ ] Guard snapshot restoration with `isRestoringHistoryRef`: suppress Fabric canvas mutation listeners (`object:added`, `object:removed`, `object:modified`) during undo/redo restoration to prevent recursive history recording or spurious dirty marks.
- [ ] Reset both `undoStack` and `redoStack` to empty on:
  1. Slide switch in sidebar / template load (`selectedId` change, `loadTemplate`), ensuring zero cross-slide undo leakage.
  2. Discard changes (`handleReset`), preventing resurrection of discarded drafts.
- [ ] Add Undo and Redo buttons to the editor toolbar:
  - Undo button with Lucide `Undo2` icon, disabled when `undoStack.length === 0`.
  - Redo button with Lucide `Redo2` icon, disabled when `redoStack.length === 0`.
- [ ] Add global keyboard shortcuts for `Ctrl+Z` / `Cmd+Z` (undo) and `Ctrl+Y` / `Ctrl+Shift+Z` / `Cmd+Shift+Z` (redo):
  - Guard against execution when focusing `<input>`, `<textarea>`, or when Fabric text object is in editing mode (`getActiveObjects().some(obj => (obj as any).isEditing)`).
- [ ] Add unit tests in `tests/smoke-spec-38.test.mjs` verifying undo/redo stack transitions, button disabled states, reset on slide switch, and reset on `handleReset`.
