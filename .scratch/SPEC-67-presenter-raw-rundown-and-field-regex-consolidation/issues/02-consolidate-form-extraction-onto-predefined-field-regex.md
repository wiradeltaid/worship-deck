# 02: Consolidate form intake extraction onto Predefined Field and Song Set regex

**What to build:** With ticket 01 landed, Presenter mode no longer depends on `parsed_data.items` to
render the schedule. The service intake parser's remaining purpose is populating form fields and
suggesting song sets. Today, the code runs both macro document parsing (`ParserProfile` /
`rundown_parser_profiles`) and dynamic per-field regex extraction (`extractDynamicFieldSuggestions`
and `extractDynamicSongSetSuggestions`).

This ticket consolidates custom field extraction onto active `predefined_fields.extraction_regex`
and `song_set_entries.extraction_regex`. The suggestion and persistence contract is made explicit:
regex extraction produces non-destructive `fieldSuggestions`, which the intake form hydrates into
editable inputs for operator review before saving to `service_field_values`. Saved values are never
silently overwritten without operator re-parse action. Macro parsing is retained strictly as background
support for date detection and legacy slide-plan generation, and is completely decoupled from custom field
extraction and presenter schedule visibility.

**Blocked by:** 01 (presenter-mode-renders-raw-rundown-text).

**Status:** ready-for-agent

- [ ] Read `internal/parse/parser.go`, `internal/httpapi/services.go`, and `src/operator/CreateForm.tsx`
      in full first.
- [ ] Verify `extractDynamicFieldSuggestions` in `internal/parse/parser.go` reliably runs every active
      predefined field regex against both individual lines and full text body, outputting to `fieldSuggestions`.
- [ ] Verify `extractDynamicSongSetSuggestions` in `internal/parse/parser.go` reliably populates song set
      suggestions based on `song_set_entries.extraction_regex`.
- [ ] In `CreateForm.tsx` and `EditForm.tsx`, ensure `fieldSuggestions` are surfaced as editable input
      suggestions that the operator can review and accept before saving. Existing saved field values on
      `EditForm` are never silently overwritten upon load or update.
- [ ] Confirm that `GET /api/services/{id}` continues returning `raw_payload` with the verbatim rundown
      text, ensuring the presenter view from ticket 01 always receives the original text.
- [ ] Add regression tests in `tests/dynamic-field-extraction.test.mjs` verifying:
      (1) Raw bulletin text containing custom fields that macro parser rules do NOT recognize, but a
          Predefined Field regex matches, successfully produces the expected `fieldSuggestions`.
      (2) Submitting the service form persists the extracted field value into `service_field_values`.
      (3) `GET /api/services/{id}` returns the verbatim `raw_payload` unchanged.
