# 16: [WSD-H-17] README restructure after v0.1.0 publication

**What to build:** In `README.md`, `README.<locale>.md` (all 9 translations), and `docs/`:
1. Post-Release Restructure (WDI Preset 1 & plan §14.1):
   - Restructure `README.md` to place `## Installation` before `## Features` per `readme-guideline.md`.
   - Compress `README.md` to under 100 lines: migrate deep sections (`## Making it yours`, `## Shipped corpora`, `## Deployment`, `## Project history`) into dedicated documents under `docs/` and link them cleanly.
   - Update download buttons to link directly to the published GitHub release asset:
     `https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe` along with direct links to `SHA256SUMS` and the releases index.
   - Keep SmartScreen warning guidance prominent near download links.
2. Synchronize Translations:
   - Apply the exact same condensed structure, section ordering, and download links across all 9 translated READMEs.
3. Verification:
   - Add `tests/readme-structure.test.mjs` asserting that all 10 README files stay under 100 lines and follow the prescribed section order (`Installation` preceding `Features`). Verify red first, then green.

**Blocked by:** 13-wsd-h-13-readme-translations-docs-match-build, 14-wsd-h-14-legal-copies-ops-threat-model-aligned, 15-wsd-h-15-public-facts-file.
*(External Milestone Prerequisite: Owner B-06 clean Windows VM sign-off and Owner B-07 publication of GitHub Release v0.1.0. This ticket is explicitly post-publication work and is excluded from pre-tag release-readiness assertions).*

**Status:** open

- [ ] Confirm Owner B-06 clean-VM test and Owner B-07 release publication completed.
- [ ] Read `readme-guideline.md` and `plan/worship-deck.md` §14.1.
- [ ] Move detailed deployment and corpora sections from `README.md` into `docs/`.
- [ ] Reorder sections so Installation precedes Features, keeping length under 100 lines.
- [ ] Update download links to point to the published v0.1.0 release asset and `SHA256SUMS`.
- [ ] Synchronize all 9 `README.<locale>.md` translations.
- [ ] Add `tests/readme-structure.test.mjs` verifying line count and section sequence. Verify red first, then green.
- [ ] Add `tests/readme-structure.test.mjs` to `package.json` `scripts.test`.
- [ ] Verify `npm test` passes cleanly.
