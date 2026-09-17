# 01: Main Spine auto-selects the first Deck Sequence slide on load

**What to build:** The Main Spine editor selects the first Deck Sequence slide automatically when
it mounts, matching the behaviour Announcement Sets already has.

**Blocked by:** none

**Status:** done

- [x] Ordinary implementation work, no debugging pass needed — the auto-select mechanism to copy
      already exists and works in `AnnouncementSetsPanel.tsx`.
- [x] Closes `BUG-1`'s residual: on a fresh page load, the first Deck Sequence slide is selected
      without the admin clicking one, and drag-move-and-release works immediately.
- [x] Closes `BUG-8`'s residual: the "New Slide" dropdown reads as active immediately on load, for
      the same reason (something is now selected).
- [x] Guard the empty case: a Main Spine with zero Deck Sequence slides does not attempt to
      auto-select a non-existent slide (no-op, no selected id set).
- [x] A test proves the residual reproduces against current code (nothing selected on mount) before
      the fix, then passes after.

