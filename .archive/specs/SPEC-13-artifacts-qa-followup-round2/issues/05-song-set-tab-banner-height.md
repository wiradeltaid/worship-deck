# 05: Song Set tab switching no longer changes canvas height

**What to build:** Switching between "1. Title Slide", "2. Verse Layout", "3. Reffrain Layout"
reports the same row height on every tab, so the canvas does not move.

**Blocked by:** 04

**Status:** done

- [x] Ordinary layout work, no debugging pass needed — the mechanism is already named (`BUG-14`'s
      round-2 note): the role badge and the explanatory banner share one row, and the banner text
      wraps to a different number of lines per tab.
- [x] Fix so that row reports a fixed height regardless of tab or banner text length — either a
      fixed-height/line-clamped container, or moving the explanatory text off the row the badge
      sits on entirely.
- [x] Confirm via the `run` skill that switching Title Slide / Verse Layout / Reffrain Layout shows
      no visible canvas movement.
- [x] A static structural guard on the fixed-height class, following
      `tests/operator-shadcn-guard.test.mjs`'s pattern, since no rendering harness exists here.

