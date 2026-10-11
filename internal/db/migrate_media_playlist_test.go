package db

import (
	"database/sql"
	"strings"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func TestMediaPlaylistItemsSchemaAndConstraints(t *testing.T) {
	handle, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("opening in-memory db: %v", err)
	}
	defer handle.Close()

	// 1. Initial migration
	if err := ensureMediaPlaylistItemsTable(handle); err != nil {
		t.Fatalf("first ensureMediaPlaylistItemsTable run failed: %v", err)
	}

	// 2. Migration idempotency
	if err := ensureMediaPlaylistItemsTable(handle); err != nil {
		t.Fatalf("second ensureMediaPlaylistItemsTable run failed (idempotency violation): %v", err)
	}

	validSHA := strings.Repeat("a", 64)
	now := time.Now().UTC().Format(time.RFC3339)

	// 3. Valid insertion
	validInsert := `
		INSERT INTO media_playlist_items (
			id, name, type, storage_key, size_bytes, duration_ms, sha256, order_key, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err = handle.Exec(validInsert, "m-1", "Worship Video", "video", "uploads/test.mp4", 1048576, 180000, validSHA, 1.0, now)
	if err != nil {
		t.Fatalf("valid insert failed: %v", err)
	}

	// 4. Valid nullable duration
	_, err = handle.Exec(validInsert, "m-2", "Audio Track", "audio", "uploads/test.mp3", 524288, nil, validSHA, 2.0, now)
	if err != nil {
		t.Fatalf("valid insert with null duration failed: %v", err)
	}

	// 5. Constraint Rejection Tests
	cases := []struct {
		name       string
		id         string
		title      string
		mediaType  string
		storageKey string
		sizeBytes  int64
		duration   any
		sha256     string
		orderKey   any
	}{
		{
			name:       "empty name",
			id:         "err-1",
			title:      "   ",
			mediaType:  "audio",
			storageKey: "uploads/a.mp3",
			sizeBytes:  100,
			duration:   1000,
			sha256:     validSHA,
			orderKey:   1.0,
		},
		{
			name:       "invalid media type",
			id:         "err-2",
			title:      "Invalid Media",
			mediaType:  "image",
			storageKey: "uploads/a.jpg",
			sizeBytes:  100,
			duration:   1000,
			sha256:     validSHA,
			orderKey:   1.0,
		},
		{
			name:       "negative size",
			id:         "err-3",
			title:      "Negative Size",
			mediaType:  "video",
			storageKey: "uploads/a.mp4",
			sizeBytes:  -1,
			duration:   1000,
			sha256:     validSHA,
			orderKey:   1.0,
		},
		{
			name:       "negative duration",
			id:         "err-4",
			title:      "Negative Duration",
			mediaType:  "audio",
			storageKey: "uploads/a.mp3",
			sizeBytes:  100,
			duration:   -500,
			sha256:     validSHA,
			orderKey:   1.0,
		},
		{
			name:       "uppercase SHA-256",
			id:         "err-5",
			title:      "Uppercase SHA",
			mediaType:  "video",
			storageKey: "uploads/a.mp4",
			sizeBytes:  100,
			duration:   1000,
			sha256:     strings.Repeat("A", 64),
			orderKey:   1.0,
		},
		{
			name:       "non-hex SHA-256",
			id:         "err-6",
			title:      "Non-hex SHA",
			mediaType:  "video",
			storageKey: "uploads/a.mp4",
			sizeBytes:  100,
			duration:   1000,
			sha256:     strings.Repeat("z", 64),
			orderKey:   1.0,
		},
		{
			name:       "short SHA-256 (63 chars)",
			id:         "err-7",
			title:      "Short SHA",
			mediaType:  "video",
			storageKey: "uploads/a.mp4",
			sizeBytes:  100,
			duration:   1000,
			sha256:     strings.Repeat("a", 63),
			orderKey:   1.0,
		},
		{
			name:       "empty storage key",
			id:         "err-8",
			title:      "Empty Storage Key",
			mediaType:  "video",
			storageKey: "",
			sizeBytes:  100,
			duration:   1000,
			sha256:     validSHA,
			orderKey:   1.0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := handle.Exec(validInsert, tc.id, tc.title, tc.mediaType, tc.storageKey, tc.sizeBytes, tc.duration, tc.sha256, tc.orderKey, now)
			if err == nil {
				t.Fatalf("expected constraint violation error for case %q, got nil", tc.name)
			}
		})
	}
}
