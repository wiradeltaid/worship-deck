# SPEC-111-03 — Backend Playlist REST API, Content Range 206, and Refcount Unlink

**Satisfies:** [UC-12, FR-16]
**Blocked by:** ["SPEC-111-02"]
**Status:** done

## Summary
Implement Go HTTP API routes for cloud media playlist CRUD, reordering, reference-counted file unlinking/purging addressed by durable storage key, and HTTP 206 Partial Content range streaming.

## Key Responsibilities
1. **REST Endpoints**:
   - `GET /api/media/playlist`: returns ordered playlist items including `id`, `name`, `type`, `storage_key`, `sha256`, `size_bytes`, `duration_ms`, `order_key`, and resolved content URL `/api/media/:id/content`.
   - `POST /api/media/playlist`: adds an ingested item to the cloud playlist.
   - `PATCH /api/media/playlist/reorder`: updates `order_key` for reordered items.
   - `DELETE /api/media/playlist/:id`: unlinks the item row from the playlist.
   - `POST /api/media/assets/:storage_key/purge`: explicit purge endpoint addressed by durable `storage_key` (not the volatile playlist row ID) that removes the underlying file from disk only if query-derived reference count equals 0 across all tables (`media_playlist_items`, `background_library_images`, `announcement_items`, artifacts).
   - Atomic option: `DELETE /api/media/playlist/:id?purge=true` performs unlink and unreferenced purge in a single coordinated transaction.
2. **Content Range Streaming**:
   - Serve `/api/media/:id/content` supporting `Range: bytes=start-end`, open-ended (`bytes=start-`), and suffix (`bytes=-suffix`) ranges with `Accept-Ranges: bytes` and `206 Partial Content`.
   - Return `416 Range Not Satisfiable` for invalid bounds (`start >= size_bytes`).
3. **Security & Authentication**:
   - All endpoints placed behind existing session authentication guards.

## Acceptance Criteria
- `DELETE` unconditionally unlinks the playlist row without deleting shared physical files.
- `purge` endpoint correctly deletes physical files when refcount = 0 and safely preserves them when refcount > 0.
- `GET /api/media/:id/content` properly answers Range headers with HTTP 206 and accurate `Content-Range`.
- Automated Go HTTP tests cover all routes, reordering, refcount query logic, and path traversal guards.

## Comments

- 2026-10-11: Implemented playlist REST endpoints (GET, POST, PATCH reorder, DELETE with refcounted purge), purge by storage key with 409 conflict on active references, and HTTP 206 Content-Range streaming in `media_playlist.go`, registered in `server.go`, and verified in `media_playlist_test.go`.
