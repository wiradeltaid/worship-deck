---
artifact: .control/decisions/DEC-087-daily-autopilot-mandate-congregation-display-target-and-scripture-line-budget-pagination.md
---

# Autopilot Ledger — DEC-087

## Resume

- State: In Progress — SPEC-100-01 implemented and verified, continuing to SPEC-100-02
- Run branch: autopilot/DEC-087
- Stopped at: Finished SPEC-100-01, continuing to SPEC-100-02
- Blocked: —
- Parked: —
- Next: SPEC-100-02 (Presentation Surface Line-Budget Scaling & Scripture Overlay Continuation Rendering)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-087 for Congregation Display Target, Window Mode Selection, and Scripture Line-Budget Pagination (SPEC-99, SPEC-100) | waiting for interactive manual dispatch | low | .control/decisions/DEC-087-daily-autopilot-mandate-congregation-display-target-and-scripture-line-budget-pagination.md |
| I-1 (SPEC-99-01) | display-target.ts | Concrete display target model, multi-screen fingerprinting, intent persistence, and safe window fallback | hardcoded popup window coordinates or raw display index | low | src/lib/display-target.ts, tests/display-target-resolver.test.mjs |
| I-2 (SPEC-99-02) | PresenterDisplayControl.tsx | Accessible split button pattern with dynamic liveness state, multi-screen radio selector, and bilingual translations | monolithic single-purpose button with hardcoded popup launch | low | src/operator/present/PresenterDisplayControl.tsx, src/operator/present/PresenterOperator.tsx, src/lib/i18n/keys.ts, src/lib/i18n/catalogue-en.ts, src/lib/i18n/catalogue-id.ts, tests/presenter-congregation-display-control.test.mjs |
| I-3 (SPEC-99-03) | PresenterOperator.tsx, ProjectorClient.tsx | Multi-screen placement coordinates, live retargeting window relocation, fullscreen query orchestration, and F11 fallback | rigid popup placement on primary screen with operator lockout | low | src/operator/present/PresenterOperator.tsx, src/projected/ProjectorClient.tsx, tests/congregation-screen-placement.test.mjs |
| I-4 (SPEC-100-01) | scripture-format.ts | Conservative visual line estimation (CHARS_PER_LINE = 60, HARD_LINES = 10), both-sides sealed isolation (>= 450 chars), and lossless continuation splitting | naive 8-verse/900-char chunking causing micro-font collapse on narrative chapters | low | src/lib/scripture-format.ts, tests/scripture-line-budget-pagination.test.mjs |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0), working tree clean.
- Peer Review: Terra independent review of PR #139 completed with verdict Accept.
- SPEC-99 Peer Review: Terra independent review of SPEC-99 completed with verdict APPROVE.
