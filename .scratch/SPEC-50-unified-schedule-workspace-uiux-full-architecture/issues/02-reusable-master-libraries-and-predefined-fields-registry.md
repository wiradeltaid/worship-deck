# 02: Reusable Master Libraries & Predefined Fields Registry

**What to build:**
Implement the Reusable Master Libraries (Song Sets, Announcements, Canvas Slide Types) and Predefined Fields Registry in the unified workspace:
1. Master Song Sets Library & Lookup:
   - Separate reusable library data (`SongSetLayout` / `SongSetEntry`) from weekly service instances:
     - In Song context editor: "Pilih dari Master Songset" opens a lookup drawer displaying previously created song sets across all services with search by song title/hymn number.
     - "Simpan ke Master Songset": registers the current song sequence into the master library for future reuse.
     - "Hapus dari Master Songset": validates that no other presets reference the master entry. Historical services retain frozen snapshot payloads in their `schedule_items.payload`, preventing retroactive drift.
2. Master Announcement Sets Library & Looping:
   - Reusable flyer decks (`AnnouncementSet` / `AnnouncementSetSlide`):
     - In Announcement context editor: "Pilih dari Master Warta" opens a lookup drawer displaying previously uploaded flyer sets with preview thumbnails.
     - "Simpan sebagai Master Warta Baru": persists current flyer collection into reusable master data.
     - Retains auto-advance looping carousel configuration for pre-service announcements.
     - Safe deletion semantics: historical services retain snapshot image references.
3. Canvas Slide Template Registration ("Simpan sebagai Tipe Slide Baru"):
   - In `MockupCanvasDesignerModal`:
     - Add primary action: **"💾 Simpan sebagai Tipe Slide Baru"**.
     - Prompts for Template Name (e.g. "Ayat Bacaan Khusus 2 Kolom", "Kutipan Renungan", "Slide Sambutan Gembala") and Category.
     - Automatically registers the new layout into the `artifact_templates` catalog with metadata so it appears in the `+ Tambah Item` timeline menu across all presets and schedules.
4. Global Predefined Fields Registry & Preset Layout Configurator:
   - Dedicated drawer/tab "🏷️ Predefined Fields & Tokens":
     - View and manage global token dictionary: `{sermon_speaker}`, `{sermon_title}`, `{scripture_reference}`, `{worship_leader}`, `{church_announcement_date}`.
     - Add custom tokens with strict data-type validation (Text, Multiline, Person, Scripture Reference, Date).
     - In Master Preset Builder: configure which tokens are included in the preset's form layout and their card grouping order.

**Satisfies:** UC-14, UC-24, FR-20, FR-29, FR-30, FR-32

**Touches:** artifacts, services, operator

**Blocked by:** 01

**Status:** open

- [ ] Implement Master Song Sets lookup drawer and save-to-master action with frozen snapshot preservation.
- [ ] Implement Master Announcement Sets lookup drawer with looping support and safe deletion semantics.
- [ ] Implement "Simpan sebagai Tipe Slide Baru" in Canvas Designer registering custom layouts into the master catalog.
- [ ] Implement Global Predefined Fields Registry drawer and per-preset form layout configurator.
