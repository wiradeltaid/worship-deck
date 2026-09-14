# SPEC-29-01 — Trusted Whole-Word Wrap Snapshots

**Status:** ready-for-agent

## What to build

Fabric `Textbox.textLines` is an untrusted layout observation, not an export contract. Add one pure exported helper that validates a candidate `wrapLines` array against the element's source text, preserving explicit paragraph boundaries. Use it at every boundary:

1. `serializeCanvas` persists a candidate only when the helper accepts it; otherwise it removes `wrapLines`.
2. `resolveTextRunsForPptx`, `resolveElementTextForPptx`, and `resolveWrapLineCount` consume a snapshot only when the same helper accepts it; otherwise they fall back to source text and measured fit.
3. The helper recognizes whole whitespace-delimited source tokens. It rejects character fragments (`Band` / `ung` for `Bandung`), reordered words, missing words, duplicate words, and soft lines crossing an explicit source newline.
4. Explicit source newlines, including empty paragraphs, remain paragraphs in PPTX. Trusted soft wraps become soft breaks only within their source paragraph.

Do not rewrap malformed data in a server-side approximation. The renderer has no authoritative shaping engine; omission plus SPEC-23's `longestWordPx`/fit policy is safer than inventing a new line layout.

## Acceptance criteria

- `['Band', 'ung']` for `Bandung` is rejected in serializer, line-count, and PPTX resolver tests.
- Valid lines such as `['Bandung', 'International Community']` are accepted only when their complete token sequence exactly partitions the matching source paragraph.
- Repeated whitespace, punctuation, explicit newlines, and consecutive blank paragraphs have tests.
- A legacy/malicious persisted malformed array is ignored without throwing and cannot result in a PPTX soft break inside an original token.
- Test the actual serializer with a Fabric mock whose `textLines` contains each rejection form; prove every guard red by temporarily bypassing the helper, then revert.
