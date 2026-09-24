# 09: [WSD-H-09] Installer ships corpora, licenses, and notices with empty initial registry

**What to build:** In `installer/worship-deck.iss`, `scripts/build-desktop.mjs`, `internal/db/bootstrap.go`, and packaging scripts:
1. Systematic Reproduction & Diagnostic Pass:
   - First demonstrate and reproduce that `dist-desktop` and the installer package currently omit the `data/` directory (resulting in missing songbooks and scripture on fresh installations), documenting root causes before implementing packaging fixes.
2. Clean Database Seeding & Bundled Corpora (Owner Decision Q2):
   - In `internal/db/bootstrap.go`: completely disable the automatic seeding of the 38 demo templates from `data/default-registry.json` during initial database bootstrap. Fresh installations (both Windows installer and source-based installations) MUST start with an empty slide registry.
   - Retain automated bootstrap seeding for bundled hymnbooks (`data/song-book/sdah.json`) and scripture translations (`data/en/bible-translation/kjv.json`).
3. Packaging Pipeline Updates:
   - Update `scripts/build-desktop.mjs` and `installer/worship-deck.iss` to package and install into `{app}`:
     - `data/song-book/sdah.json`
     - `data/en/bible-translation/kjv.json`
     - `data/fonts/` (bundled TTF fonts from WSD-H-07)
     - `LICENSE`
     - `ATTRIBUTIONS.md`
     - `THIRD-PARTY-NOTICES` (from WSD-H-08)
   - Ensure runtime user data (`data.db`, `uploads/`, `logs/`) is strictly separated from `{app}` and routed to `%LOCALAPPDATA%\WorshipDeck\` per WSD-H-02.
4. Testing:
   - Add `tests/installer-corpora-staging.test.mjs` asserting that the desktop build staging directory contains all required corpora, licenses, and notices.
   - Add Go test in `internal/db/bootstrap_test.go` asserting that clean database initialization seeds SDAH and KJV while leaving slide registry tables completely empty.
   - Report installer file size before and after font/corpora inclusion in PR notes.

**Blocked by:** 02-wsd-h-02-desktop-mode-worshipdeck-data-folder, 08-wsd-h-08-branding-svgs-font-notices.

**Status:** open

- [ ] Run diagnostic pass reproducing missing corpora in installer staging.
- [ ] In `internal/db/bootstrap.go`: disable default seeding of 38 demo templates while keeping SDAH and KJV.
- [ ] In `scripts/build-desktop.mjs` and `installer/worship-deck.iss`: include `data/`, `LICENSE`, `ATTRIBUTIONS.md`, and notices.
- [ ] Add `tests/installer-corpora-staging.test.mjs` validating staged artifacts. Verify red first, then green.
- [ ] Add Go test in `internal/db/bootstrap_test.go` validating clean bootstrap state.
- [ ] Add `tests/installer-corpora-staging.test.mjs` to `package.json` `scripts.test`.
- [ ] Verify `go test ./...` and `npm test` pass cleanly.
