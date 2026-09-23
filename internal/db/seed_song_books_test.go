package db

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func repoRoot(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	// internal/db is 2 levels below root
	root := filepath.Clean(filepath.Join(wd, "..", ".."))
	return root
}

func TestSeedSongBooks_FreshDatabase(t *testing.T) {
	root := repoRoot(t)
	dbPath := filepath.Join(t.TempDir(), "fresh.db")
	handle, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer handle.Close()

	if err := Bootstrap(handle, root); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}

	var name, locale, licence, provenance string
	var isDefault int
	err = handle.QueryRow(`
		SELECT name, locale, licence, provenance, is_default
		FROM song_books
		WHERE book_code = 'SDAH'
	`).Scan(&name, &locale, &licence, &provenance, &isDefault)
	if err != nil {
		t.Fatalf("query SDAH song_books: %v", err)
	}

	if name != "The Seventh-day Adventist Hymnal" {
		t.Errorf("expected name %q, got %q", "The Seventh-day Adventist Hymnal", name)
	}
	if locale != "en" {
		t.Errorf("expected locale %q, got %q", "en", locale)
	}
	if !strings.Contains(licence, "An accepted risk recorded by the repository owner") {
		t.Errorf("licence not populated from corpus file: %q", licence)
	}
	if !strings.Contains(provenance, "The Seventh-day Adventist Hymnal © 1985") {
		t.Errorf("provenance not populated from corpus file: %q", provenance)
	}
	if isDefault != 1 {
		t.Errorf("expected is_default=1 on fresh db, got %d", isDefault)
	}

	var hymnCount int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM hymns WHERE book_code = 'SDAH'`).Scan(&hymnCount); err != nil {
		t.Fatalf("query hymns count: %v", err)
	}
	if hymnCount == 0 {
		t.Errorf("expected hymns to be seeded, got %d", hymnCount)
	}
}

func TestSeedSongBooks_ExistingDatabaseAtVersion10(t *testing.T) {
	root := repoRoot(t)
	dbPath := filepath.Join(t.TempDir(), "existing_v10.db")
	handle, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer handle.Close()

	// Simulate existing database at data_version 10 with hymn marker stamped and no song_books row
	if _, err := handle.Exec(`
		INSERT INTO hymns (book_code, number, title, lyrics) VALUES ('SDAH', 1, 'Title', 'Lyrics');
		INSERT OR REPLACE INTO settings (key, value) VALUES ('song_book_bootstrapped_SDAH', '1');
		INSERT OR REPLACE INTO settings (key, value) VALUES ('data_version', '10');
		DELETE FROM song_books;
	`); err != nil {
		t.Fatalf("setup broken state: %v", err)
	}

	// Verify song_books is empty before bootstrap
	var countBefore int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM song_books`).Scan(&countBefore); err != nil {
		t.Fatalf("count before: %v", err)
	}
	if countBefore != 0 {
		t.Fatalf("expected 0 song_books before, got %d", countBefore)
	}

	// Run Bootstrap (simulating restart/boot)
	if err := Bootstrap(handle, root); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}

	var countAfter int
	var isDefault int
	err = handle.QueryRow(`SELECT COUNT(*), COALESCE(MAX(is_default), 0) FROM song_books WHERE book_code = 'SDAH'`).Scan(&countAfter, &isDefault)
	if err != nil {
		t.Fatalf("query SDAH count: %v", err)
	}
	if countAfter != 1 {
		t.Fatalf("expected SDAH row to appear via migration 10->11, got count=%d", countAfter)
	}
	if isDefault != 1 {
		t.Errorf("expected is_default=1, got %d", isDefault)
	}

	var ver string
	if err := handle.QueryRow(`SELECT value FROM settings WHERE key = ?`, dataVersionKey).Scan(&ver); err != nil {
		t.Fatalf("read version: %v", err)
	}
	if ver != currentDataVersion {
		t.Fatalf("expected data_version %s, got %q", currentDataVersion, ver)
	}
}

func TestSeedSongBooks_AD17DeletedSDAHNotResurrectedAtVersion11(t *testing.T) {
	root := repoRoot(t)
	dbPath := filepath.Join(t.TempDir(), "ad17_deletion.db")
	handle, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer handle.Close()

	if err := Bootstrap(handle, root); err != nil {
		t.Fatalf("first bootstrap: %v", err)
	}

	var ver string
	if err := handle.QueryRow(`SELECT value FROM settings WHERE key = ?`, dataVersionKey).Scan(&ver); err != nil {
		t.Fatalf("read version: %v", err)
	}
	if ver != currentDataVersion {
		t.Fatalf("expected data_version %s, got %q", currentDataVersion, ver)
	}

	// Administrator deliberately deletes SDAH song book row
	if _, err := handle.Exec(`DELETE FROM song_books WHERE book_code = 'SDAH'`); err != nil {
		t.Fatalf("delete SDAH song_books row: %v", err)
	}

	// Reboot
	if err := Bootstrap(handle, root); err != nil {
		t.Fatalf("second bootstrap: %v", err)
	}

	// AD-17: Row must NOT be resurrected on boot
	var countAfter int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM song_books WHERE book_code = 'SDAH'`).Scan(&countAfter); err != nil {
		t.Fatalf("query SDAH count: %v", err)
	}
	if countAfter != 0 {
		t.Fatalf("AD-17 violation: deleted SDAH row resurrected on boot (count=%d)", countAfter)
	}
}

func TestSeedSongBooks_OtherBookAlreadyDefault(t *testing.T) {
	root := repoRoot(t)
	dbPath := filepath.Join(t.TempDir(), "other_default.db")
	handle, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer handle.Close()

	// Insert another book as default
	if _, err := handle.Exec(`
		INSERT INTO song_books (book_code, name, locale, licence, provenance, is_default, updated_at)
		VALUES ('OTHER', 'Other Book', 'en', 'lic', 'prov', 1, '2026-08-20T00:00:00Z');
	`); err != nil {
		t.Fatalf("insert other default book: %v", err)
	}

	if err := Bootstrap(handle, root); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}

	var sdahDef, otherDef int
	if err := handle.QueryRow(`SELECT is_default FROM song_books WHERE book_code = 'SDAH'`).Scan(&sdahDef); err != nil {
		t.Fatalf("query SDAH is_default: %v", err)
	}
	if err := handle.QueryRow(`SELECT is_default FROM song_books WHERE book_code = 'OTHER'`).Scan(&otherDef); err != nil {
		t.Fatalf("query OTHER is_default: %v", err)
	}

	if sdahDef != 0 {
		t.Errorf("expected SDAH is_default=0 when OTHER is default, got %d", sdahDef)
	}
	if otherDef != 1 {
		t.Errorf("expected OTHER is_default=1 to remain untouched, got %d", otherDef)
	}

	var totalDefaults int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM song_books WHERE is_default = 1`).Scan(&totalDefaults); err != nil {
		t.Fatalf("query total defaults: %v", err)
	}
	if totalDefaults != 1 {
		t.Errorf("expected exactly 1 default across all books, got %d", totalDefaults)
	}
}

func TestSeedSongBooks_AdminEditedRowPreserved(t *testing.T) {
	root := repoRoot(t)
	dbPath := filepath.Join(t.TempDir(), "admin_edited.db")
	handle, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer handle.Close()

	if err := Bootstrap(handle, root); err != nil {
		t.Fatalf("first bootstrap: %v", err)
	}

	// Admin edits the name and licence
	if _, err := handle.Exec(`
		UPDATE song_books
		SET name = 'Custom SDAH Name', licence = 'Custom Licence Text'
		WHERE book_code = 'SDAH'
	`); err != nil {
		t.Fatalf("admin edit: %v", err)
	}

	// Boot again
	if err := Bootstrap(handle, root); err != nil {
		t.Fatalf("second bootstrap: %v", err)
	}

	var name, licence string
	err = handle.QueryRow(`SELECT name, licence FROM song_books WHERE book_code = 'SDAH'`).Scan(&name, &licence)
	if err != nil {
		t.Fatalf("query edited SDAH: %v", err)
	}

	if name != "Custom SDAH Name" {
		t.Errorf("expected admin-edited name %q to survive boot, got %q", "Custom SDAH Name", name)
	}
	if licence != "Custom Licence Text" {
		t.Errorf("expected admin-edited licence %q to survive boot, got %q", "Custom Licence Text", licence)
	}
}

func TestSeedSongBooks_BootTwiceProducesExactlyOneRow(t *testing.T) {
	root := repoRoot(t)
	dbPath := filepath.Join(t.TempDir(), "boot_twice.db")
	handle, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer handle.Close()

	if err := Bootstrap(handle, root); err != nil {
		t.Fatalf("first bootstrap: %v", err)
	}
	if err := Bootstrap(handle, root); err != nil {
		t.Fatalf("second bootstrap: %v", err)
	}

	var count int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM song_books WHERE book_code = 'SDAH'`).Scan(&count); err != nil {
		t.Fatalf("query count: %v", err)
	}
	if count != 1 {
		t.Errorf("expected exactly 1 SDAH row after booting twice, got %d", count)
	}
}

func TestSeedSongBooks_MissingCorpusFileGraceful(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "missing_corpus.db")
	handle, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer handle.Close()

	// Pass an empty temp dir as root where data/song-book/sdah.json does not exist
	emptyRoot := t.TempDir()
	if err := upsertHymns(handle, emptyRoot); err != nil {
		t.Fatalf("expected nil error on missing corpus file, got: %v", err)
	}
	if err := migrateSongBookRow(handle, emptyRoot); err != nil {
		t.Fatalf("expected nil error on migrateSongBookRow with missing corpus file, got: %v", err)
	}

	var count int
	if err := handle.QueryRow(`SELECT COUNT(*) FROM song_books`).Scan(&count); err != nil {
		t.Fatalf("query count: %v", err)
	}
	if count != 0 {
		t.Errorf("expected 0 rows when corpus file missing, got %d", count)
	}
}

// Ensure unused import sql doesn't trigger compile error
var _ = (*sql.DB)(nil)
