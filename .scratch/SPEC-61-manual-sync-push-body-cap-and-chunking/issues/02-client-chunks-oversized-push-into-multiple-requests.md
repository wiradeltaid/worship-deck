# 02: The sync client splits an oversized push into multiple requests

**What to build:** Read `SPEC.md` in this spec folder first. Blocked by ticket 01's server-side cap:
once `syncPush` rejects a request over 50MB, a large local mutation set needs to reach the server in
pieces instead of failing outright. Add a chunking helper in `src/lib/sync/client.ts` — e.g.
`pushSyncChunked` — that estimates the serialized size of a full `SyncPushPayload`'s `mutations`
(across all five record kinds: services, hymns, song_set_entries, background_library_images,
announcement_items) and `tombstones`, and splits them into multiple payloads under the cap when
needed, sending each through the existing `pushSync` in sequence, each with its own `mutation_id`.

**Blocked by:** 01 (cap-syncpush-body-at-50mb).

**Status:** ready-for-agent

- [ ] Read `src/lib/sync/client.ts`'s `pushSync` and `spa/src/pages/AdminSyncPage.tsx`'s five call
      sites of it in full first — the chunking helper must be a drop-in replacement each of them can
      switch to, not a sixth parallel code path.
- [ ] A mutation set that serializes under 50MB is sent as a single request, unchanged from today's
      behavior (confirm via a test that it results in exactly one `fetch`/`pushSync` call), and keeps
      the original single `mutation_id` — chunking must not fragment a push that never needed it.
- [ ] **Size must be measured from the actual final request body, not estimated from the records
      alone (confirmed by peer review).** `pushSync` sends `JSON.stringify(payload)`
      (`src/lib/sync/client.ts`) — the envelope (`client_device_id`, the chunk's own `mutation_id`),
      JSON escaping, and UTF-8 expansion all add to the wire size beyond a naive per-record estimate.
      Build each chunk's actual payload object first, serialize it, and measure the real byte length
      (e.g. via `TextEncoder`) against the 50MB cap — an estimate that guesses "under cap" while the
      real serialized chunk is over it defeats the whole point of chunking.
- [ ] **Chunk `mutation_id`s must be deterministic from the original push's own id, not freshly
      random per chunk (confirmed by peer review).** Idempotency is keyed only by
      `client_device_id` + `mutation_id` (`internal/httpapi/sync.go`) — if a retried push after a
      partial failure generates new random ids for its chunks, the already-applied chunks' idempotency
      keys won't match and get re-applied. Derive each chunk's id from the original batch's id plus a
      stable chunk index/identity (e.g. `${originalMutationId}:chunk-${n}`), so a retry from the start
      produces the exact same sequence of ids and the server's existing `already_applied: true` check
      protects every chunk that already landed.
- [ ] **Chunking must preserve the server's cross-kind processing order, not just avoid splitting
      individual records (confirmed by peer review).** `syncPush` applies mutation kinds in a fixed
      order — Services, then Hymns, then Song Set Entries, then Background Library Images, then
      Announcement Items, then Tombstones (`internal/httpapi/sync.go`, steps a–f) — and an Announcement
      Item naming a `service_global_id` that hasn't been applied yet fails with
      `unresolved_service_reference` (confirmed at `internal/httpapi/sync.go` ~line 309). The chunker
      must send chunks in an order that respects this dependency: every Service a chunk's Announcement
      Items depend on must be in an earlier or the same chunk. In addition, a chunk containing a tombstone
      for a Service MUST NOT precede any chunk in the same batch containing active (live) mutations that
      reference that Service. State a regression test: a Service and an Announcement Item
      referencing it split across two chunks, sent in dependency order, both apply successfully.
- [ ] Chunk boundaries never split a single record (one Service, one Hymn, one Song Set Entry, one
      Background Image, one Announcement Item) or a single tombstone entry across two requests.
- [ ] Every record and tombstone across the whole set is applied exactly once — confirmed by reading
      back the synced rows on the receiving instance, not just by summing `applied_count` (a bug that
      double-counts and a bug that under-applies can both produce a plausible-looking sum).
- [ ] **A single record that alone exceeds 50MB (e.g. a Service whose `images_payload` is unusually
      large) cannot be chunked further.** State the test explicitly: that one record's push attempt
      fails with an error naming which record and why, while every other record in the batch still
      applies successfully via the surrounding chunks — the whole sync must not fail opaquely because
      of one oversized record.
- [ ] **Define a standard partial-success result contract for the chunking helper, not just a single pass/fail
      (confirmed by peer review as currently missing).** `pushSync` today returns one response or
      throws once; `AdminSyncPage.tsx` reports one total `applied_count`. Define the TypeScript interface:
      ```ts
      export interface SyncPushBatchResult {
        ok: boolean;
        appliedTotal: number;
        chunks: Array<{
          mutationId: string;
          ok: boolean;
          appliedCount: number;
          error?: string;
        }>;
        skippedRecords?: Array<{ id: string; reason: string }>;
      }
      ```
      The chunking helper returns this structured result so the oversized-single-record case above can be
      surfaced to the Admin in `AdminSyncPage.tsx` as "N of M records synced; this one was skipped: <reason>"
      rather than either an opaque success or total abort.
- [ ] `AdminSyncPage.tsx`'s five `pushSync` call sites (push-all, apply-from-pull, and the three
      narrower re-push flows) are switched to the new chunking helper, removing any size-estimation
      logic that would otherwise need to be duplicated five times.
- [ ] If a chunked push is interrupted partway (network drop, server restart) and retried from the
      start, no record is double-applied — confirmed by `mutation_id` uniqueness per chunk combined
      with `syncPush`'s existing idempotency check (`already_applied: true` on a replayed
      `mutation_id`). State this as an explicit retry test, not an assumption.
