---
type: mandate
id: DEC-039
status: applied
accepted_by: 'kodesh87 (2026-09-16)'
touches:
  - .control/memlog/autopilot-DEC-039.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-37-font-availability-parity-and-unacquired-status-reconciliation/SPEC.md
  - src/components/admin/ArtifactEditor.tsx
  - src/operator/present/PresenterOperator.tsx
  - src/projected/ProjectorClient.tsx
  - spa/src/App.tsx
  - src/components/artifacts/ArtifactSlide.tsx
  - src/lib/fonts/embed-fonts.ts
  - src/lib/pptx-draw.ts
  - src/lib/artifacts/render-model.ts
  - src/lib/registry/font-catalog.ts
  - tests/smoke-spec-37.test.mjs
  - package.json
supersedes: null
superseded_by: null
created: '2026-09-16'
---

# DEC-039 — Autopilot mandate for Cross-Surface Font Availability Parity, Multi-Context Hydration, and Unacquired Font Status Reconciliation (SPEC-37)

## Decision

> The owner grants an autonomous execution mandate to implement Cross-Surface Font Availability Parity, Multi-Context Hydration, and Unacquired Font Status Reconciliation under SPEC-37, covering:
> 1) Reconciled Unacquired Font Evaluation & State Synchronization in Artifact Editor (`src/components/admin/ArtifactEditor.tsx`), decoupling toolbar indicator from stale element properties, updating element `fontStatus` on font upload batches and initial load, and preventing false `unresolved` tags during PPTX import;
> 2) Global and Multi-Context Font Hydration across Operator and Projector surfaces (`spa/src/App.tsx`, `src/operator/present/PresenterOperator.tsx`, `src/projected/ProjectorClient.tsx`), with idempotent single-flight font hydration in `src/lib/registry/font-catalog.ts` and responsive canvas refit in `src/components/artifacts/ArtifactSlide.tsx`;
> 3) PPTX Embedding Variant Fallback & Typeface Canonicalization in `src/lib/pptx-draw.ts` and `src/lib/fonts/embed-fonts.ts`, aligning DrawingML text-run typeface names with `<p:embeddedFont>` definitions, implementing fallback to regular face when exact weight/style variant is missing, and enforcing XML schema conformance;
> 4) Dual code review (coordinator self-review + `kiro-cli` `gpt-5.6-terra` peer review), automated smoke tests in `tests/smoke-spec-37.test.mjs` with executable absence guards, and public repository cleanliness;
> carrying implementation through G5 Release in the dedicated run branch `autopilot/DEC-039`.

## Why

During browser and manual validation of SPEC-36, custom fonts failed to render upon reload in Presenter Command Center and permanently fell back in the isolated Projector popup window due to lack of mount-time font hydration. Furthermore, PPTX export omitted fonts when non-regular variants were requested without exact slot matches, and Artifact Editor showed persistent `Unacquired Font` warnings for successfully acquired fonts due to short-circuiting on stale element properties.

## Cost

Operational decisions are recorded in the autopilot ledger (`.control/memlog/autopilot-DEC-039.md`).
Architectural invariants (AD-N), Go API process boundaries (AD-30), schema limits, and public repository cleanliness remain strictly preserved.
