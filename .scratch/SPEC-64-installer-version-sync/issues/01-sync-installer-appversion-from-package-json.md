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

**Status:** ready-for-agent

- [ ] Read `installer/worship-deck.iss` (the `#define MyAppVersion` line and where `AppVersion` uses
      it), `scripts/build-desktop.mjs`'s `ISCC.exe` invocation, and `.github/workflows/release.yml`'s
      existing tag↔`package.json`↔`CHANGELOG.md` checks in full first — the fix should extend that
      same enforcement pattern, not invent a different one.
- [ ] `scripts/build-desktop.mjs` passes the current `package.json` `version` to `ISCC.exe` as a
      distinct command-line argument, before the `.iss` path (e.g.
      `spawnSync(isccBin, ['/DMyAppVersion=' + version, issFile], ...)`), so the compiled installer's
      embedded version always reflects `package.json`.
- [ ] **`worship-deck.iss`'s `#define MyAppVersion "0.1.0"` must be guarded, or the command-line
      override is silently lost (confirmed by peer review).** Inno Setup's preprocessor lets a plain,
      unconditional `#define` inside the script itself override a value passed via `/D` on the command
      line — so passing `/DMyAppVersion=...` while the `.iss` still unconditionally redefines it does
      nothing. Wrap it as `#ifndef MyAppVersion` / `#define MyAppVersion "0.1.0"` / `#endif` at minimum.
- [ ] **Go further: make the define mandatory (fail-closed), not a silent fallback (peer review's
      stronger recommendation, adopted here).** Change the guard in `installer/worship-deck.iss` to
      `#ifndef MyAppVersion` / `#error "MyAppVersion must be supplied via /D from package.json"` / `#endif`,
      and have `build-desktop.mjs` read and validate `package.json`'s `version` (checking it against standard
      semver format) once before invoking `ISCC.exe`. This keeps `package.json` as the single source of
      truth rather than leaving a second, independently-driftable literal in the `.iss` file for any
      direct/manual `ISCC.exe` invocation.
- [ ] **Do not overclaim what Inno Setup does with the version (peer review found no evidence for
      this in the script).** `MyAppVersion` is used only as `[Setup] AppVersion` — there is no
      `[Code]` section or other logic in `worship-deck.iss` implementing an upgrade/downgrade
      comparison. The actual, verifiable consequence of drift is stale Windows "Apps & features"
      metadata (the installed version string shown to the user), not a custom comparison failure —
      scope the ticket's own justification to that.
- [ ] **Prove the fix at the artifact level, not just the command construction (peer review's
      explicit ask).** After building in CI (`release.yml` on Windows runner), confirm the compiled
      `WorshipDeckSetup.exe`'s own file-properties version matches `package.json`'s value via
      `(Get-Item dist-installer\WorshipDeckSetup.exe).VersionInfo.FileVersion`. In unit tests, verify
      that `build-desktop.mjs` fails if `package.json` version is missing/invalid, and passes
      `/DMyAppVersion=<version>` in the `spawnSync` argument list.
- [ ] Note only, no action required this ticket: `package-lock.json` also carries a duplicate `0.1.0`
      literal (npm maintains it automatically, so it is not a third independent source to guard) and
      `scripts/build-desktop.mjs` has an unrelated dead fallback path still naming the pre-rename
      `WorshipPresenterSetup.exe` (harmless, the branch can't trigger) — both found by peer review,
      neither blocking this ticket.
- [ ] `release.yml`'s existing verification steps are otherwise unchanged — this ticket does not touch
      the tag↔`package.json`↔`CHANGELOG.md` chain, only closes the fourth, currently-unchecked corner
      (the `.iss` file) of the same version-agreement requirement.
