# 06: Song Set inline rename in configured entries list (BUG-24 refinement / SPEC-13-13)

**What to build:** Relocate the rename affordances for a Song Set's `title` and `variableName` (code) from the redundant header card above the canvas into an inline editing affordance directly inside the list item in "Configured Song Sets" (`SongSetEntriesPanel.tsx`), ensuring zero vertical layout shift or row resizing during rename.

**Blocked by:** none

**Status:** open

**Done when:**
- The separate "Rename Header Card" above the Shared Canvas Trio is completely removed from the right-hand panel.
- Each list item in "Configured Song Sets" provides an inline rename trigger for both `title` and `variableName`.
- Inline rename inputs use stable `h-8` heights that fit within the list row without expanding the row height, shifting adjacent rows, or moving the canvas.
- Renaming properly validates and persists updates to the song set entry in the registry.

### Implementation Steps

- [ ] In `src/components/admin/SongSetEntriesPanel.tsx` (~L359-436), remove the separate "Rename Header Card" (`<div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between shadow-sm min-h-[58px]">`) that sits above the Shared Canvas Trio.
  - Reason: `AD-33` establishes that the Title/Verse/Reff canvas is shared by all song sets. Having a per-entry rename card above the canvas misled users into thinking the canvas belonged to that single entry.
- [ ] In the left sidebar's "Configured Song Sets" list (~L301-346), provide inline rename capabilities for both fields:
  - `title` (human-readable label, e.g. "Song 1")
  - `variableName` (slug/code, e.g. "song_1")
- [ ] The inline edit mode within the list row must:
  - Fit within the existing row bounds using compact `h-8` inputs.
  - Avoid expanding the height of the row or causing adjacent items or the canvas to shift or resize.
  - Provide clear Save and Cancel actions (or Enter to save, Escape to cancel).
  - Enforce variableName slug formatting (`toLowerCase().replace(/[^a-z0-9_-]/g, '_')`).
- [ ] When not renaming, the list row displays the title and `[code]` badge with an edit/rename trigger icon button alongside the delete button.
- [ ] Add regression tests in `tests/operator-shadcn-guard.test.mjs` and `tests/song-books-seed.test.mjs` verifying that:
  - The redundant Rename Header Card above the canvas trio is removed.
  - Inline rename inputs render inside the list row with fixed height constraint (`h-8`).
  - Saving the inline rename properly updates the song set entry title and code in the registry.
