# SPEC-35-01 — PPTX Modern Widescreen Dimensions, Exact Export Constants, and Percentage Geometry

**Status:** closed
**Blocked by:** none

## What to build

Align PPTX export in `src/lib/artifacts/render-model.ts` and `src/lib/pptx-draw.ts` with the modern 16:9 PowerPoint layout (960 pt x 540 pt / 12,192,000 EMU x 6,858,000 EMU). This changes the internal Canvas-unit-to-PowerPoint-point conversion to `PX_TO_PT = 1.0` while preserving every template's percentage geometry.

1. In `src/lib/artifacts/render-model.ts`:
   - Set `PPTX_SLIDE_WIDTH_IN = 960 / 72`; do not use the rounded `13.3333` literal.
   - Set `PPTX_SLIDE_HEIGHT_IN = 540 / 72` (7.5), `PPTX_SLIDE_HEIGHT_PT = 540`, and derive `PX_TO_PT = PPTX_SLIDE_HEIGHT_PT / REFERENCE_CANVAS.height`.
   - Keep `toPptxGeometry()` percentage conversion and its deterministic rounding unchanged. Font 12 must produce base geometry `fontSize: 12`.
   - Do not clamp negative or >100% geometry. Existing off-canvas clipping is intentional.

2. In `src/lib/pptx-draw.ts`:
   - Set `pres.layout = 'LAYOUT_WIDE'` and retain the shared dimensions in `FULL_BLEED`.
   - Do not alter `REFERENCE_CANVAS`, Canvas Editor dimensions, `ArtifactSlide` `cqh` sizing, registry template data, or the existing post-base-conversion text-fit scale.
   - Document in an inline reason comment only if one is needed: this is numeric application-contract parity, not a cross-renderer physical-glyph equivalence claim.

3. Tests and verification:
   - Update `tests/artifact-render-model.test.mjs` to assert `PPTX_SLIDE_WIDTH_IN === 960 / 72`, `PPTX_SLIDE_HEIGHT_IN === 7.5`, and `PX_TO_PT === 1`.
   - Verify 0%, 50%, 100%, and intentional off-canvas positions and dimensions continue to map proportionally to the new shared constants.
   - Verify font 12 and 24 map to base geometry 12 and 24 respectively. The actual generated-run assertion belongs to a sufficiently large unshrunk text box, because existing text-fit policy may intentionally reduce a constrained run.
   - Verify a generated archive contains `p:sldSz cx="12192000" cy="6858000"`; do not infer that from constants alone.

## Acceptance criteria

- Exported PPTX uses `LAYOUT_WIDE` and declares 12,192,000 x 6,858,000 EMU (960 pt x 540 pt / 33.867 cm x 19.05 cm).
- `toPptxGeometry()` maps Canvas font 12 and 24 to 12 pt and 24 pt base geometry.
- A sufficiently large, unshrunk exported text run retains its authored 12 pt or 24 pt value.
- Existing template boxes, including off-canvas boxes, retain their relative 16:9 placement; no registry migration is made.
- Slide aspect ratio remains strictly 16:9.
