package parse

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

type goldenExpected struct {
	Date                string   `json:"date"`
	SermonSpeaker       string   `json:"sermon_speaker"`
	SermonTitle         string   `json:"sermon_title"`
	ThemeVerseRef       string   `json:"theme_verse_ref"`
	VerseReadingRef     string   `json:"verse_reading_ref"`
	SpecialSong         string   `json:"special_song"`
	ClosingPrayerPerson string   `json:"closing_prayer_person"`
	HymnNumbers         []int    `json:"hymn_numbers"`
	UnmappedLines       []string `json:"unmapped_lines"`
}

type goldenFixture struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Rundown     string          `json:"rundown"`
	Profile     json.RawMessage `json:"profile"`
	Expected    goldenExpected  `json:"expected"`
}

func TestParserParity_GoldenFixtures(t *testing.T) {
	handle, _ := newParseTestDB(t)

	// Seed NKI book and hymn for Indonesian fixture
	_, _ = handle.Exec(`INSERT INTO song_books (book_code, name, is_default, updated_at) VALUES ('NKI', 'Nyanyian Kemenangan Iman', 0, '2026-09-18T00:00:00Z')`)
	_, _ = handle.Exec(`INSERT INTO hymns (book_code, number, title, lyrics) VALUES ('NKI', 45, 'Kesukaan yang Manis', 'Lirik NKI 45')`)

	fixturesDir := filepath.Join("..", "..", "tests", "fixtures", "parser-profiles")
	entries, err := os.ReadDir(fixturesDir)
	if err != nil {
		t.Fatalf("read fixtures dir %s: %v", fixturesDir, err)
	}

	foundCount := 0
	for _, entry := range entries {
		if !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		foundCount++
		filePath := filepath.Join(fixturesDir, entry.Name())
		raw, err := os.ReadFile(filePath)
		if err != nil {
			t.Fatalf("read %s: %v", filePath, err)
		}

		var fixture goldenFixture
		if err := json.Unmarshal(raw, &fixture); err != nil {
			t.Fatalf("unmarshal %s: %v", filePath, err)
		}

		var profile *ParserProfile
		if len(fixture.Profile) > 0 && string(fixture.Profile) != "null" {
			p, err := LoadParserProfileFromJSON(string(fixture.Profile))
			if err != nil {
				t.Fatalf("%s: load profile: %v", entry.Name(), err)
			}
			profile = p
		} else {
			profile = DefaultParserProfile()
		}

		parsed := ParseRundownWithProfile(handle, fixture.Rundown, profile)

		exp := fixture.Expected
		if exp.Date != "" {
			if parsed.Date == nil || *parsed.Date != exp.Date {
				t.Errorf("%s: date = %v, want %s", entry.Name(), parsed.Date, exp.Date)
			}
		}
		if exp.SermonSpeaker != "" {
			if parsed.Sermon == nil || parsed.Sermon.Speaker != exp.SermonSpeaker {
				t.Errorf("%s: sermon speaker = %v, want %s", entry.Name(), parsed.Sermon, exp.SermonSpeaker)
			}
		}
		if exp.SermonTitle != "" {
			if parsed.Sermon == nil || parsed.Sermon.Title != exp.SermonTitle {
				t.Errorf("%s: sermon title = %v, want %s", entry.Name(), parsed.Sermon, exp.SermonTitle)
			}
		}
		if exp.ThemeVerseRef != "" {
			if parsed.ThemeVerse == nil || parsed.ThemeVerse.Reference == nil || *parsed.ThemeVerse.Reference != exp.ThemeVerseRef {
				t.Errorf("%s: theme verse ref = %v, want %s", entry.Name(), parsed.ThemeVerse, exp.ThemeVerseRef)
			}
		}
		if exp.VerseReadingRef != "" {
			if parsed.VerseReading == nil || parsed.VerseReading.Reference == nil || *parsed.VerseReading.Reference != exp.VerseReadingRef {
				t.Errorf("%s: verse reading ref = %v, want %s", entry.Name(), parsed.VerseReading, exp.VerseReadingRef)
			}
		}
		if exp.SpecialSong != "" {
			if parsed.SpecialSong == nil || *parsed.SpecialSong != exp.SpecialSong {
				t.Errorf("%s: special song = %v, want %s", entry.Name(), parsed.SpecialSong, exp.SpecialSong)
			}
		}
		if exp.ClosingPrayerPerson != "" {
			if parsed.ClosingPrayerPerson == nil || *parsed.ClosingPrayerPerson != exp.ClosingPrayerPerson {
				t.Errorf("%s: closing prayer = %v, want %s", entry.Name(), parsed.ClosingPrayerPerson, exp.ClosingPrayerPerson)
			}
		}
		if len(exp.HymnNumbers) > 0 {
			var nums []int
			for _, it := range parsed.Items {
				if it.Type == "hymn" {
					nums = append(nums, it.Number)
				}
			}
			if !reflect.DeepEqual(nums, exp.HymnNumbers) {
				t.Errorf("%s: hymn numbers = %v, want %v", entry.Name(), nums, exp.HymnNumbers)
			}
		}
		if len(exp.UnmappedLines) > 0 {
			if !reflect.DeepEqual(parsed.UnmappedLines, exp.UnmappedLines) {
				t.Errorf("%s: unmapped lines = %v, want %v", entry.Name(), parsed.UnmappedLines, exp.UnmappedLines)
			}
		}
	}

	if foundCount < 3 {
		t.Fatalf("expected at least 3 golden fixtures, ran %d", foundCount)
	}
}
