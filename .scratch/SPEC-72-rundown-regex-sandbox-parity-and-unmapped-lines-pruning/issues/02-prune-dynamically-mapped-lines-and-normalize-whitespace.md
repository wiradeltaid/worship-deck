# 02: Prune dynamically mapped lines and normalize non-breaking whitespace across intake parsers

**What to build:** In `internal/parse/parser.go`, `src/lib/parser-rules.ts`, and `internal/httpapi/services.go`:
1. In `internal/parse/parser.go:ParseRundownWithProfile`:
   - Normalize non-breaking spaces ` ` to standard ASCII spaces ` ` in `normalized := strings.ReplaceAll(strings.ReplaceAll(rawText, "\r\n", "\n"), "\r", "\n")`.
   - Use this single normalized string consistently across line splitting, line matching, full-text fallback, and line offset calculations, while preserving persisted `raw_payload` verbatim.
   - After dynamic field suggestions (`extractDynamicFieldSuggestions`) and dynamic song set suggestions (`extractDynamicSongSetSuggestions`) are computed, reconcile `parsed.UnmappedLines`:
     - Prune lines that were captured by active predefined field regexes or dynamic song set entry regexes (pinpointing lines where the extracted hymn number or field value appears).
     - Ensure `parsed.UnmappedLines` contains only lines not recognized by date, section, role, legacy fields, dynamic predefined fields, or dynamic song sets.
2. In `src/lib/parser-rules.ts`:
   - Normalize non-breaking spaces in `normalizeNewlines`: `text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/ /g, ' ')`.
   - Provide an exported helper `reconcileDynamicUnmappedLines(rawLines, fieldSuggestions, songSetSuggestions)` for TypeScript client/UI intake consumers, preserving `parseRundownWithProfile` as a pure static parser while ensuring complete unmapped lines pruning parity across operator forms.
3. In `internal/httpapi/services.go`:
   - Ensure `previewService` (`POST /api/services/preview`), `createService` (`POST /api/services`), and `updateService` (`PUT /api/services/{id}`) return clean `unmappedLines` reflecting the reconciled unmapped lines array without false-positive song/field lines.
4. Cross-layer tests:
   - Go unit tests in `internal/parse/dynamic_extraction_test.go`: assert that `ParseRundown` prunes dynamically matched song lines and field lines from `parsed.UnmappedLines`, and that ` ` whitespace parses cleanly.
   - Go HTTP API test in `internal/httpapi/services_field_values_test.go`: assert `POST /api/services/preview` returns clean `unmappedLines` without false-positive song lines.
   - Node / TS parity tests in `tests/dynamic-field-extraction.test.mjs`.

**Blocked by:** 01-sandbox-multiline-regex-evaluation-parity (implementation sequencing constraint: frontend sandbox mapped lines tracking lands first before backend unmapped lines reconciliation).

**Status:** open

- [ ] Read `internal/parse/parser.go`, `src/lib/parser-rules.ts`, and `internal/httpapi/services.go` in full.
- [ ] In `internal/parse/parser.go`:
      (1) Normalize ` ` to ASCII space in `normalized` and use single normalized string across all extraction paths.
      (2) In `ParseRundownWithProfile`, reconcile `parsed.UnmappedLines` against lines captured by dynamic fields and dynamic song sets.
- [ ] In `src/lib/parser-rules.ts`:
      (1) Normalize ` ` to ASCII space in `normalizeNewlines`.
      (2) Export `reconcileDynamicUnmappedLines` to prune lines captured by dynamic fields and song set entries in UI forms.
- [ ] Add Go unit tests in `internal/parse/dynamic_extraction_test.go`:
      (1) Verify `parsed.UnmappedLines` does not contain lines matched by dynamic song set regexes.
      (2) Verify bulletin text containing non-breaking spaces ` ` parses correctly.
- [ ] Add Go HTTP API test in `internal/httpapi/services_field_values_test.go`:
      (1) Verify `unmappedLines` in `POST /api/services/preview` response excludes matched dynamic song slots.
- [ ] Run `npm test` and `go test ./...` verifying zero regressions.
