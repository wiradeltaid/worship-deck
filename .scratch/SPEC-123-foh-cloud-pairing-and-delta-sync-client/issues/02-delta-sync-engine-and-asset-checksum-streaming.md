# SPEC-123-02 — Delta Sync Engine & Media Asset Checksum Streaming

**Satisfies:** [FR-40, UC-32]
**Blocked by:** ["SPEC-123-01"]
**Status:** open

## Summary
Implement the FOH delta sync pull engine and media asset streaming with SHA-256 verification:
1. In `internal/httpapi/foh_sync.go`:
   - Endpoint `POST /api/desktop/sync/pull-cloud`:
     - Reads pairing configuration from `pairing.json`. Returns 400 if unpaired.
     - Acquires sync lock (checking Presenter Liveness / In-Flight Service Freeze).
     - Issues authenticated HTTP GET request to `{remote_url}/api/sync/pull?since_rev={rev}` with `Authorization: Bearer {token}`.
     - Ingests returned mutations (`services`, `hymns`, `song_set_entries`, `background_library_images`, `announcement_sets`, `announcement_set_slides`, `artifact_templates`, `service_registry_snapshots`, `song_set_layouts`) inside an atomic SQLite transaction.
     - Discovers all referenced media upload hashes (`/api/uploads/{hash}.{ext}`).
     - Checks local uploads folder (`uploads/`) for missing files.
     - For each missing asset, streams `GET {remote_url}/api/sync/assets/download?hash={hash}` to `.tmp_{hash}` while computing SHA-256 digest on the fly.
     - If computed SHA-256 strictly matches target hash, renames atomically to `uploads/{hash}.{ext}`; otherwise aborts, deletes temp file, and records asset error.
     - Updates `last_synced_at` in `pairing.json`.
     - Returns summary of sync execution: `{ "ok": true, "services_count": int, "hymns_count": int, "assets_downloaded": int, "bytes_transferred": int64, "duration_ms": int64 }`.
2. Add comprehensive resilience handling:
   - Timeout handling for slow cloud network.
   - Atomic rollback of database transaction if schema mismatch or fatal SQLite error occurs.
   - Partial asset resume or retry logic without corrupting existing local library.

## Acceptance Criteria
- Delta pull applies remote database changes to local SQLite without data loss or duplicate entries.
- Missing media assets are downloaded and verified with SHA-256 before being committed to `uploads/`.
- Corrupt or interrupted asset downloads are never left as valid assets in `uploads/`.
- Successful sync updates `last_synced_at` in `pairing.json`.
- Full integration tests pass in `internal/httpapi/foh_sync_test.go`.
