# SPEC-30-01 — Shared Fallback Measurement and Converged PPTX Fit

**Status:** open
**Blocked by:** none

## What to build

In `src/lib/artifacts/render-model.ts`, add one deterministic fallback layout helper for text elements whose stored `longestWordPx` and `measuredWith` are absent or invalid.

1. Resolve text through `resolveElementText(element)` before measurement, so placeholder-substituted content cannot reuse stale authoring metadata.
2. Prefer a valid stored measurement. Otherwise, calculate a finite positive longest-token width using the current font size/style and the existing headless character-advance policy. Browser canvas metrics may refine this when present, but the Node/PPTX path must remain deterministic without a DOM.
3. Partition explicit paragraphs greedily by complete tokens at a supplied scale. Use the same helper for fallback line count and fallback PPTX runs; do not create separate estimates.
4. Resolve scale from both the longest-token width and fitted content height. Re-partition at the resolved scale and repeat with a small documented iteration limit when line count changes; on non-convergence choose the smaller scale. Clamp only through the existing `MIN_TEXT_FIT_SCALE` policy.
5. An indivisible token that cannot fit at the floor remains one token. Preserve SPEC-29 residual-overflow/top-anchor behavior; do not alter authored geometry or insert a character-level break.

## Acceptance criteria

- A non-empty element lacking valid metadata has a finite, positive fallback width; no branch passes `contentWidth: 0` to the fit calculation.
- The synthetic `180px` / `102.15%` reproduction computes scale `< 1` when its fallback longest token exceeds the box, while a comfortable fallback fixture stays at scale `1`.
- Fallback line count and fallback partition agree after final scale resolution, including explicit newlines and blank paragraphs.
- A valid `longestWordPx` plus matching `measuredWith` remains preferred; mismatched style, substituted placeholder text, zero, negative, or non-finite metadata reliably select the fallback.
- A token requiring a scale below `MIN_TEXT_FIT_SCALE` is never split by this helper and produces the existing floor result.
- Tests exercise the production helper and prove red-then-green by temporarily restoring the zero-width fallback defect in the real implementation, then reverting it.
