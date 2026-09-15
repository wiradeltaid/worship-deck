# Second Opinion Review Packet: SPEC-36

## Context
- **Target Specification:** `.scratch/SPEC-36-font-import-variant-association-and-pptx-embedding-parity/SPEC.md`
- **Associated Issues:**
  - `.scratch/SPEC-36-font-import-variant-association-and-pptx-embedding-parity/issues/01-font-import-ux-and-reusable-upload-flow.md`
  - `.scratch/SPEC-36-font-import-variant-association-and-pptx-embedding-parity/issues/02-font-variant-association-and-face-registry.md`
  - `.scratch/SPEC-36-font-import-variant-association-and-pptx-embedding-parity/issues/03-ecma-376-pptx-font-obfuscation-and-powerpoint-parity.md`

## Standing Mandate
"If this draft touches the architecture spine, an SRS, an SDD, or a SPEC, you're authorized to run `wdi-review` on it yourself and edit the document directly to apply its stamp — no need to ask first, that permission is already given for this dispatch."
Note: Follow `.claude/skills/bmad-review/SKILL.md` as plain instructions for review methodology (lenses: structure, prose, edge-case-hunter).

## Original Raw Notes (Verbatim from Repo Owner)
```
1. Maunya ada tombol import font, biar bisa berkali2. Lalu bagaimana mengatasi misal Youngest itu punya varian Reguler, Bold, dll?
2. Sepertinya embedded font gak berjalan yah? ketika export - apa bisa di pptx microsoft?
```

## Review Request for Terra
Please review `SPEC-36` and its 3 issue files against the owner's verbatim notes and the existing codebase (`src/lib/fonts/embed-fonts.ts`, `src/lib/registry/font-catalog.ts`, `src/components/admin/ArtifactEditor.tsx`, `internal/httpapi/fonts.go`, `internal/pptximport/font_extract.go`):
1. Assess technical accuracy, completeness, and edge cases regarding:
   - Font import UX and repeatability in ArtifactEditor.
   - Multi-variant grouping (Regular, Bold, Italic) under a single family in both SQLite `font_faces` and browser `document.fonts`.
   - ECMA-376 Part 2 §8.5.2 font obfuscation standard for Microsoft PowerPoint desktop compatibility (GUID key, XOR first 32 bytes, MIME type `application/vnd.openxmlformats-officedocument.obfuscatedFont`, `<p:embeddedFont>` variant slots).
2. Apply `bmad-review` lenses (structure, prose, edge-case-hunter) directly to `.scratch/SPEC-36-font-import-variant-association-and-pptx-embedding-parity/SPEC.md` and update it if needed.
3. Provide your concrete findings and verdict.
