# SPEC-30-02 — Fallback Whole-Token PPTX Run Partitioning

**Status:** open
**Blocked by:** SPEC-30-01

## What to build

In `src/lib/artifacts/render-model.ts`, make `resolveTextRunsForPptx` consume the shared fallback partition from SPEC-30-01 when `wrapLines` is absent or rejected by `validateWrapLines`.

1. Keep a valid SPEC-29 `wrapLines` snapshot as the first choice. Invalid snapshots must remain ignored; never rebuild their fragments into export text.
2. For fallback text, emit one `PptxTextRun` per computed whole-token line. Put `softBreakBefore: true` only between computed lines in the same explicit paragraph.
3. Preserve every authored `\n` as `breakLine: true` at the end of its paragraph. Consecutive newlines create empty paragraphs; they must not collapse into a soft break or disappear.
4. Treat ordinary whitespace as CSS-collapsible for fallback line assembly while retaining token order and attached punctuation. Treat non-breaking spaces as an unbreakable boundary. Do not split URLs, CJK strings without word separators, emoji/grapheme sequences, or any other no-whitespace token.
5. Continue exposing the current run/options shape. Do not add a rich-text or per-span style system; the present model has one style per element.

## Acceptance criteria

- `"Bandung international community"` with no `wrapLines` produces three complete-token runs with two soft breaks in the SPEC-30 reproduction fixture.
- The end-to-end `generatePptxFromPlan` output has one `<a:p>` and two `<a:br/>` elements for that fixture; no run contains a substring fragment such as `internationa` or `l community`.
- Explicit paragraphs, including `"one\n\ntwo"`, produce separate paragraph boundaries and preserve the empty paragraph; soft breaks remain only inside a paragraph.
- Valid snapshots retain their SPEC-29 structure; malformed snapshots and absent metadata use the shared fallback rather than returning one unpartitioned paragraph.
- A floor-exceeding unbroken token remains a single run; this ticket never inserts a character or grapheme break.
- Tests prove the new whole-paragraph passthrough guard red by disabling the production fallback partition, then reverting it.
