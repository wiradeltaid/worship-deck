# SPEC-34-01 — File Explorer Multi-Select State, Keyboard, and Reorder Interactions

**Status:** open
**Blocked by:** none

## What to build

Implement checkbox-free File Explorer selection for the visible main-spine Deck Sequence in `src/components/admin/ArtifactEditor.tsx`. Do not change announcement-set list behavior or any `ArtifactEditor` embed with `hideList={true}`.

1. Create a React-free `src/lib/registry/slide-selection.ts` with explicit, ordered-ID contracts:
   - `computeRangeSelection(anchorId: string | null, targetId: string, orderedIds: string[]): string[]` returns the inclusive range in deck order. A target missing from `orderedIds` returns `[]`; a null or stale anchor falls back to `[targetId]`.
   - `resolveMultiSelectClick(params)` accepts clicked ID, Ctrl/Cmd and Shift flags, current selected IDs/anchor/active ID, and ordered IDs. It returns `{ selectedIds, anchorId, activeId, requiresDiscardConfirmation }`; it never calls `window.confirm`, loads a template, or mutates React state.
     - plain click → only clicked ID, clicked anchor/active;
     - Ctrl/Cmd click → toggles one ID; if it removes the active ID, select the first remaining selected ID in deck order (or null) and set `requiresDiscardConfirmation`;
     - Shift → replaces with the anchor-to-target range; Ctrl/Cmd+Shift unions that range. Preserve a valid anchor. If the active ID would be excluded, the target becomes the active candidate and requires a discard confirmation;
     - invalid anchor and invalid active use plain-click fallback.
   - `selectAllSlides(orderedIds)` returns every ID in order.
   - `moveSelectedBlock(params)` moves the selected IDs as one relative-order-preserving block when the dragged ID is selected; dragging an unselected ID moves only it; a drop inside the selected block returns unchanged order.
   - `reconcileSlideSelection(...)` or equivalent central helper prunes stale IDs after an authoritative list refresh and maintains the active-is-selected invariant.

2. In `ArtifactEditor.tsx`:
   - Hold `selectedIds` and `anchorId` beside `selectedId`; route every list-changing path (initial load, create, clone, paste, import, reorder refresh, delete refresh) through one ID-based reconciliation path.
   - Apply the pure click result before changing the canvas only after `mayDiscard(isDirty && isEditable, ...)` accepts every transition that changes/removes the active slide. A declined confirmation makes no selection, anchor, template, or dirty-state change.
   - Make the Deck Sequence list itself focusable and implement its `onKeyDown`:
     - Ctrl/Cmd+A selects all current templates and prevents browser Select All;
     - Escape collapses to the active slide without remounting it;
     - Delete/Backspace delegates to SPEC-34-02 only from the list, never while typing/editing/composing or from a child button.
   - Do not add a global Delete handler for slide selection; preserve the current canvas-element shortcut and its Fabric-text-editing guard.
   - Render no checkbox element or checkbox role. Use `aria-selected` plus the reviewed active/co-selected/unselected classes from SPEC-34.
   - Implement the reviewed DnD block move. Disable DnD and reorder buttons while any reorder/delete operation is in progress. After a reorder response or refresh, preserve selection and anchor by surviving ID and update a dirty active template's concurrency token without remounting it.

3. Tests and proof:
   - Add `tests/slide-selection.test.mjs`, import the pure helper directly, and cover plain click, Ctrl/Cmd toggle, Shift ranges both directions, Ctrl/Cmd+Shift union, null/stale anchor fallback, active removal candidate/confirmation, select all, Escape-collapse helper, selected-block reorder, unselected-row reorder, and no-op drops.
   - Add source guards in `tests/smoke-spec-34.test.mjs` for list focus/key wiring, selected styling, `aria-selected`, and no checkbox markup/role inside the actual Deck Sequence list. The absence guard must be proven by injecting both forbidden forms in `ArtifactEditor.tsx`, observing failure, and reverting them; document that proof beside the test.
   - Add both new test files to the explicit `npm test` command in `package.json`.
   - Manual smoke test: select ranges upward/downward, toggle non-adjacent rows, cancel a dirty active-slide switch, and drag a selected block. Source scans are not a substitute for this browser check.

## Acceptance criteria

- Plain click selects and opens exactly one slide; Ctrl/Cmd click toggles highlighted slides without checkboxes; Shift selects an inclusive ordered range; Ctrl/Cmd+Shift adds that range.
- A stale anchor cannot produce an empty or wrong range: it falls back predictably to the target.
- No selection operation discards a dirty active canvas unless the user accepted the existing discard confirmation.
- Ctrl/Cmd+A and Escape work only with Deck Sequence focus and do not affect browser text selection or canvas-element editing.
- Reordering a multi-selection moves it as one stable block and leaves selection associated with IDs after the server refresh.
