---
type: mandate
id: DEC-033
status: applied
accepted_by: 'kodesh87 (2026-09-15)'
touches:
  - .control/memlog/autopilot-DEC-033.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-31-initial-pptx-import-smart-background/SPEC.md
  - cmd/api
  - internal/httpapi
  - internal/pptximport
  - src/components/admin/ArtifactEditor.tsx
supersedes: null
superseded_by: null
created: '2026-09-15'
---

# DEC-033 — Autopilot mandate for Initial PPTX Import and Smart Background Detection (SPEC-31)

## Decision

> The owner grants an autonomous execution mandate to implement Initial PPTX Import and Smart Background Detection under SPEC-31, covering:
> 1) In-process Go API importer package (`internal/pptximport`) parsing presentation slides, relationships, and DrawingML geometries using Go stdlib `archive/zip` and `encoding/xml`;
> 2) Smart background detection evaluating native slide `p:bg`, layout `p:bg`, and bottom full-covering image shapes (>=95% coverage) to assign `layout.backgroundImage` or `layout.backgroundColor` rather than draggable foreground layers;
> 3) Extracted background media validation and persistence into local upload storage (`/api/uploads/...`) without external network dependencies;
> 4) Authored template synthesis with uniform `baseType: "general"`, `schemaVersion: 1`, and clean text element extraction;
> 5) Admin Artifact Editor / Hub HTTP integration providing seamless PPTX upload and batch import;
> carrying implementation through G5 Release with autonomous code execution, dual review (coordinator self-review + `kiro-cli` `gpt-5.6-terra` peer review),
> and automated smoke testing in the dedicated run branch `autopilot/DEC-033`.

## Why

During church onboarding and initial setup, operators already possess presentation decks containing songs, announcements, and liturgy. SPEC-31 eliminates manual slide-by-slide re-creation by importing slides as general artifact templates while ensuring background art is cleanly separated from editable text.

## Cost

Operational decisions are recorded in the autopilot ledger (`.control/memlog/autopilot-DEC-033.md`).
Architectural invariants (AD-N), Go API process boundaries (AD-30), and public repository cleanliness remain strictly preserved.
