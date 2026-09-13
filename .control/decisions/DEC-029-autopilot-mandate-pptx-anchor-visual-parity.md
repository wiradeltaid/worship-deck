---
type: mandate
id: DEC-029
status: accepted
accepted_by: 'kodesh87 (2026-09-13)'
touches:
  - .control/memlog/autopilot-DEC-029.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-27-pptx-anchor-visual-parity/SPEC.md
supersedes: null
superseded_by: null
created: '2026-09-13'
---

# DEC-029 — Autopilot mandate for PPTX as Primary Anchor 1-to-1 Visual Parity (SPEC-27)

## Decision

> The owner grants an autonomous execution mandate to implement PPTX as Primary Anchor 1-to-1 Visual Parity under SPEC-27 (tickets SPEC-27-01 through SPEC-27-04), covering:
> 1) SPEC-27-01: Establish PowerPoint OOXML Line Spacing & Metrics Alignment in `render-model.ts` and `pptx-draw.ts` so `lineSpacingMultiple = style.lineHeight / 1.2` matches CSS, with baseline offset compensation;
> 2) SPEC-27-02: Option A Single Visual Engine for Canvas Editor in `ArtifactEditor.tsx` mounting `<ArtifactSlide>` as visual content layer with transparent Fabric selection overlay and strict 16:9 stage clipping;
> 3) SPEC-27-03: TrueType Font Embedding in Exported PPTX, packaging Google Font `.ttf` files into `ppt/fonts/` with `<p:embeddedFont>` in `presentation.xml`;
> 4) SPEC-27-04: Automated real-PowerPoint conformance verification test (`tests/pptx-conformance.test.mjs`) and smoke test (`tests/smoke-spec-27.test.mjs`);
> carrying implementation through G5 Release with autonomous code execution, dual review (coordinator self-review + Sonnet 5 peer review),
> and automated smoke testing in the dedicated run branch `autopilot/DEC-029`.

## Why

Church operators and designers face cross-surface visual drift across the Canvas Editor, live Presenter, and exported PowerPoint presentations. Treating PowerPoint as the primary visual anchor and aligning web rendering directly to it guarantees 1-to-1 visual and layout parity by construction.

## Cost

Operational decisions are recorded in the autopilot ledger (`.control/memlog/autopilot-DEC-029.md`).
Architectural invariants (AD-N) and public repo data cleanliness remain strictly preserved.
