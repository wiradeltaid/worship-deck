---
artifact: .control/decisions/DEC-068-daily-autopilot-mandate-pptx-wrap-fonts-expansion-image-crop-aspect.md
---

# Autopilot Ledger — DEC-068

## Resume

- State: Applied — mandate completed; all open runnable specs (SPEC-78, SPEC-79, SPEC-80) implemented, verified, peer-reviewed, and closed
- Run branch: autopilot/DEC-068 (Draft PR #113)
- Stopped at: Done
- Blocked: —
- Parked: SPEC-73 Ticket 16 (WSD-H-17) parked on external milestone prerequisite (Owner B-06 clean-VM test & Owner B-07 v0.1.0 release publication)
- Next: Owner final review and merge of PR #113

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-068 for PPTX Word Wrap Option, Curated Presentation Fonts Expansion, and Image Crop Aspect Handling (SPEC-78, SPEC-79, SPEC-80) | waiting for interactive manual dispatch | low | .control/decisions/DEC-068-daily-autopilot-mandate-pptx-wrap-fonts-expansion-image-crop-aspect.md |
| I-1 (SPEC-78-01) | src/lib/pptx-draw.ts, internal/httpapi/server.go, spa/src/pages/RunSheetPage.tsx | Decouple native DrawingML word wrapping (wrap="square") from canvas line partitioning, support configurable ?wrap=false in Go API, and expose split download control in RunSheetPage, verified by Terra peer review | keeping DrawingML wrap="none" on canvas line partitions | medium | src/lib/pptx-draw.ts, src/lib/pptx.ts, workers/pptx/draw.mjs, internal/httpapi/server.go, internal/httpapi/server_test.go, spa/src/pages/RunSheetPage.tsx, package.json, tests/pptx-word-wrap-option.test.mjs, tests/pptx-go-http.test.mjs, .scratch/SPEC-78-pptx-word-wrap-option/issues/01-pptx-word-wrap-export-option.md |
| I-2 (SPEC-79) | package.json, spa/src/fonts.css, src/lib/registry/font-catalog.ts, data/fonts/, THIRD-PARTY-NOTICES, docs/public-facts.yaml | Bundle 6 curated presentation fonts (Plus Jakarta Sans, Fraunces, Source Serif 4, Calistoga, Cinzel Decorative, Syne) with 46 offline TTF files, full author provenance, and synchronized public facts, verified by Terra peer review | depending on external CDN fonts or missing bold faces | medium | package.json, package-lock.json, spa/src/fonts.css, src/lib/registry/font-catalog.ts, data/fonts/, THIRD-PARTY-NOTICES, docs/public-facts.yaml, README*.md, tests/bundled-fonts-guard.test.mjs, tests/pptx-bundled-fonts.test.mjs, tests/third-party-notices.test.mjs, tests/installer-corpora-staging.test.mjs, tests/artifact-font-catalog.test.mjs, .scratch/SPEC-79-curated-presentation-fonts-expansion/ |
| I-3 (SPEC-80-01) | src/lib/images/crop-image.ts, src/components/media/ImageCropDialog.tsx | Expand crop aspect ratio selector to 9 structured presets (including Original and Custom), eliminate silent 4:3 fallback with finite number guarantees, add strict W:H input validation and clamping (0.1–10.0), and provide pan/zoom guidance hint, verified by Terra peer review | keeping 4-preset toggle with silent 4:3 fallback on undefined | medium | src/lib/images/crop-image.ts, src/components/media/ImageCropDialog.tsx, package.json, tests/crop-aspect-presets.test.mjs, .scratch/SPEC-80-image-crop-presets-and-aspect-handling/ |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0), `public-repo-guard` passed (5/5).
- SPEC-78-01 verification: PASS — `tests/pptx-word-wrap-option.test.mjs` (6/6 passed), `tests/pptx-go-http.test.mjs` (5/5 passed), `TestParseWordWrapParam` (passed), `npm run typecheck` (passed), `npm run spa:build` (passed), Terra peer review accept-with-changes (all changes applied).
- SPEC-79 verification: PASS — `tests/bundled-fonts-guard.test.mjs` (5/5 passed), `tests/pptx-bundled-fonts.test.mjs` (5/5 passed), `tests/third-party-notices.test.mjs` (2/2 passed), `tests/public-facts.test.mjs` (4/4 passed), `tests/installer-corpora-staging.test.mjs` (3/3 passed), `tests/artifact-font-catalog.test.mjs` (9/9 passed), `tests/smoke-spec-17.test.mjs` (4/4 passed), `tests/readme-claims-guard.test.mjs` (6/6 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), Terra peer review approved.
- SPEC-80-01 verification: PASS — `tests/crop-aspect-presets.test.mjs` (6/6 passed), `tests/image-crop-helper.test.mjs` (5/5 passed), `tests/service-image-crop-integration.test.mjs` (3/3 passed), `tests/canvas-media-crop-integration.test.mjs` (3/3 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), Terra peer review accept-with-changes (all changes applied).
