# SPEC-113-04 — Unified Media Drawer UI, 4-Way Segmented Filter, and Dual Action Workflows

**Satisfies:** [UC-12, FR-16, FR-25]
**Blocked by:** ["SPEC-113-03"]
**Status:** open

## Summary
Redesign `MediaDrawer.tsx` into a single compact unified list with a 4-way segmented filter, compact status icons, single `Tambah Media` entry door from Komputer, 2-step cloud upload workflow, and explicit independent deletion actions, with complete bilingual `useT()` localization.

## Key Responsibilities
1. **Single Unified List Layout**:
   - Retire the two-tab switcher (Pustaka Cloud vs Media Laptop).
   - Implement compact item rows (~40px) with reorder grips, play trigger, type icon, title, compact status icon, and action menu (`⋯`).
2. **Segmented Filter Control**:
   - Provide 4 filter modes: `all` (unfiltered), `cloud-only`, `local-only`, `synced`.
   - Filter operates purely on `deriveAvailability` without mutating item order.
3. **Compact Status Icons with Tooltips**:
   - Replace bulky badge rows with a single 14px icon in row metadata:
     - `Cloud`: available on cloud only.
     - `HardDrive`: available on computer only.
     - `CloudCheck`: available on both (synced).
     - `ProgressRing`: active downloading or uploading transfer.
     - `Unlink`: detached local file handle.
4. **Action Workflows & Dual Deletions**:
   - Primary top button: `Tambah Media` (imports files from Komputer via file picker).
   - Local-only items expose `Unggah ke Cloud` row action.
   - Cloud-only items expose `Unduh ke Komputer` row action.
   - Dual deletion triggers:
     - `Hapus dari Cloud`: DELETE request to `/api/media/playlist/{id}` (blocked if actively playing).
     - `Hapus dari Komputer`: Unlinks local index handle without deleting physical disk files. Blocked or guarded if actively playing from local source.
5. **Bilingual Localization & Scoped Rename**:
   - Strictly consume all display strings, button labels, and tooltips through `useT()`.
   - Terminology update from "Laptop" to "Komputer" is scoped strictly to the media player and media storage domain, explicitly excluding physical laptop references in `PresenterDisplayControl.tsx`.

## Acceptance Criteria
- Drawer displays a single unified playlist with 4-way filter options.
- Media items occupy compact ~40px rows with status icons instead of bulky badges.
- Operator can upload local items to cloud and download cloud items to computer.
- Deleting an item from computer unlinks handle and leaves physical disk files untouched.
- All drawer labels and tooltips render cleanly in both English and Bahasa Indonesia.

## Comments
