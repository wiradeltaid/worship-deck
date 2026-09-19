# 02: Dynamic Field Service Persistence and Backfill Migration

**What to build:**
Implement service persistence for dynamic field values in Go backend, backfill existing worship services from `parsed_data` and `images_payload` into `service_field_values` using the complete legacy key mapping table, capture immutable layout snapshots for new services and backfill layout snapshots for all historical services, and provide dual-read fallback support so that existing services continue to read and update with 100% fidelity.

**Blocked by:** SPEC-46-01

**Status:** done

- [x] Implement database migration backfilling existing services from `parsed_data` and `images_payload` into `service_field_values` using the comprehensive canonical mapping:
  - `verseReading.reference` -> `scripture_reference`
  - `verseReading.text` -> `scripture_text`
  - `verseReading.translation` -> `scripture_bible_version`
  - `sermon.speaker` -> `sermon_speaker_name`
  - `sermon.title` -> `sermon_title`
  - `sermonGraphicUrl` -> `sermon_poster`
  - `closingPrayerPerson` -> `closing_prayer_person`
  - `specialSong` -> `special_song`
  - `familyName` -> `family_name`
  - `familyPhotoUrl` -> `family_photo`
  - `familyPrayerRequest` -> `family_request`
  - `youthName` -> `youth_name`
  - `youthPhotoUrl` -> `youth_photo`
  - `youthPrayerRequest` -> `youth_request`
- [x] Implement migration pass backfilling `service_form_layout_snapshots` for ALL existing services in the database, locking their historical card layout and protecting them against future live layout changes.
- [x] Update `createService` and `updateService` in `internal/httpapi/services.go` to persist custom field values to `service_field_values` while preserving existing `song_set_inputs` and `images_payload.announcementInserts`.
- [x] Capture an immutable denormalized layout snapshot in `service_form_layout_snapshots` upon new service creation.
- [x] Implement dual-read fallback in service retrieval (`getService`): if a service lacks `service_field_values`, safely fall back to reading from legacy `parsed_data` and `images_payload`. Return `field_values: Record<string, string>` alongside legacy keys in GET responses.
- [x] Implement explicit precedence rules: manual user edits > dynamic regex proposals > backfilled legacy values.
- [x] Add Go unit and integration tests verifying service create/read/update cycles with dynamic field values, backfill accuracy across all keys, snapshot generation for legacy and new services, and fallback resilience.
