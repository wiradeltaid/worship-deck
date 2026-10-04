# 04: Presenter Display Unified Dropdown Selection and Lifecycle Resilience

**Satisfies:** [UC-12, FR-16, FR-19]
**Blocked by:** SPEC-103-03
**Status:** closed

**What to build:** In `src/operator/present/PresenterDisplayControl.tsx`, `src/operator/present/PresenterOperator.tsx`, `tests/presenter-congregation-display-control.test.mjs`, `tests/display-target-resolver.test.mjs`, and `tests/projector-liveness.test.mjs`:

1. **Unified Dropdown Trigger**:
   - In `src/operator/present/PresenterDisplayControl.tsx`:
     - Replace split-button pattern (separate primary button and chevron trigger) with a single unified `DropdownMenuTrigger` button.
     - Clicking anywhere on the button opens the display target dropdown menu across all liveness states (`none`, `live`, `lost`).
     - Display current status indicator (icon, active label, badge) on the unified button trigger.
     - Selecting a target (`Screen 1`, `Screen 2`, `Window Mode`) immediately launches or relocates to that selected screen target across all states (`none`, `live`, `lost`), not just storing config.

2. **Clean Window Focus & Preserved Reopen Recovery**:
   - In `src/operator/present/PresenterOperator.tsx` & `PresenterDisplayControl.tsx`:
     - Expose `hasOpenProjector: boolean` (or `projectorWindowKnown: boolean`) from `PresenterOperator` to `PresenterDisplayControl`, updated on open, close, and closed-poll.
     - When `hasOpenProjector` is true, render a distinct **Focus Screen** action that calls pure `existing.focus()` without overwriting `existing.location.href`.
     - When `liveness === 'lost'`, render an explicit **Reopen / Recover Screen** action that invokes `openProjector()` to reattach or navigate a frozen window back to the projector route, maintaining full compliance with AD-29 and `tests/projector-liveness.test.mjs`.

3. **Accessible & Protected Projector Close**:
   - In `src/operator/present/PresenterDisplayControl.tsx`:
     - Render **Close Projector** whenever `hasOpenProjector` is true, ensuring it remains accessible even during transient heartbeat delays (`lost`).
     - When `presentationLock` is active, rather than permanently disabling the item (`disabled={presentationLock}`), prompt with a confirmation dialog (`window.confirm`) to guard against accidental blackout while still permitting intentional closure.

4. **Automated Unit & Guard Tests**:
   - In `tests/presenter-congregation-display-control.test.mjs`:
     - Test unified dropdown trigger structure.
     - Test that target selection triggers launch/relocate across `none`, `live`, and `lost` states.
     - Test that Focus calls `focus()` without URL rewrite.
     - Test that Close is accessible during `lost` liveness and prompts confirmation when locked.
   - In `tests/projector-liveness.test.mjs`:
     - Retain and verify that reattachment of frozen handles via Reopen/Recover satisfies existing AST guards.
