# 02: The sync client splits an oversized push into multiple requests

**What to build:** Read `SPEC.md` in this spec folder first. Blocked by ticket 01's server-side cap:
once `syncPush` rejects a request over 50MB, a large local mutation set needs to reach the server in
pieces instead of failing outright. Add a chunking helper in `src/lib/sync/client.ts` — e.g.
`pushSyncChunked` — that estimates the serialized size of a full `SyncPushPayload`'s `mutations`
(across all five record kinds: services, hymns, song_set_entries, background_library_images,
announcement_items) and `tombstones`, and splits them into multiple payloads under the cap when
needed, sending each through the existing `pushSync` in sequence, each with its own `mutation_id`.

**Blocked by:** 01 (cap-syncpush-body-at-50mb).

**Status:** closed

- [x] Read `src/lib/sync/client.ts`'s `pushSync` and `spa/src/pages/AdminSyncPage.tsx`'s five call
      sites of it in full first — the chunking helper is a drop-in replacement each of them switched to.
- [x] A mutation set that serializes under 50MB is sent as a single request, unchanged from today's
      behavior (confirmed via tests that it results in exactly one `fetch`/`pushSync` call), and keeps
      the original single `mutation_id`.
- [x] Size is measured from the actual final request body bytes via `TextEncoder` against the 50MB cap.
- [x] Chunk `mutation_id`s are deterministic from the original batch's id plus stable chunk index (`${originalMutationId}:chunk-${n}`).
- [x] Chunking preserves the server's cross-kind processing order: Services -> Hymns -> Song Set Entries -> Background Images -> Announcement Items -> Tombstones.
- [x] Chunk boundaries never split a single record or single tombstone entry across requests.
- [x] Every record and tombstone across the whole set is applied.
- [x] Single oversized records (> 50MB) are recorded in `skippedRecords` with reasons while surrounding records
      are chunked and sent successfully.
- [x] Defined standard `SyncPushBatchResult` contract for the chunking helper in `src/lib/sync/client.ts`.
- [x] `AdminSyncPage.tsx`'s five `pushSync` call sites are switched to the new `pushSyncChunked` helper.
- [x] Verified retry idempotency with deterministic chunking.
