## Problem Statement

Manual Device Sync (FR-40) has two halves: pushing metadata mutations (`POST /api/sync/push`) and
pushing binary assets (`POST /api/sync/assets`, content-addressed by SHA-256). The asset half caps
its request body at 50MB (`internal/httpapi/sync_assets.go`, `http.MaxBytesReader`); the metadata
push half has no cap at all — `syncPush` (`internal/httpapi/sync.go`) decodes `r.Body` directly with
no size limit. Both contract halves (`.how/hub/02-contracts/11-manual-sync.md`,
`.how/registry/02-contracts/07-manual-sync.md`) already document this asymmetry accurately; it was
confirmed as a real, still-live gap by a 2026-09-23 reconciliation pass. An Admin with a large enough
local mutation set (many Song Set entries, hymns, or Services with sizable `images_payload`/
`raw_payload` JSON) can push an arbitrarily large single request today, unlike the asset half of the
same feature.

## Solution

Owner-ruled (2026-09-23): give `syncPush` the same 50MB cap `syncAssetUpload` already enforces, and
when the full local mutation set would exceed it, split the push into multiple sequential requests
instead of failing the whole operation.

## User Stories

1. As an Admin pushing a large local dataset to a second instance, I want the sync to succeed by
   sending several smaller requests automatically, so that I don't have to manually trim what I'm
   syncing or watch it fail outright.
2. As an Admin, I want the server to refuse an oversized single request the same way it already does
   for asset uploads, so that Manual Sync can't be used to send an unbounded payload at the server.
3. As an Admin, I want a push that gets interrupted partway through its chunks (network drop,
   server restart) to be safely retryable without double-applying what already landed.

## Implementation Decisions

- **Server (`internal/httpapi/sync.go`, `syncPush`):** wrap `r.Body` in
  `http.MaxBytesReader(w, r.Body, 50<<20)` before decoding, mirroring `syncAssetUpload`'s exact
  pattern. **The error mapping needs its own care (confirmed by peer review):** a decode error today
  always maps to a generic `"Invalid request body"` (`internal/httpapi/sync.go:121`), so an oversized
  body must be distinguished (via `*http.MaxBytesError`, or reading into a bounded buffer before
  decoding) to return `syncAssetUpload`'s message ("Failed to read upload body or file too large")
  specifically for that case.
- **Client (`src/lib/sync/client.ts`):** add a chunking helper — e.g. `pushSyncChunked(baseUrl,
  buildFullPayload(), headers)` — that splits `mutations` (across all five record kinds) plus
  `tombstones` into multiple `SyncPushPayload`s under the server's cap, sending each through the
  existing `pushSync` in sequence. Three corrections to the naive version of this idea, all found by
  peer review: (1) size must be measured from each chunk's actual serialized JSON body (envelope,
  escaping, UTF-8 expansion included), not estimated from record counts; (2) each chunk's
  `mutation_id` must be deterministic — derived from the original push's own id plus a stable chunk
  index — not freshly random per attempt, so a retry-from-start reproduces the same id sequence and
  the server's existing idempotency check (`already_applied: true`) protects chunks that already
  landed; (3) chunk order must respect `syncPush`'s own fixed cross-kind processing order (Services →
  Hymns → Song Set Entries → Background Library Images → Announcement Items → Tombstones) and the
  `unresolved_service_reference` dependency it already enforces — a Service must reach the server in
  the same or an earlier chunk than any Announcement Item naming it. This remains safe without a new
  protocol otherwise: each chunk call is its own atomic transaction, upserting by `global_id`
  (`base_rev` is declared in the payload but not read anywhere in the current handler — confirmed by
  peer review via grep).
- **`AdminSyncPage.tsx`'s five separate `pushSync` call sites** (push-all, apply-from-pull, and three
  narrower re-push flows) should switch to the new chunking helper rather than duplicating the
  size-estimation/splitting logic five times.
- **A single oversized record** (e.g. one Service whose `images_payload` alone exceeds 50MB) cannot
  be chunked further by splitting the mutations array — this is an edge case the tickets must name a
  test for, not silently ignore. The chosen behavior: that one record's push attempt fails with a
  clear error naming the record, while the rest of the batch is unaffected (it is chunked into
  requests around it) — an Admin can then remove or shrink that one oversized record rather than the
  whole sync failing opaquely. This requires the chunking helper to return a **partial-success
  result** (which chunks/records succeeded, which failed and why, an aggregate applied count) rather
  than a single pass/fail — confirmed by peer review as missing from the naive design, since today's
  `pushSync` returns one response and `AdminSyncPage.tsx` reports one total `applied_count`.
- Chunk boundaries are drawn along whole records only (never split a single Service/Hymn/Song Set
  Entry/Background Image/Announcement Item across two requests) and along whole tombstone entries.

## Testing Decisions

- A good test proves the cap and the chunking boundary, not just "a request under 50MB works": push a
  single request over 50MB directly at `syncPush` and assert `400`; assemble a client-side mutation
  set that would serialize over 50MB, push it through the chunking helper, and assert it lands as
  multiple sequential requests that together apply every record exactly once (verifiable via
  `applied_count` summed across the responses, or by reading back the synced rows).
- Prior art: `internal/httpapi/sync_assets.go`'s own 50MB-cap test (if one exists — check
  `internal/httpapi/sync_assets_test.go`) for the server-side assertion shape; there is no existing
  client-side chunking precedent in this repo, so that half is new.
- Existing single-request pushes under the cap must keep working unchanged — this is additive for
  large pushes, not a behavior change for the common case.

## Out of Scope

- No change to `syncPull` or `syncAssetUpload` themselves — both already work as documented.
- No change to what FR-40 promises, or to the Presenter Liveness Guard (`TryAcquireSyncLock`).
- Not implementing `base_rev` enforcement — it remains an unused field; using it for cross-chunk
  atomicity was considered and rejected as unnecessary, since chunk calls are already safely
  independent and idempotent by `mutation_id` alone.

## Further Notes

Found in the same 2026-09-23 reconciliation pass as SPEC-58/59/60, but opened separately since the
owner gave a specific design direction (cap + chunk, not just "flag inconsistency") distinct from
those three.
