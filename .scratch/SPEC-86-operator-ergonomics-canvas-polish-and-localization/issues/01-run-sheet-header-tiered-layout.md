# 01: Run-Sheet Header 50:50 Layout & Tiered Action Clusters

**What to build:** In `spa/src/pages/RunSheetPage.tsx`, redesign the service header layout into a 50:50 two-column structure with tiered action clusters:
1. Divide `<header data-testid="run-sheet-header">` into two equal 50% columns above `lg` breakpoint (`grid grid-cols-1 lg:grid-cols-2 gap-4 border-b border-border/80 pb-4 items-start`):
   - **Column 1 (Left 50%)**:
     - Service Title with `text-2xl sm:text-3xl font-extrabold tracking-tight truncate whitespace-nowrap`, preventing unwanted word-breaks/line-breaks on desktop while preserving full accessible title via native `title` attribute (`title={svc.date || svc.id}`).
     - Service ID text and date below the title.
   - **Column 2 (Right 50%)**:
     - Group into structured vertical tiers aligned to the right:
       - **Row 1**: `OfflineReadinessBadge` aligned right, ensuring status visibility is unencumbered by action buttons.
       - **Row 2**: Primary action cluster (`Present` button with primary variant and bold styling, `Preview` slideshow button, `Remote` button).
       - **Row 3**: Utility action cluster (`Sync Artifact` button if admin, `Download PPTX` split button with word wrap dropdown).
2. Below `lg` breakpoint:
   - Stacks cleanly into full-width sections without horizontal overflow or orphan buttons.
3. Write automated unit and regression tests in `tests/run-sheet-header-tiered-layout.test.mjs` verifying:
   - Header is divided into a 2-column grid layout on desktop viewports.
   - Title container enforces line-break prevention (`truncate` / `whitespace-nowrap`) and native `title` attribute preservation.
   - Right column separates `OfflineReadinessBadge` into Row 1, Primary Actions into Row 2, and Utility Actions (Download PPTX) into Row 3.
   - Absence/injection test proving that merging all actions into an unconstrained single flex-wrap bar fails the tiered cluster assertion.

Satisfies `FR-16` and `UC-5`.

**Blocked by:** None (can start immediately).

**Status:** open

- [ ] Read `spa/src/pages/RunSheetPage.tsx`.
- [ ] In `spa/src/pages/RunSheetPage.tsx`:
      - Implement 50:50 two-column grid header.
      - Apply `whitespace-nowrap` / `truncate` and accessible `title` on service title.
      - Arrange right column into Row 1 (offline badge), Row 2 (primary actions), Row 3 (utility actions).
- [ ] In `tests/run-sheet-header-tiered-layout.test.mjs`:
      - Test header 50:50 column division and line-break prevention.
      - Test tiered rows in right column.
      - Inject defect and prove absence guard fails.
- [ ] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/run-sheet-header-tiered-layout.test.mjs` and `npm run typecheck`.
