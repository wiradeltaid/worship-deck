package db

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
)

func TestEnsureSongSetLayoutSeeds_FreshDBMissingSeedFailsClosed(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")
	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	// Empty root directory without data/default-song-set-layouts.json
	emptyRoot := filepath.Join(tempDir, "empty-root")
	if err := os.MkdirAll(emptyRoot, 0755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	err = EnsureSongSetLayoutSeeds(db, emptyRoot)
	if err == nil {
		t.Fatalf("expected EnsureSongSetLayoutSeeds to fail closed on fresh DB with missing seeds, got nil")
	}
}

func TestEnsureSongSetLayoutSeeds_FreshDBSeedsTrioAndSelfRepairs(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")
	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	// Bootstrap with repo root
	repoRoot := filepath.Join("..", "..")
	if err := EnsureSongSetLayoutSeeds(db, repoRoot); err != nil {
		t.Fatalf("EnsureSongSetLayoutSeeds: %v", err)
	}

	// Assert exactly 3 roles present
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM song_set_layouts`).Scan(&count); err != nil {
		t.Fatalf("count roles: %v", err)
	}
	if count != 3 {
		t.Fatalf("expected 3 roles, got %d", count)
	}

	// Verify each role has non-empty payload and seed_hash
	for _, role := range []string{"title", "verse", "reff"} {
		var payload string
		var seedHash sql.NullString
		if err := db.QueryRow(`SELECT payload, seed_hash FROM song_set_layouts WHERE role = ?`, role).Scan(&payload, &seedHash); err != nil {
			t.Fatalf("query role %s: %v", role, err)
		}
		if payload == "" {
			t.Fatalf("role %s has empty payload", role)
		}
		if !seedHash.Valid || seedHash.String == "" {
			t.Fatalf("role %s missing seed_hash", role)
		}
	}

	// Simulate defect: delete one role ('reff')
	if _, err := db.Exec(`DELETE FROM song_set_layouts WHERE role = 'reff'`); err != nil {
		t.Fatalf("delete role reff: %v", err)
	}

	// Re-run EnsureSongSetLayoutSeeds — must self-repair 'reff'
	if err := EnsureSongSetLayoutSeeds(db, repoRoot); err != nil {
		t.Fatalf("EnsureSongSetLayoutSeeds on repair: %v", err)
	}

	var reffPayload string
	var reffHash sql.NullString
	if err := db.QueryRow(`SELECT payload, seed_hash FROM song_set_layouts WHERE role = 'reff'`).Scan(&reffPayload, &reffHash); err != nil {
		t.Fatalf("query reff: %v", err)
	}
	if reffPayload == "" {
		t.Fatalf("expected non-empty repaired reff payload")
	}
	if !reffHash.Valid || reffHash.String == "" {
		t.Fatalf("expected valid seed_hash for repaired reff")
	}
	if reffHash.String != songSetSeedHash([]byte(reffPayload)) {
		t.Fatalf("expected seed_hash %s to match payload hash %s", reffHash.String, songSetSeedHash([]byte(reffPayload)))
	}

	// Verify custom layout preservation: update title with custom payload and NULL seed_hash
	customPayload := `{"custom":"layout_data"}`
	if _, err := db.Exec(`UPDATE song_set_layouts SET payload = ?, seed_hash = NULL WHERE role = 'title'`, customPayload); err != nil {
		t.Fatalf("update title: %v", err)
	}
	if err := EnsureSongSetLayoutSeeds(db, repoRoot); err != nil {
		t.Fatalf("EnsureSongSetLayoutSeeds after custom edit: %v", err)
	}
	var storedPayload string
	var storedHash sql.NullString
	if err := db.QueryRow(`SELECT payload, seed_hash FROM song_set_layouts WHERE role = 'title'`).Scan(&storedPayload, &storedHash); err != nil {
		t.Fatalf("query title: %v", err)
	}
	if storedPayload != customPayload {
		t.Fatalf("expected custom payload %q preserved, got %q", customPayload, storedPayload)
	}
	if storedHash.Valid {
		t.Fatalf("expected seed_hash to remain NULL for edited layout, got %q", storedHash.String)
	}
}

func TestEnsureSongSetLayoutSeeds_StagedCorporaDirectory(t *testing.T) {
	stagedDir := os.Getenv("STAGED_CORPORA_DIR")
	if stagedDir == "" {
		t.Skip("STAGED_CORPORA_DIR not set; skipping staged directory bootstrap verification")
	}
	dbPath := filepath.Join(stagedDir, "staged-test.db")
	h, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer h.Close()

	if err := Bootstrap(h, stagedDir); err != nil {
		t.Fatalf("bootstrap staged dir: %v", err)
	}

	var count int
	if err := h.QueryRow("SELECT COUNT(*) FROM song_set_layouts").Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 3 {
		t.Fatalf("expected 3 roles, got %d", count)
	}

	seeds, err := LoadSongSetLayoutSeeds(stagedDir)
	if err != nil {
		t.Fatalf("LoadSongSetLayoutSeeds from stagedDir: %v", err)
	}

	for _, role := range []string{"title", "verse", "reff"} {
		var payload string
		var seedHash string
		if err := h.QueryRow("SELECT payload, seed_hash FROM song_set_layouts WHERE role = ?", role).Scan(&payload, &seedHash); err != nil {
			t.Fatalf("role %s: %v", role, err)
		}
		expectedPayload := string(seeds[role])
		if payload != expectedPayload {
			t.Fatalf("role %s: payload mismatch against staged seed file", role)
		}
		expectedHash := songSetSeedHash(seeds[role])
		if seedHash != expectedHash {
			t.Fatalf("role %s: seed_hash mismatch: got %q, want %q", role, seedHash, expectedHash)
		}
	}
}
