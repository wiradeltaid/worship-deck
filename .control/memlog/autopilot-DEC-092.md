---
artifact: .control/decisions/DEC-092-daily-autopilot-mandate-guest-capture-permission-and-invocation.md
---

# Autopilot Ledger — DEC-092

## Resume

- Iteration: I-1
- Run branch: autopilot/DEC-092
- Stopped at: SPEC-106-01 complete; ready for SPEC-106-02
- Blocked: —
- Parked: —
- Next: SPEC-106-02

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-092 for Guest Video Capture Permission Discovery, Web API Receiver Binding, and Dropdown Click Resilience (SPEC-106) | waiting for interactive manual dispatch | low | .control/decisions/DEC-092-daily-autopilot-mandate-guest-capture-permission-and-invocation.md |
| I-1 | SPEC-106-01 | Normalize and defensively bind native mediaDevices methods to parent object and expose requestPermission with guaranteed probe teardown | unbound methods throwing Illegal invocation and manual device arming deadlock | runtime errors during capture card arm and inability to discover devices on unpermitted origins | src/lib/capture-broker.ts, src/operator/present/presenter-guest-feed-controller.ts, tests/capture-broker-device-enumeration.test.mjs |

## Smoke Test Results

- Preflight verification: PASS (Go test suite green, SPA build green, TypeScript typecheck green, public-repo-guard green, SPEC-104 & SPEC-105 test suites green)
- SPEC-106-01: PASS (CaptureBroker Web API receiver binding, requestPermission probe cleanup in try/finally, and controller delegation verified, tests/capture-broker-device-enumeration.test.mjs green)
