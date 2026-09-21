# 02: Configurable Parsing Engine in Go

**What to build:**
Refactor the Go rundown parsing package (`internal/parse`) to interpret parser profile rules dynamically instead of relying on hardcoded regex literals, supporting custom section headers, role labels, hymn numbering patterns, and unmapped line collection.

**Blocked by:** 01 (Parser Profile Schema and Built-in Rules Migration)

**Status:** closed

- [x] Implement rule execution engine in `internal/parse` that executes preprocessing (prefix stripping, timing extraction), section delimitation, field extraction rules with named capture groups, and postprocessing.
- [x] Support named capture groups and translate JS-style `(?<name>...)` to Go RE2 `(?P<name>...)` while rejecting unsupported lookarounds and backreferences.
- [x] Support multi-book hymn numbering patterns (e.g. `(?<book>SDAH|NKI|KJ)?\s*#?\s*(?<number>\d{1,4})`) and extract song candidate lists.
- [x] Preserve unmapped lines collection so unmatched text lines are surfaced rather than silently discarded.
- [x] Unit tests in `internal/parse` prove that running the `builtin-default` profile produces byte-for-byte identical output to the previous hardcoded implementation across all existing test rundowns.
