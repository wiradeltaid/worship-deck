---
type: course-correction
id: DEC-078
status: superseded
accepted_by: "kodesh87 (2026-09-28)"
touches:
  - .how/_platform/ARCHITECTURE-SPINE.md
  - .how/registry/SDD-registry.md
  - .control/registry/decisions.yaml
supersedes: AD-17
superseded_by: DEC-080
created: '2026-09-28'
---

# DEC-078 — Administrator Factory Reset Operation Narrows AD-17

## Decision

> **An authenticated Administrator may explicitly initiate a whole-application Factory Reset.**
> This decision **supersedes AD-17 in part — its bulk re-seed prohibition clause only**:
> *"Restoring shipped content stays possible as an explicit administrator action — Reset-from-seed
> per template, per AD-11 — never as a side effect of a restart, and never as a bulk re-seed of a live database."*
>
> That clause is narrowed: bulk re-seeding remains **strictly forbidden** as an automatic startup,
> recovery, or background process. However, an **explicit, authenticated, and double-confirmed
> Administrator action** (`POST /api/admin/reset-factory`) is officially authorized to perform a clean
> factory restoration.
>
> **Exact Destructive Boundary of Factory Reset:**
> 1. **Tables Truncated/Cleared**:
>    - User worship services and snapshots: `services`, `service_field_values`, `service_form_layout_snapshots`,
>      `service_registry_snapshots`, `service_song_set_layouts`.
>    - User announcement items: `announcement_items`.
>    - Sync state: `sync_tombstones`, `sync_device_mutations`.
>    - Authored custom templates (`seed_hash IS NULL`) and non-default songbooks.
> 2. **Tables Preserved / Re-seeded**:
>    - `accounts`: User accounts are preserved so the administrator remains logged in.
>    - `settings`: Preserved, with version markers refreshed.
>    - `artifact_templates`: Restored to canonical shipped seed (`data/default-registry.json` and `data/asset-map.json`).
>    - `song_set_layouts`: Restored to canonical layout trio (`data/default-song-set-layouts.json`).
>    - `song_books` & `hymns`: Restored to default SDAH (`data/song-book/sdah.json`).
>    - `bible_translations` & `bible_verses`: Restored to KJV (`data/en/bible-translation/kjv.json`).
> 3. **Filesystem Uploads Cleaned**:
>    - Uploaded media in `./data/uploads/` (or `uploadsDir()`) are purged, strictly preserving `./data/fonts/`
>      and shipped bundled fonts.
> 4. **Authorization & Security**:
>    - Unauthenticated callers receive HTTP 401 Unauthorized.
>    - Authenticated non-admin callers receive HTTP 403 Forbidden.

## Why

During manual desktop testing, operators required an in-app mechanism to wipe corrupted test data and
restore fresh out-of-the-box defaults without manual filesystem navigation or command-line database deletion.
AD-17 prohibited bulk re-seeding to prevent automatic restart resurrection of deleted templates; narrowing
AD-17 to allow an explicit, interactive, confirmed admin operation satisfies the operator maintenance need
while strictly maintaining AD-17's prohibition against automatic or implicit re-seeding on restart.

## Cost, accepted

- Existing services and custom templates are permanently removed on confirmed reset.
- Operators are protected by an explicit double-confirmation dialog in the UI and strict admin authentication.
