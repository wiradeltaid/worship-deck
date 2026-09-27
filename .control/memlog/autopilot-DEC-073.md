---
artifact: .control/decisions/DEC-073-daily-autopilot-mandate-operator-ergonomics-canvas-polish.md
---

# Autopilot Ledger — DEC-073

## Resume

- State: In Progress — SPEC-86-01 closed, verified, and peer-reviewed (APPROVED by Terra)
- Run branch: autopilot/DEC-073
- Stopped at: I-1 (SPEC-86-01 completed)
- Blocked: —
- Parked: SPEC-73 Ticket 16 (WSD-H-17) parked on external milestone prerequisite
- Next: SPEC-86-02 (Song-Set Lyric Action Dedicated Row Placement)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-073 for Operator Ergonomics, Canvas Polish, and Localization Parity (SPEC-86) | waiting for interactive manual dispatch | low | .control/decisions/DEC-073-daily-autopilot-mandate-operator-ergonomics-canvas-polish.md |
| I-1 (SPEC-86-01) | spa/src/pages/RunSheetPage.tsx, tests/run-sheet-header-tiered-layout.test.mjs, tests/run-sheet-header-redesign.test.mjs | Run-Sheet 50:50 two-column grid header, title truncation with line-break prevention, dynamic native title preservation, and 3-row tiered action clusters (Offline, Primary, Utility) with fail-closed containment and real-file defect injection proofs, approved by Terra peer review | unconstrained flex layout causing title breaks and button wrapping crowding on 1024-1440px viewports | low | spa/src/pages/RunSheetPage.tsx, tests/run-sheet-header-tiered-layout.test.mjs, tests/run-sheet-header-redesign.test.mjs, .scratch/SPEC-86-operator-ergonomics-canvas-polish-and-localization/issues/01-run-sheet-header-tiered-layout.md |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1490 pass, 0 fail), working tree clean.
- SPEC-86-01 verification: PASS — `tests/run-sheet-header-tiered-layout.test.mjs` (10/10 passed), `tests/run-sheet-header-redesign.test.mjs` (6/6 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), `public-repo-guard` (5/5 passed), Terra peer review APPROVED.
