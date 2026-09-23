---
type: cross-cutting
status: draft
created: 2026-08-18
updated: 2026-09-22
---

# Cross-cutting

## Error envelope

There is no shared JSON schema beyond `{ error: string }` plus HTTP status. [PARTIAL] — read from several `internal/httpapi/*.go` handlers, not a five-lane spec.

| Status | Meaning for the caller |
| --- | --- |
| 400 | Invalid input (id, body) |
| 401 | Session or `WEBHOOK_SECRET` wrong/absent |
| 403 | Role insufficient (Admin) |
| 404 | Row does not exist |
| 409 | `updated_at` precondition failed (AD-6) |
| 500 | Server failure; generic message to the client |
| 503 | `WEBHOOK_SECRET` not set (webhook path only) |

Session: the Go API gate fails closed if the SQLite lookup throws (AD-5). Gate responses: `Cache-Control: private, no-store`. As-built: `internal/gate` + `internal/httpapi`.

## Platform-owned

There is no `platform_owns` entity. Corpus-guide test: the webhook exists because of Hub promise FR-1; Presenter and Registry do not depend on it. The `POST /api/webhook` row belongs to Hub in the API inventory.

What binds more than one PC is already an `AD-N` (AD-7 slide order, AD-24 Operator chrome, AD-5 request gate). Not re-listed here.
