# SPEC-42-02 — Master Data Decoupling Verification, Multi-Instance Resilience, and Authoritative Test Inclusion

**What to build:**
Implement comprehensive behavioral verification tests proving that deleting song set slide instances from the main spine leaves `song_set_entries` master data strictly invariant, multiple insertions of the same song set can be deleted independently, and add `tests/smoke-spec-42.test.mjs` to `package.json`'s authoritative `test` script.

**Blocked by:** SPEC-42-01

**Status:** closed

- [x] Test Runner Registration (`package.json`):
  - Append `tests/smoke-spec-42.test.mjs` to the `test` script in `package.json` so it is executed in every full test suite pass.
- [x] Go API Decoupling Test Expansion (`internal/httpapi/song_set_entries_test.go`):
  - In `TestSongSetMasterDataDeckSequenceDecoupling`:
    - Snapshot complete master record (`variable_name`, `title`, `position`, `updated_at`) before deletion.
    - Delete the deck sequence template row.
    - Assert that all 4 master record fields are strictly identical before and after deletion (zero mutation).
    - Insert two deck instances for the same song set, delete the first, and verify the second instance survives with refreshed deck position while master record remains unchanged.
- [x] JavaScript Behavioral & Absence Smoke Tests (`tests/smoke-spec-42.test.mjs`):
  - Behavioral Test 1: Verify `DELETE /api/admin/artifacts/{id}` deletes only `artifact_templates` and does not mutate `song_set_entries`.
  - Behavioral Test 2: Verify that when all instances of a song set are removed from `artifact_templates`, the song set remains listed and available in the `New Slide` song sets catalog.
  - Executable Absence Guard: Statically scan `src/components/admin/ArtifactEditor.tsx` and assert that the per-row delete button is rendered unconditionally without `baseType` checks.
  - Defect Injection Proof: Verify that injecting any condition suppressing the delete button for `song-set-entry` causes the test to fail.
