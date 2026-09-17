# 02: Canvas interaction regressions — context menu, keyboard delete, Deck Sequence drag reorder

**What to build:** In the Artifact Registry canvas editor, dragging a Deck Sequence card actually
reorders the deck; right-clicking a canvas element actually opens a context menu offering Bring to
Front/Forward, Send Backward/to Back, Duplicate, and Delete; pressing Delete or Backspace with a
canvas element selected removes it.

**Blocked by:** 01

**Status:** done

- [x] Start with `wdi-systematic-debugging` for the drag-reorder and context-menu parts. Both
      already have their handlers implemented in `ArtifactEditor.tsx` (`defects.yaml` BUG-1, BUG-2
      name the exact lines) and one even has a ticket (`W11-03`) marked `done` with this scope — do
      not assume the hypotheses there are the whole story; reproduce live first.
- [x] Dragging a Deck Sequence card to a new position and releasing it actually reorders the deck
      (not just visually — the change persists).
- [x] Right-clicking a selected canvas element opens a context menu with working Bring to
      Front/Forward, Send Backward/to Back, Duplicate, and Delete actions.
- [x] Per `DEC-012` (`status: accepted` 2026-09-08): pressing Delete or Backspace while a canvas
      element is selected (and not mid inline-text-edit) removes that element, calling the existing
      `handleDeleteSelected`.
- [x] The keyboard-Delete listener does not fire while the active object is in inline text-edit
      mode (typing must still edit text, not delete the whole element).
- [x] If reproduction shows drag-reorder or the context menu already working correctly (QA false
      positive), do not mark it fixed silently — state what was actually observed, add the
      regression test anyway, and report the discrepancy.
- [x] Every new absence/regression assertion is seen failing against the current code before the
      fix, then passing after.
