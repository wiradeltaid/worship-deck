---
artifact: .control/decisions/DEC-093-daily-autopilot-mandate-guest-capture-timer-receiver-binding-and-transitions.md
---

# Autopilot Ledger — DEC-093

## Resume

- Iteration: I-1 (SPEC-107-01 closed)
- Run branch: autopilot/DEC-093
- Stopped at: In progress (SPEC-107-01 closed, advancing to SPEC-107-02)
- Blocked: —
- Parked: —
- Next: SPEC-107-02 execution (ProjectorGuestMediaBridge timer receiver binding)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-093 for Guest Video Capture Native Timer Receiver Binding, Header Row 3 Tiering, and Projector Transition Parity (SPEC-107) | waiting for interactive manual dispatch | low | .control/decisions/DEC-093-daily-autopilot-mandate-guest-capture-timer-receiver-binding-and-transitions.md |
| I-1 | SPEC-107-01 | Defensively bind raw timers to timerTarget (window/globalThis) and handle zero handles in CaptureBroker and PresenterGuestFeedController | bare calls and unbound properties passing this.env or controller | TypeError Illegal invocation when arming or running deadline/watchdog in V8 | src/lib/capture-broker.ts, src/operator/present/presenter-guest-feed-controller.ts, tests/capture-broker-device-enumeration.test.mjs |

## Smoke Test Results

- Preflight verification: PASS (Go test suite green, SPA build green, TypeScript typecheck green, public-repo-guard green, SPEC-106 smoke suite green, full npm test suite 1855 tests green)
- SPEC-107-01: PASS (CaptureBroker and PresenterGuestFeedController receiver binding, default environment strict window verification, and zero handle cancellation verified; tests/capture-broker-device-enumeration.test.mjs green)
