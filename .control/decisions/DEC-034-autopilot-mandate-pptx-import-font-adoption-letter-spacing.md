---
type: mandate
id: DEC-034
status: applied
accepted_by: 'kodesh87 (2026-09-15)'
touches:
  - .control/memlog/autopilot-DEC-034.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-32-pptx-import-font-adoption-and-letter-spacing/SPEC.md
  - internal/pptximport
  - internal/httpapi
  - internal/plan
  - src/lib/registry/font-catalog.ts
  - src/lib/registry/canvas-utils.ts
  - src/components/artifacts/ArtifactSlide.tsx
  - src/components/admin/ArtifactEditor.tsx
  - src/lib/pptx-draw.ts
supersedes: null
superseded_by: null
created: '2026-09-15'
---

# DEC-034 — Autopilot mandate for PPTX Import Typography Parity, Embedded Font Adoption, and Letter Spacing (SPEC-32)

## Decision

> The owner grants an autonomous execution mandate to implement PPTX Import Typography Parity, Embedded Font Adoption, and Letter Spacing under SPEC-32, covering:
> 1) Importer typography normalization in `internal/pptximport` parsing effective run properties, normalizing canonical CSS font families while preserving weight (`fontWeight` 100..900) and style (`fontStyle`), retaining `pptxTypeface` for PPTX fidelity, and converting character tracking `spc` (hundredths of a point) to `letterSpacing` (`spc / 75`);
> 2) Durable embedded font face pipeline resolving safe local `ppt/fonts/*.fntdata` font relationships, validating TTF/OTF/WOFF/WOFF2 containers with DoS bounds (16 MiB per face, 64 MiB total), storing opaque font asset records, serving them through dedicated authenticated font routes with MIME and `nosniff`, hydrating browser `FontFace` in the SPA, and generating local-only font manifests for the isolated Node PPTX worker (AD-30);
> 3) Full-stack letter spacing and typography tracking through DOM, Fabric canvas (`charSpacing = letterSpacing / fontSize * 1000`), ArtifactEditor toolbar (0.5px step input), and deterministic OOXML post-processing setting `a:rPr/@spc = round(letterSpacing * 75)` on mapped runs;
> 4) Comprehensive synthetic test suite with executable absence guards, dual code review (coordinator self-review + `kiro-cli` `gpt-5.6-terra` peer review), and zero external network font calls;
> carrying implementation through G5 Release in the dedicated run branch `autopilot/DEC-034`.

## Why

Importing church presentation decks currently loses custom typography: compound font variant names collapse to fallback fonts, embedded fonts are ignored, and character tracking (`spc`) is dropped. SPEC-32 establishes full typography parity across import, canvas editing, presenter projection, and generated PPTX export.

## Cost

Operational decisions are recorded in the autopilot ledger (`.control/memlog/autopilot-DEC-034.md`).
Architectural invariants (AD-N), Go API process boundaries (AD-30), single-style-per-element schema limits, and public repository cleanliness remain strictly preserved.
