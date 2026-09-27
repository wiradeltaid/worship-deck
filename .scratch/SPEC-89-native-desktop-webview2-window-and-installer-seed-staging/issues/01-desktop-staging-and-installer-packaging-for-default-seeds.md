# 01: Desktop Staging, Executable Root Resolution, and Song-Set Layout Trio Self-Repair Seeding

**What to build:** In `scripts/build-desktop.mjs`, `cmd/api/main.go`, `internal/db/song_set_layout_seed.go`, and `tests/installer-corpora-staging.test.mjs`:

1. **Staging Pipeline (`scripts/build-desktop.mjs`)**:
   - Update `stageCorporaAndNotices(targetDir)`:
     - In addition to hymn corpora (`data/song-book/sdah.json`), Bible translation (`data/en/bible-translation/kjv.json`), fonts, and legal notices, copy:
       - `data/default-song-set-layouts.json` -> `targetDir/data/default-song-set-layouts.json`
       - `data/default-registry.json` -> `targetDir/data/default-registry.json`
       - `data/asset-map.json` -> `targetDir/data/asset-map.json`
     - Verify that all files are copied and readable.

2. **Executable-Relative Root Resolution (`cmd/api/main.go`)**:
   - In desktop mode, if `REPO_ROOT` is unset, check whether `data/` exists adjacent to `os.Executable()`.
   - If present, adopt the executable directory as `root`. This ensures immutable asset lookups succeed when `worship-deck.exe` is run from any working directory (e.g. from terminal outside `{app}`).

3. **Robust Song-Set Layout Trio Seeding & Self-Repair (`internal/db/song_set_layout_seed.go`)**:
   - In `EnsureSongSetLayoutSeeds(db, root)`:
     - If `seeds` cannot be loaded on a fresh database (`count == 0`), return an error rather than silently skipping.
     - If `count > 0`, self-repair missing trio roles: inspect presence of `title`, `verse`, and `reff`; insert any missing role from `seeds[role]` with seed hash stamped.
     - Backfill seed hashes for existing unedited rows.

4. **Staging & Seeder Guard Tests (`tests/installer-corpora-staging.test.mjs`, `internal/db/migrate_song_set_inputs_test.go`)**:
   - Assert `stageCorporaAndNotices(tempDir)` stages valid `default-song-set-layouts.json`, `default-registry.json`, and `asset-map.json`.
   - Assert `EnsureSongSetLayoutSeeds` seeds all three roles on a fresh database and repairs partial tables.
   - Defect injection proof: Verify missing seed file fails fresh database bootstrap.

Satisfies `FR-20`, `FR-21`, `UC-14`, `UC-15`, and `AD-33`.

**Blocked by:** none

**Status:** open

- [ ] In `scripts/build-desktop.mjs`:
      - Add `default-song-set-layouts.json`, `default-registry.json`, and `asset-map.json` to `stageCorporaAndNotices(targetDir)`.
- [ ] In `cmd/api/main.go`:
      - Resolve `root` relative to `os.Executable()` in desktop mode when adjacent `data/` exists.
- [ ] In `internal/db/song_set_layout_seed.go`:
      - Fail closed on fresh databases if seed file cannot be loaded; implement self-repair for partial trio rows.
- [ ] In `tests/installer-corpora-staging.test.mjs`:
      - Assert presence and validity of staged seed files; add defect injection proof.
- [ ] Verify `npm test` and `go test ./internal/db/...` pass.
