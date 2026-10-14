# SPEC-120-01 — Decouple Presenter Remote Pairing Session from Projector Liveness Verdict

**Satisfies:** [UC-29, FR-35]
**Blocked by:** []
**Status:** closed
**Closed at:** 2026-10-14

## Summary
Prevent remote pairing code regeneration when opening, closing, or reloading the congregation screen. Replace `liveness.verdict` state reference in `PresenterOperator.tsx` remote session effect with mutable `livenessRef.current.verdict`, remove `liveness.verdict` from the `useEffect` dependencies, and add an automated regression scan guard.

## Key Responsibilities
1. **Ref Migration in `PresenterOperator.tsx`**:
   - In `handleGuestProject` (`PresenterOperator.tsx:1936`), switch from `liveness.verdict === 'live'` to `livenessRef.current.verdict === 'live'`.
   - Remove `liveness.verdict` from the dependency array of the remote session `useEffect` (`PresenterOperator.tsx:1989`).
2. **Regression Guard Test (`tests/remote-presenting-client.test.mjs`)**:
   - Add a guard test verifying that the `PresenterRemoteSession` instantiation `useEffect` in `PresenterOperator.tsx` does not depend on `liveness` or `liveness.verdict`.
   - Add defect injection proving that introducing `liveness` into the dependency list triggers a test failure.

## Acceptance Criteria
- Opening, closing, or reloading the Congregation Screen does not restart `PresenterRemoteSession` or regenerate the 6-digit PIN.
- The 6-digit code remains identical before and after the projector window transitions from `'never-opened'` to `'live'`.
- All tests in `tests/remote-presenting-client.test.mjs` pass.
