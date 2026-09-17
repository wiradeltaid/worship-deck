# SPEC-34-02 — Bulk Delete, Fresh Tokens, and Active-Canvas Reconciliation

**Status:** open
**Blocked by:** SPEC-34-01

## What to build

Implement one safe deletion lifecycle for Deck Sequence selection. The header action, list Delete/Backspace shortcut, and existing row trash action must delegate to it; do not keep a second per-row confirmation/deletion path.

1. Extend `src/lib/registry/slide-selection.ts` (or a small adjacent React-free helper) with:
   - `resolveNextActiveSlide(actualDeletedIds: string[], currentActiveId: string | null, preDeleteOrderedItems: { id: string }[]): string | null`. It returns the existing active ID when it survived; otherwise it chooses the survivor at the former active index, clamped to the post-delete list, or `null` when no survivor exists.
   - an injected asynchronous bulk-delete runner. It receives the initial ordered summaries and selected IDs, a `delete(id, updatedAt)` callback, and a `list()` callback. It returns actual successes, terminal result, and authoritative survivors. It must consume a fresh `updatedAt` for every request: after a successful delete, use that response's `templates`; when it has none, call `list()` before the next delete. A 409, 404, or other failure stops the batch and refreshes rather than attempting remaining IDs with stale assumptions.

2. In `ArtifactEditor.tsx`, implement `handleDeleteSelectedTemplates`:
   - Snapshot the current selected IDs in deck order and return without a prompt if no selected, live template remains.
   - Ask exactly one i18n-backed confirmation before the first request. For a dirty editable active item in the selection, the same confirmation explicitly warns that unsaved canvas work will be discarded. Deleting only non-active selected items must not call `mayDiscard`, remount the template, reset `isDirty`, clear Fabric selection, or overwrite the active canvas.
   - Set a busy/deleting state that disables the header, row trash controls, DnD, and reordering for the entire batch.
   - Reconcile from the authoritative final list on every outcome. If the active item survived, retain its mounted canvas and dirty state, but update its in-memory `updatedAt` from the summary. If it was actually deleted, select and load the nearest final survivor as defined above; do not clear the current canvas before the server result proves the active ID was deleted. If no item remains, clear selected ID, template, selection IDs, anchor, and dirty state.
   - On a terminal conflict/missing/failure after partial success, preserve only still-live selected IDs, use a truthful i18n-backed partial-result message, and report the actual number deleted. Do not display a success message claiming every selected item was deleted.
   - The normal successful outcome displays a consolidated `{count}` success toast/message exactly once.

3. Add i18n keys and translations to all current UI-locale sources:
   - `admin.artifacts.selectedCount`
   - `admin.artifacts.deleteSelected`
   - `admin.artifacts.deselect`
   - `admin.artifacts.confirmDeleteBulk`
   - `admin.artifacts.confirmDeleteBulkDirty`
   - `admin.artifacts.deletedBulk`
   - `admin.artifacts.deletedBulkPartial`

   Register each in `src/lib/i18n/keys.ts`, `catalogue-en.ts`, and `catalogue-id.ts`, then let `tests/i18n.test.mjs` enforce matching key sets. Do not hard-code English labels in the new UI.

4. Tests and proof:
   - In `tests/slide-selection.test.mjs`, use an injected fake adapter that deliberately replaces every survivor token after each delete. Prove the second and later calls use the refreshed token, not the initial snapshot. Cover 409 and 404 after an earlier success, assert no later deletion is attempted, and assert the final list/active replacement use actual outcomes.
   - In `tests/smoke-spec-34.test.mjs`, source-scan the real `ArtifactEditor.tsx` for one shared delete handler, one confirmation branch before the loop, list-scoped Delete/Backspace guards, i18n keys, and the no-checkbox invariant. Treat these only as wiring guards; no React component is mounted by this repository.
   - Manual smoke test with at least three slides: (a) delete three selected slides and observe one confirmation and one count toast; (b) delete an active middle slide and observe its next/nearest survivor load; (c) dirty an active slide, delete only co-selected siblings, and confirm that its unsaved canvas remains intact; (d) reproduce a 409 or 404 after one server-side deletion and confirm a truthful partial result and refreshed list.

## Acceptance criteria

- Two or more selected slides show a translated count badge, destructive `Delete (N)` action, and Deselect control.
- Header, key, and row-delete paths open no more than one confirmation and share identical concurrency/reconciliation behavior.
- A sequential batch never reuses an `updatedAt` token invalidated by an earlier delete.
- A conflict or missing row stops safely, refreshes the list, and reports actual—not intended—deletions.
- Deleting the active slide loads the nearest remaining slide; deleting only non-active selected slides preserves the active dirty canvas and refreshes its concurrency token.
