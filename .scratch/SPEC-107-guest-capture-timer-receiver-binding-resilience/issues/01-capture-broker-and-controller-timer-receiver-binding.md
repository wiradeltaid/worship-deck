# 01: Capture Broker and Controller Native Timer Receiver Binding

**Satisfies:** [UC-12, FR-16]
**Blocked by:** none
**Status:** open

**What to build:** In `src/lib/capture-broker.ts`, `src/operator/present/presenter-guest-feed-controller.ts`, and `tests/capture-broker-device-enumeration.test.mjs`:

1. **Defensive Timer Receiver Binding in `CaptureBroker`**:
   - In `CaptureBroker` constructor, extract `rawSetTimeout` and `rawClearTimeout`.
   - Wrap timer invocation via closure targeting `typeof window !== 'undefined' ? window : globalThis` so that `this.env.setTimeout(...)` and `this.env.clearTimeout(...)` never delegate with `this === this.env`.
   - Ensure preview readiness timer (`waitForPreviewReadiness`) runs without `TypeError: Failed to execute 'setTimeout' on 'Window': Illegal invocation`.

2. **Defensive Timer Receiver Binding in `PresenterGuestFeedController`**:
   - In `PresenterGuestFeedController` constructor, extract `rawSetTimeout` and `rawClearTimeout`.
   - Bind `this.envSetTimeout` and `this.envClearTimeout` to `timerTarget` so that calls in `startAttachDeadline()`, `clearAttachDeadline()`, `startFrameWatchdog()`, and `stopFrameWatchdog()` execute with valid window receiver context.

3. **Automated Unit & Guard Tests**:
   - In `tests/capture-broker-device-enumeration.test.mjs`:
     - Add mock timer environment that strictly asserts `this === windowObj` for BOTH `setTimeout` and `clearTimeout` (throwing `TypeError: Illegal invocation` if unbound or bound to non-Window object).
     - Prove that `CaptureBroker.arm()` and `PresenterGuestFeedController.arm()` successfully transition through readiness without throwing `Illegal invocation`.
     - Prove that cancellation pathways (`disarm()`, `revertToDeck()`, `clearAttachDeadline()`, `stopFrameWatchdog()`) invoke `clearTimeout` with valid receiver context.
