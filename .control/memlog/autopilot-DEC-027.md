---
artifact: .control/decisions/DEC-027-autopilot-mandate-canvas-presenter-parity-heal-crash.md
---

## Resume

Iteration: 1
Run branch: autopilot/DEC-027 (PR: ready for owner review)
Stopped at: Done — all 3 tickets under SPEC-25 implemented and closed, dual-reviewed with in-session coordinator and Sonnet 5 peer review (APPROVED after reconciling defect registry, touches list, and absence-guard test assertions), full suite 840/840 tests passing (837 pass, 0 fail, 3 skipped).
Blocked: —
Parked: [ad-n]
Next: Owner final review and merge of draft PR into main

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| Preflight | wdi-autopilot preflight | Mandate DEC-027 accepted by owner kodesh87 for Canvas/Presenter Parity Gap & Heal-Crash (SPEC-25) | Interactive approval at each ticket | Autonomous execution under ledger recording | DEC-027, decisions.yaml |
| Iteration 1 | SPEC-25-01 | Extracted buildTextFabricOptions, buildShapeFabricOptions, and elementToFabricObject to canvas-utils.ts, shared between ArtifactEditor.tsx and healTemplate() to build genuine Fabric objects | Keeping duplicate or partial object construction in healTemplate | t._set crash on Re-measure all and silent style data corruption on save | canvas-utils.ts, ArtifactEditor.tsx |
| Iteration 1 | SPEC-25-02 | Added tests/smoke-spec-25.test.mjs (T-25-01..T-25-07) covering crash prevention, full style fidelity round-trip, absence guards, and registered in package.json | Relying only on manual QA passes without automated regression checks | Silent regression on future Fabric or template changes | smoke-spec-25.test.mjs, package.json |
| Iteration 1 | SPEC-25-03 | Investigated BUG-34 stage cropping via Playwright across 6 viewports; resolved by adding container-type: size to parent and width: min(100cqw, calc(100cqh * 16 / 9)) to stage wrapper | Guessing CSS fixes without reproduction; letting stage stretch or crop | Stage clipping top/bottom and right edge in non-16:9 viewports | ArtifactSlide.tsx, smoke-spec-25.test.mjs, defects.yaml |
| Iteration 1 | Go Test Fix | Added 5ms sleep in background_library_test.go before second PATCH to advance timestamp on Windows timer tick | Allowing flaky updatedAt collision failure during test runs | Flaky test suite execution on Windows | background_library_test.go |
| Iteration 1 | Peer Review | Shelled-out Sonnet 5 review reviewed git diff against main; requested reconciling BUG-34 defect prose, touches list, and absence guard test assertions; all addressed and verified green | Proceeding with unaddressed peer review feedback | Process and documentation drift in registry and defect records | defects.yaml, decisions.yaml, smoke-spec-25.test.mjs, autopilot-DEC-027.md |
