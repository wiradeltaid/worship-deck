---
type: course-correction
id: DEC-059
status: applied
accepted_by: 'kodesh87 (2026-09-23)'
touches:
  - .control/decisions/DEC-012-canvas-keyboard-delete-exception.md
supersedes: DEC-012
superseded_by: null
created: '2026-09-23'
---

# DEC-059 — The Registry canvas's keyboard surface has grown past Delete/Backspace; DEC-012's "one exception" claim is superseded in part

## Decision

> **DEC-012's claim that "Delete/Backspace is the one keyboard exception admitted to the Registry
> canvas" no longer holds as written.** `ArtifactEditor.tsx`'s canvas `keydown` handler — the same
> function DEC-012's own code comment sits directly above — now also handles Undo (`Ctrl`/`Cmd`+`Z`),
> Redo (`Ctrl`/`Cmd`+`Y` or `Ctrl`/`Cmd`+`Shift`+`Z`), Copy (`Ctrl`/`Cmd`+`C`), and Paste
> (`Ctrl`/`Cmd`+`V`), alongside Delete/Backspace and an Escape-cancels-drawing-tool shortcut
> (SPEC-19-03). Undo/Redo shipped under DEC-040 (SPEC-38); DEC-040 never recorded this as a
> narrowing of DEC-012, and DEC-012 itself was never edited to reflect it — the corpus was carrying
> a factually wrong "exactly one shortcut" claim with nothing accounting for the gap.

## Why

Found by a corpus-vs-code reconciliation pass over `.control/decisions/` (2026-09-23), explicitly
scoped to distinguish decisions that have simply aged (expected, not a defect) from ones that actively
contradict shipped code with nothing already accounting for it. DEC-012's text is read by a future
reader as a hard boundary ("no other keyboard navigation... is implied or admitted by this decision")
and would mislead them into thinking the canvas still has exactly one shortcut, or that adding a
second one requires reopening this exact question — when five more have already shipped, deliberately,
under DEC-040's own mandate.

## Cost

- DEC-012 itself is amended in place with a pointer to this decision (the one edit an `applied` DEC-
  permits) — its original Decision/Why/Cost text is otherwise untouched, since it correctly recorded
  what was true and decided on 2026-09-08.
- This does **not** reopen OQ-13 (pointer-first accessibility floor, arrow-key nudge / Tab focus order
  still out of scope) — Undo/Redo/Copy/Paste are editing-history and clipboard shortcuts, not
  navigation, and DEC-012's distinction between "this decision" and "OQ-13's broader scope" still
  holds for what OQ-13 itself covers.
- No code changes: this decision records what already shipped and is already tested; it does not
  authorize or require anything new.

Confirmed against `src/components/admin/ArtifactEditor.tsx`'s canvas `keydown` handler (the same
function carrying the original `// DEC-012: The canvas admits one keyboard shortcut...` comment):
Undo/Redo/Copy/Paste are implemented in that same handler, shipped under DEC-040 (SPEC-38, 2026-09-17).
