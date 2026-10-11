# SPEC-111-02 — SQLite Schema & Backend Migrations for media_playlist_items

**Satisfies:** [UC-12, FR-16]
**Blocked by:** ["SPEC-111-01"]
**Status:** open

## Summary
Implement greenfield SQLite database schema and additive migrations in the Go backend for persistent cloud media playlist management with server-side SHA-256 calculation and strict lowercase hex constraints.

## Key Responsibilities
1. **Database Schema & Migrations**:
   - Update `internal/db/schema.sql` and implement `<internal/db/migrate_media_playlist.go>`.
   - Create table `media_playlist_items`:
     ```sql
     CREATE TABLE IF NOT EXISTS media_playlist_items (
       id TEXT PRIMARY KEY NOT NULL,
       name TEXT NOT NULL CHECK (length(trim(name)) > 0),
       type TEXT NOT NULL CHECK (type IN ('audio', 'video')),
       storage_key TEXT NOT NULL CHECK (length(storage_key) > 0),
       size_bytes INTEGER NOT NULL CHECK (typeof(size_bytes) = 'integer' AND size_bytes >= 0),
       duration_ms INTEGER CHECK (duration_ms IS NULL OR (typeof(duration_ms) = 'integer' AND duration_ms >= 0)),
       sha256 TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
       order_key REAL NOT NULL CHECK (typeof(order_key) IN ('real', 'integer')),
       created_at TEXT NOT NULL
     );
     CREATE INDEX IF NOT EXISTS idx_media_playlist_items_order ON media_playlist_items(order_key, id);
     CREATE INDEX IF NOT EXISTS idx_media_playlist_items_sha ON media_playlist_items(sha256);
     ```
2. **Server-Side Ingest Hashing**:
   - Ensure upload handlers calculate `sha256` via `io.TeeReader` during upload streaming; never trust client-asserted checksums.
   - Implement hash backfill for existing legacy uploads if unhashed rows exist.

## Acceptance Criteria
- Database migration executes cleanly on fresh and existing SQLite databases.
- Table constraints strictly reject invalid non-hex or uppercase SHA-256 strings and negative byte sizes.
- Unit tests verify schema creation, indexing, constraint rejections, and migration idempotency.
