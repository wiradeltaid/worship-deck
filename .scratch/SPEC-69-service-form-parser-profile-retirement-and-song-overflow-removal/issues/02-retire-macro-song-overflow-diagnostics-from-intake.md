# 02: Retire macro song overflow diagnostics from service intake

**What to build:** In `src/operator/CreateForm.tsx` and `src/operator/EditForm.tsx`, when an operator clicks "Parse", the backend returns `songOverflow` populated by legacy `parse.MatchSongSets` heuristics, triggering an alarming amber alert `⚠️ Song overflow detected: the following songs exceed configured slots:` for any detected hymns not matching legacy rules. Retire this legacy warning banner and `songOverflow` state from both intake forms. In `internal/httpapi/services.go`, discontinue calling `parse.MatchSongSets` for intake suggestions, driving `songSetSuggestions` 100% from dynamic `extractDynamicSongSetSuggestions` (powered by `song_set_entries.extraction_regex`). Return strictly empty JSON arrays (`[]`) for `songOverflow` and `songSlotsUnfilled` in the parse response. Add an absence guard and verify dynamic regex extraction remains fully operational with deterministic multi-song fixtures.

**Blocked by:** 01 (remove-residual-parser-profile-dropdown-from-service-forms — implementation sequencing constraint to prevent merge conflicts across shared form and handler files).

**Status:** open

- [ ] Read `src/operator/CreateForm.tsx`, `src/operator/EditForm.tsx`, and `internal/httpapi/services.go` in full first.
- [ ] In `src/operator/CreateForm.tsx`:
      (1) Remove `songOverflow` state and `setSongOverflow` call in `handleParse`.
      (2) Remove the amber alert block rendering `⚠️ {t('form.parser.overflowWarning')}` and the overflowing song badges.
- [ ] In `src/operator/EditForm.tsx`:
      (1) Remove `songOverflow` state and `setSongOverflow` call in `handleParse`.
      (2) Remove the amber alert block rendering `⚠️ {t('form.parser.overflowWarning')}` and the overflowing song badges.
- [ ] In `internal/httpapi/services.go`:
      (1) In `parseRundownHandler` (`POST /api/services/parse`), eliminate the call to `parse.MatchSongSets`.
      (2) Populate `songSetSuggestions` directly from `parsed.SongSetSuggestions`.
      (3) Return empty slices `[]any{}` (rendered as JSON `[]`) for both `songOverflow` and `songSlotsUnfilled` to strictly preserve response schema compatibility without false overflow data.
- [ ] Add an executable absence guard in smoke tests:
      (1) Assert `CreateForm.tsx` and `EditForm.tsx` do NOT render `form.parser.overflowWarning` or maintain `songOverflow` state.
      (2) Prove the absence guard by defect injection: temporarily re-introduce the reference, verify the test goes RED, then revert to GREEN.
- [ ] Add deterministic multi-song regression tests in `tests/dynamic-field-extraction.test.mjs`:
      (1) Use a realistic multi-song fixture containing Bible Talk and Divine Service songs (including non-matching prayer hymns like #671 and #684).
      (2) Assert exact slot-to-song mappings in `songSetSuggestions`.
      (3) Explicitly assert `response.songOverflow` is an Array of length 0 and `response.songSlotsUnfilled` is an Array of length 0.
- [ ] Verify that parsing a raw bulletin text with multiple hymns populates matching song set slots without triggering any false-positive song overflow warnings.
