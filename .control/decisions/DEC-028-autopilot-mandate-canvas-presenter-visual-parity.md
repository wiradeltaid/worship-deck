---
type: mandate
id: DEC-028
status: applied
accepted_by: 'kodesh87 (2026-09-13)'
touches:
  - .control/memlog/autopilot-DEC-028.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .control/registry/defects.yaml
  - .scratch/SPEC-26-canvas-presenter-visual-parity/SPEC.md
  - src/components/admin/ArtifactEditor.tsx
  - src/lib/registry/canvas-utils.ts
  - src/components/artifacts/ArtifactSlide.tsx
  - spa/src/pages/ParityDiagnosticPage.tsx
  - spa/src/App.tsx
  - tests/smoke-spec-26.test.mjs
  - package.json
supersedes: null
superseded_by: null
created: '2026-09-13'
---

# DEC-028 — Autopilot mandate for Canvas vs Presenter Visual & Framing Parity (SPEC-26)

## Decision

> The owner grants an autonomous execution mandate to implement Canvas vs Presenter Visual & Framing Parity under SPEC-26 (tickets SPEC-26-01 through SPEC-26-03), covering:
> 1) SPEC-26-01: Port two-engine parity harness into test tree (`tests/`), importing shipped modules (`ArtifactSlide`, `elementToFabricObject`, `buildTextFabricOptions`) and reporting 5 divergence classes (GEOM, WRAP, FIT, CLIP, OVERRUN) across all 32 shipped canvas templates;
> 2) SPEC-26-02: Close BUG-35 geometry drift on save (save with no edit must be a no-op; serializeCanvas only writes dimensions actively resized by the operator), and reconcile Canvas text engine with ArtifactSlide's box-and-fit contract (shrink-to-fit, overflow clip, font scaling);
> 3) SPEC-26-03: Implement automated parity regression suite (`tests/smoke-spec-26.test.mjs`) with absence-guards verified failing red before passing green;
> carrying implementation through G5 Release with autonomous code execution, dual review (coordinator self-review + Sonnet 5 peer review),
> and automated smoke testing in the dedicated run branch `autopilot/DEC-028`.

## Why

1. **BUG-34 (Disagreement inside stage between Canvas Editor and Presenter/Projector)**:
   Fabric's `Textbox` discards authored height and widens itself to `dynamicMinWidth` without shrink-to-fit, whereas `ArtifactSlide` enforces authored box dimensions, `overflow: hidden`, and container shrink-to-fit. This causes text to render differently, wrap onto different line counts, or clip in Presenter.
2. **BUG-35 (Stored geometry corruption on save without edits)**:
   Because `serializeCanvas` writes Fabric's recomputed measured width back as authored geometry, saving an unedited template widens element boxes (e.g. `sermon` e1.w by +44.3%), permanently corrupting stored template geometry.

## Cost

Operational decisions are recorded in the autopilot ledger (`.control/memlog/autopilot-DEC-028.md`).
Architectural invariants (AD-N) and public repo data cleanliness remain strictly preserved.
