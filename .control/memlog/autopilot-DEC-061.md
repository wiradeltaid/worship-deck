---
artifact: .control/decisions/DEC-061-daily-autopilot-mandate-exempt-branding-assets-session-gate.md
---

# Autopilot Ledger — DEC-061

## Resume

- Iteration: 1
- Run branch: autopilot/DEC-061
- Stopped at: Mandate DEC-061 completed — SPEC-66 closed through G5 Release
- Blocked: —
- Parked: —
- Next: § Finish — reconcile, validate, smoke test, and PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-061 for Exempt Branding Static Assets from Session Gate (SPEC-66) | waiting for interactive manual dispatch | low | .control/decisions/DEC-061-daily-autopilot-mandate-exempt-branding-assets-session-gate.md |
| I-1 (SPEC-66-01) | internal/gate/gate.go & internal/httpapi/branding_gate_test.go | Add /branding to exemptPrefixes and assert initial response is 200 image/svg+xml without redirect | leaving /branding gated and broken on LoginPage | high | internal/gate/gate.go, internal/gate/gate_test.go, internal/httpapi/branding_gate_test.go, tests/go-http-gate.test.mjs |
