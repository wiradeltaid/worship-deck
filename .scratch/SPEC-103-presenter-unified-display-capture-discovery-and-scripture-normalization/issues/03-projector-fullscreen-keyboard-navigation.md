# 03: Projector Fullscreen Keyboard Navigation Bridge

**Satisfies:** [UC-12, FR-19]
**Blocked by:** SPEC-103-02
**Status:** open

**What to build:** In `src/lib/present-channel.ts`, `src/projected/ProjectorClient.tsx`, `src/operator/present/PresenterOperator.tsx`, `tests/present-channel.test.mjs`, and `tests/projected-shell.test.mjs`:

1. **Channel Protocol Extension & Admission Invariants**:
   - In `src/lib/present-channel.ts`:
     - Add `{ type: 'nav-next'; serviceId: string; planIdentity: string }` and `{ type: 'nav-prev'; serviceId: string; planIdentity: string }` to the `PresentMessage` union.
     - Keep `isProjectorMessage()` strictly limited to `request-sync` and `projector-alive`. Navigation intent is operator command forwarded from projector, NOT a liveness heartbeat ack.

2. **Projector Keydown Listener**:
   - In `src/projected/ProjectorClient.tsx`:
     - Attach a window `keydown` listener that intercepts:
       - `Space`, `ArrowRight`, `PageDown` -> post `{ type: 'nav-next', serviceId, planIdentity: activePlanIdentity }` to `BroadcastChannel`.
       - `ArrowLeft`, `PageUp` -> post `{ type: 'nav-prev', serviceId, planIdentity: activePlanIdentity }` to `BroadcastChannel`.
     - Guards:
       - Ignore events when modifier keys are active (`e.ctrlKey || e.metaKey || e.altKey`).
       - Ignore events if target is an interactive or editable element (`INPUT`, `TEXTAREA`, `SELECT`, `contentEditable`).
       - Call `e.preventDefault()` to prevent default browser page scrolling on Space or Arrow keys.

3. **Presenter Navigation Handling via Fresh State Refs**:
   - In `src/operator/present/PresenterOperator.tsx`:
     - In the channel `onMessage` handler, validate:
       - `msg.serviceId === serviceId`
       - `msg.planIdentity === planIdentityRef.current` (discard navigation from stale plan tabs).
     - Read current state from refs (`activeSlidesRef.current`, `indexRef.current`, `manualNavigateRef.current`) rather than closing over initial mount values.
     - Compute next visible index via `findNextVisibleIndex(activeSlides, index, direction)`.
     - Enforce deck boundary invariants: at slide 0, `nav-prev` does not wrap or change index; at the final slide, `nav-next` does not wrap or change index.

4. **Automated Unit & Integration Tests**:
   - In `tests/present-channel.test.mjs`:
     - Test validation and admission of `nav-next` and `nav-prev` carrying `planIdentity`.
     - Test that `isProjectorMessage` returns false for `nav-next` and `nav-prev` so liveness is not falsely acknowledged.
   - In `tests/projected-shell.test.mjs`:
     - Test keydown event handling in Projector window (Space, ArrowRight, ArrowLeft), modifier suppression, and editable suppression.
