---
artifact: .control/decisions/DEC-093-daily-autopilot-mandate-guest-capture-timer-receiver-binding-and-transitions.md
---

# Autopilot Ledger — DEC-093

## Resume

- Iteration: I-1 (final)
- Run branch: autopilot/DEC-093
- Stopped at: Complete — All FR/Tickets/Specs in scope (SPEC-107) delivered, verified, and mandate applied
- Blocked: —
- Parked: —
- Next: Owner review and merge of PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-093 for Guest Video Capture Native Timer Receiver Binding, Header Row 3 Tiering, and Projector Transition Parity (SPEC-107) | waiting for interactive manual dispatch | low | .control/decisions/DEC-093-daily-autopilot-mandate-guest-capture-timer-receiver-binding-and-transitions.md |
| I-1 | SPEC-107-01 | Defensively bind raw timers to timerTarget (window/globalThis) and handle zero handles in CaptureBroker and PresenterGuestFeedController | bare calls and unbound properties passing this.env or controller | TypeError Illegal invocation when arming or running deadline/watchdog in V8 | src/lib/capture-broker.ts, src/operator/present/presenter-guest-feed-controller.ts, tests/capture-broker-device-enumeration.test.mjs |
| I-1 | SPEC-107-02 | Pair setTimeout, clearTimeout, setInterval, clearInterval with true owning target and schedule deadline before sync readiness check | independent target extraction and post-check deadline scheduling | receiver context mismatch on partial window shims and lingering deadline handles on sync ready | src/projected/projector-guest-media-bridge.ts, tests/projector-guest-media-bridge.test.mjs |
| I-1 | SPEC-107-03 | Relocate PresenterGuestFeedControl into dedicated presenter-header-row-3 full-width flex container | crowded row 1 layout crowding display control and pairing button | operator misclicks on small laptop viewports and cramped visual wrapping | src/operator/present/PresenterOperator.tsx, tests/presenter-guest-feed-controls.test.mjs |
| I-1 | SPEC-107-04 | Phase-driven mount lifecycle with retained media reference, canonical AD-23 transition durations, and track ended listener | abrupt unmounting upon switch/revert and hardcoded 300ms duration | jarring visual cuts on sanctuary screen, premature stream unmount before exit animation, and unhandled hardware disconnects | src/lib/transitions.ts, src/projected/ProjectorClient.tsx, tests/projected-transitions.test.mjs |

## Smoke Test Results

- Preflight verification: PASS (Go test suite green, SPA build green, TypeScript typecheck green, public-repo-guard green, SPEC-106 smoke suite green, full npm test suite 1855 tests green)
- SPEC-107-01: PASS (CaptureBroker and PresenterGuestFeedController receiver binding, default environment strict window verification, and zero handle cancellation verified; tests/capture-broker-device-enumeration.test.mjs green)
- SPEC-107-02: PASS (ProjectorGuestMediaBridge timer/interval receiver binding, default environment strict window verification, zero handle cancellation, and immediate sync cleanup verified; tests/projector-guest-media-bridge.test.mjs green)
- SPEC-107-03: PASS (Presenter header row 3 tiering, row 1/row 2 exclusivity, actions container containment, and defect injection verified; tests/presenter-guest-feed-controls.test.mjs green)
- SPEC-107-04: PASS (Phase-driven mounting, retained media stream during exit, canonical AD-23 SLIDE_TRANSITION_SPECS consumption, track ended listener, and defect injection verified; tests/projected-transitions.test.mjs green)
- SPEC-107: PASS (npm run smoke:spec-107, 75 tests green across device enumeration, feed controls, media bridge, and projected transitions)
