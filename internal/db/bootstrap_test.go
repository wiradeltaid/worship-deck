package db

import (
	"path/filepath"
	"testing"
)

func TestCleanBootstrap_SeedsCorporaAndLeavesSlideRegistryEmpty(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "clean-bootstrap.db")

	handle, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer handle.Close()

	// Locate repo root for data/ corpora
	repoRoot, err := filepath.Abs("../..")
	if err != nil {
		t.Fatalf("resolving repo root: %v", err)
	}

	if err := Bootstrap(handle, repoRoot); err != nil {
		t.Fatalf("Bootstrap failed: %v", err)
	}

	// 1. Verify slide registry tables are completely empty (0 templates)
	var templateCount int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM artifact_templates`).Scan(&templateCount); err != nil {
		t.Fatalf("querying artifact_templates: %v", err)
	}
	if templateCount != 0 {
		t.Fatalf("expected clean bootstrap to start with 0 slide templates, got %d", templateCount)
	}

	// 2. Verify SDAH hymn book is seeded
	var hymnCount int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM hymns WHERE book_code = 'SDAH'`).Scan(&hymnCount); err != nil {
		t.Fatalf("querying hymns: %v", err)
	}
	if hymnCount == 0 {
		t.Fatal("expected SDAH hymns to be bootstrapped on clean install, got 0")
	}

	var songBookCount int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM song_books WHERE book_code = 'SDAH'`).Scan(&songBookCount); err != nil {
		t.Fatalf("querying song_books: %v", err)
	}
	if songBookCount != 1 {
		t.Fatalf("expected 1 SDAH song book record, got %d", songBookCount)
	}

	// 3. Verify KJV bible translation is seeded
	var verseCount int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM bible_verses WHERE translation_code = 'KJV'`).Scan(&verseCount); err != nil {
		t.Fatalf("querying bible_verses: %v", err)
	}
	if verseCount == 0 {
		t.Fatal("expected KJV verses to be bootstrapped on clean install, got 0")
	}
}
