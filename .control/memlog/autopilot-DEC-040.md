---
artifact: .control/decisions/DEC-040-autopilot-mandate-canvas-undo-redo-and-line-shapes.md
---

# Autopilot Ledger — DEC-040

## Resume

- Iteration: 1
- Run branch: autopilot/DEC-040
- Stopped at: Done (SPEC-38-01 completed, reviewed, and verified green)
- Blocked: —
- Parked: —
- Next: SPEC-38-02 (Line Element & Outline Shape Creation, Canvas Interaction & Schema Validation)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start autopilot mandate DEC-040 for SPEC-38 | waiting for interactive dispatch | low | .control/decisions/DEC-040-autopilot-mandate-canvas-undo-redo-and-line-shapes.md |
| I-1 (SPEC-38-01) | ArtifactEditor & history | Implement session-scoped undo/redo history stacks with 50-entry cap, baseline transform capture, boundary resets, and disabled toolbar buttons | discarding unsaved work or manual layout reconstruction | medium | src/components/admin/ArtifactEditor.tsx, tests/smoke-spec-38.test.mjs |
| I-1 (peer-review) | ArtifactEditor & tests | Capture text editing baseline on text:editing:entered, lock restoration state synchronously to prevent double-undo race, refine keyboard shortcut guards to canvas focus and canUndo/canRedo, defer slide-boundary clearing until template load succeeds, and implement executable absence guards with defect injection (Terra review) | text edit loss in history, rapid shortcut race, or false absence guard proofs | high | src/components/admin/ArtifactEditor.tsx, tests/smoke-spec-38.test.mjs |
