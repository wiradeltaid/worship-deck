# SPEC-122-01 — Mobile Media Control Bar Three-Row Layout & Phone Seekbar Resilience

**Satisfies:** [FR-16, FR-35, UC-12, UC-29]
**Blocked by:** []
**Status:** open

## Summary
Restructure `MediaControlBar.tsx` to eliminate seekbar crushing on mobile phone viewports (< 640px / `< sm`):
1. In `MediaControlBar.tsx`, configure `data-testid="media-control-bar-row-1"` with `flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2.5 w-full min-w-0 xl:contents` to decompose into two dedicated visual sub-rows on mobile:
   - Visual Row 1: Track header info (Icon, truncated Title, Source badge `[LOCAL]` / `[CLOUD]`) on the left, and Playlist Drawer Launcher button (`data-testid="media-control-bar-drawer"`, `shrink-0`) on the right.
   - Visual Row 2: Dedicated seekbar container (`data-testid="media-control-bar-seekbar"`) holding `0:00` (`shrink-0`), `<input type="range" className="h-1.5 w-full flex-1 min-w-[120px] ...">`, and `3:45` (`shrink-0`), guaranteeing the seekbar track never collapses to zero on phone screens (360px–412px).
   - Visual Row 3 (`data-testid="media-control-bar-row-2"`): Panic transport controls with existing `overflow-x-auto no-scrollbar` and anchored Projector toggle button.
2. On tablet viewports (`sm:` to `< xl`, 640px–1279px), seamlessly coalesce Visual Rows 1 and 2 into a single horizontal row (`sm:contents` or `sm:flex-row`), preserving the established 2-row layout.
3. On desktop viewports (`xl:`, >= 1280px), maintain the established 1-row layout (`xl:contents` / `xl:h-13`) without visual shift.
4. Keep all underlying seek event handlers, pointer-capture logic, and the 1000ms remote seek reconciliation window strictly untouched.
5. In `tests/presenter-media-player.test.mjs`, add automated verification guards and defect injection tests proving:
   - Presence of `data-testid="media-control-bar-seekbar"`.
   - Responsive flex-direction decomposition (`flex-col sm:flex-row`).
   - Sizing invariants and defect injection red-to-green proofs.

## Acceptance Criteria
- On mobile phone screens (< 640px), the seekbar renders on its own dedicated sub-row (`data-testid="media-control-bar-seekbar"`) with `flex-1 min-w-[120px]`, eliminating the 0-width crushing and dot-only thumb defect.
- On mobile phone screens, track title truncates gracefully and drawer launcher button is accessible on Row 1 without competing with the seekbar for inline space.
- On tablet screens (768px–1024px), the media bar strictly retains its 2-row layout.
- On desktop screens (>= 1280px), the media bar strictly retains its 1-row layout (`xl:h-13`).
- When no media item is cued (`activeItem === null`), the empty placeholder message renders gracefully without mounting the seekbar sub-row.
- Existing seekbar handlers, pointer capture, and remote seek reconciliation window (lines 394–420) remain functionally intact.
- Existing test IDs (`media-control-bar`, `media-control-bar-row-1`, `media-control-bar-row-2`, `media-control-bar-drawer`, `media-control-bar-play`, `media-control-bar-project`) are fully preserved.
- Automated regression tests pass with defect injection verification.
