---
artifact: .control/decisions/DEC-086-daily-autopilot-mandate-scripture-ergonomics-whole-chapter-display-modes-and-offline-caching.md
---

# Autopilot Ledger — DEC-086

## Resume

- State: Applied — All SPEC-98 tickets implemented, verified, peer-reviewed, and ready for maintainer merge
- Run branch: autopilot/DEC-086 (PR #138)
- Stopped at: Done — all FRs and specs in mandate scope completed and verified
- Blocked: —
- Parked: —
- Next: Maintainer review and merge PR #138 into main

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-086 for Scripture Ergonomics, Whole Chapter, Display Modes, and Offline Caching (SPEC-98) | waiting for interactive manual dispatch | low | .control/decisions/DEC-086-daily-autopilot-mandate-scripture-ergonomics-whole-chapter-display-modes-and-offline-caching.md |
| I-1 (SPEC-98-01) | PresenterOperator.tsx | Reposition clear scripture button to scripture actions cluster adjacent to push button | keeping clear button orphaned in header row 1 | low | src/operator/present/PresenterOperator.tsx, tests/scripture-controls-ergonomics.test.mjs |
| I-2 (SPEC-98-02) | match.go, scripture.go, scripture.ts | Support whole chapter reference parsing (<Book> <Chapter>) and structured verses array in Go and TS | requiring colon on every scripture lookup | low | internal/scripture/match.go, internal/httpapi/scripture.go, src/lib/scripture.ts, tests/scripture-chapter-lookup.test.mjs |
| I-3 (SPEC-98-03) | scripture-format.ts, ScriptureOverlayView.tsx, present-channel.ts | Deterministic dual display modes (per-verse vs inline), long-passage pagination, and authoritative ScriptureOverlay contract | monolithic text blob with unconstrained font collapse | low | src/lib/scripture-format.ts, src/components/ScriptureOverlayView.tsx, src/lib/present-channel.ts, tests/scripture-display-modes-and-scaling.test.mjs |
| I-4 (SPEC-98-04) | service-snapshot.ts, PresenterOperator.tsx | IndexedDB v3 scripture_cache store, canonical key derivation, and fail-closed SCN-4 semantics | network-only runtime lookups during offline presentation | low | src/lib/offline/service-snapshot.ts, src/operator/present/PresenterOperator.tsx, tests/scripture-offline-resilience.test.mjs |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1671 pass, 0 fail, 3 skipped), working tree clean.
- SPEC-98 verification: PASS — `npm run smoke:spec-98` (28/28 pass across all 4 tickets), Go test suite passed (exit 0), public repo guard passed (5/5 pass), typecheck and SPA build passed (exit 0), Terra peer review APPROVED.
