# 03: Slide Thumbnail List Hover-Only Visibility State

**What to build:** In `src/components/SlidePreviewList.tsx`, update the slide visibility toggle button so that it is visually hidden by default and only appears upon mouse hover over that specific slide element:
1. In `SlideRow`:
   - Add `group relative` to the row container `<div data-testid="slide-preview-row">`.
   - Update the visibility toggle button `<Button data-testid="slide-visibility-toggle">`:
     - Apply Tailwind classes: `opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity`.
     - When cursor is not hovering over the row, the button is completely transparent (`opacity-0`), eliminating the repetitive visual clutter of 50+ eye icons in long service rundowns.
     - When cursor hovers over that specific slide row, only that single slide's eye toggle becomes visible (`group-hover:opacity-100`).
     - If the slide is marked hidden, the badge `<span data-testid="slide-hidden-badge">` remains visible for immediate recognition, while the toggle action button itself respects the hover-only rule.
2. In keyboard navigation and accessibility:
   - Ensure the button retains `focus-visible:opacity-100` so keyboard tab navigation can access and activate the button with clear focus indication without pointer hover.
3. Write automated unit and regression tests in `tests/slide-preview-hover-visibility.test.mjs` verifying:
   - `SlideRow` container has `group` styling.
   - `slide-visibility-toggle` carries `opacity-0` and `group-hover:opacity-100`.
   - `slide-hidden-badge` remains visible when `isHidden` is true regardless of hover state.
   - Absence/injection test proving that removing `opacity-0` or `group-hover:opacity-100` fails the hover-only assertion.

Satisfies `FR-14` and `UC-5`.

**Blocked by:** None (can start immediately).

**Status:** open

- [ ] Read `src/components/SlidePreviewList.tsx`.
- [ ] In `src/components/SlidePreviewList.tsx`:
      - Add `group` class to slide preview row container.
      - Apply `opacity-0 group-hover:opacity-100 focus-visible:opacity-100` to `slide-visibility-toggle`.
- [ ] In `tests/slide-preview-hover-visibility.test.mjs`:
      - Test hover-only opacity classes on visibility toggle button.
      - Test persistent visibility of `slide-hidden-badge` on hidden slides.
      - Inject defect and prove absence guard fails.
- [ ] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/slide-preview-hover-visibility.test.mjs` and `npm run typecheck`.
