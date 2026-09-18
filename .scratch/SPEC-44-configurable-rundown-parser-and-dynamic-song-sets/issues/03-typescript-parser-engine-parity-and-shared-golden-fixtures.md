# 03: TypeScript Parser Engine Parity and Shared Golden Fixtures

**What to build:**
Implement the TypeScript profile runner in `src/lib/parser.ts` to mirror the Go engine's execution semantics exactly, verified against a shared suite of synthetic golden test fixtures.

**Blocked by:** 02 (Configurable Parsing Engine in Go)

**Status:** closed

- [x] Refactor `src/lib/parser.ts` to interpret parser profile JSON configurations, applying identical preprocessing, regex evaluation with array flags (`["i"]`), and postprocessing rules.
- [x] Establish a suite of synthetic golden test fixtures under `tests/fixtures/parser-profiles/` covering English, Indonesian, standard Adventist rundown formats, multi-song praise sets, and dense liturgical bulletins.
- [x] Implement automated cross-engine parity test in Node (`tests/parser-parity.test.mjs`) and Go (`internal/parse/parity_test.go`) asserting 100% identical parsed outputs for all golden fixtures.
- [x] Verify that all test fixtures comply strictly with `.constitution/project/public-repository.md` (no real congregation names or private data).
