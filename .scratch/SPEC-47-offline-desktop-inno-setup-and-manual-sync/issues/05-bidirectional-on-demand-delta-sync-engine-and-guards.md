# 05: Bidirectional On-Demand Delta Sync Engine and Concurrency Guards

**What to build:**
Implement the core replication engine and concurrency protection:
1. Implement `POST /api/sync/push` endpoint in Go: receives local mutation batches tagged with `mutation_id` (UUID) and `base_rev`. The server records changes and applies them idempotently (safe on network retries).
2. Implement `GET /api/sync/pull` endpoint in Go: returns server changes since `last_synced_cursor`, including upserts and tombstones.
3. Protect SQLite concurrency on the local desktop: apply incoming sync batches within `BEGIN IMMEDIATE` transactions with `busy_timeout=5000` under WAL mode.
4. Add Presenter Liveness Guard: if a live presentation session is active on `/present/`, reject disruptive structural sync applies with HTTP 409 and user-facing warning *"Presenter actively projecting — sync paused until presentation completes"*.
5. Implement optimistic concurrency conflict detection for services: if both local and web modified the same service, mark the record as conflicted rather than silently overwriting.

**Blocked by:** 04-global-entity-identity-and-tombstone-schema-migration.md

**Status:** open

- [ ] Implement Go HTTP sync endpoints `/api/sync/push` and `/api/sync/pull` in `internal/httpapi`.
- [ ] Implement client-side sync runner in Go/TypeScript handling push and pull sequences.
- [ ] Add idempotency deduplication handling so duplicate `mutation_id` payloads succeed without double-applying.
- [ ] Enforce presenter session check blocking destructive incoming sync while live slides are projected.
- [ ] Add integration tests verifying bidirectional synchronization, conflict detection, and network retry idempotency.
- [ ] Human verification check: Make changes in local database, trigger push, assert server receives exact changes; then make changes on server, trigger pull, assert local updates correctly.
