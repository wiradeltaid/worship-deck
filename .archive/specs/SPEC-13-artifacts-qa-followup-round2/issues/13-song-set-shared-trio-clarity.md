# 13: Make the Song Set Title/Verse/Reff canvas's shared scope visible

**What to build:** The Song Set editor makes it visually unmistakable that the Title/Verse/Reff
canvas trio is ONE shared layout used by every Song Set entry — not a canvas owned by whichever
entry is currently selected in the list, the way Main Spine and Announcement Set slides each own
their own canvas.

**Blocked by:** 12

**Status:** open

- [ ] **Replaces the original `BUG-24` (Song Set duplicate/clone) — corrected in this SPEC's
      `wdi-review`.** The original request assumed each Song Set entry has its own canvas
      configuration worth cloning to avoid re-doing it. `AD-33` (2026-08-20, DEC-004) already
      establishes the opposite: "every Song Set entry, however many exist, shares one authored
      trio" — `SongSetEntriesPanel.tsx`'s `SongSetEntry` type carries only `variableName`/`title`/
      `position`/`updatedAt`, nothing canvas-related. There is nothing per-entry to clone; a new
      entry already gets the identical Title/Verse/Reff layout every other entry uses, automatically.
      Owner confirmed in-session: the real problem is that the UI gives the opposite impression
      (that each entry owns its own canvas, matching how Main Spine and Announcement Sets work),
      which is what created the "clone so I don't have to reconfigure" request in the first place.
- [ ] Ordinary implementation work, no debugging pass needed.
- [ ] Add explicit, persistent messaging inside the Title/Verse/Reff tab area stating this layout
      is shared across every Song Set entry (not scoped to whichever entry is currently selected).
- [ ] Reconsider whether the Song Set entries list (the identity/slot list: variableName + title)
      and the Title/Verse/Reff trio editor (the one shared canvas) should be visually and/or
      navigationally separated, so selecting a different entry in the list does not read as
      "now editing that entry's canvas" when the canvas shown does not actually change.
- [ ] Confirm via the `run` skill that selecting different Song Set entries while the Title/Verse/
      Reff tabs are open makes the shared-scope messaging obviously visible, not just present in a
      tooltip or a place the admin is unlikely to read before editing.
