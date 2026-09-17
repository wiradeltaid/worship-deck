# 08: Announcement Sets consistency pass

**What to build:** The Announcement Set editor shows one title area for the slide being edited
(not two near-identical stacked blocks), the "Active Announcement Set" label and title-area height
stay stable through a rename, and the "New Announcement Set" creation area matches Main Spine's
layout (`DEC-009`, `DEC-010`, `DEC-011` — all `status: accepted` 2026-09-08, applied into
`.how/_platform/design-system.md`). Note: whichever title area survives the `BUG-9` investigation
below is also the third confirmed instance of `DEC-011`'s per-slide title-area shape — a full
codebase sweep at owner request found the Announcement Set's slide-level Rename
(`handleSaveRenameSlide`, `AnnouncementSetsPanel.tsx:288`) and Reset (`slideReset`, ~L805) are
distinct from the Announcement *Set*'s own Rename (`handleSaveRenameSet`, ~L175) — so `DEC-011`'s
`[Rename] | Canvas: [Reset] [Save]` grouping applies here too, on whichever block remains.

**Blocked by:** 06, 07

**Status:** done

- [x] Start with `wdi-systematic-debugging` for `BUG-9` (the duplicate title area) specifically.
      This is not only cosmetic: the owner clarified live that the two blocks held identical
      content, and saving the top one then editing the bottom one produced a "modified by another
      session" conflict banner. Confirm exactly what each block reads from and writes to (the same
      record with two independent concurrency tokens, two records meant to mirror each other, or
      something else) before deciding the fix.
- [x] Closes `BUG-9`: collapse the two stacked title blocks into one title area for "slides in
      set" — unless the reproduction shows they are genuinely different actions on genuinely
      different objects, in which case do not collapse the UI, but still fix the stale-conflict bug
      (the two objects need to share or synchronize one concurrency token), and report the UI
      question back to the owner separately from that fix.
- [x] Per `DEC-011`: whichever title area remains after the `BUG-9` fix reads `[Rename] | Canvas:
      [Reset] [Save]`, switching to `[Cancel] [Save] | Canvas: [Reset] [Save]` while rename is
      active — same pattern as tickets 06 and 07, third instance.
- [x] Closes `BUG-16`: the "Active Announcement Set" label does not move, and the title area's
      height does not change, when rename mode toggles on or off.
- [x] Closes the Announcement Set half of `BUG-15`, per `DEC-009`/`DEC-010`: the "New Announcement
      Set" creation block mirrors Main Spine's "New Slide" panel layout, uses the `default`/primary
      button variant, and relabels from "Add New Announcement Set" to "New Announcement Set" (the
      mixed-word mislabel `DEC-010` names explicitly).
- [x] A new test proves the reproduction from the debugging step fails against current code, then
      passes after the fix.
