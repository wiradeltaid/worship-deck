---
artifact: .control/decisions/DEC-068-daily-autopilot-mandate-pptx-wrap-fonts-expansion-image-crop-aspect.md
---

# Autopilot Ledger — DEC-068

## Resume

- State: In progress — SPEC-78 closed; SPEC-79 and SPEC-80 queued for implementation
- Run branch: autopilot/DEC-068 (Draft PR #113)
- Stopped at: SPEC-78 closed
- Blocked: —
- Parked: SPEC-73 Ticket 16 (WSD-H-17) parked on external milestone prerequisite (Owner B-06 clean-VM test & Owner B-07 v0.1.0 release publication)
- Next: I-2 (SPEC-79-01: Bundling curated 6 OFL presentation fonts into @fontsource and data/fonts/)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-068 for PPTX Word Wrap Option, Curated Presentation Fonts Expansion, and Image Crop Aspect Handling (SPEC-78, SPEC-79, SPEC-80) | waiting for interactive manual dispatch | low | .control/decisions/DEC-068-daily-autopilot-mandate-pptx-wrap-fonts-expansion-image-crop-aspect.md |
| I-1 (SPEC-78-01) | src/lib/pptx-draw.ts, internal/httpapi/server.go, spa/src/pages/RunSheetPage.tsx | Decouple native DrawingML word wrapping (wrap="square") from canvas line partitioning, support configurable ?wrap=false in Go API, and expose split download control in RunSheetPage, verified by Terra peer review | keeping DrawingML wrap="none" on canvas line partitions | medium | src/lib/pptx-draw.ts, src/lib/pptx.ts, workers/pptx/draw.mjs, internal/httpapi/server.go, internal/httpapi/server_test.go, spa/src/pages/RunSheetPage.tsx, package.json, tests/pptx-word-wrap-option.test.mjs, tests/pptx-go-http.test.mjs, .scratch/SPEC-78-pptx-word-wrap-option/issues/01-pptx-word-wrap-export-option.md |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0), `public-repo-guard` passed (5/5).
- SPEC-78-01 verification: PASS — `tests/pptx-word-wrap-option.test.mjs` (6/6 passed), `tests/pptx-go-http.test.mjs` (5/5 passed), `TestParseWordWrapParam` (passed), `npm run typecheck` (passed), `npm run spa:build` (passed), Terra peer review accept-with-changes (all changes applied).
