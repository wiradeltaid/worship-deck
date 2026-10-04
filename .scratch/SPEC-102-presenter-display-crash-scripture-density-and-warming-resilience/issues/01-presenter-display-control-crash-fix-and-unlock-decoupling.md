# 01: Presenter Display Control Crash Fix & Lock Decoupling

**Satisfies:** [UC-12, FR-16]
**Blocked by:** none
**Status:** open

**What to build:** In `src/operator/present/PresenterDisplayControl.tsx`, `src/operator/present/PresenterOperator.tsx`, and `tests/presenter-congregation-display-control.test.mjs`:

1. **Resolve Base UI MenuGroupContext Crash**:
   - In `src/operator/present/PresenterDisplayControl.tsx`:
     - Wrap `<DropdownMenuLabel>` inside `<DropdownMenuGroup>` so `@base-ui/react/menu` provides the required `MenuGroupContext`.
     - Ensure the menu structure is valid under Base UI specifications without relying on undefined try/catch behavior in shared component wrappers.

2. **Scoped Decoupling from Presentation Lock**:
   - In `PresenterOperator.tsx` and `PresenterDisplayControl.tsx`:
     - Primary launcher button (`Open on External Screen` / `Open as Window`) and target selection dropdown remain enabled when `presentationLock` is active, allowing operators to freely connect or switch screens.
     - Destructive window closing (`Tutup Layar Jemaat` / `Close Screen`) while live remains locked or guarded when `presentationLock` is engaged, preventing accidental blackout mid-service.

3. **Behavioral Mounted Tests**:
   - In `tests/presenter-congregation-display-control.test.mjs`:
     - Mounted interaction test: simulate opening the dropdown menu and verify that `<DropdownMenuLabel>` and items mount cleanly without throwing `MenuGroupContext is missing`.
     - Behavioral lock test: verify that the primary launcher button and dropdown trigger remain enabled when `presentationLock === true`.
     - Defect injection proof: assert that an un-grouped `DropdownMenuLabel` fails the structure check.

## Completion evidence

Record actual commands/results and defect-injection proofs when implemented. Leave checkboxes/status open until proven; inherited review reports do not close acceptance.
