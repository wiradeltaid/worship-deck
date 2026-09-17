# Ticket SPEC-15-04 — Song Set Entry List Item Edit UX Without Height Expansion (`BUG-29`)

**Status:** done

## Description

In SPEC-14, the redundant top Rename Card was removed from above the Song Set canvas trio, and rename affordances were added inline to the Configured Song Sets list items.
However, when an operator clicks the edit (pencil) icon on an entry, the item's row height inflates from ~48px (the display height for title and `[code]`) to ~86px because it renders two stacked `Input` components (`draftTitle` and `draftVarName`, each `h-8`) plus buttons.
This vertical expansion causes an abrupt layout shift in the sidebar, pushing all subsequent song set items downward.

## Root Cause

`SongSetEntriesPanel.tsx` swaps the display element for an in-place editing block:
```tsx
<div className="flex flex-col gap-1.5">
  <Input value={draftTitle} className="text-xs font-semibold h-8 w-full" ... />
  <div className="flex items-center gap-1.5">
    <Input value={draftVarName} className="text-xs font-mono h-8 flex-1 min-w-0" ... />
    <Button ...><Check .../></Button>
    <Button ...><X .../></Button>
  </div>
</div>
```
Stacked vertically, two inputs + gap + padding expand the list item to ~86px.

## Proposed Solution Options & Recommendation

### Opsi A (Recommended: Top Card Form Mode Switching)
Right above the "Configured Song Sets" list, there is already an input card: "New Song Set" containing Title and Code inputs.
- When an operator clicks the edit icon on any song set item in the list:
  1. The top card dynamically switches mode from "New Song Set" to "Edit Song Set: [Current Title]".
  2. The inputs in the top card are pre-filled with the selected entry's `title` and `variableName`.
  3. The action button changes to "Update" (with a companion "Cancel" button).
  4. The list item below keeps its exact, stable ~48px height, but displays an active editing state badge/ring (e.g. `Editing...` or subtle border highlight).
- *Benefits*: Zero layout shift in the list items. The top form card already has ample space for both inputs. Standard Master-Detail CRUD pattern that feels native and spacious.

### Edge Cases Handled in Implementation (Opsi A)
1. **Switching rows during edit**: If an edit is already active and the operator clicks the edit pencil on a *different* song set row, smoothly switch the edit target to the new entry, updating the top card's prefilled values.
2. **Selecting a row during edit**: Clicking a list row to select/preview its canvas while edit is active should keep the entry selected without causing runtime errors or unexpected state desync.
3. **Preventing parallel creation**: While edit mode is active, the top card functions strictly as an edit form; creation mode is disabled until the edit is saved or canceled.
4. **Canceling edit**: Clicking "Cancel" (or pressing Escape) resets the top card back to "New Song Set" (clearing fields) and removes the editing highlight from the list item.
5. **Conflict & variableName sync**: Retain `handleSaveRename`'s existing 409 conflict handling and ensure `selectedVarName` / `editingVarName` synchronize correctly when `variableName` changes.

### Opsi B (Alternative: Lightweight Popover / Dialog)
- Clicking the edit icon opens a small floating Popover (anchored to the edit button) or a modal Dialog with Title and Code inputs.
- *Benefits*: Zero layout shift in the list.
- *Trade-off*: Introduces an extra overlay layer.

### Opsi C (Alternative: Compact Single-Row In-Place Edit)
- Lock the list item to ~48px. In edit mode, render a single-row form or allow editing the title directly, with an expandable popover for the variable code.
- *Trade-off*: In a ~300px sidebar, two horizontal inputs plus Save/Cancel buttons feel cramped.

## Acceptance Criteria

- Clicking edit on a song set entry does NOT expand or alter the height of list rows in the Configured Song Sets list (remains stable ~48px).
- Both the song set title and variable code (`variableName`) can be edited and saved cleanly.
- If Opsi A is used: the top card smoothly transitions to edit mode and returns to "New Song Set" mode upon save or cancel.
- Switching edit between different rows updates the top form cleanly.
- Canceling edit restores the top card to "New Song Set" with empty inputs.
- Tests in `tests/operator-shadcn-guard.test.mjs` verify stable list item dimensions and correct rename persistence.
