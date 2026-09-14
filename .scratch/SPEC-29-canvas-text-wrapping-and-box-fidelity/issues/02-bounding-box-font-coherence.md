# SPEC-29-02 — Font-Size Commit, Authored Geometry & Fitted Text Coherence

**Blocked by:** SPEC-29-01

**Status:** ready-for-agent

## What to build

Reconcile an explicit font-size edit with the existing SPEC-23/SPEC-26 shared fit policy. The saved box is authored geometry; Fabric's `dynamicMinWidth` is not a user resize and must never be persisted as automatic width growth.

1. On `handleFontSizeCommit`, update the authored font size, calculate the shared effective fit scale for the current box, and synchronize Fabric's final dimensions and clip path with the final authored geometry.
2. The editor may intentionally grow `h` after that user action, but only to the measured content height at the effective scale and never beyond the remaining reference-canvas height. Recalculate the final fit after height adjustment.
3. Record intentional height growth in the existing explicit font-size adjustment path so serialization persists it. A no-edit save and any Fabric-only layout recalculation must preserve original `w` and `h`.
4. Do **not** add `widthChange: 'font-size-auto'`, do not set `w = min(longestWordPx, canvasWidth)`, and do not use Fabric's `dynamicMinWidth` as width authority. That proposal is contradictory for a word wider than the canvas and reintroduces BUG-35 geometry drift.
5. If the minimum effective scale still cannot contain the text, retain the bounded box, clip consistently, and show the author that the layout exceeds the readable limit. Never split or silently omit the word.

## Acceptance criteria

- A narrow 180px fixture uses the same effective fit decision on Canvas and `ArtifactSlide`; save/reload does not create a narrower box, stale clip path, or new missing line.
- An intentional height adjustment is bounded by the canvas and survives serialize/reload; it does not leave empty oversized geometry computed at the unfitted font size.
- `w` remains unchanged after a font-size commit unless the user performed an explicit width resize; Fabric `dynamicMinWidth` alone cannot change it.
- A no-edit save regression test proves authored `w` and `h` are unchanged.
- Browser test coverage checks the Fabric interaction box and `ArtifactSlide` visual box use identical geometry and clipping.
