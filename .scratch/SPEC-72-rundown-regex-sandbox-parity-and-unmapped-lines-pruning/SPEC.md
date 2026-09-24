# SPEC-72 — Rundown Regex Sandbox Parity and Unmapped Lines Pruning

## Problem Statement

Following SPEC-71 (Section-Scoped Multiline Song Set Regex Extraction), the core parser in Go and TypeScript supports section-scoped multiline dotall patterns (`(?is)`). However, hands-on administrative testing on real Sabbath bulletins revealed critical parity and diagnostic defects across the sandbox test harness and intake parser:

1. **Interactive Regex Testing Sandbox Line-by-Line Limitation (`runSingleRegexTest`):**
   In `src/components/admin/FormLayoutAdminPanel.tsx`, the single regex evaluator ("Interactive Regex Testing Sandbox") still iterates test text line-by-line (`for (const line of lines)`). When an administrator tests a section-scoped multiline pattern such as `(?is)BIBLE\s+TALK.*?Opening\s+[Ss]ong\s*[:\-]\s*(?:(?<book>[A-Za-z]+)\s*)?#?\s*(?<number>\d+)`, the evaluator tests each line in isolation and erroneously reports:
   ```text
   No match found across any line in sample text.
   ```
   Furthermore, `runSingleRegexTest` exclusively inspects named group `m.groups?.value`, completely ignoring `m.groups?.number` and `m.groups?.book` used by song set entries. Administrators cannot validate multiline regexes before saving them to slot definitions.

2. **Sandbox Mapped Lines Incompleteness (`handleRunRundownTest`):**
   In `FormLayoutAdminPanel.tsx:handleRunRundownTest`, when a song set entry is matched via multiline dotall fallback (`!found` -> `testRundownText.match(re)`), the matched line is never registered into `mappedIndices`. As a consequence, even when the song is successfully extracted into the results table, the bulletin line (e.g. `[  ] Opening song : SDAH #614 Sound the Battle Cry`) remains displayed under `Baris Teks Tidak Terpetakan (Unmapped Lines)`. Additionally, the initial loop that pre-populates `mappedIndices` (lines 558–572) only performs single-line `re.test(line)`, ignoring multiline patterns.

3. **Backend and Client Unmapped Lines Stagnation & Non-Breaking Space Fragility:**
   In `internal/parse/parser.go:ParseRundownWithProfile`, `parsed.UnmappedLines` is accumulated in the initial lexical pass before dynamic predefined field extraction (`extractDynamicFieldSuggestions`) and song set regex extraction (`extractDynamicSongSetSuggestions`) are executed. If a bulletin line is captured exclusively by a dynamic predefined field or a multiline song set regex, the line is never pruned from `UnmappedLines`. Consequently, during service preview (`POST /api/services/preview`), creation (`POST /api/services`), and editing (`PUT /api/services/{id}`), operators are presented with an alarming amber warning box `⚠️ Baris Teks Tidak Terpetakan (Unmapped Lines)` containing lines that were in fact successfully parsed and extracted. In addition, bulletins copied from WhatsApp, Word, or Google Docs often contain non-breaking spaces (` `), which causes strict ASCII whitespace matchers to fail if not normalized uniformly across both line and full-text fallback paths.

## Solution

1. **Full Production Parity for Single Regex Evaluator (`FormLayoutAdminPanel.tsx:runSingleRegexTest`):**
   - Reset regex state (`re.lastIndex = 0`) before evaluation to prevent stateful leakage from `g`/`y` flags.
   - If line-by-line matching yields no match, evaluate `testRundownText.match(re)` across the uniformly normalized full sample text.
   - Support extracting named groups `value`, `number`, and `book` (or numeric capture group $1), displaying extracted hymn number, book code, and matched text span.
   - Distinguish whether a match was located on a single line or across a multiline span.

2. **Accurate Mapped Line Registration in Sandbox (`FormLayoutAdminPanel.tsx:handleRunRundownTest`):**
   - Implement source-range line mapping: For multiline song matches, locate the specific line where the extracted hymn number capture occurred (using capture group offsets or matching the hymn number token within the matched text span), and register that specific line in `mappedIndices`.
   - In the initial loop that pre-populates `mappedIndices`, evaluate patterns against normalized full text and map only the terminal song line, strictly avoiding masking intermediate unrelated lines between section headers and the song target.
   - Ensure lines matching active song set entries and predefined fields never bleed into `unmappedLines`.

3. **Backend and Client `UnmappedLines` Dynamic Reconciliation & Uniform Whitespace Normalization:**
   - In Go (`internal/parse/parser.go`):
     - Normalize non-breaking spaces (` ` -> ` `) and CRLF in `normalized` text, and use this single normalized string consistently for line splitting, line matching, full-text fallback, and line offset mapping, while keeping persisted `raw_payload` verbatim.
     - After dynamic field suggestions (`extractDynamicFieldSuggestions`) and dynamic song set suggestions (`extractDynamicSongSetSuggestions`) are computed, reconcile `parsed.UnmappedLines`: prune lines that were captured by active predefined field regexes or dynamic song set entry regexes.
     - Ensure `POST /api/services/preview`, `POST /api/services`, and `PUT /api/services/{id}` return clean `unmappedLines` without false-positive song/field lines.
   - In TypeScript (`src/lib/parser-rules.ts` & `FormLayoutAdminPanel.tsx`):
     - Normalize ` ` in `normalizeNewlines`.
     - Provide a helper function `reconcileDynamicUnmappedLines(rawLines, fieldSuggestions, songSetSuggestions, ...)` for TypeScript client and admin UI consumption, keeping the static parser `parseRundownWithProfile` pure while ensuring complete reconciliation parity in the UI.

4. **Executable Absence Guards and Regression Matrix:**
   - Add unit and integration tests asserting:
     - `runSingleRegexTest` matches multiline dotall patterns and extracts song numbers and book codes.
     - Real-world Sabbath bulletin with Bible Talk and Divine Service songs leaves zero matched song lines in `unmappedLines`.
     - Non-breaking space ` ` in bulletin headers and bracketed lines does not prevent extraction or prefix stripping.
     - Intermediate lines between section headers and songs (e.g. Prayer Partners, Welcome Remarks) remain unmapped unless matched by their own rules.

## User Stories

1. As an administrator testing regexes in `/admin/layout`, I want the Interactive Regex Testing Sandbox to evaluate multiline dotall patterns against the full sample text, so that I can immediately verify section-scoped patterns and inspect extracted song numbers before saving them to slot configurations.
2. As an administrator reviewing Rundown Parsing Test Area results, I want lines that were successfully matched by song set regexes to be excluded from Unmapped Lines, so that I only see truly unrecognized bulletin content.
3. As a service coordinator parsing a church bulletin in `/services/new`, I want lines captured by dynamic fields and songs to be cleanly pruned from the unmapped lines warning banner, avoiding false-positive parsing alarms.

## Implementation Decisions

- **Single Regex Evaluator Parity (`FormLayoutAdminPanel.tsx`):**
  - Reset `re.lastIndex = 0`.
  - First attempt line-by-line matching for fast local line feedback.
  - If no line matches, attempt `testRundownText.match(re)` on normalized text.
  - Extract `val = m.groups?.value || m.groups?.number || (m[1] !== undefined ? m[1] : m[0])`.
  - Format output clearly showing match type (line vs multiline span), extracted value, book code, and named groups.

- **Dynamic Mapped Lines Calculation & Target Line Pinpointing:**
  - For single-line matches: register the exact line index `mappedIndices.add(idx)`.
  - For multiline song matches: locate the line containing the extracted song number inside the match span, and mark only that line as mapped. Intermediate lines between the section header and the song (such as welcome remarks or prayer partners) must NOT be masked and must remain in `unmappedLines` unless matched by their own field rules.
  - In Go (`internal/parse/parser.go`), prune `parsed.UnmappedLines` by checking whether each unmapped line contains a hymn or field value extracted by the dynamic suggestions.

- **Whitespace Normalization:**
  - Replace ` ` with standard ASCII space ` ` in `internal/parse/parser.go` and `src/lib/parser-rules.ts:normalizeNewlines`.

## Testing Decisions

- **TypeScript UI & Parity Tests (`tests/dynamic-field-extraction.test.mjs`):**
  - Test `runSingleRegexTest` logic with multiline dotall patterns (`(?is)BIBLE\s+TALK.*?Opening\s+[Ss]ong...`).
  - Test that user's full Sabbath bulletin with non-breaking spaces produces clean `unmappedLines` without the 4 matched hymns, while preserving truly unmapped lines (e.g. Welcome Remarks, Prayer Partners).
  - Test `re.lastIndex` statefulness regression.
- **Go Unit Tests (`internal/parse/dynamic_extraction_test.go`):**
  - Assert that `ParseRundown` prunes dynamically matched song lines from `parsed.UnmappedLines`.
  - Assert that non-breaking spaces in bulletin text normalize and parse without error.
- **Go HTTP API Integration Test (`internal/httpapi/services_field_values_test.go`):**
  - Confirm `POST /api/services/preview` returns `unmappedLines` that excludes lines captured by `songSetSuggestions` or `fieldSuggestions`.
