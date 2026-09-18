package parse

import (
	"reflect"
	"strings"
	"testing"
)

func TestValidateAndTranslateRegex(t *testing.T) {
	// 1. Rejects lookarounds
	lookarounds := []string{
		`abc(?=def)`,
		`abc(?!def)`,
		`(?<=abc)def`,
		`(?<!abc)def`,
	}
	for _, p := range lookarounds {
		_, err := ValidateAndTranslateRegex(p)
		if err == nil {
			t.Errorf("expected error for lookaround pattern %q, got nil", p)
		}
	}

	// 2. Rejects backreferences
	backrefs := []string{
		`(a)\1`,
		`(?<word>\w+)\k<word>`,
	}
	for _, p := range backrefs {
		_, err := ValidateAndTranslateRegex(p)
		if err == nil {
			t.Errorf("expected error for backreference pattern %q, got nil", p)
		}
	}

	// 3. Translates named groups
	translated, err := ValidateAndTranslateRegex(`(?i)(?:(?<book>SDAH|NKI))?\s*#?\s*(?<number>\d+)`)
	if err != nil {
		t.Fatalf("unexpected translation error: %v", err)
	}
	expected := `(?i)(?:(?P<book>SDAH|NKI))?\s*#?\s*(?P<number>\d+)`
	if translated != expected {
		t.Fatalf("expected translated %q, got %q", expected, translated)
	}
}

func TestParseRundown_DefaultProfileParity(t *testing.T) {
	handle, _ := newParseTestDB(t)

	sampleRundown := strings.TrimSpace(`
September 20, 2026
BIBLE TALK (9.00 - 10.00 / 60 min)
Opening song: SDAH 159 (5m)
Leader: Bro. Alpha
Opening prayer: Sis. Beta
Lesson study: Elder Gamma
DIVINE SERVICE (10.00 - 12.00 / 120 min)
Theme Verse: John 3:16 For God so loved the world
Verse Reading: Psalm 23:1-3 The Lord is my shepherd
Special Song: Youth Choir
Sermon: Pastor Daniel "Walking with God"
Family & Youth: Brother Family
Closing Prayer: The Speaker
Closing song: Hymn 1
[Organist] Sis. Delta
Unmapped random line that should be captured
`)

	resBare := ParseRundown(handle, sampleRundown)
	resProfile := ParseRundownWithProfile(handle, sampleRundown, DefaultParserProfile())

	// Compare items, sermon, scripture, dates, unmapped lines
	if !reflect.DeepEqual(resBare.Date, resProfile.Date) {
		t.Errorf("Date mismatch: %v vs %v", resBare.Date, resProfile.Date)
	}
	if len(resBare.Items) != len(resProfile.Items) {
		t.Fatalf("Items length mismatch: %d vs %d", len(resBare.Items), len(resProfile.Items))
	}
	for i := range resBare.Items {
		b := resBare.Items[i]
		p := resProfile.Items[i]
		if b.Type != p.Type || b.Role != p.Role || b.Name != p.Name || b.Number != p.Number || b.Title != p.Title {
			t.Errorf("Item %d mismatch: %+v vs %+v", i, b, p)
		}
	}
	if !reflect.DeepEqual(resBare.Sermon, resProfile.Sermon) {
		t.Errorf("Sermon mismatch: %+v vs %+v", resBare.Sermon, resProfile.Sermon)
	}
	if !reflect.DeepEqual(resBare.ThemeVerse, resProfile.ThemeVerse) {
		t.Errorf("ThemeVerse mismatch: %+v vs %+v", resBare.ThemeVerse, resProfile.ThemeVerse)
	}
	if !reflect.DeepEqual(resBare.VerseReading, resProfile.VerseReading) {
		t.Errorf("VerseReading mismatch: %+v vs %+v", resBare.VerseReading, resProfile.VerseReading)
	}
	if !reflect.DeepEqual(resBare.UnmappedLines, resProfile.UnmappedLines) {
		t.Errorf("UnmappedLines mismatch: %v vs %v", resBare.UnmappedLines, resProfile.UnmappedLines)
	}
	if len(resProfile.SongCandidates) != 2 {
		t.Fatalf("expected 2 SongCandidates, got %d", len(resProfile.SongCandidates))
	}
	if resProfile.SongCandidates[0].Number != 159 || resProfile.SongCandidates[1].Number != 1 {
		t.Errorf("SongCandidates numbers mismatch: %+v", resProfile.SongCandidates)
	}
}

func TestParseRundown_CustomProfileMultiBookAndIndonesian(t *testing.T) {
	handle, _ := newParseTestDB(t)

	// Seed NKI book and hymn
	_, err := handle.Exec(`INSERT INTO song_books (book_code, name, is_default, updated_at) VALUES ('NKI', 'Nyanyian Kemenangan Iman', 0, '2026-09-18T00:00:00Z')`)
	if err != nil {
		t.Fatalf("insert NKI: %v", err)
	}
	_, err = handle.Exec(`INSERT INTO hymns (book_code, number, title, lyrics) VALUES ('NKI', 45, 'Kesukaan yang Manis', 'Lirik NKI 45')`)
	if err != nil {
		t.Fatalf("insert NKI 45: %v", err)
	}

	customRulesJSON := `{
  "schema_version": 1,
  "preprocess": {
    "strip_prefixes": ["^》\\s*"],
    "timing_patterns": ["(?i)\\(\\s*\\d+\\s*m\\s*\\)"]
  },
  "date_pattern": "(?i)(?:20\\d{2}-\\d{2}-\\d{2})",
  "section_delimiter_pattern": "(?i)^(KEBAKTIAN\\s+UTAMA|SEKOLAH\\s+SABAT)\\b",
  "hymn_patterns": [
    {
      "pattern": "(?i)(?:(?<book>Lagu|NKI|SDAH))?\\s*#?\\s*(?<number>\\d+)"
    }
  ],
  "book_aliases": {
    "LAGU": "NKI",
    "NKI": "NKI",
    "SDAH": "SDAH"
  },
  "default_book": "NKI",
  "field_rules": {
    "sermon": {
      "pattern": "(?i)^Khotbah\\s*[:\\-]\\s*(?<speaker>.+?)(?:\\s+\"(?<title>[^\"]+)\")?\\s*$"
    },
    "special_song": {
      "pattern": "(?i)^Lagu\\s+Pujian\\s*[:\\-]\\s*(?<value>.*)$"
    }
  },
  "scripture_split_pattern": "^(?<book_chapter>.+?\\s+\\d+:[\\d,\\-–]+)(?:\\s*[—–\\-:]\\s*|\\s+)(?<text>.+)$",
  "scripture_ref_pattern": "^(?<book_chapter>.+?\\s+\\d+:[\\d,\\-–]+)\\s*$",
  "role_patterns": {
    "colon_role": "^(?<role>.+?)\\s*[:\\-]\\s*(?<name>.+)$"
  },
  "song_set_matching": {
    "label_slots": [],
    "slot_family_prefix": "praise_song"
  }
}`

	profile, err := LoadParserProfileFromJSON(customRulesJSON)
	if err != nil {
		t.Fatalf("load custom profile: %v", err)
	}

	rundownText := strings.TrimSpace(`
2026-09-20
KEBAKTIAN UTAMA
Lagu Buka: Lagu 45 (5m)
Lagu Pujian: Koor Remaja
Khotbah: Pdt. Jonathan "Kasih Abadi"
Pemimpin: Bpk. Stefanus
Baris tak dikenal
`)

	res := ParseRundownWithProfile(handle, rundownText, profile)
	if res.Date == nil || *res.Date != "2026-09-20" {
		t.Errorf("expected date 2026-09-20, got %v", res.Date)
	}
	if len(res.Items) == 0 {
		t.Fatalf("expected parsed items, got 0")
	}

	// Verify Section
	if res.Items[0].Type != "section" || res.Items[0].Title != "KEBAKTIAN UTAMA" {
		t.Errorf("expected section KEBAKTIAN UTAMA, got %+v", res.Items[0])
	}

	// Verify NKI Hymn 45 mapped
	var hymnItem *Item
	for _, it := range res.Items {
		if it.Type == "hymn" {
			h := it
			hymnItem = &h
			break
		}
	}
	if hymnItem == nil {
		t.Fatalf("expected hymn item in items")
	}
	if hymnItem.BookCode != "NKI" || hymnItem.Number != 45 || hymnItem.Title != "Kesukaan yang Manis" {
		t.Errorf("expected NKI #45 Kesukaan yang Manis, got %+v", hymnItem)
	}

	// Verify SongCandidates
	if len(res.SongCandidates) != 1 {
		t.Fatalf("expected 1 SongCandidate, got %d", len(res.SongCandidates))
	}
	if res.SongCandidates[0].BookCode != "NKI" || res.SongCandidates[0].Number != 45 {
		t.Errorf("unexpected SongCandidate: %+v", res.SongCandidates[0])
	}

	// Verify Sermon
	if res.Sermon == nil || res.Sermon.Speaker != "Pdt. Jonathan" || res.Sermon.Title != "Kasih Abadi" {
		t.Errorf("unexpected sermon: %+v", res.Sermon)
	}

	// Verify Special Song
	if res.SpecialSong == nil || *res.SpecialSong != "Koor Remaja" {
		t.Errorf("unexpected special song: %v", res.SpecialSong)
	}

	// Verify Unmapped Line
	if len(res.UnmappedLines) != 1 || res.UnmappedLines[0] != "Baris tak dikenal" {
		t.Errorf("expected unmapped line 'Baris tak dikenal', got %v", res.UnmappedLines)
	}
}
