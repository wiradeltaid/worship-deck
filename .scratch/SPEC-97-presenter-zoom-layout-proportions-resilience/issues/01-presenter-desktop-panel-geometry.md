# 01: Presenter Desktop Panel Geometry Decoupling & 65/35 Proportions

**What to build:** In `src/operator/present/PresenterOperator.tsx`:

1. **Decouple Main Layout from Media Height Variable**:
   - Transition the desktop layout of `<main>` from asymmetrical flex (`lg:flex-row`, left `lg:grow-0 lg:basis-[var(--presenter-stage)]`, right `lg:flex-1`) to an explicit proportion contract.
   - Configure a 65% : 35% ratio (within a strict **62%–68%** left panel ratio band, measured as `leftWidth / (leftWidth + rightWidth)`) on `<main>` above `lg` breakpoint (1024 CSS px) using CSS Grid:
     `lg:grid lg:grid-cols-[minmax(24rem,13fr)_minmax(18rem,7fr)]`
     (or equivalent resilient flex-ratio arrangement: left `lg:flex-[13] lg:min-w-[24rem]`, right `lg:flex-[7] lg:min-w-[18rem]`).
   - Retain `min-w-0` on both columns to prevent child content from causing horizontal overflow.

2. **Responsive Fallback Below `lg`**:
   - Below `lg` (< 1024 CSS px), ensure `<main>` seamlessly falls back to vertical column stacking (`flex flex-col`), where both columns span full container width and the page scrolls vertically without horizontal page overflow (`scrollWidth <= innerWidth`).

3. **Structural Test Hook Attributes**:
   - Add `data-testid="presenter-main-layout"` to `<main>`.
   - Add `data-testid="presenter-left-panel"` to the left column container.
   - Add `data-testid="presenter-right-panel"` to the `<aside>` right column container.

**Blocked by:** none

**Status:** open

- [ ] Transition `<main>` to 65/35 desktop proportion contract above `lg` breakpoint.
- [ ] Retain `min-w-0` on both left and right panel containers.
- [ ] Ensure vertical column stacking is maintained below `lg`.
- [ ] Add `data-testid` markers for main layout and both panels.
