# Issue 05 — Song Sets UI 2-Column Overhaul

**Status:** done

## Summary
Satisfies UC-24 (FR-29, AD-38). Redesign the Song Sets management screen into a clean 2-column layout mirroring Main Spine:
1. Panel Kiri: `+ New Song Set` button automatically creates an entry with default title and selects it; Song Set list with hover-only Delete button (no up/down buttons).
2. Panel Kanan: Rename header card (`[Rename][Reset]` ⇄ `[Cancel][Save]`), trio layout switcher (`Title`, `Verse`, `Reff`), toolbar, and canvas workspace.
3. Verse and Reff layouts display automated 2/3 height guideline formula for lyric bounding box.

## Implementation Details
- In `spa/src/pages/ArtifactsPage.tsx` / `SongSetEntriesPanel.tsx`, replace 3-card stacked view with 2-column layout.
- Bind sub-layout trio directly to the right-hand canvas editor.

## Tests
- `tests/song-books-seed.test.mjs`
- `tests/registry.test.mjs`
