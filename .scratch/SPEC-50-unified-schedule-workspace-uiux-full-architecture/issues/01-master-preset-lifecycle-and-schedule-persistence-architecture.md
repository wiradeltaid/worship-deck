# 01: Master Preset Lifecycle & Schedule Persistence Architecture

**What to build:**
Implement the Master Preset Lifecycle and Schedule Persistence Architecture in the unified workspace:
1. Workspace Mode Switcher:
   - Provide a top-level mode toggle in the workspace navigation header:
     - `● Jadwal Ibadah (Instance)`: Assembling and operating a service for a specific date and time.
     - `○ Master Preset Builder`: Defining recurring liturgical blueprints, default cards, and required predefined fields.
2. Master Preset Lifecycle & State Transitions:
   - Presets follow an explicit lifecycle state machine: `draft` &rarr; `published` &rarr; `retired`.
   - `schedule_presets` (blueprint) + versioned snapshots in `schedule_preset_versions`.
   - Add "Kelola Master Preset" dialog/drawer:
     - List all presets (Sabat Pagi, Vesper Jumat, Doa Rabu, Ibadah Pemuda, Jadwal Bebas).
     - "Tambah Preset Baru": create custom preset with title, slug, and description.
     - "Ubah Blueprint": edit default spine items and required field layout (saved as new draft or published version).
     - "Hapus Preset" with **Dependency Check Guard**: if the preset version is referenced by any existing scheduled service (`services.schedule_preset_version_id`), display a non-dismissible refusal explaining that historical services depend on this blueprint, offering "Arsipkan Preset" (`is_archived = 1`) instead.
3. Local Schedule Instance Override Isolation:
   - The `services` table remains the Aggregate Root with `schedule_mode` (`legacy`, `preset`, `free`).
   - Edits made in "Jadwal Ibadah (Instance)" mode (reordering timeline items, modifying song keys, altering slide texts, or adding ad-hoc slides) mutate only the active service's `schedule_items` and bump `services.schedule_revision`.
   - Edits NEVER alter the underlying master preset definition.
   - Display an informational indicator: "Perubahan lokal pada jadwal ini tidak mengubah master preset [Nama Preset]".
4. Explicit Schedule Persistence & History Drawer:
   - Add explicit "💾 Simpan Jadwal" primary button in the workspace header with auto-save indicator ("Tersimpan otomatis 10:45" / "Ada perubahan belum disimpan").
   - Non-destructive Raw Rundown Import: pasting raw rundown text parses into a proposed diff; operator can preview and accept, merging into the timeline without wiping manual overrides.
   - Add "📂 Riwayat Jadwal" drawer replacing the standalone `DashboardPage` (`/`):
     - Search and filter scheduled services by date, preset, and status.
     - "Buka Jadwal" to load a past service into the workspace.
     - "📋 Gandakan Jadwal (Duplicate)" to clone an existing service's items onto a new date with fresh UUIDv7 identifiers.
     - "Hapus Jadwal" with confirmation dialog and soft-delete tombstone tracking.

**Satisfies:** UC-5, UC-14, FR-11, FR-20

**Touches:** services, operator

**Blocked by:** none

**Status:** open

- [ ] Implement workspace mode switcher between Schedule Instance and Master Preset Builder.
- [ ] Implement Master Preset state machine (draft -> published -> retired) and CRUD with deletion dependency guard.
- [ ] Implement local instance override isolation protecting master presets from ad-hoc edits while bumping revision.
- [ ] Implement explicit "Simpan Jadwal" action, non-destructive rundown merge, and Schedule History drawer.
