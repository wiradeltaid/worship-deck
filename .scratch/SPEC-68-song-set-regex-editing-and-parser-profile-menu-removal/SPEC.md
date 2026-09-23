# SPEC-68 — Song set regex editing and parser profile menu removal

## Problem Statement

WorshipDeck administrators and coordinators face two workflow obstacles in service preparation and layout management:

1. **Inability to Configure Song Set Extraction Regex:**
   Church service bulletins contain multiple musical items throughout the order of service (e.g., Opening Hymn, Praise & Worship Song, Scripture Reflection Hymn, Closing Song). While WorshipDeck supports Song Set Entry slots on the spine and in weekly forms, administrators currently have no user interface to view or edit the `extraction_regex` for each Song Set entry. Although the database table maintains an `extraction_regex` column and an update endpoint exists (`PUT /api/admin/song-set-entries/{variableName}/extraction-regex`), the list endpoints (`GET /api/admin/song-set-entries` and `GET /api/song-set-entries`) omit this property from serialization, and neither the Song Sets management interface nor the Card Groupings & Layout slot editor displays or allows editing of the pattern. Without configurable regexes, the dynamic intake engine cannot accurately detect, categorize, and render the intended songs into their respective Song Set slots when parsing raw bulletin text.

2. **Residual Obsolete Menu for Advanced Parser Profiles:**
   Following the consolidation of form intake onto dynamic predefined field regexes (SPEC-67), user-facing administration of macro document parser profiles is no longer needed in daily workflows. However, the Card Groupings & Layout administrative panel still displays an "Advanced Parser Profiles" tab button and renders an embedded parser profile sub-view. This residual menu generates confusion for administrators, falsely suggesting that complex macro parser profiles are still an active configuration surface for service intake.

## Solution

1. **Expose and Edit Song Set Entry Extraction Regex:**
   - Extend the song set entry administrative and operator list endpoints to query and serialize `extraction_regex` (as a nullable string).
   - Extend `POST /api/admin/song-set-entries` to optionally accept `extraction_regex` on creation, with server-side validation.
   - Provide intuitive UI controls in the Song Sets admin panel (`SongSetEntriesPanel.tsx`) to view, add, and modify the extraction regex for each song set entry, with client-side syntax validation preventing malformed regex submissions.
   - In the Card Groupings & Layout panel (`FormLayoutAdminPanel.tsx`), equip slots of kind `song_set_entry` with the same "Regex Aktif / Tanpa Regex" indicator badges and inline "Edit Regex" editing controls currently available for predefined fields, editing the single canonical regex per `variable_name` via `PUT /api/admin/song-set-entries/{variableName}/extraction-regex`.
   - Verify that the dynamic parsing and matching engine applies the configured regex of each Song Set entry slot to identify candidate song lines in bulletin text and populate suggestions into the appropriate Song Set form controls without silently overwriting saved values.

2. **Remove Obsolete Advanced Parser Profiles Menu (UI Scope):**
   - Strictly remove the "Advanced Parser Profiles" tab button and its embedded sub-panel view (`<ParserProfilesPanel />`) from the Card Groupings & Layout administration screen (`FormLayoutAdminPanel.tsx`).
   - Retain underlying database records, server endpoints, and background profile fallback logic completely intact, avoiding premature schema or architectural disruption.
   - Replace outdated positive assertions in smoke tests with an executable absence guard that asserts the tab and component remain absent from the panel.

## User Stories

1. As an administrator configuring song sets, I want to define and edit an extraction regex for each Song Set entry (e.g. `(?i)^Opening Hymn\s*[:\-]\s*(?<value>.*)$`), so that the system knows exactly which lines in a church bulletin correspond to that specific song slot.
2. As an administrator viewing the Song Sets admin panel, I want to see the currently configured extraction regex for each song set entry, so that I can audit and update parsing patterns without direct database manipulation.
3. As an administrator organizing form layout in Card Groupings & Layout, I want slots of kind `song_set_entry` to display a badge indicating whether a regex is active or absent, so that I have immediate visibility into slot parsing readiness.
4. As an administrator in Card Groupings & Layout, I want an "Edit Regex" button on `song_set_entry` slots that opens an inline regex editor, so that I can adjust song set patterns directly in context alongside other form slots.
5. As an administrator entering or saving a regex for a song set entry, I want client-side validation to catch invalid regular expression syntax immediately with clear feedback, preventing invalid requests from being submitted to the server.
6. As a service coordinator pasting an order of worship into the Service form, I want clicking "Parse" to apply each Song Set entry's custom extraction regex, so that hymns and praise songs are automatically matched into their appropriate Song Set slots.
7. As an administrator navigating the Card Groupings & Layout panel, I want to see only relevant active tabs (Card Groupings & Layout, Predefined Fields & Regex, and Rundown Test Area & Sandbox), so that obsolete macro parser profile settings no longer clutter the interface.
8. As an operator reviewing parsed suggestions, I want all songs identified by song set entry regexes to populate as editable suggestions that require manual submission, ensuring no existing data is silently overwritten.
9. As a developer maintaining the test suite, I want automated regression tests verifying that `song_set_entries` serialization, regex updates, and UI rendering of song set slots remain stable, with an executable absence guard for the retired parser profile tab.

## Implementation Decisions

- **Song Set Entry API Serialization & Creation Contract:**
  - Update `listSongSetEntries` (`GET /api/admin/song-set-entries`) and `listSongSetEntriesForOperator` (`GET /api/song-set-entries`) in `internal/httpapi/song_set_entries.go` to select and return `extraction_regex` (as `null` or string).
  - Update `createSongSetEntry` (`POST /api/admin/song-set-entries`) to optionally accept `extraction_regex`. If non-empty, validate syntax via `parse.ValidateAndTranslateRegex` before insertion.
  - The dedicated `PUT /api/admin/song-set-entries/{variableName}/extraction-regex` remains the canonical endpoint for updating regex on existing entries.

- **Song Sets Management Interface (`SongSetEntriesPanel.tsx`):**
  - Add `extractionRegex` to the `SongSetEntry` interface.
  - Add an extraction regex input field in the creation dialog/form and rename/edit workflows.
  - Implement client-side syntax validation (`new RegExp(...)`) with inline error messaging to prevent submitting malformed patterns.
  - Display the active regex pattern on each configured entry item in the list.

- **Card Groupings & Layout Slot Editor Parity (`FormLayoutAdminPanel.tsx`):**
  - Enhance the slot rendering logic: when a slot's widget kind is `song_set_entry`, resolve its canonical entry from `songSetEntries` by `ref_key` (`variable_name`).
  - Display the status badge ("Regex Aktif" / "Tanpa Regex") and provide the "Edit Regex" button with the inline editor row, saving via `PUT /api/admin/song-set-entries/{variableName}/extraction-regex`.
  - Maintain single canonical storage: slot editing mutates the underlying `song_set_entries.extraction_regex`, avoiding duplicate slot-level regex state.

- **Dynamic Intake Parser Execution:**
  - Verify that `extractDynamicSongSetSuggestions` in `internal/parse/parser.go` evaluates each active song set entry's `extraction_regex` against raw lines and returns candidate song matches in `fieldSuggestions`/`songSetSuggestions`.
  - Ensure client-side forms (`CreateForm.tsx`, `EditForm.tsx`) hydrate these suggestions into editable form fields without silently overwriting existing saved song selections.

- **Removal of Advanced Parser Profiles Tab (UI Scope Only):**
  - Remove `'profiles'` from `AdminTab` type definition in `FormLayoutAdminPanel.tsx`.
  - Remove the Tab 4 navigation button and the conditional block rendering `<ParserProfilesPanel />`.
  - Narrow scope to UI removal: retain `rundown_parser_profiles` database records and backend endpoints untouched for background date and legacy slide-plan generation support.

## Testing Decisions

- **API Boundary Tests:**
  - Verify `GET /api/admin/song-set-entries` and `GET /api/song-set-entries` include `extraction_regex` (both `null` and non-null values).
  - Verify `POST /api/admin/song-set-entries` accepts valid `extraction_regex` and rejects invalid regex with HTTP 400.
  - Verify `PUT /api/admin/song-set-entries/{variableName}/extraction-regex` persists valid patterns and rejects malformed patterns with HTTP 400.
- **Intake & Suggestion Tests:**
  - Verify that supplying bulletin text matching configured song set regexes generates `songSetSuggestions` populated into form suggestions, requiring explicit submission to commit to `service_field_values`.
- **UI Absence Guard & Component Tests:**
  - Replace the positive assertion in `tests/smoke-spec-54.test.mjs` with an executable absence guard proving `FormLayoutAdminPanel` contains neither the `'profiles'` tab button nor `<ParserProfilesPanel />`. Guard must be verified by defect injection (seen failing when injected, passing when restored).
  - Verify client-side regex validation catches invalid syntax and disables submit.
- **Prior Art:** `tests/dynamic-field-extraction.test.mjs`, `tests/form-layout-seeder.test.mjs`, and `tests/smoke-spec-54.test.mjs`.

## Out of Scope

- Dropping the `rundown_parser_profiles` table or server-side parser profiles endpoints from the Go backend.
- Modifying canvas slide layout generation or lyric split algorithms.
- Changing authentication or permission levels for administrative endpoints.

## Further Notes

This specification directly resolves user feedback regarding song set regex flexibility and cleans up residual UI artifacts left over from the parser profile deprecation.
