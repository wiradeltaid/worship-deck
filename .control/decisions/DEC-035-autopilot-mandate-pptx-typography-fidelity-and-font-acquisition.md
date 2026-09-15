---
type: mandate
id: DEC-035
status: accepted
accepted_by: 'kodesh87 (2026-09-15)'
touches:
  - .control/memlog/autopilot-DEC-035.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-33-pptx-typography-fidelity-and-font-acquisition/SPEC.md
  - internal/httpapi
  - internal/pptximport
  - internal/plan
  - src/lib/registry/font-catalog.ts
  - src/lib/registry/canvas-utils.ts
  - src/components/admin/ArtifactEditor.tsx
  - src/components/artifacts/ArtifactSlide.tsx
  - src/lib/fonts/embed-fonts.ts
  - src/lib/pptx-draw.ts
supersedes: null
superseded_by: null
created: '2026-09-15'
---

# DEC-035 — Autopilot mandate for PPTX Typography Fidelity, Font Safety Parity, and Missing Font Acquisition (SPEC-33)

## Decision

> The owner grants an autonomous execution mandate to implement PPTX Typography Fidelity, Font Safety Parity, and Missing Font Acquisition under SPEC-33, covering:
> 1) Decoupled font safety and verified export readiness in `src/lib/registry/font-catalog.ts` and `src/components/admin/ArtifactEditor.tsx`, disambiguating universal system fonts from embeddable TrueType web fonts so curated Google Fonts (Montserrat, Roboto, Inter, etc.) do not falsely warn about Arial fallback while preserving TrueType package embedding in `src/lib/fonts/embed-fonts.ts`;
> 2) Tracking-aware proportional text fitting in `src/lib/registry/canvas-utils.ts` (`applyFabricTextFit()`), ensuring `letterSpacing` scales proportionally (`baseLetterSpacing * scale`) during binary search so large-tracking text (such as `BANDUNG INTERNATIONAL COMMUNITY` with 16.89px tracking) fits onto a single line without premature line wrapping;
> 3) Cross-language typed contract (`fontStatus` in Go and TypeScript validators) and authenticated acquisition route `POST /api/admin/fonts` supporting multipart TTF/OTF uploads, atomic storage under `font_faces`, and dynamic browser hydration via `FontFace`;
> 4) Comprehensive synthetic test suite with executable absence guards, dual code review (coordinator self-review + `kiro-cli` `gpt-5.6-terra` peer review), and public repository cleanliness;
> carrying implementation through G5 Release in the dedicated run branch `autopilot/DEC-035`.

## Why

Importing church presentation decks currently displays misleading Arial fallback warnings for valid embeddable Google Fonts, prematurely wraps letter-spaced single-line text during canvas fitting, and lacks a typed contract and admin acquisition flow for missing proprietary fonts. SPEC-33 closes these gaps with complete visual and lifecycle fidelity.

## Cost

Operational decisions are recorded in the autopilot ledger (`.control/memlog/autopilot-DEC-035.md`).
Architectural invariants (AD-N), Go API process boundaries (AD-30), single-style-per-element schema limits, and public repository cleanliness remain strictly preserved.
