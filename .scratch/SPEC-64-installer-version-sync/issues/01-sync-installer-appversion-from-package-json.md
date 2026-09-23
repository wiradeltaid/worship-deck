# 01: The Windows installer's version metadata is sourced from package.json, not hand-maintained

**What to build:** `installer/worship-deck.iss` line 5 declares `#define MyAppVersion "0.1.0"` as a
plain string literal — nothing ties it to `package.json`'s own `version` field. `release.yml`'s
"Tag agrees with package.json version" step (lines 27-35) checks the git tag against
`package.json`, and its "Changelog has a section for this tag" step checks `CHANGELOG.md` against
the same tag — but neither step touches `worship-deck.iss` at all, and
`scripts/build-desktop.mjs`'s `spawnSync(isccBin, [issFile], ...)` call (~line 92) passes no version
override to `ISCC.exe`. The two values happen to agree today (both `0.1.0`) purely by coincidence of
never having been changed independently. The next version bump will pass every existing release gate
while silently shipping an installer whose Windows "Apps & features" metadata still reads the old
version. (No repo-specific Inno Setup upgrade/downgrade comparison logic exists to also be
affected — confirmed by peer review; the concrete, verifiable consequence is stale installed-app
metadata, not a comparison failure.)

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `installer/worship-deck.iss`, `scripts/build-desktop.mjs`, and `.github/workflows/release.yml`.
- [x] `scripts/build-desktop.mjs` reads and validates `package.json` semver version and passes
      `'/DMyAppVersion=' + appVersion` to `ISCC.exe`.
- [x] `installer/worship-deck.iss` wraps `MyAppVersion` in fail-closed `#ifndef MyAppVersion` /
      `#error "MyAppVersion must be supplied via /D from package.json"` / `#endif`.
- [x] Sourced installer version strictly from `package.json` to prevent Windows "Apps & features"
      version drift.
- [x] Added automated artifact-level file version verification in `.github/workflows/release.yml`
      and unit tests in `tests/installer-version-sync.test.mjs`.
- [x] Cleaned up dead references to pre-rename `WorshipPresenterSetup.exe`.
- [x] Existing tag agreement and release verification steps preserved.
