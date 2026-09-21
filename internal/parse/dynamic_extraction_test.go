package parse

import (
	"path/filepath"
	"testing"

	"github.com/wiradeltaid/worship-deck/internal/db"
)

func TestDynamicFieldAndSongSetExtraction(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "dynamic_parse.db")
	handle, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer handle.Close()

	if err := db.Bootstrap(handle, "../../"); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}

	// 1. Insert custom predefined field with regex
	_, err = handle.Exec(`
		INSERT INTO predefined_fields (
			id, variable_name, shown_text, field_type, extraction_regex, is_system, is_active
		) VALUES (
			'field-custom-speaker', 'visiting_speaker', 'Visiting Speaker', 'text', ?, 0, 1
		)
	`, `(?i)^Guest\s+Speaker\s*[:\-]\s*(?<value>.*)$`)
	if err != nil {
		t.Fatalf("insert custom field: %v", err)
	}

	// 2. Insert song set entry with regex
	_, err = handle.Exec(`
		INSERT INTO song_set_entries (variable_name, title, position, extraction_regex, updated_at)
		VALUES ('introit_song', 'Introit Song', 1, ?, CURRENT_TIMESTAMP)
	`, `(?i)^Introit\s*[:\-]\s*#?\s*(?<number>\d+)`)
	if err != nil {
		t.Fatalf("insert song set entry: %v", err)
	}

	rawBulletin := `SABBATH, OCTOBER 24, 2026
DIVINE SERVICE
Introit: #100
Guest Speaker: Pastor Alexander
Opening Song: SDAH #159
Sermon: Pastor Alexander "The Blessed Hope"
Closing Prayer: Deacon Michael
`

	parsed := ParseRundown(handle, rawBulletin)

	// Verify FieldSuggestions
	if parsed.FieldSuggestions == nil {
		t.Fatalf("expected non-nil FieldSuggestions")
	}
	if parsed.FieldSuggestions["visiting_speaker"] != "Pastor Alexander" {
		t.Errorf("expected visiting_speaker = 'Pastor Alexander', got %q", parsed.FieldSuggestions["visiting_speaker"])
	}
	if parsed.FieldSuggestions["sermon_speaker_name"] != "Pastor Alexander" {
		t.Errorf("expected sermon_speaker_name = 'Pastor Alexander', got %q", parsed.FieldSuggestions["sermon_speaker_name"])
	}
	if parsed.FieldSuggestions["sermon_title"] != "The Blessed Hope" {
		t.Errorf("expected sermon_title = 'The Blessed Hope', got %q", parsed.FieldSuggestions["sermon_title"])
	}

	// Verify SongSetSuggestions
	if parsed.SongSetSuggestions == nil {
		t.Fatalf("expected non-nil SongSetSuggestions")
	}
	introit, ok := parsed.SongSetSuggestions["introit_song"]
	if !ok {
		t.Fatalf("missing introit_song in SongSetSuggestions")
	}
	if introit.SongNumber != 100 {
		t.Errorf("expected songNumber = 100, got %v", introit.SongNumber)
	}
	if introit.SongBookCode != "SDAH" {
		t.Errorf("expected songBookCode = 'SDAH', got %v", introit.SongBookCode)
	}
}
