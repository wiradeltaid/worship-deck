# SPEC-69 — Service form parser profile retirement and song overflow removal

## Problem Statement

Following the consolidation of form intake onto dynamic Predefined Fields & Regex (SPEC-67) and Song Set Regex (SPEC-68), macro parser profiles were retired from daily administration and their dedicated tab was removed from `/admin/layout`. However, two residual artifacts of the legacy parser profile engine remain active in the operator service creation and editing workflow:

1. **Residual Parser Profile Selector on Service Forms:**
   Both `CreateForm.tsx` and `EditForm.tsx` still query `GET /api/parser-profiles`, maintain `selectedProfileId` component state, and render a "Parsing Profile:" dropdown/badge above the rundown input textarea. Furthermore, form submissions and parse requests still transmit `parserProfileId`. Since administrators no longer manage or tune macro parser profiles, exposing this selector causes operator confusion and implies that macro profiles govern form field extraction.

2. **False-Positive "Song Overflow Detected" Diagnostic Banner:**
   During rundown parsing (`POST /api/services/parse`), the backend Go handler (`internal/httpapi/services.go`) still invokes the legacy `parse.MatchSongSets` algorithm across all raw hymn numbers detected by macro scanner rules. When hymns in the pasted order of service (such as prayer hymns, introit, or songs without legacy label mappings) do not match legacy slot heuristics, they are classified into `songOverflow`. `CreateForm.tsx` and `EditForm.tsx` render this as an alarming amber warning banner:
   ```text
   ⚠️ Song overflow detected: the following songs exceed configured slots:
   SDAH #614, SDAH #316, SDAH #508, SDAH #671, SDAH #684, SDAH #476
   ```
   This banner appears even when administrators have configured explicit dynamic regexes on Song Set entries, misleading operators into believing that intake has failed or that songs were dropped.

## Solution

1. **Remove Residual Parser Profile Selector from Service Forms:**
   - Remove `parserProfiles` querying, `selectedProfileId` state, and the "Parsing Profile:" selector dropdown and badges from `src/operator/CreateForm.tsx` and `src/operator/EditForm.tsx`.
   - Remove `parserProfileId` from the JSON payloads dispatched to `POST /api/services/parse`, `POST /api/services`, and `PUT /api/services/{id}`.
   - Ensure backend handlers safely default to the system default profile when `parserProfileId` is omitted or explicitly `null`.

2. **Retire Macro Song Overflow Diagnostics from Intake:**
   - In `src/operator/CreateForm.tsx` and `src/operator/EditForm.tsx`, remove the `songOverflow` state and the conditional amber alert rendering `⚠️ {t('form.parser.overflowWarning')}`.
   - In `internal/httpapi/services.go`, discontinue calling the legacy `parse.MatchSongSets` algorithm for form intake suggestions. The intake parser's song suggestions must be driven 100% by dynamic `parsed.SongSetSuggestions` from `extractDynamicSongSetSuggestions` (configured via `song_set_entries.extraction_regex`).
   - In `POST /api/services/parse`, strictly serialize empty JSON arrays (`[]`) for `songOverflow` and `songSlotsUnfilled` to maintain exact JSON response schema compatibility for existing API consumers while eliminating false-positive overflow signals.
   - Verify with a deterministic multi-song fixture that dynamic Predefined Field Regex and Song Set Regex continue to extract and surface suggestions into form inputs seamlessly without legacy overflow noise.

## User Stories

1. As a service coordinator opening `/services/create` or `/services/:id/edit`, I want a clean intake interface without a "Parsing Profile:" selector, so that I am not distracted by obsolete configuration options.
2. As a service coordinator pasting an order of worship and clicking "Parse", I want the system to suggest songs based solely on the configured Song Set Regexes without displaying an alarming "Song overflow detected" warning banner.
3. As an administrator who has configured Song Set extraction patterns, I want the intake form to populate song suggestions directly into their matching slot fields without false-positive alerts about unmapped hymns.
4. As a developer maintaining the test suite, I want automated regression tests verifying that the parser profile selector and song overflow warning are absent from service forms while dynamic regex extraction remains fully functional.

## Implementation Decisions

- **UI Scope (`CreateForm.tsx` and `EditForm.tsx`):**
  - Drop `parserProfiles` state, `selectedProfileId`, and the `GET /api/parser-profiles` fetch effect.
  - Remove the "Parsing Profile:" `<Select>` and `<Badge>` elements above the rundown textarea.
  - Remove `songOverflow` state, the `setSongOverflow` call, and the amber warning box.
  - Maintain `unmappedLines` diagnostic warning if non-empty, as it provides legitimate guidance for unparsed lines.

- **Backend Handler Scope (`internal/httpapi/services.go`):**
  - In `parseRundownHandler` (`POST /api/services/parse`), use `parsed.SongSetSuggestions` directly as the authoritative `songSetSuggestions` response payload.
  - Cease calling `parse.MatchSongSets` during service form parse. Return strictly empty JSON arrays `[]` for `songOverflow` and `songSlotsUnfilled` to maintain JSON schema compatibility without emitting false overflow signals.
  - Explicitly support omitted and `null` `parserProfileId` in `POST /api/services/parse`, `POST /api/services`, and `PUT /api/services/{id}`, falling back to `parse.LoadDefaultParserProfile(s.DB)`.

- **Corpus & Boundary Discipline:**
  - Server-side profile database tables and endpoints remain intact to maintain backend compatibility per DEC-063.
  - Dynamic extraction via `predefined_fields.extraction_regex` and `song_set_entries.extraction_regex` remains the sole intake extraction mechanism.

## Testing Decisions

- **Absence Guards:**
  - Create or update regression tests verifying that `CreateForm.tsx` and `EditForm.tsx` contain neither `selectedProfileId`, `form.parser.profile`, nor `form.parser.overflowWarning`.
  - Prove absence guards via defect injection (temporarily restoring references, verifying failure, then restoring clean state).
- **Backend Handler & Compatibility Tests:**
  - Verify `POST /api/services/parse`, `POST /api/services`, and `PUT /api/services/{id}` handle both omitted and explicit `null` `parserProfileId` gracefully.
  - Assert that `POST /api/services/parse` response payload contains `songOverflow: []` and `songSlotsUnfilled: []` as non-null arrays.
- **Deterministic Dynamic Parsing Verification:**
  - Provide a stable test fixture with a realistic multi-song church bulletin (including multiple distinct song slots and unmapped hymns), asserting exact slot-to-song mappings in `songSetSuggestions` and confirming `songOverflow: []`.
- **E2E Form Suggestion Hydration:**
  - Verify that pasting church bulletin text and clicking Parse populates suggestions into matching song set slots without warning banners.

## Out of Scope

- Deleting the `rundown_parser_profiles` table or backend Go models (retained for backend compatibility per DEC-063).
- Modifying canvas slide layout generation or lyric split algorithms.
- Modifying Predefined Fields administration in `/admin/layout`.
