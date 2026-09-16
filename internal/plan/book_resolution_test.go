package plan_test

import (
	"database/sql"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wiradeltaid/worship-presenter-web/internal/db"
	"github.com/wiradeltaid/worship-presenter-web/internal/plan"
)

func newTestDB(t *testing.T) (*sql.DB, string) {
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

func TestTwoBooksHymnResolutionAndSubtitle(t *testing.T) {
	handle, _ := newTestDB(t)

	// Insert second song book
	now := "2026-08-21T00:00:00Z"
	_, err := handle.Exec(
		`INSERT INTO song_books (book_code, name, is_default, updated_at) VALUES (?, ?, ?, ?)`,
		"BOOK2", "Second Book", 0, now,
	)
	if err != nil {
		t.Fatalf("insert song book: %v", err)
	}

	// In BOOK2, insert hymn #1 with different lyrics and title
	_, err = handle.Exec(
		`INSERT INTO hymns (book_code, number, title, lyrics) VALUES (?, ?, ?, ?)`,
		"BOOK2", 1, "Book Two Hymn 1", "Verse 1\nBook two lyric line 1\nBook two lyric line 2",
	)
	if err != nil {
		t.Fatalf("insert hymn book2 #1: %v", err)
	}

	// Create a service pointing opening_song_bt to (BOOK2, 1)
	res, err := handle.Exec(
		`INSERT INTO services (date, raw_payload, parsed_data, updated_at) VALUES (?, ?, ?, ?)`,
		"2026-08-22", "raw", `{"items":[]}`, now,
	)
	if err != nil {
		t.Fatalf("insert service: %v", err)
	}
	svcID, _ := res.LastInsertId()

	_, err = handle.Exec(
		`INSERT INTO song_set_inputs (service_id, variable_name, song_number, song_book_code, updated_at) VALUES (?, ?, ?, ?, ?)`,
		svcID, "opening_song_bt", 1, "BOOK2", now,
	)
	if err != nil {
		t.Fatalf("insert song_set_inputs: %v", err)
	}

	// Load snapshot and plan for this service
	snap, err := plan.LoadSnapshot(handle, int(svcID))
	if err != nil {
		t.Fatalf("LoadSnapshot: %v", err)
	}

	item, ok := snap.SongInputs["opening_song_bt"]
	if !ok {
		t.Fatalf("expected opening_song_bt in snap.SongInputs")
	}
	if item.BookCode != "BOOK2" {
		t.Fatalf("expected BookCode BOOK2, got %q", item.BookCode)
	}
	if item.Title != "Book Two Hymn 1" {
		t.Fatalf("expected Title %q, got %q", "Book Two Hymn 1", item.Title)
	}
	if !strings.Contains(item.Lyrics, "Book two lyric line 1") {
		t.Fatalf("expected BOOK2 lyrics, got %q", item.Lyrics)
	}

	// Check slide plan subtitle carries BOOK2, not SDAH
	date, planItems, _, err := plan.PlanForService(handle, int(svcID))
	if err != nil {
		t.Fatalf("PlanForService: %v", err)
	}
	if date != "2026-08-22" {
		t.Fatalf("expected date 2026-08-22, got %q", date)
	}

	foundTitle := false
	for _, it := range planItems {
		if it.Artifact.LayoutKey == "title" {
			foundTitle = true
			for _, el := range it.Artifact.Layout.Elements {
				if el.PlaceholderKey != nil && *el.PlaceholderKey == "song_number" {
					if el.Text == nil || !strings.Contains(*el.Text, "BOOK2 1") {
						t.Fatalf("expected subtitle containing BOOK2 1, got %v", el.Text)
					}
					if strings.Contains(*el.Text, "SDAH") {
						t.Fatalf("subtitle should not contain SDAH for BOOK2: got %v", *el.Text)
					}
				}
			}
		}
	}
	if !foundTitle {
		t.Fatalf("expected title layout item in plan")
	}
}

func TestResolveSongBookFallbackChain(t *testing.T) {
	handle, _ := newTestDB(t)

	// 1. Explicit book wins
	if got := db.ResolveSongBook(handle, "custom"); got != "CUSTOM" {
		t.Fatalf("expected CUSTOM, got %q", got)
	}

	// 2. No explicit book, but global default marked in song_books
	_, err := handle.Exec(`UPDATE song_books SET is_default = 0`)
	if err != nil {
		t.Fatalf("clear defaults: %v", err)
	}
	_, err = handle.Exec(`INSERT INTO song_books (book_code, name, is_default, updated_at) VALUES (?, ?, ?, ?)`, "MYDEF", "My Default", 1, "2026-08-21T00:00:00Z")
	if err != nil {
		t.Fatalf("insert MYDEF: %v", err)
	}

	if got := db.ResolveSongBook(handle, ""); got != "MYDEF" {
		t.Fatalf("expected MYDEF from global default, got %q", got)
	}

	// 3. No default marked in DB -> falls back to shipped DefaultSongBook constant ("SDAH")
	_, err = handle.Exec(`UPDATE song_books SET is_default = 0`)
	if err != nil {
		t.Fatalf("clear defaults again: %v", err)
	}
	if got := db.ResolveSongBook(handle, ""); got != "SDAH" {
		t.Fatalf("expected SDAH fallback, got %q", got)
	}

	// With nil DB -> falls back to shipped DefaultSongBook constant
	if got := db.ResolveSongBook(nil, ""); got != "SDAH" {
		t.Fatalf("expected SDAH fallback for nil DB, got %q", got)
	}
}
