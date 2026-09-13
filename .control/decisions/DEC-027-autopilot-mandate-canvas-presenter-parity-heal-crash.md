---
type: mandate
id: DEC-027
status: accepted
accepted_by: 'kodesh87 (2026-09-13)'
touches:
  - .control/memlog/autopilot-DEC-027.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .control/registry/defects.yaml
  - .scratch/SPEC-25-canvas-presenter-parity-and-heal-crash/SPEC.md
  - src/components/admin/ArtifactEditor.tsx
  - src/lib/registry/canvas-utils.ts
  - src/components/artifacts/ArtifactSlide.tsx
  - tests/smoke-spec-25.test.mjs
  - package.json
  - internal/httpapi/background_library_test.go
supersedes: null
superseded_by: null
created: '2026-09-13'
---

# DEC-027 — Autopilot mandate for Canvas/Presenter Parity Gap & Heal-Crash (SPEC-25)

## Decision

> The owner grants an autonomous execution mandate to implement Canvas/Presenter Parity Gap & Heal-Crash under SPEC-25 (tickets SPEC-25-01 through SPEC-25-03), covering:
> 1) BUG-33 fix: `healTemplate()` adds every element kind as genuine Fabric instance carrying full style options by extracting `elementToFabricObject()` into a shared function between `ArtifactEditor.tsx` and `canvas-utils.ts`, preventing both crash and style data corruption,
> 2) SPEC-25-02 regression tests: adding `tests/smoke-spec-25.test.mjs` using `fabric/node` with `StaticCanvas` for shape/image add paths and plain function assertions for text style fidelity, verifying both absence-guard proofs,
> 3) SPEC-25-03 investigation & fix: investigating BUG-34 stage framing crop disparity in `ArtifactSlide.tsx` through `wdi-systematic-debugging` and establishing 16:9 unclipped stage assertion in real-browser harness,
> carrying implementation through G5 Release with autonomous code execution, dual review (self-review + Sonnet 5 peer review),
> and automated smoke testing in the dedicated run branch `autopilot/DEC-027`.

## Why

1. **"Re-measure all" Batch Heal Crash & Corruption (BUG-33, SPEC-25-01, SPEC-25-02)**:
   In `canvas-utils.ts:884`, shape and image elements are added via bare object literals `{ ...common, type: element.type }` lacking `_set()`, causing `t._set is not a function` runtime crashes when combined with unmeasured text elements. Furthermore, naive object addition strips style fields (`fillColor`, `textAlign`, `lineHeight`, etc.), corrupting template styling on save.
2. **Presenter/Canvas Viewport Cropping Disparity (BUG-34, SPEC-25-03)**:
   Presenter output clips slide content and edges compared to Canvas editor due to stage wrapper CSS sizing differences, breaking the invariant that the stage is letterboxed inside its parent.

## Cost

Operational decisions are recorded in the autopilot ledger (`.control/memlog/autopilot-DEC-027.md`).
Architectural invariants (AD-N) and public repo data cleanliness remain strictly preserved.
