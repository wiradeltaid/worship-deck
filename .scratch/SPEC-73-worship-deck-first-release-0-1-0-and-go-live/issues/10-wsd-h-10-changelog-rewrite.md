# 10: [WSD-H-10] CHANGELOG 0.1.0 rewrite from actual release build

**What to build:** In `CHANGELOG.md`:
1. Rewrite Section `## [0.1.0]`:
   - Rewrite the entire 0.1.0 release entry grounded strictly in the actual capabilities of the release build, using the approved feature-name list (WSD-H-12).
   - Strip all references to non-existent features: in-app updater, webhook chat intake (WSD-H-05), 38 slide templates, speaker notes, and retired parser profiles.
   - Strip all internal method identifiers (`DEC-`, `SPEC-`, `FR-`, `ODR-`).
   - Strip internal stack migration chronology (e.g. "Migrated ... from prior stack").
   - Eliminate all em-dashes (`—` / U+2014) and en-dashes (`–` / U+2013), conforming strictly to WDI public copy standards.
   - Plainly articulate system boundaries and limitations (bundled hymnbooks and scripture in English, mobile remote control requires server installation, manual sync and desktop installer are experimental).
2. Clean Header Hygiene:
   - Remove references to in-app updaters in the opening preamble lines of `CHANGELOG.md`.
   - Set release date placeholder to be finalized upon tag creation.
3. Verification & Absence Guard:
   - Add `tests/changelog-guard.test.mjs` asserting that the `[0.1.0]` section contains zero internal IDs (`DEC-`, `SPEC-`, `FR-`), no em/en dashes, and none of the prohibited terms: "template", "parser profile", "webhook", "projector", "updater". Verify red first on today's file, then green.
   - Verify that the GitHub Actions release workflow changelog extraction step (`release.yml:37-59`) extracts the section cleanly.

**Blocked by:** 09-wsd-h-09-installer-ships-corpora-licenses-notices, 12-wsd-h-12-feature-name-list-and-app-labels, 13-wsd-h-13-readme-translations-docs-match-build.

**Status:** closed

- [x] Read current `CHANGELOG.md` and review handover §1 WSD-H-10 table.
- [x] Rewrite preamble and `## [0.1.0]` section based strictly on actual release build features.
- [x] Ensure zero internal IDs, zero dashes (em/en), and accurate boundary notes.
- [x] Add `tests/changelog-guard.test.mjs` asserting absence of prohibited terms and dashes. Verify red first, then green.
- [x] Add `tests/changelog-guard.test.mjs` to `package.json` `scripts.test`.
- [x] Verify `release.yml` changelog parser compatibility locally and ensure `npm test` passes cleanly.
