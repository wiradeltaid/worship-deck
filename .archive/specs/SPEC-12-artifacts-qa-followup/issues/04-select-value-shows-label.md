# 04: Every Select shows the chosen item's label, not the raw value

**What to build:** Every dropdown in the Artifact Registry (and anywhere else in the app that uses
the shared `Select` component) shows the same label once an item is selected as it showed in the
open list — never the item's internal key or value string.

**Blocked by:** 03

**Status:** done

- [x] Start with `wdi-systematic-debugging` to confirm the exact `@base-ui/react/select`
      `Select.Value` fallback behaviour live before patching — `defects.yaml` BUG-8 names the
      hypothesis (`src/components/ui/select.tsx`'s bare `<SelectValue />`, no label-lookup render
      function) from a code read, not yet executed.
- [x] Fix the shared `SelectValue` component itself (one change), not each of the ~15+ individual
      call sites found via `grep -rn "SelectValue" src spa/src` — this is the one component every
      `Select` in the app is built from, per `.how/_platform/design-system.md`'s operator-chrome
      rule.
- [x] The Main Spine "New Slide" dropdown shows the chosen slide kind's label (e.g. "🎵 Bible Talk
      Opening Song"), not its raw value (e.g. `song:opening_song_bt`).
- [x] The Toolbar's predefined-placeholder dropdown shows the same behaviour.
- [x] At least one Song Set or Announcement Set dropdown is spot-checked after the fix, confirming
      the "one shared component" claim actually holds app-wide and not only in isolation.
- [x] The regression is seen failing against current code before the fix, then passing after.
