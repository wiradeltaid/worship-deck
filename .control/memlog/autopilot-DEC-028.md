---
artifact: .control/decisions/DEC-028-autopilot-mandate-canvas-presenter-visual-parity.md
---

## Resume

Iteration: 1
Run branch: autopilot/DEC-028 (PR: draft PR ready for owner review)
Stopped at: Done — all 3 tickets under SPEC-26 implemented and closed, 5 divergence categories at 0 across all 32 templates, BUG-34 and BUG-35 fixed, full test suite 845/845 passing.
Blocked: —
Parked: [ad-n]
Next: Owner final review and merge into main

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| Preflight | wdi-autopilot preflight | Mandate DEC-028 accepted by owner kodesh87 for Canvas vs Presenter Visual & Framing Parity (SPEC-26) | Interactive approval at each ticket | Autonomous execution under ledger recording | DEC-028, decisions.yaml |
| Iteration 1 | SPEC-26-01 | Ported two-engine visual parity diagnostic harness to spa/src/pages/ParityDiagnosticPage.tsx under /services/diagnostic-parity, importing shipped modules | Keeping diagnostic tools only in scratch .work/ folder | Inability to continuously verify two-engine visual parity in CI/tests | ParityDiagnosticPage.tsx, App.tsx, smoke-spec-26.test.mjs |
| Iteration 1 | SPEC-26-02 | Closed BUG-35 in serializeCanvas by persisting element dimensions only when explicitly resized/moved by operator; unedited save is now strict no-op | Allowing Fabric self-widened Textbox dimensions to overwrite stored template geometry | Stored geometry permanently widening on unedited saves (+44.3% in sermon e1) | canvas-utils.ts, ArtifactEditor.tsx |
| Iteration 1 | SPEC-26-02 | Reconciled Canvas text engine by adding applyFabricTextFit with DOM probe matching ArtifactSlide's textFitRatio and largestFittingTextScale, plus clipPath for box bounds | Allowing Fabric Textbox to paint unclipped and without shrink-to-fit | Visual disparity between Canvas Editor and Presenter/Projector output | canvas-utils.ts, ArtifactEditor.tsx |
| Iteration 1 | SPEC-26-03 | Implemented tests/smoke-spec-26.test.mjs covering two-engine sweep (32 templates, 64 elements, 0 divergences), BUG-35 no-op guard, and 3 absence-guard proofs red-then-green | Relying on manual developer inspection without automated regression tests | Undetected regression in visual parity or geometry persistence | smoke-spec-26.test.mjs, package.json |
| Iteration 1 | Peer Review | Addressed Sonnet 5 peer review feedback by rewriting T-26-03 absence guards to execute real production modules (serializeCanvas, applyFabricTextFit) and prove defect injection fails red before passing | Retaining static assert.throws wrappers without exercising production functions | Fragile or tautological absence guards in committed test suite | smoke-spec-26.test.mjs, autopilot-DEC-028.md |

