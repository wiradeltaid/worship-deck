---
artifact: .control/decisions/DEC-068-daily-autopilot-mandate-pptx-wrap-fonts-expansion-image-crop-aspect.md
---

# Autopilot Ledger — DEC-068

## Resume

- State: In progress — mandate accepted; open runnable specs (SPEC-78, SPEC-79, SPEC-80) queued for implementation
- Run branch: autopilot/DEC-068
- Stopped at: Mandate initiated
- Blocked: —
- Parked: SPEC-73 Ticket 16 (WSD-H-17) parked on external milestone prerequisite (Owner B-06 clean-VM test & Owner B-07 v0.1.0 release publication)
- Next: I-1 (SPEC-78-01: Decouple drawingML wrap from canvas partitioning and support wordWrap export query parameter)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-068 for PPTX Word Wrap Option, Curated Presentation Fonts Expansion, and Image Crop Aspect Handling (SPEC-78, SPEC-79, SPEC-80) | waiting for interactive manual dispatch | low | .control/decisions/DEC-068-daily-autopilot-mandate-pptx-wrap-fonts-expansion-image-crop-aspect.md |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0), `public-repo-guard` passed (5/5).
