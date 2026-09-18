package parse

import (
	"database/sql"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type Scripture struct {
	Reference   *string `json:"reference"`
	Text        string  `json:"text"`
	Translation string  `json:"translation,omitempty"`
}

type Sermon struct {
	Speaker string `json:"speaker"`
	Title   string `json:"title"`
}

type Item struct {
	Type       string  `json:"type"`
	Role       string  `json:"role,omitempty"`
	Name       string  `json:"name,omitempty"`
	Title      string  `json:"title,omitempty"`
	Number     int     `json:"number,omitempty"`
	Lyrics     string  `json:"lyrics,omitempty"`
	Incomplete bool    `json:"incomplete,omitempty"`
	Timing     *string `json:"timing,omitempty"`
}

type Rundown struct {
	Date                *string    `json:"date"`
	Items               []Item     `json:"items"`
	UnmappedLines       []string   `json:"unmappedLines"`
	FailedHymnNumbers   []int      `json:"failedHymnNumbers"`
	Sermon              *Sermon    `json:"sermon"`
	SpecialSong         *string    `json:"specialSong"`
	ClosingPrayerPerson *string    `json:"closingPrayerPerson"`
	ThemeVerse          *Scripture `json:"themeVerse"`
	VerseReading        *Scripture `json:"verseReading"`
	FamilyYouth         *string    `json:"familyYouth"`
	FamilyPrayerRequest *string    `json:"familyPrayerRequest"`
	YouthPrayerRequest  *string    `json:"youthPrayerRequest"`
	FamilyName          *string    `json:"familyName,omitempty"`
	YouthName           *string    `json:"youthName,omitempty"`
}

var (
	timingRange    = regexp.MustCompile(`(?i)\(\s*\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2}\s*/?\s*\d*\s*min?\s*\)`)
	timingMinutes  = regexp.MustCompile(`(?i)\(\s*\d+\s*min(?:ute)?s?\s*\)`)
	timingM        = regexp.MustCompile(`(?i)\(\s*\d+\s*m\s*\)`)
	dateRE         = regexp.MustCompile(`(?i)(?:20\d{2}-\d{2}-\d{2})|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}`)
	hymnRE         = regexp.MustCompile(`(?i)(?:SDAH|Hymn|#)\s*(\d+)`)
	sectionRE      = regexp.MustCompile(`(?i)^(BIBLE\s+TALK|DIVINE\s+SERVICE|BREAK)\b`)
	sermonRE       = regexp.MustCompile(`(?i)^Sermon\s*[:\-]\s*(.+?)(?:\s+"([^"]+)"|\s+[“"]([^”"]+)[”"])?\s*$`)
	specialRE      = regexp.MustCompile(`(?i)^Special\s+Song\s*[:\-]\s*(.*)$`)
	themeRE        = regexp.MustCompile(`(?i)^Theme(?:\s+Verse)?\s*[:\-]\s*(.*)$`)
	verseRE        = regexp.MustCompile(`(?i)^(?:Verse\s+Reading|Memory\s+(?:Verse|Text)|Ayat\s+Bacaan)\s*[:\-]\s*(.*)$`)
	familyRE       = regexp.MustCompile(`(?i)^(?:Family(?:\s*&\s*|\s+and\s+|/\s*)Youth(?:\s+of\s+the\s+Week)?|Family\s+of\s+the\s+Week|Youth\s+of\s+the\s+Week|Keluarga(?:\s*&\s*|\s+dan\s+)Pemuda)\s*[:\-]\s*(.*)$`)
	hymnHintRE     = regexp.MustCompile(`(?i)(?:SDAH|Hymn|#)\s*\d+`)
	scriptureSplit = regexp.MustCompile(`^(.+?)\s+(\d+:[\d,\-–]+)(?:\s*[—–\-:]\s*|\s+)(.+)$`)
	scriptureRef   = regexp.MustCompile(`^(.+?)\s+(\d+:[\d,\-–]+)\s*$`)
	bracketRole    = regexp.MustCompile(`^\[([^\]]+)\]\s*(.+)$`)
	colonRole      = regexp.MustCompile(`^(.+?)\s*[:\-]\s*(.+)$`)
	clockRole      = regexp.MustCompile(`^\d{1,2}:\d{2}$`)
	isoDate        = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
)

func LocalISODate(t time.Time) string {
	return t.Format("2006-01-02")
}

func parseCalendarDate(raw string) *string {
	raw = strings.TrimSpace(raw)
	if isoDate.MatchString(raw) {
		t, err := time.Parse("2006-01-02", raw)
		if err != nil || t.Format("2006-01-02") != raw {
			return nil
		}
		return &raw
	}
	layouts := []string{
		"January 2, 2006",
		"January 2 2006",
		"Jan 2, 2006",
		"Jan 2 2006",
	}
	title := toTitleMonth(raw)
	for _, layout := range layouts {
		if t, err := time.Parse(layout, title); err == nil {
			s := t.Format("2006-01-02")
			return &s
		}
	}
	return nil
}

func toTitleMonth(s string) string {
	parts := strings.Fields(s)
	if len(parts) == 0 {
		return s
	}
	m := strings.ToLower(parts[0])
	if len(m) > 0 {
		parts[0] = strings.ToUpper(m[:1]) + m[1:]
	}
	return strings.Join(parts, " ")
}

func extractTiming(line string) *string {
	var found []string
	for _, re := range []*regexp.Regexp{timingRange, timingMinutes, timingM} {
		for _, m := range re.FindAllString(line, -1) {
			m = strings.TrimPrefix(m, "(")
			m = strings.TrimSuffix(m, ")")
			found = append(found, strings.TrimSpace(m))
		}
	}
	if len(found) == 0 {
		return nil
	}
	joined := strings.Join(found, " · ")
	return &joined
}

func stripTimings(line string) string {
	line = timingRange.ReplaceAllString(line, "")
	line = timingMinutes.ReplaceAllString(line, "")
	line = timingM.ReplaceAllString(line, "")
	return strings.Join(strings.Fields(line), " ")
}

func stripPrefixes(line string) string {
	line = strings.TrimSpace(line)
	line = strings.TrimPrefix(line, "》")
	line = strings.TrimSpace(line)
	if strings.HasPrefix(line, "[") {
		line = regexp.MustCompile(`^\[\s*\]\s*`).ReplaceAllString(line, "")
	}
	return strings.TrimSpace(line)
}

func cleanLine(line string) string {
	return stripTimings(stripPrefixes(line))
}

// resolveDefaultBook resolves the song book code from the database using the
// DEC-004 S3 three-step fallback order:
//  1. explicit weekly/provided bookCode
//  2. global default book in song_books (is_default = 1)
//  3. shipped DefaultSongBook ("SDAH")
func resolveDefaultBook(db *sql.DB, explicitBook string) string {
	explicit := strings.ToUpper(strings.TrimSpace(explicitBook))
	if explicit != "" {
		return explicit
	}
	if db != nil {
		var defaultBook string
		err := db.QueryRow(`SELECT book_code FROM song_books WHERE is_default = 1 LIMIT 1`).Scan(&defaultBook)
		if err == nil && strings.TrimSpace(defaultBook) != "" {
			return strings.ToUpper(strings.TrimSpace(defaultBook))
		}
	}
	return "SDAH"
}

// LookupHymnInBook resolves a hymn on the pair (book_code, number) following the
// DEC-004 S3 fallback order for book resolution.
func LookupHymnInBook(db *sql.DB, bookCode string, number int) (title, lyrics string, incomplete bool) {
	resolvedBook := resolveDefaultBook(db, bookCode)
	if db == nil {
		return fmt.Sprintf("Unknown %s %d", resolvedBook, number), "", true
	}
	var t, l sql.NullString
	err := db.QueryRow(`SELECT title, lyrics FROM hymns WHERE book_code = ? AND number = ?`, resolvedBook, number).Scan(&t, &l)
	if err != nil {
		return fmt.Sprintf("Unknown %s %d", resolvedBook, number), "", true
	}
	title = t.String
	lyrics = l.String
	if strings.TrimSpace(lyrics) == "" {
		if title == "" {
			title = fmt.Sprintf("Unknown %s %d", resolvedBook, number)
		}
		return title, "", true
	}
	return title, lyrics, false
}

// LookupHymn resolves a hymn by number using the default resolved book.
func LookupHymn(db *sql.DB, number int) (title, lyrics string, incomplete bool) {
	return LookupHymnInBook(db, "", number)
}

func ParseScriptureValue(raw string) *Scripture {
	value := strings.TrimSpace(raw)
	if value == "" || value == "-" || value == "—" {
		return nil
	}
	if m := scriptureSplit.FindStringSubmatch(value); m != nil {
		ref := strings.TrimSpace(m[1]) + " " + strings.TrimSpace(m[2])
		return &Scripture{Reference: &ref, Text: strings.TrimSpace(m[3])}
	}
	if m := scriptureRef.FindStringSubmatch(value); m != nil {
		ref := strings.TrimSpace(m[1]) + " " + strings.TrimSpace(m[2])
		return &Scripture{Reference: &ref, Text: ""}
	}
	return &Scripture{Reference: nil, Text: value}
}

func ParseRundown(db *sql.DB, rawText string) Rundown {
	normalized := strings.ReplaceAll(strings.ReplaceAll(rawText, "\r\n", "\n"), "\r", "\n")
	var lines []string
	for _, l := range strings.Split(normalized, "\n") {
		l = strings.TrimSpace(l)
		if l != "" {
			lines = append(lines, l)
		}
	}
	parsed := Rundown{
		Items:             []Item{},
		UnmappedLines:     []string{},
		FailedHymnNumbers: []int{},
	}
	if m := dateRE.FindString(normalized); m != "" {
		parsed.Date = parseCalendarDate(m)
	}
	var sermonSpeaker string
	for _, rawLine := range lines {
		if dateRE.MatchString(rawLine) && !strings.Contains(rawLine, ":") {
			continue
		}
		timing := extractTiming(stripPrefixes(rawLine))
		line := cleanLine(rawLine)
		if line == "" {
			continue
		}
		mapped := false
		if sectionRE.MatchString(line) {
			title := strings.TrimSpace(regexp.MustCompile(`\s*\(.*\)\s*$`).ReplaceAllString(line, ""))
			title = strings.Join(strings.Fields(title), " ")
			parsed.Items = append(parsed.Items, withTiming(Item{Type: "section", Title: title}, timing))
			mapped = true
		}
		if !mapped {
			if m := specialRE.FindStringSubmatch(line); m != nil {
				v := strings.TrimSpace(m[1])
				if v == "" || v == "-" || v == "—" || strings.EqualFold(v, "none") {
					parsed.SpecialSong = nil
				} else {
					parsed.SpecialSong = &v
				}
				mapped = true
			}
		}
		if !mapped {
			if m := themeRE.FindStringSubmatch(line); m != nil {
				parsed.ThemeVerse = ParseScriptureValue(m[1])
				mapped = true
			}
		}
		if !mapped {
			if m := verseRE.FindStringSubmatch(line); m != nil {
				parsed.VerseReading = ParseScriptureValue(m[1])
				mapped = true
			}
		}
		if !mapped {
			if m := familyRE.FindStringSubmatch(line); m != nil {
				v := strings.TrimSpace(m[1])
				if v == "" || v == "-" || v == "—" {
					parsed.FamilyYouth = nil
				} else {
					parsed.FamilyYouth = &v
				}
				mapped = true
			}
		}
		if !mapped {
			if m := sermonRE.FindStringSubmatch(line); m != nil {
				speaker := strings.TrimSpace(regexp.MustCompile(`\s+"[^"]*"\s*$`).ReplaceAllString(m[1], ""))
				title := ""
				if m[2] != "" {
					title = strings.TrimSpace(m[2])
				} else if m[3] != "" {
					title = strings.TrimSpace(m[3])
				}
				if speaker != "" {
					parsed.Sermon = &Sermon{Speaker: speaker, Title: title}
					sermonSpeaker = speaker
					name := speaker
					if title != "" {
						name = speaker + " — " + title
					}
					parsed.Items = append(parsed.Items, withTiming(Item{Type: "role", Role: "Sermon", Name: name}, timing))
					mapped = true
				}
			}
		}
		if !mapped {
			if m := hymnRE.FindStringSubmatch(line); m != nil {
				number, _ := strconv.Atoi(m[1])
				title, lyrics, incomplete := LookupHymn(db, number)
				item := Item{Type: "hymn", Number: number, Title: title, Lyrics: lyrics, Incomplete: incomplete}
				parsed.Items = append(parsed.Items, withTiming(item, timing))
				if incomplete && !containsInt(parsed.FailedHymnNumbers, number) {
					parsed.FailedHymnNumbers = append(parsed.FailedHymnNumbers, number)
				}
				mapped = true
			}
		}
		if !mapped {
			if role := parseRoleLine(line); role != nil {
				name := role.Name
				if regexp.MustCompile(`(?i)^Closing\s+Prayer$`).MatchString(role.Role) &&
					regexp.MustCompile(`(?i)^The\s+Speaker$`).MatchString(name) {
					if sermonSpeaker != "" {
						name = sermonSpeaker
					}
				}
				if regexp.MustCompile(`(?i)^Closing\s+Prayer$`).MatchString(role.Role) {
					parsed.ClosingPrayerPerson = &name
				}
				parsed.Items = append(parsed.Items, withTiming(Item{Type: "role", Role: role.Role, Name: name}, timing))
				mapped = true
			}
		}
		if !mapped && dateRE.MatchString(line) {
			mapped = true
		}
		if !mapped {
			parsed.UnmappedLines = append(parsed.UnmappedLines, rawLine)
		}
	}
	if parsed.ClosingPrayerPerson != nil &&
		regexp.MustCompile(`(?i)^The\s+Speaker$`).MatchString(*parsed.ClosingPrayerPerson) &&
		sermonSpeaker != "" {
		parsed.ClosingPrayerPerson = &sermonSpeaker
		for i, item := range parsed.Items {
			if item.Type == "role" &&
				regexp.MustCompile(`(?i)^Closing\s+Prayer$`).MatchString(item.Role) &&
				regexp.MustCompile(`(?i)^The\s+Speaker$`).MatchString(item.Name) {
				parsed.Items[i].Name = sermonSpeaker
			}
		}
	}
	return parsed
}

type roleLine struct {
	Role string
	Name string
}

func parseRoleLine(line string) *roleLine {
	if hymnHintRE.MatchString(line) {
		return nil
	}
	if regexp.MustCompile(`(?i)^Sermon\s*[:\-]`).MatchString(line) {
		return nil
	}
	if regexp.MustCompile(`(?i)^Special\s+Song\s*[:\-]`).MatchString(line) {
		return nil
	}
	if regexp.MustCompile(`(?i)^Theme(?:\s+Verse)?\s*[:\-]`).MatchString(line) {
		return nil
	}
	if regexp.MustCompile(`(?i)^(?:Verse\s+Reading|Memory\s+(?:Verse|Text)|Ayat\s+Bacaan)\s*[:\-]`).MatchString(line) {
		return nil
	}
	if regexp.MustCompile(`(?i)^(?:Family(?:\s*&\s*|\s+and\s+|/\s*)Youth|Family\s+of\s+the\s+Week|Youth\s+of\s+the\s+Week|Keluarga)`).MatchString(line) {
		return nil
	}
	if sectionRE.MatchString(line) && !strings.Contains(line, ":") {
		return nil
	}
	var m []string
	if b := bracketRole.FindStringSubmatch(line); b != nil {
		m = b
	} else if c := colonRole.FindStringSubmatch(line); c != nil {
		m = c
	} else {
		return nil
	}
	role := strings.TrimSpace(m[1])
	name := strings.TrimSpace(m[2])
	if role == "" || name == "" || clockRole.MatchString(role) {
		return nil
	}
	return &roleLine{Role: role, Name: name}
}

func withTiming(item Item, timing *string) Item {
	if timing == nil {
		return item
	}
	item.Timing = timing
	return item
}

func containsInt(xs []int, n int) bool {
	for _, x := range xs {
		if x == n {
			return true
		}
	}
	return false
}

func Normalize(parsed Rundown) Rundown {
	if parsed.Items == nil {
		parsed.Items = []Item{}
	}
	if parsed.UnmappedLines == nil {
		parsed.UnmappedLines = []string{}
	}
	if parsed.FailedHymnNumbers == nil {
		parsed.FailedHymnNumbers = []int{}
	}
	if parsed.FamilyPrayerRequest == nil && parsed.YouthPrayerRequest == nil && parsed.FamilyYouth != nil {
		parsed.FamilyPrayerRequest = parsed.FamilyYouth
	}
	return parsed
}
