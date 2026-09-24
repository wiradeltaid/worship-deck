# SPEC-70 — Complete rundown parser profile and song overflow retirement

## Problem Statement

Following the consolidation of form intake onto dynamic Predefined Field Regex (SPEC-67), Song Set Entry Regex (SPEC-68), and operator service form cleanup (SPEC-69), macro parser profiles and the legacy 3-pass song matching heuristic were retired from daily intake. However, residual artifacts and obsolete architecture remain active across several layers of the application:

1. **Residual Parser Profile and Song Overflow Diagnostics in Sandbox Admin (`FormLayoutAdminPanel.tsx`):**
   The Card Groupings & Layout administrative panel (`/admin/layout`) contains a "Rundown Test Area & Sandbox" tab. While the dedicated "Advanced Parser Profiles" menu tab was removed in SPEC-68, the sandbox tab itself still:
   - Fetches `GET /api/parser-profiles` on mount and stores `defaultProfile`. (In fact, because the API returns `rulesJson` while the client looks for `defaultProfile.rules`, the client was already silently falling back to client built-ins, demonstrating that the network call and profile state are completely dead baggage).
   - Executes legacy `parseRundownWithProfile(...)` and `matchSongSets(...)`.
   - When hymns exceed legacy slot heuristics, renders an alarming amber diagnostic box:
     ```text
     Lagu Melebihi Slot (Overflow Songs):
     SDAH #614 ("[  ] Opening song : SDAH #614 Sound the Battle Cry")
     SDAH #316 ("[  ] Closing Song : SDAH #316 Lift Out Thy Life Within Me")
     SDAH #508 ("[  ] Opening Song : SDAH #508 "Anywhere With Jesus"")
     SDAH #671 ("[  ] Before int. prayer : #671 now dear Lord as we pray")
     SDAH #684 ("[  ] After int. prayer : #684 hear our prayer o Lord")
     SDAH #476 ("[  ] Closing Song : SDAH #476 "Burdens Are Lifted at Calvary"")
     ```
   - This misleads administrators into believing macro parser profiles and slot overflow limits still govern intake, when in reality intake is 100% driven by dynamic regex patterns configured on `predefined_fields` and `song_set_entries`.
   - In addition, `src/components/admin/ParserProfilesPanel.tsx` remains in the tree as an unreferenced, orphaned component.

2. **Obsolete Parser Profile Endpoints, Legacy Song Matching, and Persistence Dependencies in Backend and Client Libraries:**
   - In the Go backend, `internal/httpapi/parser_profiles.go` and routes in `server.go` (`GET /api/parser-profiles`, `/api/admin/parser-profiles...`) still expose macro profile CRUD surfaces.
   - `internal/parse/song_set_matching.go` maintains the legacy 3-pass matching algorithm (`MatchSongSets`) and overflow heuristic.
   - `internal/parse/parser.go` still queries `rundown_parser_profiles` via `LoadDefaultParserProfile(db)` during fallback parsing.
   - `services.parser_profile_id` and `parser_profile_version` columns exist on the database; incoming service requests or webhooks may still carry optional `parserProfileId` parameters that must be handled safely without error.
   - In client libraries, `src/lib/song-set-matching.ts` and `src/lib/parser-rules.ts` maintain duplicated legacy 3-pass matching and profile rule types.
   - In the method corpus, UC-30 ("I configure how the Rundown parser reads our congregation's format", FR-36) and contract `09-rundown-parser-profiles.md` still formally describe macro profile administration rather than reflecting its retirement in favor of UC-31 (Dynamic Form Layout, Predefined Fields, and Song Set Regex).

## Solution

1. **Retire Sandbox Parser Profile Dependency and Song Overflow Diagnostics (UI Scope):**
   - In `src/components/admin/FormLayoutAdminPanel.tsx`:
     - Eliminate `defaultProfile` state and the `fetch('/api/parser-profiles')` call.
     - Update `handleRunRundownTest` to evaluate song suggestions directly against `songSetEntries` using their dynamic `extraction_regex` (matching `internal/parse/parser.go:extractDynamicSongSetSuggestions` parity), with no calls to `parseRundownWithProfile` or `matchSongSets`.
     - Standardize `unmappedLines` semantics: a rundown line is marked mapped if it matches any active Predefined Field regex, any active Song Set Entry regex, or standard date/section delimiters. All remaining lines appear in `unmappedLines`.
     - Remove `overflowSongs` from `testResults` state and completely remove the amber warning box rendering `Lagu Melebihi Slot (Overflow Songs):`.
   - Delete the orphaned `src/components/admin/ParserProfilesPanel.tsx` component.
   - Add an exhaustive absence-guard mutation matrix in smoke tests asserting that `FormLayoutAdminPanel.tsx` contains neither `defaultProfile`, `/api/parser-profiles`, nor `Lagu Melebihi Slot`, and that `ParserProfilesPanel.tsx` is deleted. Prove each guard via independent defect injection.

2. **Retire Legacy Parser Profiles and Song Set Matching Across Backend, Client Libs, and Corpus:**
   - In `internal/httpapi/`:
     - Retire `/api/parser-profiles` and `/api/admin/parser-profiles...` endpoints and handlers from `server.go` and `parser_profiles.go`.
     - Ensure service creation, preview, and update handlers gracefully accept and ignore omitted or legacy `parserProfileId` values without failing.
   - In `internal/parse/`:
     - Retire `song_set_matching.go` (`MatchSongSets`) and associated legacy profile unit tests.
     - Decouple `ParseRundown` from `LoadDefaultParserProfile(db)`. Replace dynamic database-driven profile compilation with a permanent static internal parser (`StaticDefaultParser`) that provides built-in date, section, and standard hymn book resolution (SDAH, etc.).
   - In `src/lib/`:
     - Retire legacy `matchSongSets` and `songOverflow` types from `src/lib/song-set-matching.ts`.
     - Clean up `src/lib/parser-rules.ts` and `src/lib/parser.ts` to deprecate profile-based matching in favor of dynamic regex extraction.
   - In the corpus:
     - Update `usecases.yaml` and `.what/hub/SRS-hub.md` to formally record UC-30 / FR-36 as retired / superseded by UC-31.
     - Mark `.how/hub/02-contracts/09-rundown-parser-profiles.md` and related references in `SDD-hub.md`, `00-inventory.md`, and `data-model.md` as retired.
   - Ensure all backend unit tests (`go test ./...`) and frontend test suites (`npm test`) pass cleanly.

## User Stories

1. As an administrator testing rundown extraction in `/admin/layout`, I want the Sandbox area to extract song set entries using their configured dynamic regexes without querying `/api/parser-profiles`, so that the sandbox test results accurately reflect real intake extraction.
2. As an administrator testing a church bulletin in the Sandbox area, I want all matching hymns to populate into their respective Song Set slots without displaying a false "Lagu Melebihi Slot (Overflow Songs)" warning box.
3. As a developer auditing the codebase, I want orphaned components (`ParserProfilesPanel.tsx`), dead parser profile API endpoints, and obsolete 3-pass song matching code removed, so that the codebase is clean and free of legacy baggage.
4. As an operator or developer running the automated test suite, I want robust absence guards verified by an explicit mutation matrix ensuring no legacy parser profile UI or overflow warnings can accidentally regress into the application.

## Implementation Decisions

- **Sandbox Parity with Intake Extraction:**
  - The Sandbox in `FormLayoutAdminPanel.tsx` executes the exact same extraction semantics as production form intake:
    - Predefined fields are extracted via `extractPredefinedFields`.
    - Song sets are extracted by iterating each active song set entry and matching against its `extraction_regex`.
    - Song results reflect slot variable, title, book code, number, and status (`matched` / `unfilled`).
    - There is zero concept of "overflow songs" because song slots are explicitly defined and any line not matched simply remains in `unmappedLines`.
- **Static Parser Successor (Go Backend):**
  - Replace database-loaded parser profiles with a static, non-configurable internal parser engine (`StaticDefaultParser`).
  - Standard Indonesian and English date patterns, section delimiters, and standard book codes (SDAH) remain supported natively without database queries.
  - Existing database table `rundown_parser_profiles` and columns `services.parser_profile_id` remain dormant for zero-data-loss database backward compatibility, but are no longer queried or mutated during intake.
- **Clean Component Removal:**
  - Delete `src/components/admin/ParserProfilesPanel.tsx` outright since it is completely unreferenced.
- **Corpus Consistency:**
  - Mark UC-30 in `.control/registry/usecases.yaml` as retired / superseded by UC-31.
  - Update `SRS-hub.md`, `SDD-hub.md`, `09-rundown-parser-profiles.md`, and `00-inventory.md`.

## Testing Decisions

- **Absence Guard Mutation Matrix:**
  - Assert that `src/components/admin/FormLayoutAdminPanel.tsx` does not contain `Lagu Melebihi Slot` (proven by defect injection).
  - Assert that `src/components/admin/FormLayoutAdminPanel.tsx` does not contain `/api/parser-profiles` (proven by defect injection).
  - Assert that `src/components/admin/FormLayoutAdminPanel.tsx` does not contain `overflowSongs` (proven by defect injection).
  - Assert that `src/components/admin/ParserProfilesPanel.tsx` does not exist on disk (proven by defect injection).
  - Assert that `internal/httpapi/server.go` does not register `/api/parser-profiles` routes.
- **Sandbox Regression Tests:**
  - Provide a test fixture derived from the user's reported sample (containing SDAH #614, #316, #508, #671, #684, #476).
  - Verify that configured song set slots extract their matching hymns and unmapped lines populate without overflow warnings.
- **Backend Regression Suite:**
  - Run `go test ./...` and `npm test` to ensure zero regressions across the existing suite.

## Out of Scope

- Modifying slide rendering or PPTX generation logic.
- Modifying Predefined Field and Card Grouping schema or layouts.
- Altering the Presentation mode raw rundown viewer.
