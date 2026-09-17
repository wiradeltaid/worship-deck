---
type: mandate
id: DEC-040
status: accepted
accepted_by: 'kodesh87 (2026-09-17)'
touches:
  - .control/memlog/autopilot-DEC-040.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-38-canvas-undo-redo-and-line-unfilled-shape-elements/SPEC.md
  - src/components/admin/ArtifactEditor.tsx
  - src/components/artifacts/ArtifactSlide.tsx
  - src/lib/registry/types.ts
  - src/lib/registry/validate.ts
  - src/lib/pptx-draw.ts
  - internal/plan/types.go
  - internal/plan/validate_artifact.go
  - tests/smoke-spec-38.test.mjs
  - package.json
supersedes: null
superseded_by: null
created: '2026-09-17'
---

# DEC-040 — Autopilot mandate for Canvas Undo/Redo and Line & Outline Shape Elements (SPEC-38)

## Decision

> The owner grants an autonomous execution mandate to implement Canvas Session Undo / Redo History and Line & Unfilled Shape Elements under SPEC-38, covering:
> 1) Session-Scoped Undo and Redo History Stack in `ArtifactEditor.tsx` with full snapshot state capture (elements, background, active slide, canvas dimensions), boundary isolation across slides and discard-changes resets, and restoration guarding against listener loops;
> 2) Line and Unfilled (Outline) Shape Elements in `ArtifactEditor.tsx`, `src/lib/registry/types.ts`, `src/lib/registry/validate.ts`, `internal/plan/types.go`, and `internal/plan/validate_artifact.go`, supporting creation tools, property panel controls, context menu integration, and schema validation;
> 3) Multi-Surface Visual Parity and PPTX Native Vector Line/Outline Export across web slide projection (`src/components/artifacts/ArtifactSlide.tsx`) and PowerPoint generation (`src/lib/pptx-draw.ts`) with accurate line point thickness ($strokeWidth \times 0.75\text{ pt}$) and opacity transparency;
> 4) Dual code review (coordinator self-review + `kiro-cli` `gpt-5.6-terra` peer review), automated smoke tests in `tests/smoke-spec-38.test.mjs` with executable absence guards, and public repository cleanliness;
> carrying implementation through G5 Release in the dedicated run branch `autopilot/DEC-040`.

## Why

Operators designing templates in Artifact Editor currently lack undo/redo recovery for accidental layout changes or deletions, requiring manual reconstruction or complete discard of unsaved work. Furthermore, the slide canvas lacks primitive line dividers and unfilled/outline shape elements, forcing operators to rely on static image assets that cannot be styled or resized dynamically.

## Cost if wrong

Low: Session history is transient in-memory state; line and outline shapes adhere strictly to existing artifact validation schemas, coordinate mappings, and PPTX DrawingML specifications without modifying database schemas or breaking existing templates.
