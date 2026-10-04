# 02: Projector Media Bridge Native Timer and Interval Receiver Binding

**Satisfies:** [UC-12, FR-16]
**Blocked by:** SPEC-107-01
**Status:** closed

**What to build:** In `src/projected/projector-guest-media-bridge.ts` and `tests/projector-guest-media-bridge.test.mjs`:

1. **Defensive Timer and Interval Receiver Binding**:
   - In `ProjectorGuestMediaBridge` constructor, extract `rawSetTimeout`, `rawClearTimeout`, `rawSetInterval`, and `rawClearInterval`.
   - Wrap all four functions targeting `typeof window !== 'undefined' ? window : globalThis` to eliminate receiver context loss when called as properties of `this.env`.
   - Ensure playback readiness deadline timer (`waitForPlaybackReadiness`) and periodic status re-emission timer (`startStatusReemitTimer`) execute without `Illegal invocation`.

2. **Automated Unit & Guard Tests**:
   - In `tests/projector-guest-media-bridge.test.mjs`:
     - Add mock timer/interval environment that strictly asserts `this === windowObj` for `setTimeout`, `clearTimeout`, `setInterval`, and `clearInterval`.
     - Verify that `syncProjection()` cleanly acquires consumer stream, awaits playback readiness, emits `attached` status, and tears down cleanly without receiver errors.
