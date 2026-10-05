# 04: Automated Motion, Bidirectional Navigation, and Interruption Guard Suite

**Satisfies:** [UC-12, UC-13, FR-16, FR-19, AD-23]
**Blocked by:** SPEC-108-03
**Status:** closed

**What to build:** In `tests/projected-transitions.test.mjs` (or `tests/projector-scripture-transitions.test.mjs`):

1. **Replace Legacy Fixed-Class Assertions**:
   - In `tests/projected-transitions.test.mjs`, update or replace existing assertions that test for static `transition-opacity duration-300` Tailwind classes on scripture and blank containers.
   - Assert directly on computed inline styles from `getScriptureTransitionStyle` and `getBlankTransitionStyle`.

2. **Scripture Canonical Transition Tests**:
   - Test `cut` and `none`: assert 0ms instant mount, swap, and unmount for scripture overlays.
   - Test `fade` and `dissolve`: assert opacity styles transitioning between `0` and `1` during entrance, exit, and crossfade between pages over canonical 500ms duration.
   - Test `push`:
     - Assert `translateX(100%)` $\to$ `translateX(0)` on initial entrance and next page advancing over canonical 450ms.
     - Assert `translateX(-100%)` $\to$ `translateX(0)` on previous page returning over canonical 450ms.
     - Assert outgoing scripture pushes off-screen (`translateX(0)` $\to$ `translateX(-100%)` on next, `translateX(0)` $\to$ `translateX(100%)` on prev).
     - Assert same-page updates crossfade in-place without horizontal transform translation.

3. **Adaptive Blank Screen Conformance**:
   - Assert `cut` / `none`: verify instant 0ms cut to black on blanking, and 0ms instant restore on unblanking.
   - Assert `fade` / `push`: verify adaptive opacity fade over 300ms on blanking and restore on unblanking, without transform translate distortion.
   - Assert that blanking and unblanking preserve underlying slide index, scripture overlay, and guest video states unperturbed (FR-16).

4. **Interruption & Defect Injection**:
   - Verify that rapid page flipping (next $\to$ prev $\to$ next within 50ms) cancels previous timers cleanly without ghost text lingering or orphaned timers.
   - Inject defect test: simulate hardcoded 300ms opacity timer and verify guard test fails.
