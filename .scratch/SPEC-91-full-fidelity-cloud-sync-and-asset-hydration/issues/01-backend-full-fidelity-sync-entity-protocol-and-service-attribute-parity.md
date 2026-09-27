# 01: Schema Migration, Stable Global IDs, and Backend Sync Entity Protocol

**What to build:** In `internal/db/migrate_sync_announcement_sets.go`, `internal/httpapi/sync.go`, `package.json`, and `tests/sync-full-fidelity-entities.test.mjs`:

1. **Database Schema Migration (`internal/db/migrate_sync_announcement_sets.go`)**:
   - Add `global_id TEXT UNIQUE` to `announcement_sets`.
   - Add `global_id TEXT UNIQUE` and `ann_set_global_id TEXT` to `announcement_set_slides`.
   - Backfill existing rows with deterministic UUIDv7 values.
   - Add foreign key and indexing on `global_id`.

2. **Service Attribute Preservation (`internal/httpapi/sync.go`)**:
   - Update `SyncService` struct to include `HiddenSlideIDs json.RawMessage` and `EmergencyPatches json.RawMessage`.
   - In `syncPull`, update `sQuery` to select `COALESCE(hidden_slide_ids, '[]')` and `COALESCE(emergency_patches, '[]')`.
   - In `syncPush`, persist `hidden_slide_ids` and `emergency_patches` during service upsert.

3. **Full-Fidelity Presentation Entity Schemas & Parent-First Ordering (`internal/httpapi/sync.go`)**:
   - Extend `SyncMutations` to support:
     - `AnnouncementSets []SyncAnnouncementSet` (`global_id`, `label`, `updated_at`)
     - `AnnouncementSetSlides []SyncAnnouncementSetSlide` (`global_id`, `ann_set_global_id`, `label`, `payload`, `position`, `updated_at`, `seed_hash`)
     - `ArtifactTemplates []SyncArtifactTemplate` (`id`, `label`, `base_type`, `payload`, `updated_at`, `seed_hash`, `position`, `variable_name`, `ann_set_global_id`)
     - `ServiceRegistrySnapshots []SyncServiceRegistrySnapshot` (`service_global_id`, `template_id`, `position`, `label`, `base_type`, `payload`, `updated_at`, `variable_name`, `ann_set_global_id`)
     - `SongSetLayouts []SyncSongSetLayout` (`role`, `payload`, `updated_at`, `seed_hash`)
     - `ServiceSongSetLayouts []SyncServiceSongSetLayout` (`service_global_id`, `role`, `payload`, `updated_at`)
   - Enforce parent-first insertion: insert `announcement_sets` before `announcement_set_slides`; insert `services` before `service_registry_snapshots`.
   - Implement tombstone deletion handling for sets, slides, and templates.

4. **Automated Guard Tests & Registration (`package.json`, `tests/sync-full-fidelity-entities.test.mjs`)**:
   - Register `tests/sync-full-fidelity-entities.test.mjs` in `package.json` under `"test"` and `"smoke:spec-91"`.
   - Assert round-trip push and pull of all newly added entities and service attributes.
   - Defect injection proof: verify that omitting `hidden_slide_ids` or inverted parent-child insertion triggers test failure.

Satisfies `FR-40`, `FR-21`.

**Blocked by:** none

**Status:** closed

- [x] In `internal/db/migrate_sync_announcement_sets.go`:
      - Implement schema migration adding `global_id` columns and indexes.
- [x] In `internal/httpapi/sync.go`:
      - Add `hidden_slide_ids` and `emergency_patches` to `SyncService` query and upsert.
      - Implement sync protocol serialization, parent-first upsert, and tombstone handling.
- [x] In `package.json`:
      - Register `tests/sync-full-fidelity-entities.test.mjs` in `test` and `smoke:spec-91`.
- [x] In `tests/sync-full-fidelity-entities.test.mjs`:
      - Add unit and round-trip tests with defect injection.
