---
artifact: .control/decisions/DEC-090-daily-autopilot-mandate-unified-display-and-scripture-normalization.md
---

# Autopilot Ledger — DEC-090

## Resume

- Iteration: I-1
- Run branch: autopilot/DEC-090
- Stopped at: In progress — Tickets SPEC-103-01 and SPEC-103-02 completed
- Blocked: —
- Parked: —
- Next: SPEC-103-03 (BroadcastChannel Slide Navigation & Synchronization Protocol)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-090 for Presenter Unified Display Selection, Guest Capture Discovery, Fullscreen Navigation, and Scripture Comma Normalization (SPEC-103) | waiting for interactive manual dispatch | low | .control/decisions/DEC-090-daily-autopilot-mandate-unified-display-and-scripture-normalization.md |
| I-1 | SPEC-103-01 | Wrap DropdownMenuLabel in DropdownMenuGroup, expose idempotent enumerateDevices & selectDevice with generation gating, and place guest feed control in Header Row 1 | unguarded dropdown labels, auto-arming radio items, and fragmented row placement | Base UI crash on open, unwanted device lockup, and poor operator discoverability | src/operator/present/PresenterGuestFeedControl.tsx, src/operator/present/presenter-guest-feed-controller.ts, src/lib/capture-broker.ts, src/operator/present/PresenterOperator.tsx |
| I-1 | SPEC-103-02 | Strip terminal punctuation, normalize comma-prefixed and bare translation suffixes with NKJV-before-KJV precedence in Go and TypeScript, and verify Service 10 warming | whitespace-only suffix patterns and un-sanitized trailing commas | 404 scripture lookup failures, degraded offline badge on Service 10, and broken multi-verse spans | internal/scripture/match.go, src/lib/offline/service-snapshot.ts, internal/scripture/match_test.go, tests/scripture-offline-resilience.test.mjs |

## Smoke Test Results

- Preflight verification: PASS (Go test suite green, TypeScript typecheck green, public-repo-guard green, smoke:spec-101 green, SPEC-102 suites green)
