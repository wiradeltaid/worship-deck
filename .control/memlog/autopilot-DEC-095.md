---
artifact: .control/decisions/DEC-095-daily-autopilot-mandate-scripture-pagination-crossfade-backdrop-continuity.md
---

# Autopilot Ledger — DEC-095

## Resume

- Iteration: I-1 (final)
- Run branch: autopilot/DEC-095
- Stopped at: Complete — All FR/Tickets/Specs in scope (SPEC-109) delivered, verified, and mandate applied
- Blocked: —
- Parked: —
- Next: Owner review and merge of PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-095 for Scripture Overlay Pagination Crossfade Backdrop Continuity Parity (SPEC-109) | waiting for interactive manual dispatch | low | .control/decisions/DEC-095-daily-autopilot-mandate-scripture-pagination-crossfade-backdrop-continuity.md |
| I-1 | SPEC-109-01 | Mount persistent scripture backdrop layer at z-20 with #0B1220 and pointer-events-none beneath outgoing and active scripture overlays | per-overlay backgrounds without common backdrop | 25% underlying slide alpha bleed during fade/dissolve crossfades | src/projected/ProjectorClient.tsx |
| I-1 | SPEC-109-02 | Define getScriptureBackdropStyle and ScriptureBackdropPhase in transitions.ts conforming to SLIDE_TRANSITION_SPECS and AD-23 | hardcoded opacity classes on backdrop | inconsistent transition timings and sliding black seams on push | src/lib/transitions.ts |
| I-1 | SPEC-109-03 | Authoritative ScriptureOverlayStateMachine with synchronous ref authority, in-flight exit reconciliation, and automated regression suite | duplicate test-only state machine without ref synchronization | race conditions on rapid messages and desynchronized opacity on transition changes | src/lib/transitions.ts, src/projected/ProjectorClient.tsx, tests/projected-transitions.test.mjs, package.json |

## Smoke Test Results

- Preflight verification: PASS (Go test suite green, SPA build green, public-repo-guard green, full npm test suite 1875 tests green, validator green)
- SPEC-109-01: PASS (Persistent scripture backdrop layer rendered at z-20 with #0B1220 and pointer-events-none; tests/projected-transitions.test.mjs green)
- SPEC-109-02: PASS (getScriptureBackdropStyle exports canonical 0ms cut, 500ms fade/dissolve, and 450ms push opacity styling; tests/projected-transitions.test.mjs green)
- SPEC-109-03: PASS (ScriptureOverlayStateMachine zero alpha bleed verification, live transition change reconciliation, and edge-case suites green; npm run test:smoke-spec-109 passes 39 tests green)
- Acceptance suites: PASS (tests/acceptance-fr16-fr19-fr28.test.mjs green)
