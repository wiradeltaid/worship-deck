---
title: 'Go process listens, gates, and opens SQLite'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_revision: '7030c26'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '.how/_platform/ARCHITECTURE-SPINE.md'
  - '.control/decisions/DEC-003-go-api-react-spa-pptx-worker.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The always-on process is still Next.js. AD-30 requires a Go API that owns the request gate and SQLite.

**Approach:** Add `cmd/api` that listens, applies the AD-5 prefix matcher, verifies `auth_session` and re-checks SQLite, and opens `DB_PATH` with startup DDL. Unauthenticated gated JSON is 401. Exempt paths do not check the cookie.

## Boundaries & Constraints

**Always:** Same exempt prefixes as `src/proxy.ts` (`(?:/|$)` semantics). `/api/uploads` stays gated. `Cache-Control: private, no-store` on gated responses. One process opens the SQLite file.

**Block If:** A new matcher exclusion without its assertion test. A Node app server as the live API. Editing `.what/`, `.how/`, or an applied DEC.

**Never:** Congregation data, `.env` committed, inventory renumber, `/api/health` unless a new inventory row is added properly.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Gated, no cookie | `GET /api/services` | `401` `{ error: "Unauthorized" }` | no-store |
| Exempt | `POST /api/auth/login` without cookie | Gate does not 401 for missing session (handler may still 400/401 for body) | — |
| Prefix widen | `GET /api/webhookfoo` | Gated (401 without cookie) | — |
| Valid cookie | HMAC ok, account live, sid not revoked | Request proceeds | Fail closed if DB lookup throws |
| Admin path | `/api/admin/**` with operator cookie | `403` | — |

</intent-contract>

## Code Map

- `cmd/api/main.go` — listen `PORT` default 3000
- `internal/gate` — matcher + HTTP middleware
- `internal/auth` — cookie HMAC + DB re-check
- `internal/db` — open + DDL
- `src/proxy.ts` + `tests/proxy-matcher.test.mjs` — keep lists aligned
- `tests/go-http-gate.test.mjs` — spawn `go run ./cmd/api`

## Tasks & Acceptance

- Go binary/process listens without Next.
- GATED/EXEMPT lists match the Next pin (same paths as `tests/proxy-matcher.test.mjs`).
- SQLite file is created/opened on start.
- `tests/go-http-gate.test.mjs` registered in `package.json`.

## Spec Change Log

## Review Triage Log
