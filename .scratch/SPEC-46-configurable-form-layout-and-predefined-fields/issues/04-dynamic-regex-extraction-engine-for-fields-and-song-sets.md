# 04: Dynamic Regex Extraction Engine for Fields and Song Sets

**What to build:**
Extend the rundown parser in both Go (`internal/parse`) and TypeScript (`src/lib/parser.ts`) to execute dynamic extraction regexes for text/textarea predefined fields and per-entry song set regexes using the safe cross-runtime regex dialect, strictly enforcing that only date and worship title/header remain hardcoded while all other fields and song sets extract exclusively via admin-configured regexes, returning extracted values as non-destructive suggestions with single and "Accept All" controls.

**Blocked by:** SPEC-46-03

**Status:** done

- [x] Define and enforce the cross-runtime safe regex dialect (compatible with both Go RE2 and JavaScript `RegExp`: no lookarounds `(?=...)`, `(?<=...)`, no backreferences `\1`).
- [x] Enforce hardcoded extraction boundary: for all new services, ONLY `service_date` and Worship Title/Header are extracted via standard hardcoded rules. ALL other text fields and song set entries extract exclusively via their configured `extraction_regex`.
- [x] Extend Go rundown parsing to load active `predefined_fields` with `extraction_regex` and extract values into a dynamic suggestions map using named capture `(?<value>...)` or group 1 with first-match semantics.
- [x] Implement per-entry song set regex matching using `song_set_entries.extraction_regex`, capturing `(?<number>\d+)` and optional `(?<book>\w+)`, defaulting to the church's default song book code if `book` is omitted.
- [x] Mirror the dynamic field and per-entry song regex extraction logic in TypeScript (`src/lib/parser.ts` / `src/lib/parser-rules.ts`) to maintain golden fixture parity between browser client preview and Go server parsing.
- [x] Return parsed field suggestions alongside song set suggestions in the `/api/services/preview` response.
- [x] Implement conflict semantics for suggestion acceptance: "Accept All" fills empty fields and flags conflicting fields for operator confirmation.
- [x] Add unit and parity tests in Go and TypeScript verifying regex extraction across various bulletin formatting variations and song numbering styles.
