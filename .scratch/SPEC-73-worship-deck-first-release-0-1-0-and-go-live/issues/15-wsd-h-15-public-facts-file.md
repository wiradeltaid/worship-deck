# 15: [WSD-H-15] Public facts file establishment (K7)

**What to build:** In `docs/public-facts.yaml` and test files:
1. Establish Single Public Facts Manifest:
   - Create `docs/public-facts.yaml` following the WDI standard pattern (matching `wira-desk/docs/public-facts.yaml`).
   - Each fact item must declare:
     - `id`: unique identifier (e.g. `product_version`, `installer_filename`, `installer_checksum_filename`, `bundled_font_families_count`, `bundled_song_books_count`)
     - `value`: factual value
     - `derived_from`: source file path and pattern/expression (e.g. `package.json:version`)
     - `appears_in`: array of public surfaces where this fact appears (e.g. `README.md`, `wiradeltaid-web`)
2. Automated Fact Derivation Test:
   - Add `tests/public-facts.test.mjs` that dynamically reads `docs/public-facts.yaml`, resolves each `derived_from` source file, and asserts that `value` matches the derived source value exactly.
   - Assert that modifying any source fact or manifest entry fails the test. Verify red first by injecting a mismatched test value, then green.

**Blocked by:** 01-wsd-h-01-release-artifact-names.

**Status:** open

- [ ] Inspect public facts convention in `wira-desk/docs/public-facts.yaml`.
- [ ] Author `docs/public-facts.yaml` covering version, installer name, font count (35), and corpora facts.
- [ ] Add `tests/public-facts.test.mjs` verifying fact integrity against derived sources. Verify red first, then green.
- [ ] Add `tests/public-facts.test.mjs` to `package.json` `scripts.test`.
- [ ] Verify `npm test` passes cleanly.
