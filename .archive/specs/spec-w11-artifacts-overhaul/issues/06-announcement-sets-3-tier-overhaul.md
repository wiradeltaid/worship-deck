# Issue 06 — Announcement Sets UI 3-Tier Overhaul

**Status:** done

## Summary
Satisfies UC-14, UC-15 (FR-20, FR-21, AD-38). Redesign Announcement Sets screen into a clean 3-tier hierarchy:
1. Panel Kiri: `Add New Announcement Set` button (auto-creates and selects new set), Dropdown Selector for active Announcement Set, and List of Slides in Set with hover-only actions (`[↑][↓][❐][🗑]`).
2. Panel Kanan: Canvas Editor for the active announcement slide, identical to Main Spine editor with Rename card, toolbars, and Change Background.
3. Completely remove the confusing "Main Spine Markers" card, as placement is handled directly in Main Spine.

## Implementation Details
- Update `AnnouncementSetsPanel.tsx` / `ArtifactsPage.tsx` to implement the 3-tier structure.
- Remove Main Spine Markers card and its legacy state.

## Tests
- `tests/announcement-sets.test.mjs`
- `tests/registry.test.mjs`
