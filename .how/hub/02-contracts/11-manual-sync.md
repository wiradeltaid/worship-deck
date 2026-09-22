---
type: contract
component: hub
lc: LC-23
direction: exposed
created: '2026-09-22'
updated: '2026-09-22'
---

# Contract — Manual Sync (mutation half)

## Source of truth

`none`. `internal/httpapi/sync.go`, `src/lib/sync/client.ts`.

## Purpose

UC-32. Admin pushes and pulls Service-family data between two WorshipDeck instances on demand;
FR-40. **Experimental — see `docs/threat-model.md` §3.7 before relying on this.** The content-addressed
asset half of the same feature (fonts, images) is Registry's, `.how/registry/02-contracts/07-manual-sync.md`.

## Operations

| Operation | Purpose | Realizes |
| --- | --- | --- |
| POST `/api/sync/push` | Push this instance's Services, hymns, Song Set entries, background images, and announcement items to the address the caller names | UC-32 |
| GET `/api/sync/pull` | Pull the same record kinds from the address the caller names | UC-32 |
| GET `/api/sync/status` | This device's sync state: device id, whether a presenter is actively live | UC-32 |

## Five lanes

| Lane | Answer |
| --- | --- |
| Authentication | Admin session (`requireAdmin`) on the **receiving** instance. **Load-bearing gap:** the request is a same-origin `fetch()` with no `credentials` option and no CORS support anywhere in the Go API — a genuine cross-machine call has no cookie to present and, for `POST`, no successful preflight. Confirmed working only as one instance calling itself. |
| Validation | `mutation_id` required on push, used for idempotency. Each mutation row keeps its own `global_id` (UUIDv7) so a record's identity survives across two databases with different autoincrement sequences. |
| Error handling | Envelope in `cross-cutting.md`. 409 `presenter_active` — a live presentation holds the sync lock (`globalRemoteHub.TryAcquireSyncLock`); the caller retries once presenting ends. 400 malformed body. **No documented size limit** — `syncPush` decodes the request body with no `http.MaxBytesReader`, unlike the 4 MB the webhook enforces (`08-webhook.md`) or the 50 MB `syncAssetUpload` enforces (Registry). |
| Rate limiting | `none`. |
| Idempotency | A repeated `mutation_id` on push is a no-op the second time (idempotency key), not a duplicate write. Pull is safe to repeat; `since` narrows it to rows changed after a given timestamp. |

## Error behaviour

| Condition | Response | Caller should |
| --- | --- | --- |
| A presenter is actively projecting on the target instance | 409 `presenter_active` | Wait for the presentation to end, then retry |
| Non-Admin session | 403 | Sign in as Admin on the instance being pushed to or pulled from |
| Malformed body | 400 | Fix the payload shape client-side |
| Cross-origin call with no shared session | Browser refuses the request (CORS), before any of the above is reached | Not currently a supported deployment shape — see Purpose |

## Compatibility

The payload shape (`SyncPushPayload`, `SyncMutations`) is shared with `src/lib/sync/client.ts` and
with Registry's asset-check payload — a field renamed on one side without the other breaks sync
silently rather than loudly, since there is no schema version negotiation.

## Constraints

**This contract describes the code as it stands, not a verified deployment shape.** SPEC-56
(`wire-dynamic-predefined-field-catalog`) is unrelated; the CORS/auth gap here has no open spec yet —
report it before building anything that depends on cross-machine sync actually working. The
"Device Authorization Token" field in `AdminSyncPage.tsx` sends an `Authorization: Bearer` header
that no handler in this contract reads; it is not a functioning authentication path today.
