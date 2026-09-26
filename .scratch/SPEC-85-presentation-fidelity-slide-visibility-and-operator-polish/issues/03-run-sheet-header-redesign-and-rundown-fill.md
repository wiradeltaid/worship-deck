# 03: Run-Sheet Header Action Bar Redesign & Presenter Rundown Textarea Vertical Fill

**What to build:** Polish the ergonomics and layout hierarchy in `spa/src/pages/RunSheetPage.tsx` and `src/operator/present/PresenterOperator.tsx`:
1. In `spa/src/pages/RunSheetPage.tsx`:
   - Redesign the top header panel of `/services/{id}` to prevent button wrapping on standard desktop displays (1024px-1920px):
     - Group controls into structured, semantic clusters:
       - **Meta Cluster (Left)**: Service Title, Service ID badge, and `OfflineReadinessBadge`.
       - **Primary Controls (Center/Right)**: "Present" (primary visual prominence), "Preview" (Slideshow), and "Remote".
       - **Utility Controls (Right)**: "Sync Artifact" (admin) and "Download PPTX" (split button with word wrap options dropdown).
     - Responsive behavior:
       - Above 1024px: Meta cluster sits left, Action clusters sit inline right without awkward wrapping.
       - Below 1024px: Clean two-row stack (Meta on row 1, Actions on row 2), preventing Download PPTX from dropping alone to an orphaned third row.
2. In `src/operator/present/PresenterOperator.tsx`:
   - Locate the Run-Sheet panel `<section>` and inner list `<ul className="... max-lg:max-h-[45vh] lg:max-h-[30rem]">`.
   - Remove the restrictive `lg:max-h-[30rem]` cap.
   - Adjust flex properties (`flex-1 min-h-0 flex flex-col h-full`) so that the rundown text container expands to fill the entire vertical height of the panel, matching the height of the adjacent slides list panel and eliminating bottom empty dead space.
3. Write automated tests in `tests/run-sheet-header-redesign.test.mjs` verifying:
   - Run-Sheet header renders all actions in structured container groups across 1024px and 1920px viewports without uncontrolled wrap displacement.
   - Presenter rundown text container does not carry `lg:max-h-[30rem]` and flex-fills available vertical height.
   - Absence/injection test proving that restoring `lg:max-h-[30rem]` fails the height expansion assertion.

Satisfies `FR-16`, `UC-20`, and `UC-21`.

**Blocked by:** None (can start immediately).

**Status:** open

- [ ] Read `spa/src/pages/RunSheetPage.tsx` and `src/operator/present/PresenterOperator.tsx`.
- [ ] In `spa/src/pages/RunSheetPage.tsx`:
      - Reorganize header action bar into semantic groups (Meta, Primary Actions, Utility Actions).
      - Style Download PPTX and action buttons to remain inline and legible without awkward wrapping.
- [ ] In `src/operator/present/PresenterOperator.tsx`:
      - Remove `lg:max-h-[30rem]` from Run-Sheet panel.
      - Configure flexbox container to occupy full vertical panel height.
- [ ] In `tests/run-sheet-header-redesign.test.mjs`:
      - Verify DOM structure and layout styling of header action bar.
      - Verify height fill styling of Presenter rundown panel.
      - Inject defect and prove guard fails.
- [ ] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/run-sheet-header-redesign.test.mjs` and `npm run typecheck`.
