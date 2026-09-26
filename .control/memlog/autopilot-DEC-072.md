---
artifact: .control/decisions/DEC-072-daily-autopilot-mandate-presentation-fidelity-slide-visibility.md
---

# Autopilot Ledger — DEC-072

## Resume

- State: In Progress — Tickets SPEC-85-01 and SPEC-85-02 closed, verified, and peer-reviewed (APPROVED by Terra)
- Run branch: autopilot/DEC-072
- Stopped at: —
- Blocked: —
- Parked: SPEC-73 Ticket 16 (WSD-H-17) parked on external milestone prerequisite
- Next: I-3 (SPEC-85-03)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-072 for Presentation Fidelity, Slide Visibility Control, and Operator Polish (SPEC-85) | waiting for interactive manual dispatch | low | .control/decisions/DEC-072-daily-autopilot-mandate-presentation-fidelity-slide-visibility.md |
| I-1 (SPEC-85-01) | src/lib/song-set-dirty-guard.ts, src/operator/DynamicFormBody.tsx, src/operator/EditForm.tsx, internal/httpapi/song_sets.go, tests/song-set-save-to-book-guard.test.mjs, tests/save-to-book-go-http.test.mjs | Song-Set Save-to-Book dirty guard, empty-string rejection, identity-change lifecycle, and synchronous ref-first state ordering, approved by Terra peer review | saving empty strings to hymnal or hiding retry button on save conflict | high | src/lib/song-set-dirty-guard.ts, src/operator/DynamicFormBody.tsx, src/operator/EditForm.tsx, internal/httpapi/song_sets.go, tests/song-set-save-to-book-guard.test.mjs, tests/save-to-book-go-http.test.mjs, .scratch/SPEC-85-presentation-fidelity-slide-visibility-and-operator-polish/issues/01-song-set-save-to-book-dirty-guard.md |
| I-2 (SPEC-85-02) | src/components/ScriptureOverlayView.tsx, src/lib/scripture-scaling.ts, tests/scripture-aspect-containment.test.mjs, tests/smoke-spec-43.test.mjs | Fixed 16:9 canvas aspect containment, stage-anchored container-query sizing (88cqw inner stage), exact computed padding content-box subtraction, pure cqh scaling, and bounded label clamp, approved by Terra peer review | distorted non-16:9 scripture scaling, rem clamp degradation on 4K/thumbnails, or ResizeObserver feedback oscillation | high | src/components/ScriptureOverlayView.tsx, src/lib/scripture-scaling.ts, tests/scripture-aspect-containment.test.mjs, tests/smoke-spec-43.test.mjs, .scratch/SPEC-85-presentation-fidelity-slide-visibility-and-operator-polish/issues/02-scripture-congregation-aspect-containment.md |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1433 pass, 0 fail), working tree clean.
- SPEC-85-01 verification: PASS — `tests/song-set-save-to-book-guard.test.mjs` (15/15 passed), `tests/save-to-book-go-http.test.mjs` (9/9 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), `npm test` (1448 passed, 0 failed, 3 skipped), Terra peer review APPROVED.
- SPEC-85-02 verification: PASS — `tests/scripture-aspect-containment.test.mjs` (8/8 passed), `tests/smoke-spec-43.test.mjs` (35/35 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), `public-repo-guard` (5/5 passed), Terra peer review APPROVED.
