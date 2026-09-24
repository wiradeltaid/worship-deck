# 01: Support rawText fallback for song set dynamic regex extraction

**What to build:** In `internal/parse/parser.go` and `src/lib/parser-rules.ts`, song set dynamic regex extraction currently operates exclusively line-by-line. When an order of worship contains multiple service sections (such as Bible Talk and Divine Service) where song items share identical line labels (e.g. `[ ] Opening song`), line-by-line regexes cannot anchor to enclosing section headers. Add `rawText` fallback to `extractDynamicSongSetSuggestions` in Go and `extractSongSetEntries` in TypeScript when line-by-line matching yields no valid hymn suggestion (`!found`), enabling multiline dotall regex patterns (e.g. `(?is)BIBLE\s+TALK.*?Opening\s+[Ss]ong\s*:\s*(?:(?<book>[A-Za-z]+)\s*)?#?\s*(?<number>\d+)`). Add deterministic multi-section tests in Go unit tests, Node/TS parity tests, and Go HTTP API integration tests (`POST /api/services/parse`) verifying exact slot extraction for identically labeled songs across sections using purely synthetic test data.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `internal/parse/parser.go` (`extractDynamicSongSetSuggestions`), `src/lib/parser-rules.ts` (`extractSongSetEntries`), and `internal/httpapi/services_field_values_test.go` in full first.
- [x] In `internal/parse/parser.go`:
      (1) In `extractDynamicSongSetSuggestions`, track whether a pattern produced a valid hymn suggestion (`num > 0`) on any line (`found := false`).
      (2) If `!found`, execute `p.re.FindStringSubmatch(rawText)`.
      (3) If matched, extract named groups `number` and `book` (or numeric submatches), resolve book code via `profile.ResolveBook(bookStr)` (defaulting to "SDAH"), look up hymn in DB, and populate `suggestions[p.variableName] = SongSetSuggestion{ ... MatchKind: "regex" }`.
- [x] In `src/lib/parser-rules.ts`:
      (1) In `extractSongSetEntries`, track whether an entry produced a valid hymn suggestion (`num > 0`) on any line (`let found = false`).
      (2) If `!found`, execute `rawText.match(re)`.
      (3) If matched, extract `number` and `book` (from named groups or numeric capture groups), perform `lookupHymnFn`, and populate `suggestions[varName]`.
- [x] Add Go unit tests in `internal/parse/dynamic_extraction_test.go`:
      (1) Configure multiple song set entries with section-scoped regexes (e.g. `bt_opening_song` targeting Bible Talk and `ds_opening_song` targeting Divine Service).
      (2) Parse a realistic multi-section raw bulletin fixture using synthetic member names (e.g. "Leader One", "Speaker Two") containing both Bible Talk and Divine Service.
      (3) Assert that `bt_opening_song` extracts SDAH #614 and `ds_opening_song` extracts SDAH #508 without collision.
- [x] Add Node/TS parity tests in `tests/dynamic-field-extraction.test.mjs`:
      (1) Test `extractSongSetEntries` with section-scoped multiline regexes across `rawText`.
      (2) Assert exact slot-to-song mapping for Bible Talk opening/closing and Divine Service opening/closing.
- [x] Add Go HTTP API integration test in `internal/httpapi/services_field_values_test.go`:
      (1) Test `POST /api/services/parse` with section-scoped regexes on `song_set_entries`.
      (2) Confirm `songSetSuggestions` returns distinct hymns for both Bible Talk and Divine Service slots over HTTP.
- [x] Run full test suite (`npm test` and `go test ./...`) to ensure zero regressions across existing single-line regexes and parser tests.
