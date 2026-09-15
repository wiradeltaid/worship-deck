# SPEC-35-02 — Validated Dynamic PPTX Import Scale and 1:1 Modern Typography Ingestion

**Status:** closed
**Blocked by:** SPEC-35-01

## What to build

Update `internal/pptximport/` to derive text font size and character tracking from the imported presentation's validated physical slide height. Modern 540 pt widescreen imports must retain numeric font and tracking values; legacy 405 pt widescreen imports must retain their proportional behaviour.

1. Derive and validate the scale in `parser.go`:
   - Keep the current rejection of missing, zero, or negative `pres.SldSz.CX` and `pres.SldSz.CY`, before division, and retain the 16:9 aspect-ratio check. Missing XML attributes decode as zero and therefore fail deterministically with the existing invalid-slide-dimensions error.
   - Only after validation, calculate once per presentation:
     ```go
     slideHeightPt := float64(pres.SldSz.CY) / 12700.0 // 1 pt = 12,700 EMU
     pxToPt := slideHeightPt / 540.0                   // reference Canvas height
     ```
   - Pass `pxToPt` through `parseSlide` (`smart_background.go`), `extractElementFromNode`, `extractTextStyle`, and `extractTextStyleWithWarnings` to both typography conversion helpers. No text-style path may retain the legacy constant.

2. Replace the hardcoded conversion constant:
   - Remove `const PxToPt = 0.75`.
   - Use `DrawingMLSzToPx(sz int, pxToPt float64)` for `(sz / 100) / pxToPt`, preserving the current default font size when `sz <= 0` and deterministic four-decimal rounding.
   - Use `DrawingMLSpcToPx(spc int, pxToPt float64)` for `(spc / 100) / pxToPt`, preserving zero and negative spacing.
   - The helpers may defensively use `1.0` for a direct caller that supplies a non-finite or non-positive scale. `ParsePresentation` must not reach that fallback for an uploaded PPTX; it rejects invalid dimensions instead.

3. Tests and verification:
   - Update every direct helper and `extractTextStyleWithWarnings` test for the new explicit parameter.
   - Add package fixtures with actual text runs for modern 16:9 (12,192,000 x 6,858,000 EMU) and legacy 16:9 (9,144,000 x 5,143,500 EMU). Assert both `fontSize` and `letterSpacing`: modern `sz="1200"`, `spc="150"` becomes 12 and 1.5; legacy becomes 16 and 2.
   - Add parser cases for `cy=0` and missing `cy`; each must fail before extraction, rather than importing at a default scale.
   - Retain an accepted non-legacy 16:9 height fixture to prove the calculation is dynamic rather than a two-value branch.

## Acceptance criteria

- A modern 16:9 PPTX with 12 pt text and `spc="100"` imports as Canvas `fontSize: 12` and `letterSpacing: 1`.
- A legacy 405 pt 16:9 PPTX with 12 pt text and `spc="150"` imports as 16 Canvas units and 2 tracking units.
- Every extraction call path receives the presentation-derived scale; no `PxToPt = 0.75` conversion remains.
- PPTX packages with missing, zero, or negative slide dimensions are rejected; they never silently import with a 1.0 scale.
- `go test ./internal/pptximport` passes.
