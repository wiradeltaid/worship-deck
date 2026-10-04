---
artifact: .control/decisions/DEC-089-daily-autopilot-mandate-guest-speaker-hdmi-and-presenter-resilience.md
---

# Autopilot Ledger — DEC-089

## Resume

- Iteration: I-1
- Run branch: autopilot/DEC-089 (draft PR pending)
- Stopped at: In-progress — SPEC-101-01 completed; ready for SPEC-101-02
- Blocked: —
- Parked: —
- Next: Implement SPEC-101-02 (Presenter Guest Feed Controls, State Machine, and PresentChannel Projection)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-089 for Guest Speaker HDMI Video Capture Input (SPEC-101) and Presenter Display Crash, Scripture Density & Warming Resilience (SPEC-102) | waiting for interactive manual dispatch | low | .control/decisions/DEC-089-daily-autopilot-mandate-guest-speaker-hdmi-and-presenter-resilience.md |
| I-1 | SPEC-101-01 | Build CaptureBroker with single projector clone slot and 5s preview readiness deadline | multi-consumer unbounded Set | driver contention and clone leak | src/lib/capture-broker.ts |

## Smoke Test Results

- Preflight verification: in progress
