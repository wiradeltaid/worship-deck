# SPEC-46 — Configurable Form Layout, Grouping Cards, and Predefined Fields with Dynamic Regex Extraction

> **Status:** open
> **Release:** configurable-form-layout-and-predefined-fields
> **Component:** hub
> **Touches:** services, db, hymns, slide-plan, artifacts
> **Depends on:** SPEC-45

## Problem Statement

Across diverse church traditions and worship formats, intake requirements for weekly worship services vary dramatically:

1. **Rigid Hardcoded Service Form Layout:**
   The service editor (`RunSheetPage.tsx`, `EditForm.tsx`, `CreateForm.tsx`) renders hardcoded cards (Song Sets, Bible Talk, Divine Worship, Sermon, Weekly Announcement Posters, Family of the Week, Youth of the Week). Churches cannot reorganize these cards, create new groupings (e.g. "Afternoon Program", "Sabbath School", "Mission Spotlight"), or combine song sets and announcement slots with custom fields according to their liturgy.

2. **In-Place Layout Management Absence:**
   Administrators cannot manage or adjust visual layout directly in the context of creating or editing worship services ("di menu ini" in Worship Presenter View). Layout changes are either impossible or divorced from the live visual editing experience.

3. **Hardcoded Monolithic Field Vocabulary:**
   All field keys (`sermonSpeaker`, `verseReading`, `specialSong`, `closingPrayerPerson`, `familyPrayerRequest`, `youthPrayerRequest`, etc.) are hardcoded into Go structs (`parse.Rundown`, `ctx`), TypeScript types (`WorshipFormFields`), and database columns. Adding or renaming a field requires full-stack code changes. Congregations with distinct liturgical elements cannot capture their own data.

4. **Inflexible and Hardcoded Rundown Extraction:**
   Rundown extraction currently relies on hardcoded regex cascades and a complex global 3-pass song set heuristic. Churches whose bulletin text formats differ cannot customize how specific fields or song sets are extracted. Song sets lack an explicit per-entry extraction regex, making song mapping unpredictable when bulletin labels vary.

5. **Static Slide Plan Hydration Whitelist:**
   In `internal/plan/hydrate.go` and `internal/plan/plan.go`, token replacement in canvas slide templates is restricted to a fixed catalog whitelist (`catalogValues`). Custom church tokens cannot be dynamically substituted into canvas slides without modifying Go backend structs.

6. **Lack of an Adaptive, Non-Destructive Seeder:**
   Standard fields (Verse Reference, Verse Text, Sermon Speaker, Family Photo, etc.) should serve as default starter fields rather than immutable application constants. Administrators have no way to restore missing default fields adaptively without overwriting existing customizations.

## Solution

1. **Relational Form Layout and Grouping Schema:**
   - Introduce `form_layouts`, `form_groupings`, and `form_group_slots` in SQLite.
   - Each grouping renders visually as a distinct `<Card>` in the service editor.
   - Denormalize `layout_id` on `form_group_slots` with `UNIQUE(layout_id, widget_kind, ref_key)` to enforce cardinality invariants cleanly in SQLite:
     ```sql
     CREATE TABLE form_group_slots (
       id TEXT PRIMARY KEY,
       layout_id TEXT NOT NULL REFERENCES form_layouts(id) ON DELETE CASCADE,
       grouping_id TEXT NOT NULL REFERENCES form_groupings(id) ON DELETE CASCADE,
       sort_order INTEGER NOT NULL,
       widget_kind TEXT NOT NULL CHECK (widget_kind IN ('predefined_field', 'song_set_entry', 'announcement_slot')),
       ref_key TEXT NOT NULL,
       UNIQUE (grouping_id, sort_order),
       UNIQUE (layout_id, widget_kind, ref_key)
     );
     ```
   - Inside a Grouping Card, support 4 user-facing element types:
     - `text`: scalar text input with `input_length` visual width.
     - `text_area`: scalar multiline input with `initial_lines` visual height.
     - `image`: scalar asset input with standardized 3-column renderer.
     - `announcement_slot`: 4 weekly announcement poster slots bound to `images_payload.announcementInserts`.
     *(Note on domain modeling: `text`, `text_area`, and `image` reside in `predefined_fields`; `announcement_slot` is modeled as a specialized `widget_kind` binding to slots 1..4, fulfilling the user's principle that announcement sets are not plain scalar fields because they are inserted into the main presentation sequence).*
     - `song_set_entry`: dynamic song set input row mapped to `song_set_entries.variable_name`.
   - Enforce fixed top shell invariants: Rundown Textarea remains fixed at top-left; Live Slide Preview panel remains fixed and sticky at top-right. The area below rundown is fully configurable per grouping card.
   - Service Date (`service_date`) and Worship Title/Header remain standard and hardcoded, excluded from dynamic field extraction.

2. **In-Place Visual Layout Management in Worship New/Edit:**
   - Right within `RunSheetPage.tsx`, `EditForm.tsx`, and `CreateForm.tsx`, provide an in-place **"Kelola Layout Visual" / "Customize Layout"** toggle for administrators.
   - In this mode, administrators can add new grouping cards, drag/reorder cards, add/remove fields, song sets, and announcement slots directly in the live form context, and trigger "Seed Default Predefined Field" without leaving the worship view.
   - A standalone administrative view (`/admin/form-layout` and `/admin/predefined-fields`) is also provided for complete administrative oversight.

3. **Administrative Mutation APIs:**
   - Provide transactional administrative API endpoints:
     - `GET /api/worship-form-layout`: fetch active layout, groupings, slots, and field definitions.
     - `POST /api/admin/form-groupings`: create or edit card grouping (`id`, `label`, `description`, `sort_order`).
     - `DELETE /api/admin/form-groupings/:id`: delete card grouping and cascade delete its slots.
     - `PUT /api/admin/form-groupings/reorder`: atomic reordering of card groupings.
     - `POST /api/admin/form-grouping-slots`: add slot (`layout_id`, `grouping_id`, `widget_kind`, `ref_key`, `sort_order`).
     - `DELETE /api/admin/form-grouping-slots/:id`: remove slot from card grouping.
     - `PUT /api/admin/form-grouping-slots/reorder`: atomic reordering of slots inside a card grouping.
     - `POST /api/admin/predefined-fields`: create or edit predefined field with regex compilation validation.
     - `DELETE /api/admin/predefined-fields/:id`: soft-delete/archive field (`is_active = 0`).
     - `POST /api/admin/predefined-fields/seed-defaults`: adaptive gap-filling seeder endpoint.
     - `PUT /api/admin/song-set-entries/:variable_name/extraction-regex`: set extraction regex for a song set entry.

4. **Predefined Fields with Visual Sizing and Per-Field Regex:**
   - Define `predefined_fields` with `shown_text`, immutable `id`, constrained immutable `variable_name` (`/^[a-z][a-z0-9_]{1,63}$/` and unique), `field_type` (`text`, `text_area`, `image`), visual sizing properties (`input_length` for text width classes `max-w-xs`, `max-w-md`, `w-full` and max length; `initial_lines` for textarea height bounded 2..20), and optional `extraction_regex`.
   - Validation rule: `extraction_regex` MUST be NULL/empty when `field_type = 'image'` ("kecuali gambar, gambar tidak bisa").
   - Text and textarea fields specify an individual regex with named capture `(?<value>...)`.
   - Song set entries in `song_set_entries` specify an individual `extraction_regex` with named capture groups `(?<number>\d+)` and optional `(?<book>\w+)`, making song extraction deterministic and transparent.
   - Image fields provide a standardized 3-column visual layout:
     - Column 1: Image thumbnail preview.
     - Column 2: Choose file / paste image URL input.
     - Column 3: Upload button AND Download button (linking to the verified image asset).
   - Reserved key policy: reserved keys (`service_date`, `serviceDate`, `hymnNumber`, `songTitle`, `lyrics`, `label`, `background`, `announcement_inserts`) are forbidden as custom variable names.

5. **Decoupled Form Layout vs. Slide Plan Presentation Sequence:**
   - Form layout governs operator input grouping and editing convenience only.
   - The slide presentation sequence (deck order) remains governed by Artifact Registry templates and announcement set markers, preventing accidental presentation reshuffling when form cards are reorganized.

6. **Dynamic Key-Value Service Persistence & Complete Legacy Backfill:**
   - Store custom field values in `service_field_values` (`service_id`, `variable_name`, `value_text`).
   - Retain existing `song_set_inputs` (DEC-004) and `images_payload.announcementInserts` (SPEC-45) without structural regression.
   - Complete legacy key mapping table:
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
   - Precedence: Manual user edits in service form > dynamic regex proposals > backfilled legacy values.
   - Migration backfills `service_form_layout_snapshots` for ALL existing services in the database. Historic services read their frozen snapshot so future layout changes do not distort historic services.

7. **Dynamic Canvas Token Hydration in Go Slide Plan:**
   - In `internal/plan/hydrate.go` and `internal/plan/plan.go`, hydrate canvas templates dynamically by merging `service_field_values` into the `values map[string]interface{}`.
   - Establish a dynamic token resolver combining system keys, active fields, and snapshot field definitions.
   - DEC-004 S5 contract: unknown tokens generate a validation warning on save in the artifact editor, but during live presentation hydration they render empty without crashing or blocking slide generation.
   - Image elements bind either via image `placeholderKey` or replace token `{image_variable_name}` into element `src`.

8. **Cross-Runtime Regex Contract & Hardcoded Parsing Invariant:**
   - Dialect: Safe regex subset compatible with both Go RE2 and JavaScript `RegExp` (no lookarounds `(?=...)`, `(?<=...)`, no backreferences `\1`).
   - Validation on save: The admin endpoint compiles patterns using `internal/parse/regex.go`'s translator. Invalid syntax is rejected with 400 and exact line/column error.
   - Hardcoded parsing invariant: For all new services, ONLY `service_date` and Worship Title/Header are hardcoded. ALL other text fields and song sets extract exclusively via admin-configured regexes. Legacy hardcoded cascades exist strictly as a read fallback for legacy services.

9. **Adaptive Gap-Filling Seeder (`Seed Default Predefined Field`) Manifest:**
   - Seeder matches on immutable `seed_key` strings and executes `INSERT ... ON CONFLICT(seed_key) DO NOTHING` to restore missing defaults without modifying, overwriting, or deleting user-customized labels, regexes, or custom groupings.
   - If a seeded field was soft-deleted (`is_active = 0`), the seeder respects the deletion and reports it as skipped; an explicit "Restore" action is provided if the user wishes to un-archive it.
   - Complete Seeder Manifest:
     | `seed_key` | `variable_name` | `shown_text` | `field_type` | Visual Sizing | Default Grouping Card | Default Regex |
     |---|---|---|---|---|---|---|
     | `default.verse_reference` | `scripture_reference` | Verse Reading Reference | `text` | `input_length: 100` | Bible Talk | `(?i)^(?:Verse\s+Reading|Memory\s+(?:Verse|Text)|Ayat\s+Bacaan)\s*[:\-]\s*(?<value>.*)$` |
     | `default.verse_text` | `scripture_text` | Verse Reading Text | `text_area` | `initial_lines: 5` | Bible Talk | (empty / resolved from Scripture API) |
     | `default.sermon_speaker` | `sermon_speaker_name` | Sermon Speaker | `text` | `input_length: 100` | Sermon | `(?i)^Sermon\s*[:\-]\s*(?<value>.+?)(?:\s+[\"“](?<title>[^\"”]+)[\"”])?\s*$` |
     | `default.sermon_title` | `sermon_title` | Sermon Title | `text` | `input_length: 100` | Sermon | (captured from sermon regex) |
     | `default.sermon_graphic` | `sermon_poster` | Sermon Poster | `image` | 3-column layout | Sermon | `NULL` |
     | `default.closing_prayer` | `closing_prayer_person` | Closing Prayer | `text` | `input_length: 100` | Sermon | `(?i)^(?:Closing\s+Prayer|Doa\s+Tutup)\s*[:\-]\s*(?<value>.*)$` |
     | `default.special_song` | `special_song` | Special Song | `text` | `input_length: 100` | Divine Worship | `(?i)^Special\s+Song\s*[:\-]\s*(?<value>.*)$` |
     | `default.family_photo` | `family_photo` | Family Photo | `image` | 3-column layout | Family of the Week | `NULL` |
     | `default.family_name` | `family_name` | Family Name | `text` | `input_length: 100` | Family of the Week | `(?i)^(?:Family(?:\\s*&\\s*|\\s+and\\s+|/\\s*)Youth|Family\\s+of\\s+the\\s+Week|Keluarga)\\s*[:\\-]\\s*(?<value>.*)$` |
     | `default.family_request` | `family_request` | Family Prayer Request | `text_area` | `initial_lines: 5` | Family of the Week | (empty / operator input) |
     | `default.youth_photo` | `youth_photo` | Youth Photo | `image` | 3-column layout | Youth of the Week | `NULL` |
     | `default.youth_name` | `youth_name` | Youth Name | `text` | `input_length: 100` | Youth of the Week | `(?i)^(?:Youth(?:\\s+of\\s+the\\s+Week)?|Pemuda)\\s*[:\\-]\\s*(?<value>.*)$` |
     | `default.youth_request` | `youth_request` | Youth Prayer Request | `text_area` | `initial_lines: 5` | Youth of the Week | (empty / operator input) |
   - Default Groupings:
     1. "Song Set" (contains dynamic song set slots: `ds_opening_song`, `praise_song_1`, `praise_song_2`, `ds_closing_song`)
     2. "Bible Talk" (`scripture_reference`, `scripture_text`)
     3. "Divine Worship" (`special_song`)
     4. "Sermon" (`sermon_speaker_name`, `sermon_title`, `closing_prayer_person`, `sermon_poster`)
     5. "Weekly Announcement Posters" (Announcement Slots 1, 2, 3, 4)
     6. "Family of the Week" (`family_photo`, `family_name`, `family_request`)
     7. "Youth of the Week" (`youth_photo`, `youth_name`, `youth_request`)

10. **Admin Layout Builder and Operator Suggestion Engine:**
    - Provide in-place layout customization in `EditForm.tsx` and `CreateForm.tsx` plus full admin interfaces under Settings (`/admin/form-layout` and `/admin/predefined-fields`).
    - Rundown extraction returns non-destructive proposals (`fieldSuggestions` and `songSetSuggestions`) with single and "Accept All" controls.
    - Conflict semantics: "Accept All" fills empty fields and highlights conflicting fields for operator confirmation.

## User Stories

1. As a worship service administrator, I want to manage and customize the visual card layout directly within the worship service view, so that I can organize cards and fields in the live context of service creation.
2. As a worship service administrator, I want to organize service input fields into custom grouping cards (such as "Song Set", "Afternoon Program", "Sermon & Scripture"), so that the service editor reflects our church's unique liturgy.
3. As an administrator, I want to define custom text, textarea, and image predefined fields with custom variable names and visual sizing, so that we can capture church-specific items on our presentation slides.
4. As an administrator, I want each text field and song set entry to have its own configurable extraction regex, so that bulletin text formats unique to our church extract accurately into the correct slots.
5. As an administrator, I want an adaptive "Seed Default Predefined Field" action that fills missing default fields without overwriting our existing custom fields or layouts.
6. As an administrator, I want to bind any of our 4 weekly announcement poster slots into any grouping card, so that posters can be uploaded where they make the most sense in our workflow.
7. As a worship service operator, I want the rundown textarea to remain fixed at the top-left and the Live Slide Preview to remain sticky at the top-right, so that my core workflow remains familiar and responsive.
8. As a worship service operator, I want parsed rundown values to appear as non-destructive suggestions with an "Accept All" button, so that manual edits are never silently overwritten.
9. As a worship service operator, I want image fields to render a clean 3-column layout (thumbnail preview, choose file/paste URL, upload and download), so that image assets are easy to manage and verify.
10. As a congregation member and AV operator, I want slide presentation order and PPTX exports to remain strictly governed by the slide registry, so that reorganizing cards on the edit form never disrupts the presentation sequence.
11. As a system maintainer, I want existing church services and slide templates to continue rendering with 100% fidelity after migration, with zero regressions to slide plan generation or offline PPTX creation.

## Implementation Decisions

1. **Fixed Shell Invariants:**
   - The top row of `EditForm.tsx` and `CreateForm.tsx` is immutable: Left = Rundown Textarea with profile selection and parse trigger; Right = Live Slide Preview sticky panel.
   - Grouping cards render sequentially in the configurable area below the rundown panel.
   - Service Date (`service_date`) and Worship Title/Header remain standard and hardcoded, excluded from dynamic field extraction.

2. **In-Place Layout Management:**
   - Administrators can toggle "Kelola Layout Visual" right inside `RunSheetPage.tsx`, `EditForm.tsx`, and `CreateForm.tsx`, in addition to the standalone `/admin/form-layout` settings view.

3. **Four Element Types & Relational Cardinality:**
   - User-facing element types: `text`, `text_area`, `image`, and `announcement_slot` (plus dynamic `song_set_entry`).
   - Cardinality constraint `UNIQUE(layout_id, widget_kind, ref_key)` enforced in SQLite on `form_group_slots`.
   - Validation rule: `extraction_regex` is rejected when `field_type = 'image'`.

4. **Per-Entry Song Set Regex:**
   - Each song set entry in `song_set_entries` contains an `extraction_regex` with named captures `(?<number>\d+)` and optional `(?<book>\w+)`. If `book` is absent, the church's configured default song book is applied.

5. **Decoupled Form Layout vs. Slide Deck Order:**
   - Form layout card positioning is strictly operator UX and does not alter the slide deck sequence.

6. **Canonical Value Storage & Complete Precedence:**
   - Canonical custom field values reside in `service_field_values`.
   - Precedence: Manual user edits > dynamic regex proposals > backfilled legacy values.
   - Legacy services without `service_field_values` fall back seamlessly to `parsed_data` and `images_payload` during the transition phase.

7. **Idempotent Technical Seed Keys & Complete Manifest:**
   - Seeder matches on immutable `seed_key` strings (including `default.verse_reference` and `default.verse_text`), never on user-editable labels or variable names.
   - Inactive/deleted fields are preserved without re-activation by default seeder unless explicitly restored.

8. **Immutable Historic Form Snapshots for ALL Services:**
   - When a service is created (and during backfill for all existing services), its form layout is captured into `service_form_layout_snapshots`.
   - Editing an existing service uses its frozen snapshot so that future admin edits to the live layout never distort previously created services. Re-syncing layout is an explicit admin action.

9. **Preservation of DEC-004 and SPEC-45 Baseline:**
   - `song_set_inputs` remains the SSOT for weekly song numbers, books, backgrounds, and lyric overrides (DEC-004).
   - SPEC-45 (merged in `94db19d`, PR #83) is officially closed and forms our baseline.
   - Announcement persistence: `RunSheetPage.tsx` explicitly passes `initialAnnouncementInserts` to `EditForm.tsx` ensuring all 4 slots round-trip without loss.
   - Announcement layout: `AnnouncementSlotRenderer` renders each slot in full-width single-row vertical cadence (`flex flex-col gap-4`), strictly preserving the absence guard against `sm:grid-cols-2` enforced in `tests/smoke-spec-45.test.mjs`.
