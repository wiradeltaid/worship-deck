---
artifact: .control/decisions/DEC-084-daily-autopilot-mandate-onedrive-connector-and-dual-hash-parity.md
---

# Autopilot Ledger — DEC-084

## Resume

- State: Iteration — Mandate accepted, ready to begin SPEC-95 execution
- Run branch: autopilot/DEC-084
- Stopped at: Mandate opened
- Blocked: —
- Parked: —
- Next: Begin SPEC-95 Ticket 01 (OAuth PKCE endpoints and SQLite config storage)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-084 for OneDrive Cloud Connector, PPTX Sync Prompt, and Dual-Hash Parity (SPEC-95, SPEC-96) | waiting for interactive manual dispatch | low | .control/decisions/DEC-084-daily-autopilot-mandate-onedrive-connector-and-dual-hash-parity.md |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1647 pass, 0 fail, 3 skipped), working tree clean.
