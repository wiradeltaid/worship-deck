# 02: Expose and edit Song Set Entry extraction regex in Admin and Layout panels

**What to build:** Enable administrators to view and configure extraction regexes for Song Set entries so that the dynamic intake engine can accurately detect, parse, and match songs into their intended Song Set slots. Update backend endpoints to serialize `extraction_regex`, extend creation contract, provide regex view and edit controls with client-side syntax validation in the Song Sets admin panel, provide inline regex status and editing for `song_set_entry` slots in Card Groupings & Layout, and verify end-to-end dynamic parsing and suggestion behavior.

**Blocked by:** 01 (remove-obsolete-advanced-parser-profiles-menu).

**Status:** ready-for-agent

- [ ] Read `internal/httpapi/song_set_entries.go`, `src/components/admin/SongSetEntriesPanel.tsx`, and `src/components/admin/FormLayoutAdminPanel.tsx` in full first.
- [ ] In `internal/httpapi/song_set_entries.go`:
      (1) Update `listSongSetEntries` (`GET /api/admin/song-set-entries`) and `listSongSetEntriesForOperator` (`GET /api/song-set-entries`) to select and serialize `extraction_regex` (as nullable string).
      (2) Update `createSongSetEntry` (`POST /api/admin/song-set-entries`) to optionally accept `extraction_regex`, validating syntax via `parse.ValidateAndTranslateRegex` before insertion.
      (3) Verify `PUT /api/admin/song-set-entries/{variableName}/extraction-regex` persists valid patterns and returns HTTP 400 for malformed patterns.
- [ ] In `src/components/admin/SongSetEntriesPanel.tsx`:
      (1) Add `extractionRegex?: string | null` to the `SongSetEntry` interface.
      (2) Add an extraction regex input field in the creation dialog and rename/edit workflows.
      (3) Implement client-side syntax validation (`new RegExp(...)`) with inline error messages to block invalid submissions before sending requests.
      (4) In the configured entries list, display the active regex badge/string for each entry.
      (5) Persist regex updates on existing entries via `PUT /api/admin/song-set-entries/{variableName}/extraction-regex`.
- [ ] In `src/components/admin/FormLayoutAdminPanel.tsx`:
      (1) For slots of `widget_kind === 'song_set_entry'`, match with canonical `songSetEntries` by `ref_key` (`variable_name`).
      (2) Display "Regex Aktif" / "Tanpa Regex" status badges matching the predefined field slot visual pattern.
      (3) Add the "Edit Regex" button and inline editor row with client-side validation, saving via `PUT /api/admin/song-set-entries/{variableName}/extraction-regex`.
- [ ] End-to-End Dynamic Parsing & Suggestions:
      (1) Verify `extractDynamicSongSetSuggestions` in `internal/parse/parser.go` uses the configured `extraction_regex` of each song set entry to extract song candidates from bulletin text lines.
      (2) Verify that form intake (`CreateForm.tsx`, `EditForm.tsx`) surfaces extracted songs as editable suggestions without silently overwriting saved selections.
- [ ] Add regression tests in `tests/dynamic-field-extraction.test.mjs` or a dedicated test suite verifying:
      (1) `GET /api/admin/song-set-entries` returns `extraction_regex` (handling null/empty and non-empty).
      (2) Regex update endpoint rejects malformed regex with HTTP 400 and accepts valid patterns.
      (3) Bulletin text with song lines matching a song set entry's regex generates the expected song suggestion for that slot.
