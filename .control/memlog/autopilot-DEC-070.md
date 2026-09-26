---
artifact: .control/decisions/DEC-070-daily-autopilot-mandate-dropdown-containment-and-pptx-wrap.md
---

# Autopilot Ledger — DEC-070

## Resume

- State: In-progress — SPEC-82-01 implemented and verified; proceeding to SPEC-82-02
- Run branch: autopilot/DEC-070 (Draft PR #115)
- Stopped at: Ticket boundary (SPEC-82-01 closed)
- Blocked: —
- Parked: SPEC-73 Ticket 16 (WSD-H-17) parked on external milestone prerequisite (Owner B-06 clean-VM test & Owner B-07 v0.1.0 release publication)
- Next: Implement SPEC-82-02 (Song-Set Background Dropdown Containment & Typography in DynamicFormBody.tsx)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-070 for Song-Set Dropdown Containment and PPTX Dynamic Text Word Wrap Parity (SPEC-82, SPEC-83) | waiting for interactive manual dispatch | low | .control/decisions/DEC-070-daily-autopilot-mandate-dropdown-containment-and-pptx-wrap.md |
| I-1 (SPEC-82-01) | src/lib/artifacts/render-model.ts, src/lib/present-channel.ts, tests/presenter-live-background-preview.test.mjs | Preserve authored deck background when lyric backgroundOverride is null/undefined/''/whitespace, normalize override via trim, add projector propagation guards, and verify via child-process real-file defect injection proofs, approved by Terra peer review | erasing deck background to undefined when override is null or default | medium | src/lib/artifacts/render-model.ts, src/lib/present-channel.ts, tests/presenter-live-background-preview.test.mjs, .scratch/SPEC-82-song-set-dropdown-containment-and-presenter-parity/issues/01-presenter-deck-default-background-resolution.md |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1362 pass, 0 fail), working tree clean.
- SPEC-82-01 verification: PASS — `tests/presenter-live-background-preview.test.mjs` (7/7 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), Terra peer review APPROVED.
