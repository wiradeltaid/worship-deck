# Ticket SPEC-17-03 — PPTX Export & Projected Slideshow Font Synchronization with Automated Regressions Suite

**Status:** closed

## Description

Ensure the font family selected in the canvas editor renders accurately in web slideshow views (`ArtifactSlide.tsx`) and is faithfully preserved in exported PowerPoint presentations (`pptx-draw.ts`). Run full automated regression suites and smoke tests.

## Requirements

1. **PowerPoint Export (`src/lib/pptx-draw.ts`)**:
   - Verify `resolveFontFamily(style)` in `render-model.ts` returns the bare font family name (e.g. `'Montserrat'`, `'Roboto'`) and maps cleanly to pptxgenjs `fontFace`.
   - Ensure fallback to canonical `DEFAULT_FONT_FAMILY` if undefined. Note: PowerPoint uses OS-installed fonts. If a non-system font is not installed on the machine opening the PPTX, PowerPoint gracefully falls back to system defaults.

2. **Web Slideshow & Projector Rendering (`src/components/artifacts/ArtifactSlide.tsx`)**:
   - In `ArtifactSlide.tsx`, apply `fontFamily: getFontStack(element.style?.fontFamily)` so browser rendering uses the full CSS fallback chain (e.g. `"Montserrat", sans-serif`).
   - Projector views (`ProjectorClient.tsx`) render via `SlideView` -> `ArtifactSlide.tsx`, inheriting this automatically.

3. **Automated Verification**:
   - Update `tests/artifact-editor-controls.test.mjs` with font family persistence tests.
   - Run full suite: `npm test`, `npm run typecheck`, and automated smoke tests.

## Acceptance Criteria
- Exported PPTX contains the selected font family name in `fontFace`.
- Web presentation slide elements render with `getFontStack()` CSS inline styling.
- All test suites green.
