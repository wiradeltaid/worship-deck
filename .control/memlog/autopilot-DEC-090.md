---
artifact: .control/decisions/DEC-090-daily-autopilot-mandate-unified-display-and-scripture-normalization.md
---

# Autopilot Ledger — DEC-090

## Resume

- Iteration: I-1 (final)
- Run branch: autopilot/DEC-090
- Stopped at: Complete — All FR/Tickets/Specs in scope (SPEC-103) delivered, verified, and mandate applied
- Blocked: —
- Parked: —
- Next: Owner review and merge of PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-090 for Presenter Unified Display Selection, Guest Capture Discovery, Fullscreen Navigation, and Scripture Comma Normalization (SPEC-103) | waiting for interactive manual dispatch | low | .control/decisions/DEC-090-daily-autopilot-mandate-unified-display-and-scripture-normalization.md |
| I-1 | SPEC-103-01 | Wrap DropdownMenuLabel in DropdownMenuGroup, expose idempotent enumerateDevices & selectDevice with generation gating, and place guest feed control in Header Row 1 | unguarded dropdown labels, auto-arming radio items, and fragmented row placement | Base UI crash on open, unwanted device lockup, and poor operator discoverability | src/operator/present/PresenterGuestFeedControl.tsx, src/operator/present/presenter-guest-feed-controller.ts, src/lib/capture-broker.ts, src/operator/present/PresenterOperator.tsx |
| I-1 | SPEC-103-02 | Strip terminal punctuation, normalize comma-prefixed and bare translation suffixes with NKJV-before-KJV precedence in Go and TypeScript, and verify Service 10 warming | whitespace-only suffix patterns and un-sanitized trailing commas | 404 scripture lookup failures, degraded offline badge on Service 10, and broken multi-verse spans | internal/scripture/match.go, src/lib/offline/service-snapshot.ts, internal/scripture/match_test.go, tests/scripture-offline-resilience.test.mjs |
| I-1 | SPEC-103-03 | Add nav-next and nav-prev carrying serviceId and planIdentity, gate interactive/editable targets, and read fresh synchronous refs in Presenter | treating nav messages as liveness acks, allowing key intercepts in forms, and reading stale render closures | false liveness state, unwanted slide advances while typing, and stale plan navigation | src/lib/present-channel.ts, src/projected/ProjectorClient.tsx, src/operator/present/PresenterOperator.tsx, tests/present-channel.test.mjs, tests/projected-shell.test.mjs |
| I-1 | SPEC-103-04 | Unified DropdownMenuTrigger button, immediate target launch/relocate across all states including never-opened with known-open handle, pure focusProjector, and protected close with confirm | split button pattern, delayed target selection, overwriting location.href on focus, and inaccessible close button | accidental launch to wrong screen, crashing open window on focus, and inability to close lost window | src/operator/present/PresenterDisplayControl.tsx, src/operator/present/PresenterOperator.tsx, tests/presenter-congregation-display-control.test.mjs |

## Smoke Test Results

- Preflight verification: PASS (Go test suite green, TypeScript typecheck green, public-repo-guard green, smoke:spec-101 green, SPEC-102 suites green)
- SPEC-103: PASS (npm run smoke:spec-103, 82 tests green across all 5 test files)
