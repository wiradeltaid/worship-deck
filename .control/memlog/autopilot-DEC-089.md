---
artifact: .control/decisions/DEC-089-daily-autopilot-mandate-guest-speaker-hdmi-and-presenter-resilience.md
---

# Autopilot Ledger — DEC-089

## Resume

- Iteration: I-1
- Run branch: autopilot/DEC-089 (draft PR pending)
- Stopped at: In-progress — SPEC-101-02 completed; ready for SPEC-101-03
- Blocked: —
- Parked: —
- Next: Implement SPEC-101-03 (Projector Media Bridge, Fullscreen Rendering, and Fallback Telemetry)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-089 for Guest Speaker HDMI Video Capture Input (SPEC-101) and Presenter Display Crash, Scripture Density & Warming Resilience (SPEC-102) | waiting for interactive manual dispatch | low | .control/decisions/DEC-089-daily-autopilot-mandate-guest-speaker-hdmi-and-presenter-resilience.md |
| I-1 | SPEC-101-01 | Build CaptureBroker with single projector clone slot and 5s preview readiness deadline | multi-consumer unbounded Set | driver contention and clone leak | src/lib/capture-broker.ts |
| I-1 | SPEC-101-02 | Wire guest feed controller with single projection ref across all four sync producers, 5s attach deadline, and Escape panic | fragmented projection state and manual sync overrides | desynchronization on reconnect or emergency edits | src/operator/present/presenter-guest-feed-controller.ts |

## Smoke Test Results

- Preflight verification: in progress
