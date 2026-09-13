# 01: PPTX line spacing formula and baseline alignment

**What to build:** Align PPTX text line spacing multiple and vertical baseline positioning with CSS DOM rendering, eliminating the 20% line-pitch expansion in PowerPoint export and preventing ascender clipping when line-height is less than 1.0.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] In `pptx-draw.ts`, normalize `lineSpacingMultiple` as `style.lineHeight / 1.2` so that `<a:spcPct>` in OOXML reflects true em height matching CSS line-height.
- [x] For tight line-height (`lineHeight < 1.0`), compensate first-line baseline half-leading in `ArtifactSlide.tsx` so top ascenders (such as "B" and "d") remain inside the box without clipping.
- [x] Ensure `toPptxGeometry` and existing regression tests in `smoke-spec-22.test.mjs` and `smoke-spec-23.test.mjs` remain green.
