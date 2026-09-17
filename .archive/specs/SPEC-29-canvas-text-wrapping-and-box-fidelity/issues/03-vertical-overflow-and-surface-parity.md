# SPEC-29-03 — Conditional Safe Vertical Overflow & Surface Parity

**Blocked by:** SPEC-29-02

**Status:** closed

## What to build

Preserve the author's top/middle/bottom alignment when effective fitted content fits. When it does not fit—particularly at `MIN_TEXT_FIT_SCALE`—do not center the clipped region around the text block: top-anchor it so the first visible line is whole.

1. In `ArtifactSlide`, detect actual post-fit vertical overflow (`content.scrollHeight > box.clientHeight`, accounting for the line-height compensation already present). Prefer CSS `safe center` when available, with a measured `flex-start` fallback.
2. Keep `toCssJustifyContent`'s normal top/middle/bottom mapping for fitting content. It must not change every middle-aligned template to top alignment.
3. Add a render-model/PPTX decision that chooses `top` only when its estimate reaches the minimum scale and still exceeds box height. Otherwise retain `resolveVerticalAlign(style)`.
4. Keep Canvas's Fabric clip path synchronized with the same final box. The Canvas visual layer is already `ArtifactSlide`; no second overflow policy may be introduced in the interaction layer.

## Acceptance criteria

- A fitting middle-aligned and a fitting bottom-aligned fixture retain their authored vertical placement.
- A forced multiline overflow preserves the complete top of line one in Canvas, Presenter, Projector, and PPTX; later content may clip at the bottom when the readability floor is reached.
- Browser coverage proves the measured-overflow fallback, not merely the existence of a CSS string. A manual PowerPoint/LibreOffice smoke test records the top line as legible.
- The overflow guard is injected with a forced oversized content block and observed failing before the fix is restored.
