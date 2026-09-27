---
artifact: .control/decisions/DEC-075-daily-autopilot-mandate-cross-machine-cloud-sync.md
---

# Autopilot Ledger — DEC-075

## Resume

- State: In-progress — All SPEC-88 tickets (SPEC-88-01 through 04) implemented, verified, and peer-reviewed (APPROVED by Terra)
- Run branch: autopilot/DEC-075
- Stopped at: Done — all FRs in mandate scope completed and verified
- Blocked: —
- Parked: SPEC-73 Ticket 16 (WSD-H-17) parked on external milestone prerequisite
- Next: Staging, committing to run branch autopilot/DEC-075, running final local suite, and opening draft PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-075 for Cross-Machine Cloud Sync with Ephemeral Auth and CORS (SPEC-88) | waiting for interactive manual dispatch | low | .control/decisions/DEC-075-daily-autopilot-mandate-cross-machine-cloud-sync.md |
| I-1 (SPEC-88-01..04) | internal/httpapi/server.go, internal/httpapi/auth.go, src/lib/sync/client.ts, spa/src/pages/AdminSyncPage.tsx, tests/sync-cors-and-bearer-auth.test.mjs, tests/admin-sync-ephemeral-auth.test.mjs | Cross-Machine Cloud Sync with Go API Bearer Auth, CORS origin allowlisting & preflight handling, login token export, SyncHttpError structured errors, and in-memory origin-bound RemoteAuthDialog lifecycle with asset 401 re-prompting and conflict resolution origin validation, approved by Terra peer review | relying on cookie-only gate or storing device tokens in browser storage | low | internal/httpapi/server.go, internal/httpapi/auth.go, src/lib/sync/client.ts, spa/src/pages/AdminSyncPage.tsx, tests/sync-cors-and-bearer-auth.test.mjs, tests/admin-sync-ephemeral-auth.test.mjs |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1543 pass, 0 fail), working tree clean.
- SPEC-88-01..04 verification: PASS — `tests/sync-cors-and-bearer-auth.test.mjs` (12/12 passed), `tests/admin-sync-ephemeral-auth.test.mjs` (9/9 passed), `npm run smoke:spec-88` (21/21 passed), `npm run typecheck` (0 errors), `npm run spa:build` (passed), `public-repo-guard` (5/5 passed), Go test suite (11/11 packages passed), Terra independent peer review APPROVED.
