# 01: Sandbox multiline regex evaluation parity and song group extraction

**What to build:** In `src/components/admin/FormLayoutAdminPanel.tsx`:
1. Update `runSingleRegexTest` in the "Interactive Regex Testing Sandbox" to achieve production parity with the main parser:
   - Reset `re.lastIndex = 0` to prevent stateful leakage from `g`/`y` flags.
   - When line-by-line testing produces no match, fall back to evaluating `testRundownText.match(re)` across the entire sample text.
   - Support named groups `number` and `book` (used by song set entries) in addition to `value` (used by predefined fields), or numeric capture groups.
   - Display a distinct, readable result when matching across a multiline span, showing the matched text snippet, extracted value/number, and all capture groups.
2. In `handleRunRundownTest` in "Rundown Parsing Test Area (Production-Parity)":
   - When a song set entry is matched via multiline dotall fallback (`!found` -> `testRundownText.match(re)`), pinpoint the line where the hymn number capture occurs, and add only that specific line index to `mappedIndices`.
   - Strictly avoid marking the entire multiline match span as mapped; intermediate lines between section headers and song lines (such as welcome remarks, prayer partners) must remain unmapped unless matched by their own rules.
   - Update pre-mapping loops for song entries and predefined fields so multiline regexes map their target lines accurately without masking unrelated intermediate content.
   - Ensure matched song lines (such as `[  ] Opening song : SDAH #614 Sound the Battle Cry`) are excluded from `unmappedLines`.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `src/components/admin/FormLayoutAdminPanel.tsx` in full.
- [x] In `src/components/admin/FormLayoutAdminPanel.tsx`:
      (1) In `runSingleRegexTest`, reset `re.lastIndex = 0` and add multiline dotall fallback evaluating `testRundownText.match(re)`.
      (2) Extract `val = m.groups?.value || m.groups?.number || (m[1] !== undefined ? m[1] : m[0])`, plus display `m.groups?.book` if present.
      (3) In `handleRunRundownTest`, register multiline song set match target line indices into `mappedIndices`.
      (4) In `handleRunRundownTest`, update pre-mapping loops to pinpoint target lines without masking intermediate content.
- [x] Add unit tests in `tests/dynamic-field-extraction.test.mjs` verifying:
      (1) Single regex evaluation successfully matches multiline dotall patterns, resets `lastIndex`, and extracts song numbers and books.
      (2) Extraction of the user's multi-section Sabbath bulletin fixture excludes matched song lines from `unmappedLines` while preserving truly unmapped lines.
- [x] Verify `npm test` passes without regression.
