---
artifact: .control/decisions/DEC-040-autopilot-mandate-canvas-undo-redo-and-line-shapes.md
---

# Autopilot Ledger — DEC-040

## Resume

- Iteration: 2
- Run branch: autopilot/DEC-040
- Stopped at: Done (SPEC-38-02 completed, reviewed, and verified green)
- Blocked: —
- Parked: —
- Next: SPEC-38-03 (PPTX Export & Presentation Parity for Lines and Outlines)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start autopilot mandate DEC-040 for SPEC-38 | waiting for interactive dispatch | low | .control/decisions/DEC-040-autopilot-mandate-canvas-undo-redo-and-line-shapes.md |
| I-1 (SPEC-38-01) | ArtifactEditor & history | Implement session-scoped undo/redo history stacks with 50-entry cap, baseline transform capture, boundary resets, and disabled toolbar buttons | discarding unsaved work or manual layout reconstruction | medium | src/components/admin/ArtifactEditor.tsx, tests/smoke-spec-38.test.mjs |
| I-1 (peer-review) | ArtifactEditor & tests | Capture text editing baseline on text:editing:entered, lock restoration state synchronously to prevent double-undo race, refine keyboard shortcut guards to canvas focus and canUndo/canRedo, defer slide-boundary clearing until template load succeeds, and implement executable absence guards with defect injection (Terra review) | text edit loss in history, rapid shortcut race, or false absence guard proofs | high | src/components/admin/ArtifactEditor.tsx, tests/smoke-spec-38.test.mjs |
| I-2 (SPEC-38-02) | schema & ArtifactEditor | Add line element and outline shapes with strokeColor/strokeWidth schema validation, perPixelTargetFind: false hit testing, and toolbar creation/inspector controls | static image workarounds or unclickable transparent shapes | medium | src/lib/registry/types.ts, src/lib/registry/validate.ts, internal/plan/validate_artifact.go, src/lib/registry/canvas-utils.ts, src/components/admin/ArtifactEditor.tsx, src/components/artifacts/ArtifactSlide.tsx, src/lib/pptx-draw.ts |
| I-2 (peer-review) | ArtifactSlide & Go validation | Render lines via SVG to honor height and diagonal paths on web presenter, preserve wrapLines and measuredWith in Go marshalLayout, and isolate stroke mutations to lines and outline shapes (Terra review) | web projection line distortion, missing text metrics in Go API, or stroke leakage on solid shapes | high | src/components/artifacts/ArtifactSlide.tsx, internal/plan/validate_artifact.go, internal/plan/validate_artifact_test.go, src/components/admin/ArtifactEditor.tsx, tests/smoke-spec-38.test.mjs |
