# 01: Top Header Refactoring: Blank Schedule, Load Schedule, Copy Preset & Preset Lifecycle Management

**What to build:**
Re-architect the top navigation bar and schedule/preset lifecycle controls:
1. Direct Top-Left Action Buttons:
   - Provide primary action buttons in Zone A (top-left):
     - `[Jadwal Baru]`: Resets the workspace to a clean slate (Slide 0 only, zero slide items). Prompts confirmation if unsaved changes exist. Default focus immediately lands on Slide 0 rundown input.
     - `[Muat Jadwal]`: Renamed from `Riwayat Jadwal`. Opens the schedule drawer to search, load, duplicate, or delete existing saved service schedules.
     - `[Salin Preset]`: Allows selecting a Master Preset (e.g. Sabat Pagi, Vesper, Ibadah Pemuda) to populate/seed the timeline slides.
2. Explicit Overwrite Warning on `[Salin Preset]`:
   - If the active schedule already contains slides, parsed rundown text, or modified fields (especially after `Muat Jadwal` or editing):
     - Displays an explicit warning modal analogous to re-syncing artifacts (`UC-16`):
       *"Menyalin preset akan menggantikan susunan slide jadwal aktif saat ini. Seluruh slide yang ada akan ditimpa dengan cetak biru preset. Lanjutkan?"*
     - Options: `Batal` (aborts cleanly) and `Gantikan Slide` (applies preset blueprint).
3. Removal of In-Place Preset Switcher Dropdown:
   - Remove the Preset Switcher Dropdown from the status bar / top command strip. Presets are blueprints copied into schedules, not hot-swapped runtime modes.
4. Save as Preset (Sanitizer) & Symmetrical Duplication:
   - In the secondary ribbon or schedule actions menu:
     - Add `[Simpan sebagai Preset Baru]`: Opens a modal allowing the operator to name a new Master Preset created from the current schedule. Automatically runs the **Preset Sanitizer**:
       - Retains slide sequence, slide types, typography styles, and token placements.
       - Strips all instance-specific payloads: raw rundown text, uploaded flyer/poster files, specific dates, and instance personnel names.
     - Support duplicating active schedules (`[Duplikat Jadwal]`) in the schedule drawer with timestamped copy naming.
     - Support duplicating master presets (`[Duplikat Preset]`) in the master preset drawer to allow deriving new preset templates easily.
5. Schedule & Preset Structural Equivalence:
   - Under the hood, enforce structural identity: `Schedule ≡ Preset`. Both share the same slide array schema, where Preset is the empty-payload template and Schedule is the populated instance.

**Satisfies:** UC-5, UC-11, UC-14, FR-11

**Touches:** services

**Blocked by:** none

**Status:** open

- [ ] Add `[Jadwal Baru]` and `[Muat Jadwal]` buttons directly at top-left.
- [ ] Implement `[Salin Preset]` dialog with overwrite confirmation warning guard (covering loaded and dirty schedules).
- [ ] Remove live Preset Selector dropdown from the status/identity strip.
- [ ] Implement `[Simpan sebagai Preset Baru]` with automated Preset Sanitizer.
- [ ] Implement `[Duplikat Jadwal]` in schedule drawer and `[Duplikat Preset]` in master preset drawer.
- [ ] Ensure shared structural schema for schedules and presets.
