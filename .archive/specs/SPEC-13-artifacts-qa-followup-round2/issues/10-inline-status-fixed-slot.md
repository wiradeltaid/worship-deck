# 10: Inline status text stops moving the canvas

**What to build:** The inline success/error line (e.g. "Template renamed", "Template order saved")
occupies a fixed-height slot above the toolbar, so its presence, absence, or text length never
changes the canvas's vertical position. The toaster stays exactly as it is.

**Blocked by:** 09

**Status:** open

- [ ] Ordinary layout work, no debugging pass needed.
- [ ] Closes `BUG-20`: reserve a fixed-height container for the inline status line, rendering it
      empty rather than unmounted when there is nothing to show — same family of fix as `BUG-13`'s
      "stays mounted, shows placeholder content" pattern.
- [ ] Confirm via the `run` skill that triggering a rename/save/order-change no longer shifts the
      canvas panel's position.
- [ ] A static structural guard on the fixed-height class, following
      `tests/operator-shadcn-guard.test.mjs`'s pattern.
