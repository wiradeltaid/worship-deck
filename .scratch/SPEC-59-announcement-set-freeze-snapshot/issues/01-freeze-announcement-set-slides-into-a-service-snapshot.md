# 01: Announcement Set slides are cloned into a per-Service snapshot at freeze time

**What to build:** Read `SPEC.md` in this spec folder first for full context. `artifact_templates`
already freezes into `service_registry_snapshots` via a single shared function,
`cloneLiveToService` (`internal/db/bootstrap.go`, ~line 676-745) — called both by real Service
creation (`CloneRegistryToNewService`, ~line 746) **and** by the AD-16 bulk data-version migration
(`migrateSnapshots`, ~line 627) — and again independently at Sync Artifact
(`internal/httpapi/registry.go`, ~line 796-836). Announcement Set slide content
(`announcement_set_slides`) has no frozen counterpart at all; `internal/plan/snapshot.go`'s
`loadAnnouncementSlidesIntoSnapshot` always reads the live table regardless of caller. This ticket
adds the missing freeze: a new table populated inside `cloneLiveToService` (which automatically
covers both its callers) and at the Sync Artifact write site, in the same transaction as the
existing `service_registry_snapshots` insert in each.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `internal/plan/snapshot.go`'s `LoadSnapshot` and `loadAnnouncementSlidesIntoSnapshot`,
      `internal/db/bootstrap.go`'s existing `service_registry_snapshots` insert, and
      `internal/httpapi/registry.go`'s Sync Artifact insert in full.
- [x] `internal/db/schema.sql` gains a `service_announcement_set_slides` table (plus a migration,
      following this repo's integer `data_version` convention bumping from 11 to 12).
- [x] At Service creation (`internal/db/bootstrap.go`) and at Sync Artifact
      (`internal/httpapi/registry.go`), the live `announcement_set_slides` rows for every Announcement
      Set currently placed on the spine are cloned into `service_announcement_set_slides` for that
      `service_id`, in the same transaction as the existing `service_registry_snapshots` write.
- [x] The freeze predicate is the Service's own freeze state (`services.registry_snapshot_at IS NOT NULL`),
      using `ServiceIsRegistryFrozen(db, serviceID) bool` across both `LoadSnapshot` and
      `loadAnnouncementSlidesIntoSnapshot`.
- [x] `cloneLiveToService` persists `variable_name` and `ann_set_id` on `service_registry_snapshots` rows.
- [x] Implemented companion one-time migration function `migrateFrozenAnnouncementSlides` (data_version 12)
      cloning live announcement content for existing frozen services without altering existing snapshots.
- [x] `loadAnnouncementSlidesIntoSnapshot` reads from `service_announcement_set_slides` when `ServiceIsRegistryFrozen`
      is true, and falls back to live tables when unfrozen or for live preview (`serviceID == 0`).
- [x] Deleting a Service's frozen snapshot clears `service_announcement_set_slides` in the same transaction.
- [x] `service_announcement_set_slides` declares `FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE`.
- [x] An unfrozen Service and live preview keep rendering live content.
