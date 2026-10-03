---
artifact: .control/decisions/DEC-087-daily-autopilot-mandate-congregation-display-target-and-scripture-line-budget-pagination.md
---

# Autopilot Ledger — DEC-087

## Resume

- State: In Progress — SPEC-99 closed, ready to review and continue to SPEC-100
- Run branch: autopilot/DEC-087
- Stopped at: Finished SPEC-99, ready for peer review and SPEC-100
- Blocked: —
- Parked: —
- Next: Peer review SPEC-99 with Terra and begin SPEC-100 (Scripture Line-Budget Pagination & Long-Verse Resilience)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-087 for Congregation Display Target, Window Mode Selection, and Scripture Line-Budget Pagination (SPEC-99, SPEC-100) | waiting for interactive manual dispatch | low | .control/decisions/DEC-087-daily-autopilot-mandate-congregation-display-target-and-scripture-line-budget-pagination.md |
| I-1 (SPEC-99-01) | display-target.ts | Concrete display target model, multi-screen fingerprinting, intent persistence, and safe window fallback | hardcoded popup window coordinates or raw display index | low | src/lib/display-target.ts, tests/display-target-resolver.test.mjs |
| I-2 (SPEC-99-02) | PresenterDisplayControl.tsx | Accessible split button pattern with dynamic liveness state, multi-screen radio selector, and bilingual translations | monolithic single-purpose button with hardcoded popup launch | low | src/operator/present/PresenterDisplayControl.tsx, src/operator/present/PresenterOperator.tsx, src/lib/i18n/keys.ts, src/lib/i18n/catalogue-en.ts, src/lib/i18n/catalogue-id.ts, tests/presenter-congregation-display-control.test.mjs |
| I-3 (SPEC-99-03) | PresenterOperator.tsx, ProjectorClient.tsx | Multi-screen placement coordinates, live retargeting window relocation, fullscreen query orchestration, and F11 fallback | rigid popup placement on primary screen with operator lockout | low | src/operator/present/PresenterOperator.tsx, src/projected/ProjectorClient.tsx, tests/congregation-screen-placement.test.mjs |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0), working tree clean.
- Peer Review: Terra independent review of PR #139 completed with verdict Accept.
