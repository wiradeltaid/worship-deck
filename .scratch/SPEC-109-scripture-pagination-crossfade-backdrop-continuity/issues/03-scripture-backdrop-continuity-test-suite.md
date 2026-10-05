# 03: Automated Backdrop Continuity and Scripture Pagination Crossfade Regression Suite

**Satisfies:** [UC-12, UC-13, FR-16, FR-19, AD-23]
**Blocked by:** SPEC-109-02
**Status:** closed

**What to build:** In `tests/projected-transitions.test.mjs`:

1. **Backdrop Layer Mounting & Style Verification**:
   - Assert `data-testid="projector-scripture-backdrop"` presence when scripture overlay is mounted.
   - Assert that backdrop helper `getScriptureBackdropStyle` returns expected styles across all transition modes:
     - `none` / `cut`: instantaneous 0ms swap.
     - `fade` / `dissolve`: 500ms opacity transition (`opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)`).
     - `push`: 450ms opacity transition adhering to canonical push timing.

2. **Rendered Pagination Continuity Verification (Executable DOM / Integration Seam)**:
   - Simulate scripture-to-scripture page navigation (`next`: page 1 $\to$ page 2, and `prev`: page 2 $\to$ page 1) in `fade` and `dissolve`:
     - Assert that `projector-scripture-backdrop` remains mounted and stays at `active` state (`opacity: 1`) without entering `entering-start` or `exiting`.
     - Verify outgoing and active scripture elements crossfade smoothly over the persistent backdrop without revealing underlying slide content.

3. **Reload / Initial Sync & Interruption Lifecycle Verification**:
   - Assert that initial sync / projector reload with active scripture mounts overlay and backdrop directly as `active` without replaying entrance animations (`isInitialSyncRef.current`).
   - Assert rapid pagination clicks and mid-transition clear cancellation leave zero stranded timers or ghost text.
   - Assert that `clear-scripture` cleanly triggers backdrop exit alongside the overlay.

4. **Absence Guard Defect Injection Proof**:
   - Demonstrate the absence-guard principle: verify that if the persistent backdrop is removed or unmounted during pagination, the test fails, and passes when restored.
