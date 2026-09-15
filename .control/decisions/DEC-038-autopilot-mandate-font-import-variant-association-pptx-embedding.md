---
type: mandate
id: DEC-038
status: applied
accepted_by: 'kodesh87 (2026-09-15)'
touches:
  - .control/memlog/autopilot-DEC-038.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-36-font-import-variant-association-and-pptx-embedding-parity/SPEC.md
  - src/components/admin/ArtifactEditor.tsx
  - src/lib/registry/font-catalog.ts
  - src/lib/fonts/embed-fonts.ts
  - internal/httpapi/fonts.go
  - internal/pptximport/font_extract.go
  - tests/smoke-spec-36.test.mjs
  - package.json
supersedes: null
superseded_by: null
created: '2026-09-15'
---

# DEC-038 — Autopilot mandate for Font Import UX, Variant Association, and PPTX Microsoft OpenXML Embedding Parity (SPEC-36)

## Decision

> The owner grants an autonomous execution mandate to implement Font Import UX, Variant Association, and PPTX Microsoft OpenXML Embedding Parity under SPEC-36, covering:
> 1) An accessible, repeatable "Import Font" action in Artifact Editor (Font Family popover + toolbar) supporting multi-file TTF/OTF upload with per-file feedback and dynamic `custom` category registration;
> 2) Typographic family and variant association (regular, bold, italic, bold italic) across Go backend (`internal/httpapi`), SQLite database constraints `(family, weight, style)`, and browser `document.fonts` `FontFace` instances;
> 3) ECMA-376 Part 2 §8.5.2 font obfuscation (`.odttf` with 16-byte XOR key derived from UUID), `[Content_Types].xml` standard MIME type, and compliant `<p:embeddedFont>` variant slot mapping (`<p:regular>`, `<p:bold>`, `<p:italic>`, `<p:boldItalic>`) in PresentationML;
> 4) Dual code review (coordinator self-review + `kiro-cli` `gpt-5.6-terra` peer review), automated smoke tests in `tests/smoke-spec-36.test.mjs` with executable absence guards, and public repository cleanliness;
> carrying implementation through G5 Release in the dedicated run branch `autopilot/DEC-038`.

## Why

Operators importing custom fonts across multiple weights and styles encountered overwrite conflicts, lack of accessible upload outside missing-font alerts, and PPTX font embedding non-compliance where PowerPoint Desktop failed to recognize embedded raw TTF streams due to missing ECMA-376 obfuscation and missing variant slot relationships.

## Cost

Operational decisions are recorded in the autopilot ledger (`.control/memlog/autopilot-DEC-038.md`).
Architectural invariants (AD-N), Go API process boundaries (AD-30), schema limits, and public repository cleanliness remain strictly preserved.
