# 04: Global Entity Identity and Tombstone Schema Migration

**What to build:**
Lay the database foundation for distributed offline/online data synchronization:
1. Add `global_id TEXT UNIQUE NOT NULL` (UUIDv7) to all entities that participate in sync (`services`, `announcement_items`, `hymns`, `song_set_entries`, `background_library_images`).
2. Create migration helper that generates and backfills existing records with monotonic UUIDv7 keys.
3. Create `sync_tombstones` table (`id INTEGER PRIMARY KEY, global_id TEXT NOT NULL, entity_type TEXT NOT NULL, deleted_at TEXT NOT NULL, source_rev INTEGER NOT NULL, UNIQUE(global_id)`).
4. Update deletion handlers in Go HTTP API (`deleteService`, `deleteAnnouncementSetSlide`, etc.) to insert a tombstone record upon deletion rather than leaving no trace, preventing zombie resurrection during synchronization.
5. Introduce `sync_state` table to record `last_synced_cursor`, `server_revision`, and `device_id`.

**Blocked by:** 01-desktop-launcher-mutex-and-data-dir-resolution.md

**Status:** open

- [ ] Write schema migration adding `global_id` and unique indices to syncable tables in `internal/db`.
- [ ] Implement UUIDv7 generation helper in pure Go.
- [ ] Create `sync_tombstones` table and `sync_state` table.
- [ ] Update service and slide deletion queries to record tombstones.
- [ ] Add unit tests verifying schema migration backfills and tombstone creation on delete.
- [ ] Human verification check: Insert a service, delete it, and verify that a tombstone entry with the service's `global_id` is recorded in `sync_tombstones`.
