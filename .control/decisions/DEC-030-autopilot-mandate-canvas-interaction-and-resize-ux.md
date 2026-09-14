---
type: mandate
id: DEC-030
status: applied
accepted_by: 'kodesh87 (2026-09-14)'
touches:
  - .control/memlog/autopilot-DEC-030.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-28-canvas-interaction-and-resize-ux/SPEC.md
  - src/components/admin/ArtifactEditor.tsx
  - src/lib/registry/canvas-utils.ts
  - tests/smoke-spec-28.test.mjs
supersedes: null
superseded_by: null
created: '2026-09-14'
---

# DEC-030 — Autopilot mandate for Canvas Editor Interaction UX, Text Ghosting Elimination & Bounding-Box Resize Invariants (SPEC-28)

## Decision

> The owner grants an autonomous execution mandate to implement Canvas Editor Interaction UX, Text Ghosting Elimination & Bounding-Box Resize Invariants under SPEC-28 (tickets SPEC-28-01 through SPEC-28-03), covering:
> 1) SPEC-28-01: Enforce the transparent proxy invariant in `canvas-utils.ts` and `ArtifactEditor.tsx`, ensuring Fabric text proxies are 100% transparent and shadowless across all toolbar mutations, selection syncs, duplications, and transformations;
> 2) SPEC-28-02: Split editor overflow behavior from runtime fitting, adding an editor-only non-persisted render mode (authored scale 1, CSS wrap/clip) while keeping production runtime `ArtifactSlide` and `largestFittingTextScale` safety intact;
> 3) SPEC-28-03: Make height constraints and auto-expansion intentional in reference-canvas coordinates, clamping effective height to single-line floor without collapsing user-expanded boxes, and auto-expanding boxes on font-size increase;
> carrying implementation through G5 Release with autonomous code execution, dual review (coordinator self-review + `kiro-cli` `gpt-5.6-terra` peer review),
> and automated smoke testing in the dedicated run branch `autopilot/DEC-030`.

## Why

Hand testing by the product owner on 2026-09-14 revealed visible text ghosting after color/style changes due to Fabric proxies rendering opaque fills over DOM text, and counter-intuitive text box resize behavior where shrinking a box visually downscaled font size via runtime shrink-to-fit instead of clipping/wrapping, while increasing font size failed to expand the box height. Aligning editor authoring interaction with DOM-first invariants while preserving runtime presentation safety eliminates ghosting and restores intuitive canvas authoring.

## Cost

Operational decisions are recorded in the autopilot ledger (`.control/memlog/autopilot-DEC-030.md`).
Architectural invariants (AD-N) and public repo data cleanliness remain strictly preserved.
