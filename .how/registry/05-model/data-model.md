---
type: model
component: registry
layer: physical
created: 2026-08-18
updated: 2026-08-20
---

# Model — Registry (physical)

**Physical-shape decision (DEC-004, closed at G4):** own tables per new concept — not one
overloaded discriminator row on `artifact_templates`. See SDD Decision Summary for why. None of
the five new tables below exist yet ([MISSING] throughout); `artifact_templates` and
`service_registry_snapshots` are as-built.

```mermaid
erDiagram
  artifact_templates {
    TEXT id PK
    TEXT label
    TEXT base_type
    TEXT variable_name
    INTEGER ann_set_id
    TEXT payload
    TEXT updated_at
    TEXT seed_hash
    INTEGER position
  }
  song_set_entries {
    INTEGER id PK
    TEXT variable_name UK
    TEXT title
    INTEGER position
    TEXT updated_at
  }
  artifact_templates }o--o| song_set_entries : "mirrors (by variable_name, no FK)"
  song_set_layouts {
    TEXT role PK
    TEXT payload
    TEXT updated_at
    TEXT seed_hash
  }
  announcement_sets {
    INTEGER id PK
    TEXT label
    TEXT updated_at
  }
  announcement_set_slides {
    INTEGER id PK
    INTEGER ann_set_id FK
    TEXT label
    TEXT payload
    TEXT updated_at
    TEXT seed_hash
    INTEGER position
  }
  background_library_images {
    INTEGER id PK
    TEXT url
    INTEGER is_default
    TEXT created_at
    TEXT updated_at
  }
  song_books {
    TEXT book_code PK
    TEXT name
    INTEGER is_default
    TEXT updated_at
  }
  services ||--o{ service_registry_snapshots : "freeze"
  service_registry_snapshots {
    INTEGER service_id PK
    TEXT template_id PK
    INTEGER position
    TEXT label
    TEXT base_type
    TEXT payload
    TEXT updated_at
  }
  announcement_sets ||--o{ announcement_set_slides : "ordered slides"
  artifact_templates }o--o| announcement_sets : "ann-set marker references"
  services ||--o{ service_song_set_layouts : "freeze"
  service_song_set_layouts {
    INTEGER service_id PK
    TEXT role PK
    TEXT payload
    TEXT updated_at
  }
```

`services` and `hymns` are Hub-owned; every table above is Registry-owned (AD-16, AD-31, AD-33).
Diagram columns match the dictionary. `hymns.book_code` (Hub-owned, S3) is not redrawn here — it
is a plain TEXT column that a Song Book's `book_code` is expected to match, never a DB foreign
key across the two components' tables (no cross-component FK; checked in code where it matters,
same discipline as AD-31's write-path uniqueness).

## Entities

| Entity | Table | Identified by |
| --- | --- | --- |
| ArtifactTemplate | `artifact_templates` | `id` TEXT |
| SongSetEntry | `song_set_entries` | `variable_name` TEXT (`UNIQUE NOT NULL`, DB-enforced) — the identity/title/position master; the `artifact_templates` row with matching `variable_name` (`base_type='song-set-entry'`) is a derived mirror kept for spine placement, no FK |
| ServiceRegistrySnapshot | `service_registry_snapshots` | `(service_id, template_id)` |
| SongSetLayoutTrio (role) | `song_set_layouts` | `role` TEXT (`title`\|`verse`\|`reff`) — the **live** table Admin edits |
| ServiceSongSetLayoutTrio (role) | `service_song_set_layouts` | `(service_id, role)` — the **frozen** per-service copy (AD-16, reversed 2026-08-20) |
| AnnouncementSet | `announcement_sets` | `id` INTEGER |
| AnnouncementSetSlide | `announcement_set_slides` | `id` INTEGER |
| BackgroundLibraryImage | `background_library_images` | `id` INTEGER |
| SongBook | `song_books` | `book_code` TEXT |

## Data dictionary

| Table | Column | Type | Meaning |
| --- | --- | --- | --- |
| artifact_templates | id | TEXT PK | Stable spine-row identity |
| artifact_templates | label | TEXT | List label; for a Song Set entry this is its title (AD-18) |
| artifact_templates | base_type | TEXT | `general` \| `song-set-entry` \| `ann-set-marker` (AD-31; was `general`\|`song-set`\|`announcement`) |
| artifact_templates | variable_name | TEXT NULL | Set only when `base_type = 'song-set-entry'`; mirrors the matching `song_set_entries.variable_name` row for spine placement (AD-31) — no FK, kept in sync in code on create/rename/delete; carries no uniqueness constraint of its own, the real `UNIQUE NOT NULL` lives on `song_set_entries` |
| artifact_templates | ann_set_id | INTEGER NULL | Set only when `base_type = 'ann-set-marker'`; references `announcement_sets.id` in code (no DB `FOREIGN KEY`, same discipline) |
| song_set_entries | id | INTEGER PK | Row identity |
| song_set_entries | variable_name | TEXT `UNIQUE NOT NULL` | The entry's cross-boundary identity (AD-31); DB-level uniqueness, not code-checked — a deleted row's `variable_name` is hard-gone and MAY be reused by a later entry (owner ruling, 2026-08-20); no reservation, no tombstone |
| song_set_entries | title | TEXT | Entry title; mirrored onto the matching `artifact_templates.label` |
| song_set_entries | position | INTEGER | Spine order, independent counter from `artifact_templates.position` |
| song_set_entries | updated_at | TEXT | Optimistic-concurrency token |
| artifact_templates | payload | TEXT | Canvas layout JSON; NULL for `song-set-entry` and `ann-set-marker` rows — they carry no canvas of their own (AD-33) |
| artifact_templates | updated_at | TEXT | Optimistic-concurrency token |
| artifact_templates | seed_hash | TEXT | Whether Reset to shipped seed is available; NULL for `song-set-entry`/`ann-set-marker` rows (nothing to reset — a rename is the only mutable field) |
| artifact_templates | position | INTEGER | Spine order 0..N-1 with no gap |
| song_set_layouts | role | TEXT PK | `title` \| `verse` \| `reff` — exactly 3 rows, seeded once, never added to or removed from |
| song_set_layouts | payload | TEXT | Canvas layout JSON; `verse`/`reff` are authored on a blank canvas (no background field at authoring time, AD-33) |
| song_set_layouts | updated_at | TEXT | Optimistic-concurrency token |
| song_set_layouts | seed_hash | TEXT | Reset availability, same semantics as `artifact_templates` |
| announcement_sets | id | INTEGER PK | Set identity |
| announcement_sets | label | TEXT | Admin's name for the set (e.g. "Announcement 1") |
| announcement_sets | updated_at | TEXT | Optimistic-concurrency token for set-level edits (label rename) |
| announcement_set_slides | id | INTEGER PK | Slide identity within its set |
| announcement_set_slides | ann_set_id | INTEGER | Owning set |
| announcement_set_slides | label | TEXT | List label |
| announcement_set_slides | payload | TEXT | Canvas layout JSON — same shape and validation as a General (AD-15) |
| announcement_set_slides | updated_at | TEXT | Optimistic-concurrency token |
| announcement_set_slides | seed_hash | TEXT | Reset availability for the shipped seed sets (reference deck ann-set-1/2) |
| announcement_set_slides | position | INTEGER | Order 0..N-1 within `ann_set_id`, no gap |
| background_library_images | id | INTEGER PK | Image identity |
| background_library_images | url | TEXT | Resolves through the same shared helpers as any other Registry image (AD-8); images only (S10) — no colour/gradient row shape exists |
| background_library_images | is_default | INTEGER (0/1) | At most one row is 1 at a time, enforced in LC-15, never a partial-unique-index-only design (defense in depth: a code check runs regardless) |
| background_library_images | created_at | TEXT | Add time |
| background_library_images | updated_at | TEXT | Optimistic-concurrency token |
| song_books | book_code | TEXT PK | Matches `hymns.book_code` (Hub-owned); e.g. `SDAH` |
| song_books | name | TEXT | Display name |
| song_books | is_default | INTEGER (0/1) | At most one row is 1 at a time, same discipline as Background Library default |
| song_books | updated_at | TEXT | Optimistic-concurrency token |
| service_registry_snapshots | service_id | INTEGER PK | Hub Service; CASCADE on delete |
| service_registry_snapshots | template_id | TEXT PK | Frozen spine-row identity (may be a `general` or `song-set-entry` id) |
| service_registry_snapshots | position | INTEGER | Frozen order 0..N-1 |
| service_registry_snapshots | label | TEXT | Frozen list label |
| service_registry_snapshots | base_type | TEXT | Frozen entry key; no `slot`/`kind` column (AD-19) |
| service_registry_snapshots | payload | TEXT | Frozen layout JSON |
| service_registry_snapshots | updated_at | TEXT | Token copied from the live row at clone time |
| service_song_set_layouts | service_id | INTEGER PK | Hub Service; CASCADE on delete, same discipline as `service_registry_snapshots` |
| service_song_set_layouts | role | TEXT PK | `title` \| `verse` \| `reff` — frozen copy of `song_set_layouts.role`, exactly 3 rows per Service |
| service_song_set_layouts | payload | TEXT | Frozen trio layout JSON, copied from the live `song_set_layouts` row at freeze time |
| service_song_set_layouts | updated_at | TEXT | Token copied from the live row at clone time |

**Snapshot scope, extended by AD-35 and reversed for the trio (owner ruling, 2026-08-20).**
Creating or Syncing a Service clones `artifact_templates` (the spine) into
`service_registry_snapshots` exactly as before, **and now also** clones every
`announcement_set_slides` row belonging to a set any live marker on that spine references, into a
parallel `service_announcement_set_slides` table (same shape as `service_registry_snapshots`, keyed
`(service_id, ann_set_id, slide_id)`) — [MISSING], this design's own addition, not read from code.

**The shared `song_set_layouts` trio is now snapshotted too**, into a parallel
`service_song_set_layouts` table keyed `(service_id, role)` — [MISSING], this design's own
addition. An earlier draft of this design left the trio unfrozen, read live at generate/render time
the same way the plan reads other shared, non-per-service structure (AD-12); the owner ruled
freezing is better, so the trio now follows the same clone-on-create / Sync-only-replace discipline
as every other structural piece AD-16 clones. Editing the live trio today therefore does **not**
reach any existing Service — only a new Service created after the edit, or an existing Service
after an explicit Sync Artifact, sees it. This closes the inconsistency the earlier draft flagged
against UC-20 (`04-usecases/UC-20-deck-matches-payload.md`), which already described the trio as
part of "the Service's frozen structure" — that use case was right, and this data model now
matches it.

## Invariants

- Live `artifact_templates.position` unique and sequential after bootstrap, delete, and reorder
- Live `announcement_set_slides.position` unique and sequential per `ann_set_id`
- Exactly 3 `song_set_layouts` rows exist at all times (`title`, `verse`, `reff`); no add/remove path
- Exactly 3 `service_song_set_layouts` rows exist per Service after its snapshot freezes (`title`,
  `verse`, `reff`); cloned at creation, replaced whole on Sync — same discipline as
  `service_registry_snapshots` (AD-16, reversed 2026-08-20)
- At most one `song_set_entries` row per `variable_name` (AD-31, DB-enforced via `UNIQUE NOT NULL`);
  `artifact_templates` mirrors this identity for spine placement but carries no constraint of its
  own. A deleted row's `variable_name` is hard-gone and MAY be reused by a later row (owner ruling,
  2026-08-20)
- At most one `background_library_images.is_default = 1` row at a time (code-enforced)
- At most one `song_books.is_default = 1` row at a time (code-enforced)
- `ann_set_id` on a live `ann-set-marker` row must reference a live `announcement_sets.id`, checked in code (no DB `FOREIGN KEY`); a live marker referencing it blocks that set's own delete
- Snapshot `position` sequential per `service_id` (and per `ann_set_id` in the new service-side
  Announcement Set slide table) after clone/Sync
- `base_type`/`label` columns must agree with the payload on the same write (AD-18; agreement tests still debt)
- Seeder does not fill a missing live id after bootstrap, on any of the six live tables (AD-17)
- No `slot`/`kind` column on any table (AD-19)

## Physical notes

`RegistrySnapshot` in `src/lib/artifacts/registry-snapshot.ts` is the **live** map assembled per
plan build — a name clash with the `service_registry_snapshots` freeze; unchanged by this design.
Persisted Service plans read the frozen tables. Preview (no Service exists yet, so no snapshot
exists to read) reads the live tables directly, including `song_set_layouts` — the live table
itself never holds a frozen copy (that lives in `service_song_set_layouts`, see above). Every
Service that does have a snapshot reads its own `service_song_set_layouts` row, never
`song_set_layouts` directly.
