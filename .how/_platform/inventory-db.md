---
type: inventory
kind: db
scope: _platform
status: draft
created: '2026-08-18'
updated: '2026-09-22'
derived_from: code
verified: '06edf67'
---

# Inventory — tables

Derived by `inventory.py` from `CREATE TABLE IF NOT EXISTS` in `src/lib/db/index.ts`. Numbers are stable; new rows take the next number. Numbers 12–13 were never live tables (one-shot rebuild names) and MUST NOT be reused.

## Rows

| No | Table | Owning component | What it holds | Key columns | Status |
| --- | --- | --- | --- | --- | --- |
| 4 | accounts | hub | Per-person accounts | id | published |
| 3 | announcement_items | hub | Announcement list | id | published |
| 15 | announcement_set_slides | registry | Slides inside an Announcement Set | id | published |
| 16 | announcement_sets | registry | Admin-authored Announcement Sets (DEC-004) | id | published |
| 11 | artifact_templates | registry | Slide order and layout | id | published |
| 17 | background_library_images | registry | Admin-owned background image library (S10) | id | published |
| 18 | bible_book_names | presenter | Book names per translation | translation_code, book_id | published |
| 9 | bible_books | presenter | Book names per translation | id | published |
| 8 | bible_translations | presenter | Translation corpora | code | published |
| 10 | bible_verses | presenter | Verse text | id, book_id, chapter, verse, translation_code | published |
| 23 | form_group_slots | hub | Slots inside a form grouping, each bound to one field widget (SPEC-46) | id, grouping_id, sort_order, layout_id, widget_kind, ref_key | published |
| 24 | form_groupings | hub | Groupings inside a form layout (SPEC-46) | id, layout_id, sort_order | published |
| 25 | form_layouts | hub | Named Service form layouts (SPEC-46) | id | published |
| 2 | hymns | hub | Song Book entries | id, book_code, number | published |
| 5 | login_attempts | hub | Login trail | id | published |
| 26 | predefined_fields | hub | Admin-defined Service form fields (SPEC-46) | id | published |
| 6 | revoked_sessions | hub | Revoked sessions | sid | published |
| 27 | rundown_parser_profiles | hub | Configurable rundown parsing rule profiles (SPEC-44) | id | published |
| 28 | service_field_values | hub | Per-Service values entered for predefined fields (SPEC-46) | service_id, variable_name | published |
| 29 | service_form_layout_snapshots | hub | Per-Service frozen copy of the form layout (SPEC-46) | service_id | published |
| 14 | service_registry_snapshots | registry | Per-Service frozen registry clone (AD-16) | service_id, template_id | published |
| 19 | service_song_set_layouts | registry | Per-Service frozen copy of the shared trio (S13 R4) | service_id, role | published |
| 1 | services | hub | One dated Service and the week's payload | id | published |
| 7 | settings | hub | Application settings | key | published |
| 20 | song_books | registry | Song book registry rows (DEC-005 / AD-36) | book_code | published |
| 30 | song_set_entries | registry | Admin-configurable list of song-set entries (Master Data, DEC-004/AD-31) | id | published |
| 21 | song_set_inputs | hub | Per-Service weekly song-set input: number, book, background, lyric override | service_id, variable_name | published |
| 22 | song_set_layouts | registry | Shared Title / Verse / Reff layout trio (S4) | role | published |

## Findings

- Rows 12 (`hymns_with_book_code`) and 13 (`bible_verses_with_translation_code`) were catalogued as live tables. They are one-shot rebuild names in the same DDL file, then `RENAME TO` the live tables. Dropped from the rows; those numbers MUST NOT be reused. W1's freeze table is therefore **14**.
- `service_registry_snapshots` is Registry-owned (AD-16). `services.registry_snapshot_at` is a Hub column on table 1, not a separate table.
- **Plan vs code (DEC-004, not yet built):** table 3 (`announcement_items`, hub-owned) is retired by this decision — composition moves to the Registry as Announcement Sets nested inside `artifact_templates` or a sibling table (G4 design call). Announcement Sets, Song Set Entry, Background Library, and per-Service Lyric Override have since shipped (rows 15–17, 19, 21, 30); this table is the one part of the phase still outstanding.
- 2026-09-22: rows 23–30 (`form_group_slots`, `form_groupings`, `form_layouts`, `predefined_fields`, `rundown_parser_profiles`, `service_field_values`, `service_form_layout_snapshots`, `song_set_entries`) added by `wdi-reconcile` → `wdi-blueprint`. SPEC-43 through SPEC-55 and SPEC-44/46 shipped this code without the inventory being refreshed; `wdi-blueprint` at G3 owns this file and none of these specs' own reviews caught the gap because inventory refresh is this skill's job, not a ticket's.
