---
artifact: .control/decisions/DEC-071-daily-autopilot-mandate-offline-presentation-resilience.md
---

# Autopilot Ledger — DEC-071

## Resume

- State: Complete — All 3 tickets of SPEC-84 closed, verified, and peer-reviewed (APPROVED by Terra)
- Run branch: autopilot/DEC-071
- Stopped at: Done — mandate DEC-071 complete
- Blocked: —
- Parked: SPEC-73 Ticket 16 (WSD-H-17) parked on external milestone prerequisite
- Next: PR to development_branch (main) and mandate review

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-071 for Offline Presentation Resilience and Emergency Local Edit (SPEC-84) | waiting for interactive manual dispatch | low | .control/decisions/DEC-071-daily-autopilot-mandate-offline-presentation-resilience.md |
| I-1 (SPEC-84-01) | spa/src/lib/auth/SessionProvider.tsx, src/lib/auth-session.ts, src/components/Header.tsx, spa/src/pages/OperatorShell.tsx, src/components/LogoutButton.tsx, spa/src/pages/ProjectorPage.tsx, src/lib/offline/service-snapshot.ts, tests/session-provider-resilience.test.mjs | Fault-tolerant session provider differentiating 401/403 from network failure, atomic online revalidation with monotonic sequence guards, offline server mutation gating, operation-scoped media resolution context with terminal revocation, and projector authorization bootstrapping, approved by Terra peer review | ejecting operators to /login on network outage or leaking blob URLs during route shifts | high | spa/src/lib/auth/SessionProvider.tsx, src/lib/auth-session.ts, src/components/Header.tsx, spa/src/pages/OperatorShell.tsx, src/components/LogoutButton.tsx, spa/src/pages/ProjectorPage.tsx, src/lib/offline/service-snapshot.ts, tests/session-provider-resilience.test.mjs, .scratch/SPEC-84-offline-presentation-resilience/issues/01-session-fault-tolerance.md |
| I-2 (SPEC-84-02) | src/lib/offline/service-snapshot.ts, src/components/offline/OfflineReadinessBadge.tsx, spa/src/pages/RunSheetPage.tsx, spa/src/pages/PresentPage.tsx, src/operator/present/PresenterOperator.tsx, src/components/Header.tsx, tests/offline-service-snapshot.test.mjs | Client-side service snapshot and auto-warming pre-cache with deep asset traversal, zero-media immediate readiness, generation and cacheEpoch concurrency guards, LRU eviction with unreferenced media sweeping, and accessible offline Sync item, approved by Terra peer review | blank screen presentation freezes on Wi-Fi loss, post-logout storage resurrection, or stale offline banner states | high | src/lib/offline/service-snapshot.ts, src/components/offline/OfflineReadinessBadge.tsx, spa/src/pages/RunSheetPage.tsx, spa/src/pages/PresentPage.tsx, src/operator/present/PresenterOperator.tsx, src/components/Header.tsx, tests/offline-service-snapshot.test.mjs, .scratch/SPEC-84-offline-presentation-resilience/issues/02-service-snapshot-and-auto-warming.md |
| I-3 (SPEC-84-03) | src/operator/present/PresenterOperator.tsx, src/projected/ProjectorClient.tsx, spa/src/pages/RunSheetPage.tsx, src/lib/present-channel.ts, src/lib/offline/service-snapshot.ts, internal/httpapi/services.go, internal/plan/plan.go, internal/db/schema.sql, internal/db/migrate.go, tests/emergency-local-edit.test.mjs, tests/services-go-http.test.mjs | Presentation lock matrix, emergency local edit with BroadcastChannel sync and mount replay, server-side patch persistence with stable canonical basePlanIdentity, lifecycle stale-replay guards, and in-place offline snapshot reversion, approved by Terra peer review | frozen onstage lyrics, desynchronized auditorium screens, or accidental destructive edits during worship | high | src/operator/present/PresenterOperator.tsx, src/projected/ProjectorClient.tsx, spa/src/pages/RunSheetPage.tsx, src/lib/present-channel.ts, src/lib/offline/service-snapshot.ts, internal/httpapi/services.go, internal/plan/plan.go, internal/db/schema.sql, internal/db/migrate.go, tests/emergency-local-edit.test.mjs, tests/services-go-http.test.mjs, .scratch/SPEC-84-offline-presentation-resilience/issues/03-emergency-local-edit.md |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1371 pass, 0 fail), working tree clean.
- SPEC-84-01 verification: PASS — `tests/session-provider-resilience.test.mjs` (18/18 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), Terra peer review APPROVED.
- SPEC-84-02 verification: PASS — `tests/offline-service-snapshot.test.mjs` (27/27 passed), `tests/theme-chrome.test.mjs` (70/70 passed), `tests/smoke-spec-47.test.mjs` (18/18 passed), `tests/public-repo-guard.test.mjs` (5/5 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), Terra peer review APPROVED.
- SPEC-84-03 verification: PASS — `tests/emergency-local-edit.test.mjs` (15/15 passed), `tests/services-go-http.test.mjs` (29/29 passed), `tests/smoke-spec-43.test.mjs` (30/30 passed), `tests/operator-shadcn-guard.test.mjs` (10/10 passed), `go test ./cmd/... ./internal/...` (passed), `npm test` (1433 passed, 0 failed, 3 skipped), `public-repo-guard.test.mjs` (5/5 passed), `npm run typecheck` (passed), `npm run spa:build` (passed), Terra peer review APPROVED.
