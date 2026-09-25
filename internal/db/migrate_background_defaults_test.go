package db

import (
	"path/filepath"
	"testing"
	"time"
)

func TestEnsureBackgroundDefaultAssignments_MigrationAndCascade(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "defaults_migration.db")
	handle, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer handle.Close()

	if err := Bootstrap(handle, "../../"); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}

	// 1. Insert a test image asset with is_default = 1
	now := time.Now().UTC().Format(time.RFC3339Nano)
	res, err := handle.Exec(`
		INSERT INTO background_library_images (url, name, is_default, category, created_at, updated_at)
		VALUES ('/assets/test-default.png', 'Test Default', 1, 'background', ?, ?)
	`, now, now)
	if err != nil {
		t.Fatalf("insert image: %v", err)
	}
	imageID, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("last insert id: %v", err)
	}

	// 2. Reset marker and test ensureBackgroundDefaultAssignments backfill logic
	_, err = handle.Exec(`DELETE FROM settings WHERE key = 'background_defaults_migrated'`)
	if err != nil {
		t.Fatalf("delete marker: %v", err)
	}
	_, err = handle.Exec(`DELETE FROM background_default_assignments`)
	if err != nil {
		t.Fatalf("clear assignments: %v", err)
	}

	if err := ensureBackgroundDefaultAssignments(handle); err != nil {
		t.Fatalf("ensureBackgroundDefaultAssignments: %v", err)
	}

	// Verify both roles are backfilled
	var songSetImgID, generalImgID int64
	err = handle.QueryRow(`SELECT background_image_id FROM background_default_assignments WHERE role = 'song_set'`).Scan(&songSetImgID)
	if err != nil {
		t.Fatalf("query song_set: %v", err)
	}
	if songSetImgID != imageID {
		t.Fatalf("expected song_set imageId=%d, got %d", imageID, songSetImgID)
	}

	err = handle.QueryRow(`SELECT background_image_id FROM background_default_assignments WHERE role = 'general'`).Scan(&generalImgID)
	if err != nil {
		t.Fatalf("query general: %v", err)
	}
	if generalImgID != imageID {
		t.Fatalf("expected general imageId=%d, got %d", imageID, generalImgID)
	}

	// 3. Foreign key cascade proof: delete parent image directly
	_, err = handle.Exec(`DELETE FROM background_library_images WHERE id = ?`, imageID)
	if err != nil {
		t.Fatalf("delete image: %v", err)
	}

	var remainingCount int
	err = handle.QueryRow(`SELECT COUNT(*) FROM background_default_assignments WHERE background_image_id = ?`, imageID).Scan(&remainingCount)
	if err != nil {
		t.Fatalf("count remaining: %v", err)
	}
	if remainingCount != 0 {
		t.Fatalf("expected 0 assignments after image delete (cascade), got %d", remainingCount)
	}

	// 4. Durable clearing proof: clearing assignments must NOT resurrect on restart
	res2, _ := handle.Exec(`
		INSERT INTO background_library_images (url, name, is_default, category, created_at, updated_at)
		VALUES ('/assets/second.png', 'Second', 1, 'background', ?, ?)
	`, now, now)
	imageID2, _ := res2.LastInsertId()

	// Clear assignments and verify marker prevents resurrection
	_, _ = handle.Exec(`DELETE FROM background_default_assignments`)
	if err := ensureBackgroundDefaultAssignments(handle); err != nil {
		t.Fatalf("second ensureBackgroundDefaultAssignments: %v", err)
	}

	var finalCount int
	_ = handle.QueryRow(`SELECT COUNT(*) FROM background_default_assignments`).Scan(&finalCount)
	if finalCount != 0 {
		t.Fatalf("expected 0 assignments (durable clear), got %d (resurrected %d)", finalCount, imageID2)
	}
}
