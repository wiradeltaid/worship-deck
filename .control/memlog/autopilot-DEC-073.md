---
artifact: .control/decisions/DEC-073-daily-autopilot-mandate-operator-ergonomics-canvas-polish.md
---

# Autopilot Ledger — DEC-073

## Resume

- State: In Progress — SPEC-86-05 closed, verified, and peer-reviewed (APPROVED by Terra)
- Run branch: autopilot/DEC-073
- Stopped at: I-5 (SPEC-86-05 completed)
- Blocked: —
- Parked: SPEC-73 Ticket 16 (WSD-H-17) parked on external milestone prerequisite
- Next: SPEC-86-06 (Strict Bilingual i18n Localization Parity Across Service & Presenter Surfaces)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-073 for Operator Ergonomics, Canvas Polish, and Localization Parity (SPEC-86) | waiting for interactive manual dispatch | low | .control/decisions/DEC-073-daily-autopilot-mandate-operator-ergonomics-canvas-polish.md |
| I-1 (SPEC-86-01) | spa/src/pages/RunSheetPage.tsx, tests/run-sheet-header-tiered-layout.test.mjs, tests/run-sheet-header-redesign.test.mjs | Run-Sheet 50:50 two-column grid header, title truncation with line-break prevention, dynamic native title preservation, and 3-row tiered action clusters (Offline, Primary, Utility) with fail-closed containment and real-file defect injection proofs, approved by Terra peer review | unconstrained flex layout causing title breaks and button wrapping crowding on 1024-1440px viewports | low | spa/src/pages/RunSheetPage.tsx, tests/run-sheet-header-tiered-layout.test.mjs, tests/run-sheet-header-redesign.test.mjs, .scratch/SPEC-86-operator-ergonomics-canvas-polish-and-localization/issues/01-run-sheet-header-tiered-layout.md |
| I-2 (SPEC-86-02) | src/operator/DynamicFormBody.tsx, tests/song-set-lyric-button-layout.test.mjs | Relocated Song-Set lyric action buttons (Edit/Close Lyrics and Save to Book) to a dedicated action row with strict direct sibling adjacency, tag-depth containment, and real-file defect injection proofs, approved by Terra peer review | keeping lyric buttons in selector input flex row causing mid-typing button jumps and horizontal layout shifts | low | src/operator/DynamicFormBody.tsx, tests/song-set-lyric-button-layout.test.mjs, .scratch/SPEC-86-operator-ergonomics-canvas-polish-and-localization/issues/02-song-set-lyric-button-layout.md |
| I-3 (SPEC-86-03) | src/components/SlidePreviewList.tsx, tests/slide-preview-hover-visibility.test.mjs | Hover-only opacity reveal (opacity-0 group-hover:opacity-100 focus-visible:opacity-100) on rundown slide visibility toggle while preserving persistent hidden badge visibility and real-file defect injection proofs, approved by Terra peer review | always-visible eye icons cluttering 50+ slide long service rundowns | low | src/components/SlidePreviewList.tsx, tests/slide-preview-hover-visibility.test.mjs, .scratch/SPEC-86-operator-ergonomics-canvas-polish-and-localization/issues/03-slide-preview-hover-visibility.md |
| I-4 (SPEC-86-04) | src/operator/present/PresenterOperator.tsx, tests/presenter-header-two-row-layout.test.mjs, tests/slide-visibility-hide-show.test.mjs | Reorganized Presenter header into two right-aligned semantic rows (Row 1 Display/Audience, Row 2 Safety/Workflow), moved active slide hide toggle to Current Slide transport bar, removed redundant header toggle and filmstrip hover button, and verified with real-file defect injection proofs, approved by Terra peer review | 8-button single-row header chaos, tiny hover buttons on filmstrip thumbnails, and slide visibility action trapped away from transport controls | low | src/operator/present/PresenterOperator.tsx, tests/presenter-header-two-row-layout.test.mjs, tests/slide-visibility-hide-show.test.mjs, .scratch/SPEC-86-operator-ergonomics-canvas-polish-and-localization/issues/04-presenter-header-two-row-layout.md |
| I-5 (SPEC-86-05) | src/operator/present/PresenterOperator.tsx, src/lib/emergency-canvas.ts, tests/emergency-canvas-inspector-crop.test.mjs | Type-specific Emergency Canvas inspector branching (shapes/lines omit image controls, images get upload/crop triggers), ImageCropDialog integration with Apply/upload race prevention and durable base64 Data URL offline fallback, approved by Terra peer review | invalid image controls on shapes/lines, missing image crop in emergency canvas, and Apply button race conditions | high | src/operator/present/PresenterOperator.tsx, src/lib/emergency-canvas.ts, tests/emergency-canvas-inspector-crop.test.mjs, .scratch/SPEC-86-operator-ergonomics-canvas-polish-and-localization/issues/05-emergency-canvas-inspector-crop.md |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1490 pass, 0 fail), working tree clean.
- SPEC-86-01 verification: PASS — `tests/run-sheet-header-tiered-layout.test.mjs` (10/10 passed), `tests/run-sheet-header-redesign.test.mjs` (6/6 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), `public-repo-guard` (5/5 passed), Terra peer review APPROVED.
- SPEC-86-02 verification: PASS — `tests/song-set-lyric-button-layout.test.mjs` (8/8 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), `public-repo-guard` (5/5 passed), Terra peer review APPROVED.
- SPEC-86-03 verification: PASS — `tests/slide-preview-hover-visibility.test.mjs` (6/6 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), `public-repo-guard` (5/5 passed), Terra peer review APPROVED.
- SPEC-86-04 verification: PASS — `tests/presenter-header-two-row-layout.test.mjs` (6/6 passed), `tests/slide-visibility-hide-show.test.mjs` (16/16 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), `public-repo-guard` (5/5 passed), Terra peer review APPROVED.
- SPEC-86-05 verification: PASS — `tests/emergency-canvas-inspector-crop.test.mjs` (10/10 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), `public-repo-guard` (5/5 passed), Terra peer review APPROVED.
