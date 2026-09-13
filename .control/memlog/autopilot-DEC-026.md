---
artifact: .control/decisions/DEC-026-autopilot-mandate-canvas-healing-persistence-isolation.md
---

## Resume

Iteration: 1
Run branch: autopilot/DEC-026 (PR: ready for owner review)
Stopped at: Done — all 4 tickets under SPEC-24 implemented and closed, dual-reviewed with in-session coordinator and Sonnet 5 peer review (APPROVED), all 8 tests in smoke-spec-24 and full suite passing
Blocked: —
Parked: [ad-n]
Next: Owner final review and merge of draft PR #62 into main

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| Preflight | wdi-autopilot preflight | Mandate DEC-026 accepted by owner kodesh87 for Canvas Healing Dirty-State & Persistence Isolation (SPEC-24) | Interactive approval at each ticket | Autonomous execution under ledger recording | DEC-026, decisions.yaml |
| Iteration 1 | SPEC-24-01 | Decoupled background healing from navigation guard by removing markDirty() from unmeasured element check in mountCanvas and setting isHealingOnlyRef.current = false | Marking clean legacy slides dirty on mount | Spurious unsaved changes modal intercepting every slide switch | ArtifactEditor.tsx, smoke-spec-24.test.mjs |
| Iteration 1 | SPEC-24-02 | Added atomic markUserDirty() to reset isHealingOnlyRef.current = false and dirty form, hooked to canvas mutations (moving, scaling, resizing, modified, text changed) and controls | Allowing isHealingOnlyRef to remain true during user edits | User edits being misidentified as background healing passes | ArtifactEditor.tsx, smoke-spec-24.test.mjs |
| Iteration 1 | SPEC-24-03 | Implemented non-destructive serializeCanvas evaluating computedX/Y from live Fabric coordinates (left/top) and preserving live content and styles | Forcing source coordinates, content, and style on isHealingSave | Canvas edits snapping back to initial position and content on save | canvas-utils.ts, smoke-spec-24.test.mjs |
| Iteration 1 | SPEC-24-04 | Implemented automated smoke test suite (T-24-01..T-24-08) including verified absence-guard failure proofs and registered in package.json | Relying only on manual verification without automated regression guards | Silent regression on future healing or canvas edits | smoke-spec-24.test.mjs, package.json |
| Iteration 1 | Peer Review | Shelled-out Sonnet 5 peer review verified correctness across all 4 tickets, confirmed BUG-31 and BUG-32 resolution, noted bulk Re-measure all remains intact, and issued APPROVED verdict | Single-agent self-review | Risk of undetected edge cases in canvas lifecycle | ArtifactEditor.tsx, canvas-utils.ts, smoke-spec-24.test.mjs |
