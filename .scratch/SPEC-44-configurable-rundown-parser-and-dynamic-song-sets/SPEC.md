# SPEC-44 — Configurable Rundown Parsing Engine and Dynamic Song Sets

> **Status:** open
> **Release:** configurable-rundown-parser-and-dynamic-song-sets
> **Component:** hub
> **Touches:** services, db, hymns, slide-plan
> **Depends on:** SPEC-43

## Problem Statement

During operational review and system preparation for multi-church adoption, operators and maintainers identified significant inflexibility in weekly worship rundown intake:

1. **Hardcoded Monolithic Regex Cascades:**
   The rundown parsing engine is currently hardcoded across both Go (`internal/parse/parser.go`) and TypeScript (`src/lib/parser.ts`). Every section header (`BIBLE TALK`, `DIVINE SERVICE`), role label (`Sermon`, `Special Song`, `Ayat Bacaan`), and hymn numbering pattern (`(?:SDAH|Hymn|#)`) is compiled into binaries and scripts. Congregations with different liturgies, naming conventions, or languages cannot use the system without modifying source code.

2. **Inflexible Hymn and Song Book Formats:**
   Churches use diverse song books and numbering patterns (e.g. `Lagu 123` for NKI, `KJ 45` for Kidung Jemaat, `PKJ 12`, `SDAH 45`). The parser currently assumes SDAH-first or `#` patterns and cannot map book-specific prefixes to registered song books.

3. **Rigid and Disconnected Song Set Matching:**
   Different services and congregations have varying praise & worship segments (e.g., 2 songs in one church, 5 songs in another). The free-text rundown parser does not populate `song_set_inputs` at all today; operators must re-type hymn numbers into song set cards manually.

4. **Lack of Configuration UI and Sandbox Testing:**
   Administrators have no interface to test or customize parsing rules against real rundown text samples. They cannot preview token extraction or diagnose why a line was unmapped without running local tests.

## Solution

1. **Configurable Parsing Profile Entity & Schema:**
   - Introduce database-backed `rundown_parser_profiles` storing JSON-defined parsing rules with revision versioning.
   - Seed the current hardcoded rules as an immutable `builtin-default` profile on migration to guarantee 100% backward compatibility for existing deployments.

2. **Dual-Engine Canonical Rule Runner (Go & TypeScript):**
   - Implement lightweight, profile-driven cascade interpreters in both Go (`internal/parse`) and TypeScript (`src/lib/parser.ts`) executing identical normalization, section delimitation, field extraction (via named capture groups `(?<name>...)`), and hymn numbering recognition.
   - Restrict patterns to a shared safe regex subset (no lookarounds/backreferences; explicit flag arrays `["i"]`) with regex compilation linting.
   - Validate parity across Go and TypeScript via shared golden JSON fixtures.

3. **Dynamic Song Sets 3-Pass Hybrid Matching:**
   - **Pass 1 (Label Match):** Explicitly labeled song lines (e.g., "Opening Song: SDAH 10") claim designated template slots matching configured labels.
   - **Pass 2 (Positional Match):** Unlabeled hymn/praise lines (e.g., "Praise 1: Lagu 45", "Praise 2: Lagu 88") map sequentially into configured slot families (e.g., `praise_song_1` through `praise_song_5`) using `song_set_entries.position`.
   - **Pass 3 (Diagnostics & Omission):** Unclaimed songs are reported in `songOverflow`; empty slots in the slot family are omitted from the live presentation plan (zero empty slides generated).
   - In accordance with DEC-004, the parser suggests song set assignments in preview (`songSetSuggestions`) as non-destructive draft values that operators can accept with one click, preserving operator authority over stored `song_set_inputs`.

4. **Admin UI: Parsing Profile Builder & Live Sandbox:**
   - Provide an admin panel under Settings (`/admin/parsing`) with a split-pane view:
     - Left pane: Structured Rule Builder for common cases (prefixes, delimiters, label-to-target mappings) with an Advanced Regex tab for complex custom patterns.
     - Right pane: Sticky Live Testing Sandbox where administrators paste sample rundown text and immediately inspect color-coded extracted tokens, song set suggestions, and unmapped line warnings.

5. **Hub Operator Intake Integration:**
   - `CreateForm.tsx` and `EditForm.tsx` automatically employ the active default parsing profile (with optional profile selector if multiple profiles exist).
   - Clicking "Parse" hydrates structured form fields and populates song set rows via `songSetSuggestions` without silent overwrites, displaying clear banners for unmapped lines or song overflow.

## User Stories

1. As an administrator of a congregation with a distinct liturgy, I want to configure custom section headers and field extraction labels, so that our bulletin rundown text parses accurately into worship services.
2. As an administrator, I want to define aliases for our local song books (such as "Lagu" for NKI or "KJ" for Kidung Jemaat), so that song lines with book prefixes automatically bind to the correct song book code.
3. As an administrator, I want an interactive live sandbox in Admin Settings where I can paste sample rundown text and view extracted fields in real time, so that I can verify rule correctness before saving.
4. As an administrator, I want rule configuration to provide structured forms for synonyms and separators, so that I do not need to write complex regular expressions for standard label variations.
5. As an advanced user, I want an Advanced Regex tab with named capture group support, so that I can handle non-standard or dense rundown formats.
6. As an administrator, I want the system to reject dangerous or unsupported regex syntax (such as lookarounds or ReDoS patterns) upon saving, so that the server and client remain stable and performant.
7. As a worship service operator, I want the rundown parser to automatically suggest numbers and books for our dynamic praise & worship song slots, so that I do not have to manually re-enter each hymn number into separate form cards.
8. As a worship service operator, I want to review and accept parsed song suggestions before they are committed, so that I retain full editorial control over weekly song selections.
9. As a worship service operator, I want unused song set slots in a slot family to produce zero slides in the presentation deck, so that services with fewer songs do not display blank or missing slides.
10. As a worship service operator, I want unmapped lines or surplus songs beyond our configured slots to be clearly displayed in an alert banner, so that no part of the rundown is lost or silently discarded.
11. As a system maintainer, I want existing church services and rundown imports to continue parsing with identical behavior, so that upgrading to SPEC-44 causes zero regressions.
12. As a developer, I want Go and TypeScript parser engines to execute against identical golden test vectors, so that browser preview and server presentation plans never drift.

## Implementation Decisions

1. **Parser Output Closed Vocabulary:**
   - The extraction targets remain strictly bound to the existing `parse.Rundown` and `WorshipFormFields` domain model (`serviceDate`, `sermonTitle`, `sermonSpeaker`, `scriptureReference`, `scriptureText`, `closingPrayerPerson`, `familyPrayerRequest`, `youthPrayerRequest`, `familyName`, `youthName`, `songSets`).
   - Profile rules map source text patterns to these known target keys. Arbitrary custom target keys are rejected.

2. **Database Storage & Immutability:**
   - Store profiles in a new SQLite table `rundown_parser_profiles` (`id`, `slug`, `title`, `description`, `rules_json`, `is_builtin`, `is_default`, `version`, `created_at`, `updated_at`).
   - Services track which parser profile and version was applied via optional `parser_profile_id` and `parser_profile_version` columns on `services`.
   - The initial migration seeds a `builtin-default` profile containing the exact pre-SPEC-44 hardcoded extraction rules.

3. **Dual-Engine Safe Regex Subset:**
   - Both Go (`internal/parse`) and TypeScript (`src/lib/parser.ts`) execute profile JSON configurations.
   - Named capture groups are normalized (e.g. `(?<name>...)` in JS, converted to `(?P<name>...)` in Go).
   - Regex flags are passed as arrays (e.g. `["i"]`). Inline flags `(?i)` and unsupported constructs (lookaheads, lookbehinds, backreferences) are forbidden and rejected during profile validation.

4. **Song Set Hybrid 3-Pass Matching & Omission Contract:**
   - Parser output separates song extractions into `songCandidates`: `{ label, bookCode, number, titleHint, section }`.
   - Matching against active `song_set_entries` runs in 3 passes:
     1. Match candidate label against `match_labels` configured on song set entries.
     2. Match remaining candidates sequentially into available slot family entries ordered by `position`.
     3. Collect any remaining candidates into `songOverflow` and mark unassigned slots in `songSlotsUnfilled`.
   - In `slide-plan.ts` and `internal/plan/plan.go`, song set entries with null or empty weekly input are omitted from the slide plan.

5. **Hub Operator Interaction Model:**
   - `POST /api/services/preview` returns `fields` and `songSetSuggestions`.
   - The operator form displays suggested songs with a visual indicator ("Suggested from Rundown") and an "Accept" action. Clicking "Parse" populates both structured fields and song sets simultaneously.

## Testing Decisions

- **Parity Golden Suite:** A suite of synthetic rundown fixtures (`tests/fixtures/parser-profiles/`) tested simultaneously against Go (`internal/parse`) and Node (`tests/parser-parity.test.mjs`) to verify identical token extraction across languages.
- **Absence Guards:** Executable defect-injection proofs verifying that unmapped lines are never discarded, invalid regexes are rejected on profile save, and unfilled song slots generate zero slides.
- **Backward Compatibility Proofs:** Automated regression tests verifying that legacy rundown text formats parse identically under the seeded `builtin-default` profile.
- **Strict Public Repository Compliance:** All test fixtures and sample data strictly use synthetic congregation names and references in compliance with `.constitution/project/public-repository.md`.

## Out of Scope

- Client-side visual canvas layout editing within the parser profile builder (layouts remain governed by Artifact Registry / `song_set_entries`).
- Machine-learning or AI-based natural language parsing (all parsing is deterministic rule- and pattern-driven).
- Dynamic creation of new physical database tables or runtime schema alterations per tenant.

## Further Notes

- SPEC-44 delivers the foundation for multi-congregation and multi-liturgy flexibility while preserving the proven architecture of Worship Presenter Web.
- The 6-ticket milestone breakdown ensures that backend schema and engine capabilities are fully verified with parity tests before admin and operator UI layers are integrated.
