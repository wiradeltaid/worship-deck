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
      following this repo's integer `data_version` convention in `internal/db/migrate.go` bumping from 11 to 12)
      carrying enough columns to reconstruct exactly what `loadAnnouncementSlidesIntoSnapshot` builds from the
      live table today: `service_id`, `ann_set_id`, `label`, `payload`, `position`, and a frozen copy
      of each referenced Announcement Set's own label (today read live from `announcement_sets` in
      the same function).
- [ ] At Service creation (`internal/db/bootstrap.go`) and at Sync Artifact
      (`internal/httpapi/registry.go`), the live `announcement_set_slides` rows for every Announcement
      Set currently placed on the spine are cloned into `service_announcement_set_slides` for that
      `service_id`, in the same transaction as the existing `service_registry_snapshots` write — both
      must commit or fail together. Ensure writes respect SQLite `MaxOpenConns(1)` by using the active transaction handle.
- [ ] **The freeze predicate is the Service's own freeze state (`services.registry_snapshot_at IS NOT NULL`),
      not `service_announcement_set_slides` row existence (corrected after peer-review rounds found the naive version broken).**
      An Announcement Set with zero slides at freeze time freezes with zero child rows in the new table —
      indistinguishable from "never frozen" if row-count is the test. Use a single shared helper
      `serviceIsRegistryFrozen(db, serviceID) bool` checking `registry_snapshot_at IS NOT NULL` across both
      `LoadSnapshot` and `loadAnnouncementSlidesIntoSnapshot`. If frozen, read `service_announcement_set_slides`
      even when it has zero rows for this Service; otherwise (unfrozen, or the live preview at `serviceID` 0)
      read live from `announcement_set_slides`. State the regression test explicitly: freeze a Service whose
      Announcement Set has zero slides, add a live slide afterward, and assert the frozen Service still
      shows nothing for it.
- [ ] **`cloneLiveToService` must also start persisting `variable_name` and `ann_set_id` on the
      `service_registry_snapshots` rows it writes (a separate, pre-existing gap in the same function
      this spec already touches, found by the same second review round — narrows this spec's Out of
      Scope, see SPEC.md).** Today it selects/inserts only `id, label, base_type, payload, updated_at`,
      leaving both columns NULL; Sync Artifact's own write (`internal/httpapi/registry.go`) already
      selects/inserts both correctly. `LoadSnapshot`'s `COALESCE(s.ann_set_id, a.ann_set_id)` masks this
      by falling back to the *live* marker's `ann_set_id` whenever the snapshot's own column is NULL —
      meaning a Service frozen at creation (never yet Synced) has its `ann-set-marker` rows still
      tracking whatever the live marker points at *right now*, so retargeting or removing that live
      marker later changes which Announcement Set an already-frozen Service shows. Fix
      `cloneLiveToService` to match Sync Artifact's own `SELECT`/`INSERT` shape for these two columns.
      State the test: create a Service (freezing it), retarget or delete the live marker's Announcement
      Set association afterward, and assert the frozen Service's rendered announcement content and
      marker identity are unaffected.
- [ ] **Decide and implement the upgrade path for Services already frozen before this ships.**
      `migrateSnapshots` only processes Services where `registry_snapshot_at IS NULL`, so an
      already-frozen Service will never get an initial `service_announcement_set_slides` row from that
      path, and `cloneLiveToService` must NOT be re-executed on frozen services (it destructively deletes
      and rewrites snapshots). Add a companion one-time migration function (bump `data_version` to 12 in
      `internal/db/migrate.go`) that narrowly clones *today's* live announcement content into `service_announcement_set_slides`
      for every Service that already has `registry_snapshot_at IS NOT NULL`, without touching existing snapshots.
- [ ] `loadAnnouncementSlidesIntoSnapshot` reads from `service_announcement_set_slides` when `serviceIsRegistryFrozen`
      is true for the given `serviceID` (per the corrected predicate above), and falls back to the
      live `announcement_set_slides` table exactly as today when the Service has no freeze yet, or for
      the live preview (`serviceID` 0).
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
