# SPEC-51 — Unified Schedule Workspace 1920 Full HD Responsive Redesign & Ergonomics Architecture

> **Status:** closed  
> **Release:** unified-schedule-workspace-1920-redesign  
> **Component:** hub  
> **Touches:** operator, spa, presenter, artifacts, tests  
> **Depends on:** SPEC-50  

## Problem Statement

During hand-testing of the unified schedule workspace following the SPEC-50 delivery, the maintainer provided explicit directional feedback:
*"rancang ulang semuanya, agar bisa responsive tapi dirancang agar minimal width 1920 (Full HD), artinya jika mau ditata ulang, lakukan sekarang."*

Evaluation against the active application layout identified key architectural and visual opportunities:
1. **Under-Utilized Full HD Viewport (AV Booth Standard):**
   - Church presentation booths and operator consoles predominantly run on 1080p (1920×1080) Full HD displays or multi-monitor AV setups.
   - The previous layout used fixed narrow widths (Timeline 320px, Canvas Preview 440px), resulting in excessive empty horizontal gutters or disproportionately cramped contextual editors when displayed on 1920px screens.
   - The 16:9 Canvas Preview was constrained to ~400px width (rendering only ~225px high), making typography hierarchy, slide layouts, and bounding boxes difficult to inspect without opening the modal designer.
2. **Contextual Editor Ergonomics at 1920px Density:**
   - Song editing, announcement arrangement, and sermon predefined fields were stacked in single narrow columns. At 1920px, the center editor has ample horizontal room (600px–900px) to support comfortable dual-column workflows (e.g. song metadata & hymn lookup alongside full verse lyrics preview).
3. **Master Libraries Direct CRUD in Drawer:**
   - As observed during operator triage, the "Koleksi Master & Kamus Variabel" drawer supported lookup and "Pilih set ini", but lacked direct in-drawer creation from scratch, editing, and deletion with dependency guards. Operators had to route through the active schedule timeline to register new master sets.
4. **Header & Control Strip Clutter:**
   - Mode toggles, preset selectors, status badges, sync indicators, and action buttons were loosely distributed across multiple wrapping divs, leading to vertical jumping when toggling modes. Consolidating into structured command bars tailored for 1920px Full HD creates an authoritative AV command center.

SPEC-51 executes a comprehensive redesign of the workspace, setting 1920px Full HD as the primary design baseline while ensuring fluid responsiveness for larger viewports (2K/4K) and graceful degradation for sub-1920px laptop screens.

## Layout Specification & Proportions (Responsive Contract)

| Breakpoint Tier | Viewport Width (`W`) | Timeline Width | Editor Width | Preview Width | Layout Behavior |
|---|---|---|---|---|---|
| **Tier 1: Full HD & Ultra-Wide** | `W >= 1920px` (2xl) | `400px` (fixed shrink-0) | Fluid `min-w-[600px] max-w-[900px]` | `580px` (fixed shrink-0, ~560×315 16:9 canvas) | Full 3-panel simultaneous view. No horizontal scrolling. |
| **Tier 2: Standard Desktop / Laptop** | `1280px <= W < 1920px` (xl/lg) | `320px` (fixed shrink-0) | Fluid `min-w-[450px]` | `440px` (shrink-0, ~420×236 16:9 canvas) | Proportional scaling. All 3 panels visible side-by-side. |
| **Tier 3: Small Laptop / Tablet** | `W < 1280px` (md/sm) | `100%` (stacked) or 300px | Fluid `100%` | Drawer/Modal or Bottom Sheet | Stacked tabs or drawer overlay preventing horizontal button clipping. |

### Vertical Dimension Contract
- Viewport calculation: `h-[calc(100vh-175px)]` with responsive min-height: `min-h-[700px]` on standard 1080p, scaling down to `min-h-[560px]` on shorter laptop displays (`max-height: 768px`) to prevent nested double scrollbars while maintaining internal panel scrolling.

## Dependency Guard & Deletion Semantics Matrix

| Entity | Delete Precondition & Guard Behavior | Archival Option | Historical Service Impact |
|---|---|---|---|
| **Master Preset** | Refuses deletion if referenced in any `services.schedule_preset_version_id`. Displays non-dismissible refusal modal explaining active schedule references. | Permitted (`is_archived = true`). | Preserves blueprint integrity for historical services. |
| **Master Song Set** | Refuses deletion if referenced by any master preset default blueprint items. | Warning prompt if referenced in past schedules. | Frozen snapshot in `schedule_items.payload` ensures zero retroactive drift. |
| **Master Announcement Set** | Permitted with confirmation dialog showing flyer count. | N/A | Existing scheduled services retain deep-cloned flyer snapshots. |
| **Predefined Token** | System tokens (`isSystem: true`, e.g. `{sermon_speaker}`) are strictly immutable (delete button disabled). Custom tokens can be deleted with confirmation. | N/A | Past services retain token string keys without breaking. |

## User Workflows & State Transitions

### Workflow 1: 1920px High-Density 3-Panel Layout
```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP COMMAND STRIP (1920px Viewport):                                                                                   │
│ [ ● Jadwal Ibadah | ○ Master Preset ]  [ Sabat Pagi ▼ ] [ 2026-09-26 ] │ [ Siap Tayang ] [ 🟢 Sync ] │ [ 📱 ] [ ▶ ] [ 💾 Simpan ] │
├────────────────────────────────┬─────────────────────────────────────────────────┬─────────────────────────────────────┤
│ RUN SHEET TIMELINE (400px)     │ CONTEXTUAL EDITOR (Fluid 600-900px)             │ LIVE CANVAS PREVIEW (580px)         │
│                                │                                                 │                                     │
│ 1. [ Pembukaan & Doa ]         │ [ Judul Item: Lagu — Hai Pujilah Tuhan        ] │ ┌─────────────────────────────────┐ │
│ 2. [ Lagu — SDAH 123 (D)     ] │                                                 │ │                                 │ │
│    • 3 Slide • 10:00           │ [ Metadata & Nada ]    [ Lirik & Format ]       │ │   Hai Pujilah Tuhan, Khalik     │ │
│ 3. [ Warta Jemaat (4 Flyer)  ] │ • Buku: SDAH 123       • Bait 1 (Aktif)         │ │   Semesta Alam...               │ │
│ 4. [ Khotbah: Pdt. E. R.     ] │ • Nada: D (Key of D)   • Bait 2 (Aktif)         │ │                                 │ │
│ 5. [ Doa Syafaat             ] │ • Background: Navy     • Bait 4 (Aktif)         │ └─────────────────────────────────┘ │
│                                │                                                 │ [ B: Blackout ] [ C: Clear Text ]   │
│ [ + Tambah Item ]              │ [ 💾 Simpan ke Master ] [ 🎨 Canvas Designer  ] │ [ ⚡ Ayat Cepat ] [ 📐 16:9 Grid ]   │
└────────────────────────────────┴─────────────────────────────────────────────────┴─────────────────────────────────────┘
```

### Workflow 2: In-Drawer Direct Master Libraries CRUD
- Drawer **"Koleksi Master & Kamus Variabel"** updated with direct action capabilities:
  - **Master Song Sets Tab:**
    - "+ Tambah Song Set": Opens modal to create a new multi-song collection directly without editing active service.
    - "Ubah": Edit title, description, and songs in-place.
    - "Hapus": Refuses deletion with dependency guard if referenced by any master preset blueprint.
  - **Master Warta Tab:**
    - "+ Tambah Warta Baru": Upload flyers and set carousel duration directly into reusable master storage.
    - "Ubah" & "Hapus": Manage flyers and loop settings in-place.
  - **Predefined Fields Tab:**
    - Edit existing tokens, delete custom tokens (system tokens `{sermon_speaker}` remain immutable).

### Workflow 3: Keyboard Shortcuts Safety & Focus Guards
- Quick Projection shortcuts (`B` for Blackout, `C` for Clear Text) are guarded against input focus:
  - If the active element is `INPUT`, `TEXTAREA`, or `[contenteditable]`, single-key triggers are suppressed.
  - Visual indicator badges display active Blackout or Clear Text state with single-click restore.

## User Stories

1. As a church AV operator on a 1920×1080 Full HD presentation booth screen, I want the unified workspace to fully utilize the 1920px horizontal width and 1080p vertical viewport without awkward letterboxing or double scrollbars, so that I can see timeline, contextual editor, and large live canvas preview side-by-side (`UC-5`, satisfying `FR-11`).
2. As an operator editing hymns and songs, I want a spacious contextual editor with dual-column layout for song metadata and verse lyrics preview, so that I can configure verses and hymn numbers rapidly without horizontal crampedness (`UC-24`, satisfying `FR-20`).
3. As an operator, I want a larger 16:9 canvas preview (580px width) with quick blackout (`B`) and clear text (`C`) toggles directly accessible on the right panel, so that I have instant confidence in what is being projected on stage (`UC-11`, `UC-12`, satisfying `FR-32`).
4. As an administrator, I want to create, edit, and delete reusable Master Song Sets and Master Announcements directly from within the Master Libraries drawer, so that I can maintain church repertoires independently of specific weekly dates (`UC-14`, satisfying `FR-20`, `FR-29`).
5. As a mobile or laptop operator, I want the workspace controls and layout to remain responsive on varying screen sizes while maintaining high-density ergonomics at 1920px+, so that the application adapts across devices without horizontal clipping (`UC-5`, satisfying `FR-44`).

## Tickets

- `SPEC-51-01`: 1920 Full HD Responsive Viewport & 3-Panel Layout Grid Overhaul
- `SPEC-51-02`: Master Libraries In-Drawer Direct CRUD & Layout Refactoring
- `SPEC-51-03`: Consolidated AV Command Header, Quick Tools & High-Density Toolbar
- `SPEC-51-04`: Full HD Workspace End-to-End Verification, Smoke Test Suite & Regression Guards
