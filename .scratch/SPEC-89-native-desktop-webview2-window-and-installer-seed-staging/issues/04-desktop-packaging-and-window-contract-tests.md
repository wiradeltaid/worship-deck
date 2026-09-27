# 04: Desktop Packaging, Window Lifecycle, and Seeder End-to-End Contract Tests

**What to build:** In `tests/desktop-webview2-contract.test.mjs`, `internal/desktop/desktop_test.go`, and `tests/installer-corpora-staging.test.mjs`:

1. **Packaging & Subsystem Flags Verification (`tests/desktop-webview2-contract.test.mjs`)**:
   - Assert `scripts/build-desktop.mjs` passes `-H=windowsgui` when compiling the Go desktop binary for Windows.
   - Assert `scripts/build-desktop.mjs` stages `default-song-set-layouts.json`, `default-registry.json`, and `asset-map.json`.
   - Assert `installer/worship-deck.iss` packages `{app}\data\*` and executes with `--desktop`.

2. **Go Desktop Module & Process Seam Tests (`internal/desktop/desktop_test.go`)**:
   - Test `RunDesktopWindow` fallback behavior when URL is provided.
   - Test single-instance mutex focus restoration logic, window title resolution, and taskbar flash fallback.
   - Test graceful shutdown sequence and verify runtime info removal.
   - Verify pure Go compilation with `CGO_ENABLED=0` and `GOOS=windows`.

3. **End-to-End Staged Database Bootstrap Test (`tests/installer-corpora-staging.test.mjs`)**:
   - Assemble mock staging directory using `stageCorporaAndNotices(tempDir)`.
   - Run Go DB bootstrap against a fresh database using `tempDir` as root:
     - Assert `song_set_layouts` table has exactly 3 rows (`title`, `verse`, `reff`).
     - Assert each row has valid JSON payload and matching `seed_hash`.
     - Assert missing seed file fails bootstrap on a fresh database.

4. **Absence Guard**:
   - Add guard verifying zero lingering console-mode flags or missing seed files in desktop packaging.
   - Real-file defect injection proofs:
     - Mutate `scripts/build-desktop.mjs` to remove `-H=windowsgui` -> test fails red.
     - Mutate `scripts/build-desktop.mjs` to omit `default-song-set-layouts.json` -> test fails red.

Satisfies `FR-20`, `FR-21`, `UC-14`, `UC-15`, `AD-30`, and `AD-33`.

**Blocked by:** SPEC-89-03

**Status:** open

- [ ] In `tests/desktop-webview2-contract.test.mjs`:
      - Implement contract assertions for desktop build flags, seed staging, and installer packaging.
      - Add defect injection proofs for `-H=windowsgui` and seed staging.
- [ ] In `tests/installer-corpora-staging.test.mjs`:
      - Add end-to-end staged bootstrap verification for song-set layout trio.
- [ ] In `internal/desktop/desktop_test.go`:
      - Add unit tests for window options, graceful shutdown seams, and fallback logic.
- [ ] Add `tests/desktop-webview2-contract.test.mjs` to `package.json` `scripts.test`.
- [ ] Verify full test suite passes cleanly.
