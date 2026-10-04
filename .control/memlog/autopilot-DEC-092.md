---
artifact: .control/decisions/DEC-092-daily-autopilot-mandate-guest-capture-permission-and-invocation.md
---

# Autopilot Ledger — DEC-092

## Resume

- Iteration: I-1 (final)
- Run branch: autopilot/DEC-092
- Stopped at: Complete — All FR/Tickets/Specs in scope (SPEC-106) delivered, verified, and mandate ready to conclude
- Blocked: —
- Parked: —
- Next: § Finish — Run full suite locally, mark draft PR ready, apply mandate

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-092 for Guest Video Capture Permission Discovery, Web API Receiver Binding, and Dropdown Click Resilience (SPEC-106) | waiting for interactive manual dispatch | low | .control/decisions/DEC-092-daily-autopilot-mandate-guest-capture-permission-and-invocation.md |
| I-1 | SPEC-106-01 | Normalize and defensively bind native mediaDevices methods to parent object and expose requestPermission with guaranteed probe teardown | unbound methods throwing Illegal invocation and manual device arming deadlock | runtime errors during capture card arm and inability to discover devices on unpermitted origins | src/lib/capture-broker.ts, src/operator/present/presenter-guest-feed-controller.ts, tests/capture-broker-device-enumeration.test.mjs |
| I-1 | SPEC-106-02 | Add controlled dropdown snapshot with request invalidation, explicit permission CTA, and FR-25 1:1 bilingual parity | live dropdown re-renders mid-pointer-press and un-actionable empty state | dropped clicks during device selection and operator confusion on unpermitted origins | src/operator/present/PresenterGuestFeedControl.tsx, src/lib/i18n/keys.ts, src/lib/i18n/catalogue-en.ts, src/lib/i18n/catalogue-id.ts, tests/presenter-guest-feed-controls.test.mjs, package.json |

## Smoke Test Results

- Preflight verification: PASS (Go test suite green, SPA build green, TypeScript typecheck green, public-repo-guard green, SPEC-104 & SPEC-105 test suites green)
- SPEC-106-01: PASS (CaptureBroker Web API receiver binding, requestPermission probe cleanup in try/finally, and controller delegation verified, tests/capture-broker-device-enumeration.test.mjs green)
- SPEC-106-02: PASS (Controlled dropdown state, request invalidation, permission CTA, and bilingual parity verified, tests/presenter-guest-feed-controls.test.mjs green)
- SPEC-106: PASS (npm run smoke:spec-106, 46 tests green across tests/capture-broker-device-enumeration.test.mjs and tests/presenter-guest-feed-controls.test.mjs)
