---
artifact: .control/decisions/DEC-048-daily-autopilot-mandate-continuous-engineering-routine.md
---

# Autopilot Ledger — DEC-048

## Resume

- Iteration: 1 (Progress)
- Run branch: autopilot/DEC-048
- Stopped at: Delivered SPEC-47-01 (Desktop Launcher, Mutex, and Data Dir Resolution)
- Blocked: —
- Parked: —
- Next: SPEC-47-02 Bundled Portable Node.js and PPTX Worker Isolation

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-048 for continuous engineering routine (SPEC-47) | waiting for interactive dispatch | low | .control/decisions/DEC-048-daily-autopilot-mandate-continuous-engineering-routine.md |
| I-1 (SPEC-47-01) | internal/desktop & cmd/api | Implement standalone desktop launcher, Windows Named Mutex, dynamic loopback port scanner, and LocalAppData data dir resolution | hardcoded cwd storage and wildcard network binds | high | internal/desktop, cmd/api/main.go, cmd/api/desktop_test.go |
| I-1 (peer-review) | internal/desktop & cmd/api | Apply Terra review fixes: ValidateBindHost loopback guard, fail-closed mutex exit, raw-byte defect injection, and 0700/0600 permissions | potential firewall alerts, concurrent process races, and permissions leak | high | internal/desktop/port.go, cmd/api/main.go, internal/desktop/mutex_other.go, tests/smoke-spec-47.test.mjs |
