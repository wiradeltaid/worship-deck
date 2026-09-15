# SPEC-33-02 — Tracking-Aware Proportional Text Fit and Wrap Parity

**Status:** open
**Blocked by:** SPEC-33-01

## What to build

Ensure letter-spaced text measures accurately and preserves single-line layout without premature line wrapping:

1. In `src/lib/registry/canvas-utils.ts`, inside `applyFabricTextFit()`:
   - Extract `const baseLetterSpacing = typeof element.style?.letterSpacing === 'number' && Number.isFinite(element.style.letterSpacing) ? element.style.letterSpacing : 0;`.
   - Inside `fitsAt(scale: number)`:
     Set `inner.style.letterSpacing = `${baseLetterSpacing * scale}px`` on the temporary measurement element so that glyph size and tracking scale down proportionally.
   - Adjust `tb.fontSize = baseFontSize * bestScale` and ensure Fabric `Textbox` word wrapping width accurately accommodates `charSpacing`.
2. Construct a shared test fixture for `BANDUNG INTERNATIONAL COMMUNITY`:
   - Authored width: `77.044%` (1479.24px on 1920x1080 canvas), font: Montserrat 41.4px, `letterSpacing: 16.8933px`.
   - Assert single-line layout (`textLines.length === 1`) in Fabric canvas and DOM `ArtifactSlide.tsx` without wrapping `COMMUNITY` to line 2.
3. Verify PPTX export preserves single-line wrap and exact `spc` round-trip.

## Acceptance criteria

- An imported slide element with content `BANDUNG INTERNATIONAL COMMUNITY` and `letterSpacing: 16.89px` renders on a single line across the slide at full width, exactly matching the PowerPoint layout in Finding 1 without wrapping `COMMUNITY` onto line 2.
- Automated tests verify that `applyFabricTextFit` scales `letterSpacing` proportionally during `fitsAt(scale)`.
