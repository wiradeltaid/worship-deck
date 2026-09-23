---
id: DEC-012
status: applied
accepted_by: 'kodesh87 (2026-09-08)'
touches:
  - .scratch/SPEC-12-artifacts-qa-followup/issues/02-canvas-interaction-regressions.md
supersedes: null
superseded_by: DEC-059
created: '2026-09-08'
---

# DEC-012 — The canvas admits one keyboard shortcut, Delete/Backspace on the selected element; OQ-13's pointer-first assumption narrows, it does not fall

**Superseded in part by DEC-059 (2026-09-23):** the "one keyboard exception" claim in this decision's
own text no longer holds — Undo/Redo/Copy/Paste have since shipped in the same handler (DEC-040,
SPEC-38). This decision's Why/Cost below are otherwise unchanged and still describe what was true and
decided on 2026-09-08.

## Decision

> **Pressing Delete or Backspace while a canvas element is selected removes it, calling the same
> `handleDeleteSelected` path the context menu and sidebar button already use.** This is the one
> keyboard exception admitted to the Registry canvas. OQ-13's assumption — "the canvas editor stays
> pointer-first with no keyboard equivalent" — is narrowed to exclude this single shortcut; it is
> not voided, and no other keyboard navigation (arrow-key nudge, Tab between elements, keyboard-
> driven resize) is implied or admitted by this decision.

## Why

Manual QA (`.work/requirements/prompt-04-artifacts-main-spine-qa-followup.md` § CANVAS #1) asked
for keyboard Delete, unprompted by anything in the DEC-008 mandate. `handleDeleteSelected` already
exists and is already reachable by pointer (context menu, sidebar button — see BUG-2 in
`defects.yaml`), so this is a small, low-risk addition: one `keydown` listener calling a function
that is already trusted. OQ-13 (2026-08-19) recorded the opposite assumption at G2 without it being
tested against a real authoring session; this is the planning assumption meeting its first real
manual QA pass, not a reversal of the deliberate v1 accessibility-floor scope decision behind it.

## Cost

- The canvas now has to distinguish "Delete pressed while editing inline text content" (must type
  the character / delete a character of the text, existing Fabric.js `Textbox` editing behaviour)
  from "Delete pressed while an element is selected but not in text-edit mode" (must remove the
  element) — the listener needs a guard against the active object being in edit mode, or a stray
  keystroke while renaming a caption deletes the whole box instead of a character.
- OQ-13 still stands for everything else; a future request for broader keyboard support (arrow-key
  nudge, Tab focus order) needs its own decision rather than reading this one as having opened the
  door generally.

Confirmed by a codebase sweep (2026-09-08, at owner request when accepting this decision): the
Registry canvas (`ArtifactEditor.tsx`) is the only Fabric.js canvas in the app (grepped
`src/`/`spa/src/` for `fabric.Canvas`/`FabricImage`/`fabric.Textbox`) — this decision's scope is
already complete; no other editor needs the same exception.
