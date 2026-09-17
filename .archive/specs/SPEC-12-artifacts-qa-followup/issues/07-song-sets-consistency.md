# 07: Song Sets consistency pass

**What to build:** The Song Sets editor drops the exposed "2/3 Formula" wording, keeps canvas height
stable when switching between the Title/Verse/Reff tabs, lets the Admin rename a Song Set's code the
same way its title is already renameable, and matches Main Spine's "New Slide" layout and
title-area button grouping (`DEC-009`, `DEC-010`, `DEC-011` — all `status: accepted` 2026-09-08,
applied into `.how/_platform/design-system.md`).

**Blocked by:** 06

**Status:** done

- [x] Ordinary UX work, no debugging pass needed.
- [x] Closes `BUG-14`: the "Verse Layout" tab label no longer shows "(2/3 Formula)"; the canvas
      height stays the same when switching between "Title Slide", "Verse Layout", and "Reffrain
      Layout" — either the "Auto Lyric Box" explanatory banner appears with equivalent height on
      all three tabs, or it moves somewhere that isn't above the canvas.
- [x] Closes the Song Set half of `BUG-15`: a Rename affordance exists next to the Song Set's code
      (`variableName`/slug) field, alongside the existing title Rename.
- [x] Closes the remainder of the Song Set half of `BUG-15`, per `DEC-009`/`DEC-010`: the "New Song
      Set" creation block's layout mirrors Main Spine's "New Slide" panel (section label, then
      fields, then the create button), with the `default`/primary button variant and the accepted
      "New" label.
- [x] Per `DEC-011`: the Title/Verse/Reff sub-slide title area applies the same `[Rename] | Canvas:
      [Reset] [Save]` grouping built in ticket 06.
