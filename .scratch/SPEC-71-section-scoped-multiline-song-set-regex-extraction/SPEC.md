# SPEC-71 — Section-scoped multiline song set regex extraction

## Problem Statement

Following SPEC-68 (Expose and Edit Song Set Entry Extraction Regex) and SPEC-69 (Service Form Parser Profile Retirement and Song Overflow Removal), service intake song suggestions are driven 100% by dynamic patterns configured in `song_set_entries.extraction_regex`.

However, the intake parser currently evaluates song set regexes exclusively line-by-line (`for _, line := range lines` in `internal/parse/parser.go` and `for const line of lines` in `src/lib/parser-rules.ts`). In real-world church bulletins, orders of worship frequently contain multiple distinct worship segments—such as **Bible Talk** and **Divine Service**—where song entries share identical local line labels (for example, `[ ] Opening song : SDAH #614` in Bible Talk and `[ ] Opening Song : SDAH #508` in Divine Service).

Because line-by-line matching cannot perceive enclosing section headers (which appear lines earlier in the bulletin), and because `extractDynamicSongSetSuggestions` lacks the full `rawText` fallback already implemented for Predefined Fields (`extractDynamicFieldSuggestions`), operators cannot write section-scoped multiline/dotall patterns (such as `(?is)BIBLE\s+TALK.*?Opening\s+[Ss]ong\s*:\s*(?:(?<book>[A-Za-z]+)\s*)?#?\s*(?<number>\d+)`). Any regex attempting to anchor to a section header fails to match because the header and the song line reside on different lines. (Note: A pattern like `(?i)BT\s+Opening\s+Song...` fails doubly on standard bulletins because the bulletin text contains `BIBLE TALK` rather than `BT`, and the header is separated by several lines from the song item). Consequently, multiple song slots with identical labels either collide on the first occurrence in the text or fail extraction entirely.

## Solution

1. **Enable Full `rawText` Fallback for Song Set Dynamic Extraction:**
   - In Go (`internal/parse/parser.go:extractDynamicSongSetSuggestions`): When a pattern does not produce a valid, positive hymn suggestion on any individual line (`!found`), evaluate `p.re.FindStringSubmatch(rawText)`. If a match is found, extract named capture groups `number` and `book` (or numeric capture group $1), look up the hymn metadata, and populate `suggestions[p.variableName]` with `MatchKind: "regex"`.
   - In TypeScript (`src/lib/parser-rules.ts:extractSongSetEntries`): When a pattern does not produce a valid, positive hymn suggestion on any individual line (`!found`), evaluate `rawText.match(re)`. If matched, extract `number` and `book` (or numeric capture group $1), look up hymn information via `lookupHymnFn`, and populate `suggestions[varName]`.
   - `found` is strictly defined as "a valid, positive hymn suggestion (`songNumber > 0`) was produced", ensuring an unparseable or partial line match never suppresses an accurate full-text multiline fallback.
   - This aligns Song Set extraction with the established Predefined Field extraction architecture (`extractDynamicFieldSuggestions` / `extractPredefinedFields`), enabling full parity across both extraction engines.

2. **Support Section-Scoped Multiline DotAll Regexes:**
   - With `rawText` fallback enabled, operators can use dotall flags (`(?s)` or `(?is)`) and non-greedy traversals (`.*?`) to anchor song extractions to enclosing section headers (e.g. `(?is)BIBLE\s+TALK.*?Opening\s+[Ss]ong...` and `(?is)DIVINE\s+SERVICE.*?Opening\s+[Ss]ong...`).
   - Line-by-line matching continues to take precedence for single-line patterns, preserving zero-overhead execution for existing single-line regexes.

3. **Deterministic Multi-Section Synthetic Fixture Verification:**
   - Adhering strictly to public repository rules (`.constitution/project/public-repository.md`), all test fixtures MUST use purely synthetic participant names (e.g. "Leader One", "Speaker Two") or omit names, while retaining representative church bulletin structure: Bible Talk (Opening Hymn, Closing Hymn) and Divine Service (Opening Hymn, Closing Hymn, Intercessory Prayer responses).
   - Assert exact slot-to-song mapping for all configured slots without collisions or missed suggestions across Go unit tests, TypeScript parity tests, and Go HTTP API integration tests.

## User Stories

1. As a service coordinator pasting a church bulletin with multiple service segments (e.g. Bible Talk and Divine Service), I want song suggestions to correctly distinguish between identically labeled songs (such as Bible Talk Opening Song vs Divine Service Opening Song), so that each slot receives the correct hymn without manual reassignment.
2. As an administrator configuring `song_set_entries.extraction_regex`, I want the regex engine to support section-scoped patterns spanning multiple lines using `(?is)` dotall syntax, so that I can reliably target songs under specific service headings.
3. As a developer maintaining the intake parser, I want complete parity between Go and TypeScript dynamic extraction engines, with robust test fixtures asserting correct section-scoped extraction, fallback behavior, and HTTP API integration.

## Implementation Decisions

- **Parser Engine Alignment (`internal/parse/parser.go` & `src/lib/parser-rules.ts`):**
  - Keep the primary line-by-line loop as the fast path.
  - If a pattern does not produce a valid hymn suggestion on any individual line (`!found`), execute `FindStringSubmatch` (Go) / `.match()` (TS) against the full `rawText`.
  - Extract `number` and `book` from named capture groups (`(?P<number>...)` in Go, `(?<number>...)` in JS) or fallback numeric capture group $1.
  - In Go, sanitize lookup with `profile.ResolveBook(bookStr)` and `LookupHymnInBook(db, bookCode, num)`.
  - In TS, sanitize lookup with `lookupHymnFn(num, bookCode)`.

- **Regex Compatibility & Flags:**
  - In Go, `(?is)` is natively supported by `regexp.Compile`. `ValidateAndTranslateRegex` in `internal/parse/regex.go` preserves inline flags while translating `(?<name>...)` to `(?P<name>...)`.
  - In TypeScript, `compileProfileRegex` in `src/lib/parser-rules.ts` translates `(?([ims]+))` into JS RegExp flags `i`, `m`, and `s` (`dotAll`), allowing `.` to match newlines seamlessly.

- **Non-Destructive Intake Contract:**
  - Extracted suggestions remain non-destructive suggestions that hydrate into form inputs only when the operator accepts them or when fields are empty.

## Testing Decisions

- **Go Parser Regression Tests (`internal/parse/dynamic_extraction_test.go`):**
  - Verify section-scoped multiline regexes using `(?is)BIBLE\s+TALK.*?Opening\s+song...` and `(?is)DIVINE\s+SERVICE.*?Opening\s+Song...` against a synthetic multi-section bulletin fixture.
  - Assert that `parsed.SongSetSuggestions` maps Bible Talk Opening Song to SDAH #614 and Divine Service Opening Song to SDAH #508.
- **Node / TypeScript Parity Tests (`tests/dynamic-field-extraction.test.mjs`):**
  - Add test case verifying `extractSongSetEntries` correctly resolves section-scoped multiline regexes across `rawText`.
  - Assert correct song number and book resolution for multiple songs with identical labels across different sections.
- **HTTP API End-to-End Test (`internal/httpapi/services_field_values_test.go`):**
  - Test `POST /api/services/parse` with section-scoped regexes on `song_set_entries`, confirming `songSetSuggestions` returns distinct hymns for both Bible Talk and Divine Service slots.
- **Public Repo Synthetic Data Discipline:**
  - Ensure zero real congregation member names or sensitive personal data enter test files or mock bulletins.

## Out of Scope

- Modifying the predefined fields extraction engine (already supports `rawText` fallback).
- Changing canvas slide rendering or lyric split logic.
- Automatic inference of service sections without regex rules.
