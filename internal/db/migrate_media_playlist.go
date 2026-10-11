package db

import (
	"database/sql"
	"fmt"
)

// ensureMediaPlaylistItemsTable creates the media_playlist_items table and indexes
// if they do not already exist (SPEC-111, Kernel K4).
func ensureMediaPlaylistItemsTable(handle *sql.DB) error {
	schema := `
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
	`
	if _, err := handle.Exec(schema); err != nil {
		return fmt.Errorf("creating media_playlist_items schema: %w", err)
	}
	return nil
}
