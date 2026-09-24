package parse

import (
	"path/filepath"
	"strings"
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

func TestSectionScopedSongSetExtraction(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "section_parse.db")
	handle, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer handle.Close()

	if err := db.Bootstrap(handle, "../../"); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}

	// Insert song set entries with section-scoped multiline regexes using (?is) dotall
	_, err = handle.Exec(`
		INSERT INTO song_set_entries (global_id, variable_name, title, position, extraction_regex, updated_at)
		VALUES
			('019253c0-0000-7000-8000-000000000071', 'bt_opening_song', 'BT Opening Song', 1, ?, CURRENT_TIMESTAMP),
			('019253c0-0000-7000-8000-000000000072', 'ds_opening_song', 'DS Opening Song', 2, ?, CURRENT_TIMESTAMP)
	`, `(?is)BIBLE\s+TALK.*?Opening\s+[Ss]ong\s*:\s*(?:(?<book>[A-Za-z]+)\s*)?#?\s*(?<number>\d+)`,
		`(?is)DIVINE\s+SERVICE.*?Opening\s+[Ss]ong\s*:\s*(?:(?<book>[A-Za-z]+)\s*)?#?\s*(?<number>\d+)`)
	if err != nil {
		t.Fatalf("insert song set entries: %v", err)
	}

	// Synthetic multi-section bulletin with identical local line labels
	rawBulletin := `SABBATH, OCTOBER 24, 2026

BIBLE TALK (9:00 - 10:00)
Leader: Leader One
[ ] Opening song : SDAH #614 Sound the Battle Cry
Scripture: Psalm 119:105

DIVINE SERVICE (10:00 - 12:00)
Leader: Leader Two
[ ] Opening Song : SDAH #508 "Anywhere With Jesus"
Sermon: Speaker Two "The Blessed Hope"
Closing Prayer: Elder One
`

	parsed := ParseRundown(handle, rawBulletin)

	if parsed.SongSetSuggestions == nil {
		t.Fatalf("expected non-nil SongSetSuggestions")
	}

	btSong, ok := parsed.SongSetSuggestions["bt_opening_song"]
	if !ok {
		t.Fatalf("missing bt_opening_song in SongSetSuggestions")
	}
	if btSong.SongNumber != 614 {
		t.Errorf("expected bt_opening_song number = 614, got %v", btSong.SongNumber)
	}
	if btSong.SongBookCode != "SDAH" {
		t.Errorf("expected bt_opening_song book = 'SDAH', got %v", btSong.SongBookCode)
	}

	dsSong, ok := parsed.SongSetSuggestions["ds_opening_song"]
	if !ok {
		t.Fatalf("missing ds_opening_song in SongSetSuggestions")
	}
	if dsSong.SongNumber != 508 {
		t.Errorf("expected ds_opening_song number = 508, got %v", dsSong.SongNumber)
	}
	if dsSong.SongBookCode != "SDAH" {
		t.Errorf("expected ds_opening_song book = 'SDAH', got %v", dsSong.SongBookCode)
	}
}

func TestUnmappedLinesPruningAndWhitespaceNormalization(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "pruning_parse.db")
	handle, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer handle.Close()

	if err := db.Bootstrap(handle, "../../"); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}

	// Insert field and song set entries
	_, err = handle.Exec(`
		INSERT INTO predefined_fields (
			id, variable_name, shown_text, field_type, extraction_regex, is_system, is_active
		) VALUES (
			'field-offertory', 'offertory_person', 'Offertory Person', 'text', ?, 0, 1
		)
	`, `(?i)^Offertory\s*[:\-]\s*(?<value>.*)$`)
	if err != nil {
		t.Fatalf("insert custom field: %v", err)
	}

	_, err = handle.Exec(`
		INSERT INTO song_set_entries (global_id, variable_name, title, position, extraction_regex, updated_at)
		VALUES
			('019253c0-0000-7000-8000-000000000073', 'bt_song', 'BT Song', 1, ?, CURRENT_TIMESTAMP),
			('019253c0-0000-7000-8000-000000000074', 'ds_song', 'DS Song', 2, ?, CURRENT_TIMESTAMP)
	`, `(?is)BIBLE\s+TALK.*?Opening\s+[Ss]ong\s*:\s*(?:(?<book>[A-Za-z]+)\s*)?#?\s*(?<number>\d+)`,
		`(?is)DIVINE\s+SERVICE.*?Opening\s+[Ss]ong\s*:\s*(?:(?<book>[A-Za-z]+)\s*)?#?\s*(?<number>\d+)`)
	if err != nil {
		t.Fatalf("insert song set entries: %v", err)
	}

	// Notice non-breaking spaces ( ) mixed in, and unmapped announcements line
	rawBulletin := "SABBATH, OCTOBER 24, 2026\n\n" +
		"BIBLE TALK (9:00 - 10:00)\n" +
		"Leader: Leader One\n" +
		"Announcements and Visitor Greetings\n" +
		"[ ] Opening song : SDAH #614 Sound the Battle Cry\n" +
		"Scripture: Psalm 119:105\n\n" +
		"DIVINE SERVICE (10:00 - 12:00)\n" +
		"Leader: Leader Two\n" +
		"Offertory: Elder John Smith\n" +
		"[ ] Opening Song : SDAH #508 \"Anywhere With Jesus\"\n" +
		"Sermon: Speaker Two \"The Blessed Hope\"\n" +
		"Closing Prayer: Elder One\n"

	parsed := ParseRundown(handle, rawBulletin)

	// Verify song extraction
	if parsed.SongSetSuggestions["bt_song"].SongNumber != 614 {
		t.Errorf("expected bt_song = 614, got %v", parsed.SongSetSuggestions["bt_song"].SongNumber)
	}
	if parsed.SongSetSuggestions["ds_song"].SongNumber != 508 {
		t.Errorf("expected ds_song = 508, got %v", parsed.SongSetSuggestions["ds_song"].SongNumber)
	}
	// Verify field extraction
	if parsed.FieldSuggestions["offertory_person"] != "Elder John Smith" {
		t.Errorf("expected offertory_person = 'Elder John Smith', got %q", parsed.FieldSuggestions["offertory_person"])
	}

	// Verify that matched song lines and field lines are pruned from UnmappedLines
	for _, line := range parsed.UnmappedLines {
		if strings.Contains(line, "614") {
			t.Errorf("UnmappedLines must NOT contain hymn #614 line: %q", line)
		}
		if strings.Contains(line, "508") {
			t.Errorf("UnmappedLines must NOT contain hymn #508 line: %q", line)
		}
		if strings.Contains(line, "Elder John Smith") {
			t.Errorf("UnmappedLines must NOT contain Offertory line: %q", line)
		}
	}

	// Verify truly unmapped announcement line remains
	hasAnnouncements := false
	for _, line := range parsed.UnmappedLines {
		if strings.Contains(line, "Announcements and Visitor Greetings") {
			hasAnnouncements = true
			break
		}
	}
	if !hasAnnouncements {
		t.Errorf("expected Announcements to remain in UnmappedLines, got: %v", parsed.UnmappedLines)
	}
}
