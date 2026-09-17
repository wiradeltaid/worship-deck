# SPEC-33-01 — Font Safety Parity and Verified Export Readiness

**Status:** closed
**Blocked by:** none

## What to build

Decouple universal system fonts from embeddable web fonts and eliminate false PowerPoint export warnings:

1. In `src/lib/registry/font-catalog.ts`, clarify font definitions:
   - Identify `category === 'system'` for universal system fonts that do not require font embedding in PPTX export.
   - Designate `embeddable: true` for fonts with confirmed TrueType export embedding support (all Google Fonts in the catalog and dynamically hydrated fonts).
   - Ensure `src/lib/fonts/embed-fonts.ts` continues to embed non-system fonts into PPTX packages without regression (do NOT bypass embedding for Google Fonts).
2. In `src/components/admin/ArtifactEditor.tsx`:
   - Compute `isExportReady`: true if the font is a universal system font, a catalog font with confirmed embedding support, or locally registered in `font_faces`.
   - Suppress the amber exclamation badge `⚠` and Arial fallback tooltip for all export-ready fonts (including Montserrat, Roboto, Inter, etc.).
   - Reserve the warning badge strictly for genuinely unresolved or unacquired fonts.
3. Add unit and regression tests in `tests/artifact-font-catalog.test.mjs` and `tests/artifact-editor-controls.test.mjs` verifying that export-ready fonts emit no warning icon.

## Acceptance criteria

- Selecting `Montserrat` (or any curated Google Font) in the Artifact Editor toolbar does NOT render an amber `⚠` exclamation mark or claim that Arial substitution will occur.
- Non-system fonts continue to be embedded into PPTX export archives via `embedPresentationFonts()`.
- Genuinely unresolved custom typefaces still display an informative status.
