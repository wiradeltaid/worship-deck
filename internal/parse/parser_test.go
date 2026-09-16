package parse

import (
	"database/sql"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wiradeltaid/worship-presenter-web/internal/db"
)

func newParseTestDB(t *testing.T) (*sql.DB, string) {
	t.Helper()
	root, err := filepath.Abs(filepath.Join("..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("WPW_USE_SHIPPED_REGISTRY", "1")
	t.Setenv("AUTH_SECRET", "this-is-a-valid-auth-secret-for-testing")
	t.Setenv("AUTH_BOOTSTRAP_USER", "admin")
	t.Setenv("AUTH_BOOTSTRAP_PASSWORD", "test-password-123")

	handle, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { handle.Close() })
	if err := db.Bootstrap(handle, root); err != nil {
		t.Fatal(err)
	}
	return handle, root
}

func TestLookupHymnInBook_TwoBooks(t *testing.T) {
	handle, _ := newParseTestDB(t)

	_, err := handle.Exec(
		`INSERT INTO song_books (book_code, name, is_default, updated_at) VALUES (?, ?, ?, ?)`,
		"BOOK2", "Book Two", 0, "2026-08-21T00:00:00Z",
	)
	if err != nil {
		t.Fatalf("insert song book: %v", err)
	}

	_, err = handle.Exec(
		`INSERT INTO hymns (book_code, number, title, lyrics) VALUES (?, ?, ?, ?)`,
		"BOOK2", 1, "Book Two Hymn One", "Verse 1\nBook two lyrics",
	)
	if err != nil {
		t.Fatalf("insert hymn: %v", err)
	}

	// Lookup in default book (SDAH)
	title1, lyrics1, incomplete1 := LookupHymn(handle, 1)
	if incomplete1 || title1 != "Praise to the Lord" || !strings.Contains(lyrics1, "Praise to the Lord") {
		t.Fatalf("expected SDAH hymn 1, got title=%q incomplete=%v", title1, incomplete1)
	}

	// Lookup in BOOK2
	title2, lyrics2, incomplete2 := LookupHymnInBook(handle, "BOOK2", 1)
	if incomplete2 || title2 != "Book Two Hymn One" || !strings.Contains(lyrics2, "Book two lyrics") {
		t.Fatalf("expected BOOK2 hymn 1, got title=%q incomplete=%v", title2, incomplete2)
	}

	// Lookup unknown in BOOK2
	titleU, _, incompleteU := LookupHymnInBook(handle, "BOOK2", 9999)
	if !incompleteU || titleU != "Unknown BOOK2 9999" {
		t.Fatalf("expected Unknown BOOK2 9999, got %q", titleU)
	}
}

func TestParseRundownKeepsSDAHRegex(t *testing.T) {
	handle, _ := newParseTestDB(t)

	// Operator typed SDAH in rundown
	raw := "BIBLE TALK\nOpening song: SDAH 159\nClosing song: Hymn 1\nDIVINE SERVICE\nOpening song: # 2"
	parsed := ParseRundown(handle, raw)

	var hymnNumbers []int
	for _, it := range parsed.Items {
		if it.Type == "hymn" {
			hymnNumbers = append(hymnNumbers, it.Number)
		}
	}

	if len(hymnNumbers) != 3 || hymnNumbers[0] != 159 || hymnNumbers[1] != 1 || hymnNumbers[2] != 2 {
		t.Fatalf("expected [159, 1, 2], got %v", hymnNumbers)
	}
}
