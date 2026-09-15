# SPEC-34 — Deck Sequence Multi-Select and Bulk Delete

> **Status:** Open — drafted for G5 Release under UC-15 / FR-21.
> **Review:** APPROVED WITH EDITS — 2026-09-15; code baseline `0de22925e8e62c7ccf25b7ac3f451361a38eeb62`; lenses: structure, prose, edge-case-hunter. No registry `spec_reviewed` trace is written yet because this draft is untracked and therefore has no commit SHA to trace.
> **Component:** registry (`src/components/admin/ArtifactEditor.tsx`, `src/lib/registry/slide-selection.ts`)
> **Touches:** artifacts, admin, registry
> **Depends on:** SPEC-33

## 1. Problem statement

The **Deck Sequence** sidebar in `src/components/admin/ArtifactEditor.tsx` currently allows only one active canvas slide (`selectedId === item.id`). Administrators importing a large presentation therefore delete obsolete slides one at a time, each with a separate confirmation.

The owner requested an intuitive, checkbox-free selection and bulk-delete experience:
> *"bisa buatkan sorot banyak slide lalu bisa delete? kayak clickable item (tanpa checkbox), kayak lagi milih file di file explorer"*

This SPEC applies only to the visible main-spine **Deck Sequence** in `ArtifactEditor`; it does not change the announcement-set panel's separate slide list or any `hideList` embed. It must provide File Explorer-style selection—plain click, Ctrl/Cmd click, Shift click, Ctrl/Cmd+A, Escape, Delete/Backspace—plus safe bulk deletion and existing single-row deletion through one lifecycle.

## 2. Decisions and invariants

### 2.1 File Explorer selection model

- `selectedIds: Set<string>` contains every highlighted Deck Sequence item.
- `anchorId: string | null` is the stable start of the next Shift range.
- `selectedId: string | null` is the primary slide loaded in the Fabric canvas.
- Every reconciliation after list load, create, clone, paste, import, reorder, or delete prunes IDs absent from the authoritative list. If `selectedIds` is non-empty, `selectedId` is a member of it. A list with no remaining item has all three values empty/null.
- The UI keeps selection in IDs, never indices, because reordering and server refreshes change indices.

Pointer semantics are exactly these:

1. **Plain click:** after confirming any required dirty-canvas discard, select only the clicked item, set it active, and make it the anchor.
2. **Ctrl/Cmd click:** toggle the clicked item. Adding a non-active item preserves the active canvas and dirty state. Removing the active item chooses the first remaining selected item in current deck order; this is an active-slide change and must receive the same dirty-discard confirmation before any state changes. Removing the final item clears the active slide and template only after that confirmation.
3. **Shift click:** calculate the inclusive range from a valid `anchorId`; if it is stale/missing, use a valid active ID; if neither exists in the current list, behave as a plain click on the target and set that target as the anchor. Plain Shift replaces the selection; Ctrl/Cmd+Shift unions the range. Preserve a valid original anchor for subsequent range expansion. If the resulting selection excludes the active slide, make the clicked target active only after the dirty-discard guard succeeds. A declined guard is atomic: selection, anchor, canvas, and dirty state remain unchanged.
4. **Ctrl/Cmd+A:** only while the Deck Sequence list itself has focus, prevent the browser Select All and select every current item. Keep the current active slide if it remains selected; otherwise use the first deck item. It never changes the canvas merely because every item was selected.
5. **Escape:** only while the list has focus, collapse selection to the active slide; if no active slide exists, clear selection and anchor. It does not discard or reload a canvas.

The list is a focusable keyboard control (`tabIndex={0}` or equivalent) with an accessible item state such as `aria-selected`; it contains **no checkbox input or checkbox role**. Active and co-selected items have visibly distinct styling:

- active canvas slide: `border-primary bg-primary/20 ring-1 ring-primary/40 font-semibold text-foreground`;
- co-selected slide: `border-primary/60 bg-primary/10 ring-1 ring-primary/20 text-foreground`;
- unselected slide: `border-border/60 bg-muted/30 hover:bg-muted/70 hover:border-border`.

### 2.2 Reordering a multi-selection

Dragging a selected row moves the complete current selection as one contiguous block, retaining its original relative order. Dragging an unselected row moves only that row and does not silently alter selection. Dropping within the selected block is a no-op. The final order is submitted once through the existing complete-list `adapter.reorder` contract.

While an order request is in flight, bulk delete, DnD, move buttons, and individual delete controls are disabled. On reorder success or conflict refresh, keep `selectedIds` and `anchorId` by surviving IDs and advance the active template's `updatedAt` token without remounting its dirty canvas. This prevents a reorder from clearing selection or making the next Save stale.

### 2.3 Header controls and keyboard scope

When more than one slide is selected, the Deck Sequence header shows an i18n-backed `{count} selected` badge, a destructive `Delete ({count})` action, and a `Deselect` action. Deselect uses the Escape behavior.

`Delete` and `Backspace` invoke deletion only when the focused element is in the Deck Sequence list, the event has no Ctrl/Cmd/Alt modifier, no operation is busy, and the event is not already prevented or composing. They must never trigger from `input`, `textarea`, `select`, `[contenteditable]`, a button, a font-size field, or a Fabric textbox in editing mode. The existing canvas-element Delete/Backspace shortcut remains scoped to the canvas and must not be captured by the list handler.

All new visible strings—including plural confirmation, count badge, success, partial failure, and Deselect—must be registered in `src/lib/i18n/keys.ts`, `catalogue-en.ts`, and `catalogue-id.ts`; no literal English label is introduced in this feature.

### 2.4 Bulk deletion, concurrency, and canvas reconciliation

One shared `handleDeleteSelectedTemplates` owns header, keyboard, and per-row delete requests. It snapshots the selected IDs in current deck order, validates that at least one still exists, and opens exactly **one** confirmation before any request. If the active selected slide is editable and dirty, that one confirmation explicitly says its unsaved canvas changes will be discarded. Deleting only non-active selected slides does not ask to discard, remount, clear, or otherwise alter the dirty active canvas.

Deletion is sequential because the existing API deletes one template at a time. Every successful delete can bump every survivor's `updatedAt`; consequently the next request **must use fresh tokens** from `res.templates`, or call `adapter.list()` before the next request when a successful adapter response does not return a list. It must never reuse the initial token snapshot after a successful deletion.

- A `409` or `404` is terminal for the batch: stop rather than guessing which stale item to delete next, reload the authoritative list, reconcile selection by IDs, and report the number actually deleted plus the conflict/missing outcome. Other request failures follow the same stop-and-refresh rule.
- A completed batch reloads/reconciles from the authoritative survivor list, not from optimistic local filtering. The success toast reports the actual deleted count.
- If the active slide survived, keep its mounted canvas and dirty state. Its in-memory `updatedAt` is advanced from the new summary so a later Save is not rejected solely because siblings were deleted.
- If the active slide was actually deleted, compute the replacement from the pre-delete deck order and the IDs actually deleted: use the survivor at the deleted active slide's former index, clamped to the final list; then load that template. Do not clear/reload the active canvas until the server outcome shows that its ID was deleted. If no slide remains, set `selectedId` and `template` to `null` and clear dirty state.
- If a partial batch deleted the active item, the same nearest-survivor rule applies. If it did not, preserve the active dirty canvas even though selected sibling deletions may have succeeded.

### 2.5 Testable pure helpers and regression safety

`src/lib/registry/slide-selection.ts` is a pure, React-free module. It defines and tests:

- `computeRangeSelection(anchorId: string | null, targetId: string, orderedIds: string[]): string[]`, including absent anchor/target behavior;
- `resolveMultiSelectClick(...)`, which returns selection, anchor, active candidate, and whether the caller must request a dirty-discard confirmation without invoking browser APIs;
- `selectAllSlides(orderedIds: string[]): string[]`;
- `moveSelectedBlock(...)` for the DnD semantics above;
- `resolveNextActiveSlide(actualDeletedIds, previousActiveId, preDeleteOrderedItems)`;
- a pure injected bulk-deletion runner or equivalent that refreshes concurrency tokens between calls and returns attempted/deleted/conflict outcomes.

Tests must prove plain/Ctrl/Cmd/Shift/Ctrl+Shift selection, stale anchor fallback, active-removal dirty-guard request, range directions, select-all, Escape collapse, multi-block reorder, nearest active replacement, token refresh after each delete, one terminal conflict/404 reload, and dirty active-slide preservation when only co-selected slides are removed. React is not mounted in this repository: UI assertions are source guards and must be described honestly as such. Add both new test files to `package.json`'s explicit `test` script.

The checkbox absence guard scans the real `ArtifactEditor.tsx` Deck Sequence markup. Per repository policy, prove it first fails by temporarily injecting both `<input type="checkbox">` and a checkbox role into that real list, then revert the injected defects and record the proof in the test comments. A source scan cannot prove runtime reachability, so manual smoke testing is a release deliverable: verify a dirty active slide, range selection, Ctrl/Cmd selection, a block drag, keyboard deletion, and a 409/404 response in a browser.

## 3. Tickets

- **SPEC-34-01:** Pure selection/reorder engine plus File Explorer pointer and list-scoped keyboard interactions.
- **SPEC-34-02:** One-confirmation bulk deletion, fresh optimistic-lock tokens, active-canvas reconciliation, i18n, and executable/source/manual proof.
