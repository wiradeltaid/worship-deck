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

**Status:** ready-for-agent

- [ ] Read `internal/plan/snapshot.go`'s `LoadSnapshot` and `loadAnnouncementSlidesIntoSnapshot`,
      `internal/db/bootstrap.go`'s existing `service_registry_snapshots` insert (~line 677-715), and
      `internal/httpapi/registry.go`'s Sync Artifact insert (~line 796-836) in full before writing
      any schema or code — the new table and its write sites must mirror the existing pattern exactly,
      not invent a different shape.
- [ ] `internal/db/schema.sql` gains a `service_announcement_set_slides` table (plus a migration,
      following this repo's numbered-migration convention in `internal/db/migrate*.go`) carrying
      enough columns to reconstruct exactly what `loadAnnouncementSlidesIntoSnapshot` builds from the
      live table today: `service_id`, `ann_set_id`, `label`, `payload`, `position`, and a frozen copy
      of each referenced Announcement Set's own label (today read live from `announcement_sets` in
      the same function).
- [ ] At Service creation (`internal/db/bootstrap.go`) and at Sync Artifact
      (`internal/httpapi/registry.go`), the live `announcement_set_slides` rows for every Announcement
      Set currently placed on the spine are cloned into `service_announcement_set_slides` for that
      `service_id`, in the same transaction as the existing `service_registry_snapshots` write — both
      must commit or fail together.
- [ ] `loadAnnouncementSlidesIntoSnapshot` reads from `service_announcement_set_slides` when a frozen
      row exists for the given `serviceID` (mirroring `LoadSnapshot`'s own existing choice between
      `service_registry_snapshots` and live `artifact_templates`), and falls back to the live
      `announcement_set_slides` table exactly as today when the Service has no freeze yet, or for the
      live preview (`serviceID` 0).
- [ ] Deleting a Service's frozen snapshot (`DELETE FROM service_registry_snapshots WHERE service_id
      = ?`, the clear-before-rewrite calls inside `cloneLiveToService` and the Sync Artifact write
      site) also deletes the paired `service_announcement_set_slides` rows in the same transaction.
- [ ] **`service_announcement_set_slides` declares `FOREIGN KEY(service_id) REFERENCES
      services(id) ON DELETE CASCADE`**, matching `service_registry_snapshots` and
      `service_song_set_layouts` (`schema.sql` ~line 135-142, ~181-193) exactly, with
      `PRAGMA foreign_keys = ON` already set (`internal/db/db.go` ~line 43). This is required, not
      optional: actual Service deletion (`deleteService`, `internal/httpapi/services.go`) never issues
      an explicit `DELETE FROM service_registry_snapshots` — it relies entirely on this cascade.
      Without the same FK on the new table, deleting a Service would leave its frozen announcement
      rows orphaned forever, which is exactly the kind of silent drift this spec exists to close.
      Confirm with a test: delete a Service that has a frozen announcement snapshot, and assert its
      `service_announcement_set_slides` rows are gone.
- [ ] An unfrozen Service, and the live preview, keep rendering the exact same content they do today —
      this ticket is additive for frozen Services only.
