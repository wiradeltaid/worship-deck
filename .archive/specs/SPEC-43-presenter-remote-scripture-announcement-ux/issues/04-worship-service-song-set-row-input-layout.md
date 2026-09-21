# 04: Worship Service Song Set Single-Row Input Layout

**What to build:**
Redesign the song set inputs in `EditForm.tsx` and `CreateForm.tsx` from cramped 2-column grid cards into an orderly, single-row-per-song layout featuring clean alignment of slot name, song book selector, hymn number autocomplete, background selector, and lyrics toggle.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] Song set inputs in `EditForm.tsx` and `CreateForm.tsx` are organized as 1 horizontal row per song set item instead of a 2-column card grid.
- [x] Each row cleanly aligns: Slot Title, Song Book select dropdown, Hymn Number autocomplete, Background selector, and Edit Lyrics action.
- [x] Inline lyric editor opens neatly in an accordion row or modal without disrupting the vertical alignment of other song rows.
- [x] Responsive design collapses gracefully on mobile/tablet viewports while preserving single-row clarity on desktop.
- [x] All song set save, conflict detection, and reset behaviors remain fully operational without data loss.
