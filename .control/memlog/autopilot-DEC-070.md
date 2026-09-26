---
artifact: .control/decisions/DEC-070-daily-autopilot-mandate-dropdown-containment-and-pptx-wrap.md
---

# Autopilot Ledger — DEC-070

## Resume

- State: Applied — mandate completed; all open runnable specs (SPEC-82, SPEC-83) implemented, verified, peer-reviewed, and closed
- Run branch: autopilot/DEC-070 (Draft PR #115)
- Stopped at: Done
- Blocked: —
- Parked: SPEC-73 Ticket 16 (WSD-H-17) parked on external milestone prerequisite (Owner B-06 clean-VM test & Owner B-07 v0.1.0 release publication)
- Next: Owner final review and merge of PR #115

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-070 for Song-Set Dropdown Containment and PPTX Dynamic Text Word Wrap Parity (SPEC-82, SPEC-83) | waiting for interactive manual dispatch | low | .control/decisions/DEC-070-daily-autopilot-mandate-dropdown-containment-and-pptx-wrap.md |
| I-1 (SPEC-82-01) | src/lib/artifacts/render-model.ts, src/lib/present-channel.ts, tests/presenter-live-background-preview.test.mjs | Preserve authored deck background when lyric backgroundOverride is null/undefined/''/whitespace, normalize override via trim, add projector propagation guards, and verify via child-process real-file defect injection proofs, approved by Terra peer review | erasing deck background to undefined when override is null or default | medium | src/lib/artifacts/render-model.ts, src/lib/present-channel.ts, tests/presenter-live-background-preview.test.mjs, .scratch/SPEC-82-song-set-dropdown-containment-and-presenter-parity/issues/01-presenter-deck-default-background-resolution.md |
| I-2 (SPEC-82-02) | src/operator/DynamicFormBody.tsx, tests/song-set-background-parity.test.mjs | Constrain background selector trigger with w-full, dual min-w-0 flexbox text truncation, concise text-[11px] truncate labels (Image id and Song-Set Default (#id)) with title tooltips, and verify with branch-specific defect injection proofs, approved by Terra peer review | letting trigger overflow w-48 container and clip outside card boundaries | low | src/operator/DynamicFormBody.tsx, tests/song-set-background-parity.test.mjs, .scratch/SPEC-82-song-set-dropdown-containment-and-presenter-parity/issues/02-song-set-dropdown-containment-and-typography.md, .control/registry/specs.yaml |
| I-3 (SPEC-83-01) | src/lib/artifacts/render-model.ts, src/lib/pptx-draw.ts, tests/pptx-dynamic-text-native-word-wrap.test.mjs | Emit unmeasured dynamic text via resolveExplicitParagraphRunsForPptx without synthetic soft breaks, enabling native DrawingML wrap="square" and authored verticalAlign while preserving static authoritative wrap and SPEC-30 fixtures, approved by Terra peer review | injecting synthetic <a:br/> breaks on dynamic text that force premature lines in PowerPoint | medium | src/lib/artifacts/render-model.ts, src/lib/pptx-draw.ts, tests/pptx-dynamic-text-native-word-wrap.test.mjs, package.json, .scratch/SPEC-83-pptx-dynamic-text-native-word-wrap/issues/01-pptx-dynamic-text-native-word-wrap.md, .control/registry/specs.yaml |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1362 pass, 0 fail), working tree clean.
- SPEC-82-01 verification: PASS — `tests/presenter-live-background-preview.test.mjs` (7/7 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), Terra peer review APPROVED.
- SPEC-82-02 verification: PASS — `tests/song-set-background-parity.test.mjs` (6/6 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), Terra peer review APPROVED.
- SPEC-83-01 verification: PASS — `tests/pptx-dynamic-text-native-word-wrap.test.mjs` (6/6 passed), `tests/smoke-spec-30.test.mjs` (6/6 passed), `tests/pptx-word-wrap-option.test.mjs` (6/6 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), Terra peer review APPROVED.
