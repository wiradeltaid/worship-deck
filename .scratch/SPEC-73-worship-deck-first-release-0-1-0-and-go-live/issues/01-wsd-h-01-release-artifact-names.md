# 01: [WSD-H-01] Release artifact names and single checksum file

**What to build:** In `installer/worship-deck.iss`, `.github/workflows/release.yml`, `scripts/build-desktop.mjs`, and `tests/installer-version-sync.test.mjs`:
1. Update Inno Setup script to output `WorshipDeck-{#MyAppVersion}-x64-setup.exe` (`OutputBaseFilename=WorshipDeck-{#MyAppVersion}-x64-setup`).
2. Update release workflow `.github/workflows/release.yml` and desktop packaging scripts to produce and upload:
   - `WorshipDeck-<version>-x64-setup.exe`
   - Single checksum file `SHA256SUMS` formatted as `<sha256>  <filename>` (two spaces separating hash and file).
   - Strictly avoid generating unversioned aliases (e.g. `WorshipDeck-Setup.exe` or `WorshipDeckSetup.exe`) or `.txt` extensions (`SHA256SUMS.txt`).
3. Single source of truth for versioned artifact naming: read dynamically from `package.json` version rather than hardcoding literal strings.
4. Add absence guard test `tests/release-artifact-names.test.mjs` asserting zero occurrences of `WorshipDeckSetup` or `SHA256SUMS.txt` across tracked files (excluding historical changelogs and archived specs).
5. Update `tests/installer-version-sync.test.mjs` to enforce the new artifact pattern.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `installer/worship-deck.iss`, `.github/workflows/release.yml`, and `scripts/build-desktop.mjs`.
- [x] In `installer/worship-deck.iss`: set `OutputBaseFilename=WorshipDeck-{#MyAppVersion}-x64-setup`.
- [x] In `.github/workflows/release.yml`: update build artifact paths to `WorshipDeck-*-x64-setup.exe` and `SHA256SUMS`.
- [x] In `scripts/build-desktop.mjs`: align desktop packaging filenames with package version.
- [x] In `tests/installer-version-sync.test.mjs`: assert new versioned installer naming pattern.
- [x] Add `tests/release-artifact-names.test.mjs` asserting absence of legacy installer naming. Verify red first by injecting legacy name, then green.
- [x] Add `tests/release-artifact-names.test.mjs` to `package.json` `scripts.test`.
- [x] Verify `npm test` passes cleanly.
