# 07: Every title area keeps its height stable through rename, and the Song Set trio drops its Rename control

**What to build:** Entering rename mode on any title area in this editor — a Main Spine slide, a
Song Book entry, an Announcement Set or its slide-in-set, a Song Set's own title — reserves the
same height it had before rename mode started, so the canvas below it never moves. The Song Set's
Title/Verse/Reff trio stops offering Rename at all.

**Blocked by:** 06

**Status:** done

- [x] Ordinary implementation work, no debugging pass needed.
- [x] Closes the widened `BUG-16`: SPEC-12 fixed this for Announcement Set's own "Active
      Announcement Set" label specifically; this ticket makes the fix general — one title-area
      component (or one shared height contract) used everywhere this editor shows a rename affordance,
      not a per-screen patch. Explicitly covers Main Spine, Song Books, and the Song Set's own
      title area (the one that currently grows further still, adding a `TITLE:` label while
      renaming).
- [x] Closes `BUG-23`: remove the Rename control from the Song Set's Title/Verse/Reff tabs
      entirely (`createSongSetTrioAdapter()`'s `roles` array has no persisted label field behind
      it — confirmed by code reading this spec's own investigation, see
      `.work/requirements/prompt-08-artifacts-qa-followup-round2.md`). Static labels "Title Slide"
      / "Verse Layout" / "Refrain Layout" replace it.
- [x] A new test proves the height-shift reproduces on ALL FOUR named surfaces (Main Spine slide,
      Song Book entry, Announcement Set's own title area, Song Set's title area) against current
      code before the fix, then passes on all four after — not a sample of two. This defect was
      reopened this round specifically because SPEC-12's fix proved out on only the one surface it
      targeted (Announcement Set's label) while the same bug stayed live everywhere else; a partial
      surface count here repeats that exact mistake.

