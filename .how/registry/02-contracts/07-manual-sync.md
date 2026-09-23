---
type: contract
component: registry
lc: LC-11
direction: exposed
created: '2026-09-22'
updated: '2026-09-22'
---

# Contract — Manual Sync (asset half)

## Source of truth

`none`. `internal/httpapi/sync_assets.go`.

## Purpose

UC-32. Content-addressed exchange of the image/font assets a synced Service, Song Set entry, or
Announcement Set references; FR-40. **Experimental — see `docs/threat-model.md` §3.7.** The
mutation half (Service/Song Set/announcement rows themselves) is Hub's,
`.how/hub/02-contracts/11-manual-sync.md`.

## Operations

| Operation | Purpose | Realizes |
| --- | --- | --- |
| POST `/api/sync/assets/check` | Given a list of SHA-256 hashes, report which ones this instance is missing | UC-32 |
| POST `/api/sync/assets/upload` | Upload one asset by its content hash | UC-32 |
| GET `/api/sync/assets/[sha256]` | Download one asset by its content hash | UC-32 |

## Five lanes

| Lane | Answer |
| --- | --- |
| Authentication | Admin session (`requireAdmin`) — same load-bearing gap as the mutation half: no CORS support, cookie-only auth that a genuine cross-origin call cannot present. |
| Validation | A hash in the `check` request MUST match the SHA-256 pattern; a non-matching entry is silently skipped rather than rejected (`sha256Regex.MatchString`). Upload MUST be bounded to 50 MB (`http.MaxBytesReader`, `sync_assets.go:132`) — the one sync endpoint with an explicit size cap. |
| Error handling | Envelope in `cross-cutting.md`. 400 malformed body. 404 unknown hash on download. |
| Rate limiting | `none`. |
| Idempotency | Uploading a hash this instance already holds is a no-op — content-addressing makes a duplicate upload indistinguishable from the original, and `check` is what lets a caller avoid sending it at all. |

## Error behaviour

| Condition | Response | Caller should |
| --- | --- | --- |
| Requested hash not found | 404 | The peer does not have this asset either; nothing to download |
| Upload body over 50 MB | Refused by `http.MaxBytesReader` before the handler runs | Split or compress the asset — no chunked-upload path exists |
| Malformed hash in `check` request | Silently skipped, not reported | Confirm the caller only sends well-formed SHA-256 strings |

## Compatibility

The 50 MB cap here and the **absent** cap on the mutation half's `syncPush` (Hub's contract) are
inconsistent within the same feature — a caller cannot assume every sync endpoint shares one size
policy.

## Constraints

Content-addressing means an asset's identity is its own hash — there is no rename, no metadata
update, no delete on this contract. An asset no longer referenced by anything on this instance is
never purged through sync; it accumulates until removed at the filesystem level, the same posture
`04-background-library.md` already accepts for orphaned files after a delete-by-reference.
