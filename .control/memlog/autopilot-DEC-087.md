---
artifact: .control/decisions/DEC-087-daily-autopilot-mandate-congregation-display-target-and-scripture-line-budget-pagination.md
---

# Autopilot Ledger — DEC-087

## Resume

- State: In Progress — Loop initiated for SPEC-99 and SPEC-100
- Run branch: autopilot/DEC-087
- Stopped at: Preflight accepted, starting SPEC-99 implementation
- Blocked: —
- Parked: —
- Next: Implement SPEC-99 (Congregation Display Target and Window Mode Selection)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-087 for Congregation Display Target, Window Mode Selection, and Scripture Line-Budget Pagination (SPEC-99, SPEC-100) | waiting for interactive manual dispatch | low | .control/decisions/DEC-087-daily-autopilot-mandate-congregation-display-target-and-scripture-line-budget-pagination.md |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0), working tree clean.
- Peer Review: Terra independent review of PR #139 completed with verdict Accept.
