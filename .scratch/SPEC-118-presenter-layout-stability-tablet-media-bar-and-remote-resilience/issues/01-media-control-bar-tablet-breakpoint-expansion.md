# SPEC-118-01 — Responsive Media Control Bar Breakpoint Expansion for Tablet & Compact Viewports

**Satisfies:** [UC-12, UC-29, FR-16, FR-25, FR-35]
**Blocked by:** []
**Status:** closed

## Summary
Expand the responsive 2-row layout breakpoint in `MediaControlBar.tsx` from `md:` (768px) to `xl:` (1280px). This ensures that tablets (such as iPad Mini in 744px/768px portrait and 1024px landscape, as well as 10"–12" tablets up to 1279px) display the spacious 2-row layout with a full-width scrubbable seekbar, while widescreen desktop workstations (>= 1280px) cleanly flatten into the single horizontal bar.

## Key Responsibilities
1. **Container Breakpoint Elevation (`src/operator/present/media-player/MediaControlBar.tsx`)**:
   - Replace `md:` with `xl:` across layout container classes:
     `w-full h-auto xl:h-13 shrink-0 px-3 py-2 xl:py-0 bg-card/95 border-b border-border shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2 xl:gap-3 select-none text-xs transition-opacity`.
2. **Row 1 & Row 2 Flattening Gating**:
   - Update `data-testid="media-control-bar-row-1"` to use `xl:contents`.
   - Update `data-testid="media-control-bar-row-2"` to use `xl:contents`.
   - Update children order modifiers (`md:order-1` -> `xl:order-1`, `md:order-2` -> `xl:order-2`, `md:order-3` -> `xl:order-3`, `md:order-4` -> `xl:order-4`).
3. **Explicit Tablet Band Coverage (768px – 1279px)**:
   - On tablets (spanning 768px portrait to 1024px landscape and up to 1279px compact displays), Row 1 expands the seekbar across the available width next to track metadata and drawer launcher, allowing precise scrubbing without mis-taps.
   - Row 2 comfortably houses transport controls, volume slider, shuffle/repeat, and projector toggle with zero horizontal clipping.
4. **Desktop Preservation (>= 1280px)**:
   - On widescreen desktop displays (>= 1280px), all controls flatten into 1 horizontal row (`h-13`), preserving established desktop operator ergonomics.

## Acceptance Criteria
- Viewports under 1280px (explicitly covering smartphones 380px–450px, iPad Mini in 744px/768px portrait, iPad in 1024px landscape, and compact tablets up to 1279px) render `MediaControlBar` in 2 spacious rows.
- The seekbar in Row 1 has ample horizontal room to scrub smoothly without compressing into an unusable sliver.
- Viewports >= 1280px flatten to a single row (`h-13`).
- All existing tests in `tests/presenter-media-player.test.mjs` updated to verify `xl:` breakpoint and pass cleanly.
