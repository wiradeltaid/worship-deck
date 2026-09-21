# 01: Schema Migration and Adaptive Seeder Backend

**What to build:**
Create database tables for form layouts, groupings, grouping slots, predefined fields, service field values, and layout snapshots with complete identity, cardinality (`UNIQUE(layout_id, widget_kind, ref_key)`), and reserved-key constraints. Implement the complete normative seeder manifest in Go with `seed_key` collision guards (`INSERT ... ON CONFLICT(seed_key) DO NOTHING`) that seeds default fields (including both `default.verse_reference` and `default.verse_text`) and groupings without overwriting existing customizations, reject regex on image fields, and expose Go HTTP API endpoints for layout management and administrative mutations.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Add `form_layouts`, `form_groupings`, `form_group_slots`, `predefined_fields`, `service_field_values`, and `service_form_layout_snapshots` tables to SQLite schema with complete constraints:
  - `predefined_fields`: `id` (UUID PK), `variable_name` (unique, `/^[a-z][a-z0-9_]{1,63}$/`), `shown_text`, `field_type` (`text`, `text_area`, `image`), `input_length`, `initial_lines`, `extraction_regex`, `seed_key` (unique), `is_system`, `is_active`. Add constraint: `CHECK (field_type != 'image' OR extraction_regex IS NULL)`.
  - `form_groupings`: `id` (UUID PK), `layout_id` (FK), `label`, `description`, `sort_order`, `UNIQUE(layout_id, sort_order)`.
  - `form_group_slots`: `id` (UUID PK), `layout_id` (FK), `grouping_id` (FK), `sort_order`, `widget_kind` (`predefined_field`, `song_set_entry`, `announcement_slot`), `ref_key`, with cardinality constraint `UNIQUE(layout_id, widget_kind, ref_key)` and `UNIQUE(grouping_id, sort_order)`.
  - `service_form_layout_snapshots`: `service_id` (PK FK), `layout_version`, `snapshot_json`, `created_at`.
- [x] Add `extraction_regex` column to `song_set_entries` table.
- [x] Implement reserved key validation forbidding custom field variable names matching: `service_date`, `serviceDate`, `hymnNumber`, `songTitle`, `lyrics`, `label`, `background`, `announcement_inserts`.
- [x] Implement `SeedDefaultFormLayout(db)` in Go using the complete normative seeder manifest:
  - `default.verse_reference`: `scripture_reference`, Verse Reading Reference, `text`, `input_length: 100`, Bible Talk
  - `default.verse_text`: `scripture_text`, Verse Reading Text, `text_area`, `initial_lines: 5`, Bible Talk
  - `default.sermon_speaker`: `sermon_speaker_name`, Sermon Speaker, `text`, `input_length: 100`, Sermon
  - `default.sermon_title`: `sermon_title`, Sermon Title, `text`, `input_length: 100`, Sermon
  - `default.sermon_graphic`: `sermon_poster`, Sermon Poster, `image`, Sermon
  - `default.closing_prayer`: `closing_prayer_person`, Closing Prayer, `text`, `input_length: 100`, Sermon
  - `default.special_song`: `special_song`, Special Song, `text`, `input_length: 100`, Divine Worship
  - `default.family_photo`: `family_photo`, Family Photo, `image`, Family of the Week
  - `default.family_name`: `family_name`, Family Name, `text`, `input_length: 100`, Family of the Week
  - `default.family_request`: `family_request`, Family Prayer Request, `text_area`, `initial_lines: 5`, Family of the Week
  - `default.youth_photo`: `youth_photo`, Youth Photo, `image`, Youth of the Week
  - `default.youth_name`: `youth_name`, Youth Name, `text`, `input_length: 100`, Youth of the Week
  - `default.youth_request`: `youth_request`, Youth Prayer Request, `text_area`, `initial_lines: 5`, Youth of the Week
  - Default groupings created: "Song Set", "Bible Talk", "Divine Worship", "Sermon", "Weekly Announcement Posters", "Family of the Week", "Youth of the Week".
- [x] Implement HTTP API endpoints:
  - `GET /api/worship-form-layout`: returns active layout, groupings, slots, and field definitions.
  - `POST /api/admin/form-groupings`: create or edit card grouping (`id`, `label`, `description`, `sort_order`).
  - `DELETE /api/admin/form-groupings/:id`: delete card grouping and cascade delete its slots.
  - `PUT /api/admin/form-groupings/reorder`: atomic reordering of card groupings.
  - `POST /api/admin/form-grouping-slots`: add slot (`layout_id`, `grouping_id`, `widget_kind`, `ref_key`, `sort_order`).
  - `DELETE /api/admin/form-grouping-slots/:id`: remove slot from card grouping.
  - `PUT /api/admin/form-grouping-slots/reorder`: atomic reordering of slots inside a card grouping.
  - `POST /api/admin/predefined-fields`: create or edit predefined field with regex compilation validation (rejecting regex when `field_type = 'image'`).
  - `DELETE /api/admin/predefined-fields/:id`: soft-delete/archive field (`is_active = 0`).
  - `POST /api/admin/predefined-fields/seed-defaults`: runs the adaptive seeder and returns a report `{ inserted: number, skipped: number, inactive_skipped: number }`.
  - `PUT /api/admin/song-set-entries/:variable_name/extraction-regex`: set extraction regex for a song set entry.
- [x] Write backend unit tests in Go (`internal/db` and `internal/httpapi`) verifying idempotent seeding, gap-filling without overwriting modified fields, reserved key rejection, image regex rejection, and API response contracts.
