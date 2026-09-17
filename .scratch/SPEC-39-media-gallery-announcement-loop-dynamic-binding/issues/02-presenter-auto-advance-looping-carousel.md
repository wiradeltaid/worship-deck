# SPEC-39-02 — Presenter Section-Bounded Looping Carousel for Announcements

**What to build:**
Introduce an automated section-bounded carousel loop mode in `PresenterOperator.tsx` and `ProjectorClient.tsx` that enables announcement slide sequences to advance automatically on a configurable timer (5s, 7s, 10s, 15s) and wrap continuously within the active announcement section boundary, while disarming immediately upon manual operator navigation or deck refresh.

**Blocked by:** None (can start immediately)

**Status:** open

- [ ] Implement section-bounded looping state and timer controls in `src/operator/present/PresenterOperator.tsx`:
  - Add Loop Toggle button in the presenter header with active indicator badge.
  - Provide a dropdown selector for slide interval timing (5s, 7s, 10s, 15s; default 7s stored in `localStorage`).
  - Announcement section detection: compute `[sectionStartIndex, sectionEndIndex]` for contiguous announcement slides (`templateId.startsWith('ann-slide-')` or announcement group).
  - Loop execution: advance `currentSlideIndex` every interval. When reaching `sectionEndIndex`, wrap to `sectionStartIndex`.
  - Boundary safety: if the current slide is not in an announcement section, or if the section has $\le 1$ slide, looping is disabled or treated as a static hold.
  - Manual override guard: immediately disarm `isLooping = false` if the operator presses Arrow keys, clicks any slide in the jump grid/list, changes services, or clicks Stop Loop.
- [ ] Synchronize loop advance to projection screen:
  - Broadcast slide transitions via `present-channel` so `ProjectorClient.tsx` updates in lockstep with the operator loop timer.
  - Clean up active interval timers on component unmount or service switch.
- [ ] Conformance & Smoke Tests:
  - Add tests in `tests/smoke-spec-39.test.mjs` verifying loop timer step progression, wrap-around strictly at announcement section boundary, refusal to loop non-announcement liturgy, and immediate disarm upon manual key/navigation input.
  - Absence guard verifying that removing boundary wrap logic fails tests.
