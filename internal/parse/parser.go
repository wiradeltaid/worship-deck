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
	BookCode   string  `json:"bookCode,omitempty"`
	Lyrics     string  `json:"lyrics,omitempty"`
	Incomplete bool    `json:"incomplete,omitempty"`
	Timing     *string `json:"timing,omitempty"`
}

type SongCandidate struct {
	Line       string  `json:"line"`
	BookCode   string  `json:"bookCode"`
	Number     int     `json:"number"`
	Title      string  `json:"title"`
	Lyrics     string  `json:"lyrics"`
	Incomplete bool    `json:"incomplete"`
	Label      string  `json:"label,omitempty"`
	Timing     *string `json:"timing,omitempty"`
}

type SongSetSuggestion struct {
	VariableName string `json:"variableName"`
	SongNumber   int    `json:"songNumber"`
	SongBookCode string `json:"songBookCode"`
	Title        string `json:"title"`
	Lyrics       string `json:"lyrics"`
	SourceLine   string `json:"sourceLine,omitempty"`
	MatchKind    string `json:"matchKind,omitempty"`
}

type Rundown struct {
	Date                *string         `json:"date"`
	Items               []Item          `json:"items"`
	UnmappedLines       []string        `json:"unmappedLines"`
	FailedHymnNumbers   []int           `json:"failedHymnNumbers"`
	Sermon              *Sermon         `json:"sermon"`
	SpecialSong         *string         `json:"specialSong"`
	ClosingPrayerPerson *string         `json:"closingPrayerPerson"`
	ThemeVerse          *Scripture      `json:"themeVerse"`
	VerseReading        *Scripture      `json:"verseReading"`
	FamilyYouth         *string         `json:"familyYouth"`
	FamilyPrayerRequest *string         `json:"familyPrayerRequest"`
	YouthPrayerRequest  *string         `json:"youthPrayerRequest"`
	FamilyName          *string         `json:"familyName,omitempty"`
	YouthName           *string           `json:"youthName,omitempty"`
	SongCandidates      []SongCandidate   `json:"songCandidates,omitempty"`
	FieldSuggestions    map[string]string `json:"fieldSuggestions,omitempty"`
	SongSetSuggestions  map[string]SongSetSuggestion `json:"songSetSuggestions,omitempty"`
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

func extractNamedGroups(re *regexp.Regexp, text string) map[string]string {
	if re == nil {
		return nil
	}
	match := re.FindStringSubmatch(text)
	if match == nil {
		return nil
	}
	result := make(map[string]string)
	names := re.SubexpNames()
	for i, name := range names {
		if i != 0 && name != "" && i < len(match) {
			if val := strings.TrimSpace(match[i]); val != "" || result[name] == "" {
				result[name] = val
			}
		}
	}
	return result
}

func extractTimingWithProfile(line string, profile *ParserProfile) *string {
	timingREs := []*regexp.Regexp{timingRange, timingMinutes, timingM}
	if profile != nil && len(profile.timingREs) > 0 {
		timingREs = profile.timingREs
	}
	var found []string
	for _, re := range timingREs {
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

func extractTiming(line string) *string {
	return extractTimingWithProfile(line, nil)
}

func stripTimingsWithProfile(line string, profile *ParserProfile) string {
	timingREs := []*regexp.Regexp{timingRange, timingMinutes, timingM}
	if profile != nil && len(profile.timingREs) > 0 {
		timingREs = profile.timingREs
	}
	for _, re := range timingREs {
		line = re.ReplaceAllString(line, "")
	}
	return strings.Join(strings.Fields(line), " ")
}

func stripTimings(line string) string {
	return stripTimingsWithProfile(line, nil)
}

func stripPrefixesWithProfile(line string, profile *ParserProfile) string {
	line = strings.TrimSpace(line)
	if profile != nil && len(profile.stripPrefixREs) > 0 {
		for _, re := range profile.stripPrefixREs {
			line = re.ReplaceAllString(line, "")
			line = strings.TrimSpace(line)
		}
		return strings.TrimSpace(line)
	}
	line = strings.TrimPrefix(line, "》")
	line = strings.TrimSpace(line)
	if strings.HasPrefix(line, "[") {
		line = regexp.MustCompile(`^\[\s*\]\s*`).ReplaceAllString(line, "")
	}
	return strings.TrimSpace(line)
}

func stripPrefixes(line string) string {
	return stripPrefixesWithProfile(line, nil)
}

func cleanLineWithProfile(line string, profile *ParserProfile) string {
	return stripTimingsWithProfile(stripPrefixesWithProfile(line, profile), profile)
}

func cleanLine(line string) string {
	return cleanLineWithProfile(line, nil)
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

func ParseScriptureValueWithProfile(raw string, profile *ParserProfile) *Scripture {
	value := strings.TrimSpace(raw)
	if value == "" || value == "-" || value == "—" {
		return nil
	}
	splitRE := scriptureSplit
	refRE := scriptureRef
	if profile != nil && profile.scriptureSplitRE != nil {
		splitRE = profile.scriptureSplitRE
	}
	if profile != nil && profile.scriptureRefRE != nil {
		refRE = profile.scriptureRefRE
	}
	if m := splitRE.FindStringSubmatch(value); m != nil {
		groups := extractNamedGroups(splitRE, value)
		if bc, ok := groups["book_chapter"]; ok && groups["text"] != "" {
			t := strings.TrimSpace(groups["text"])
			return &Scripture{Reference: &bc, Text: t}
		}
		if len(m) >= 4 {
			ref := strings.TrimSpace(m[1]) + " " + strings.TrimSpace(m[2])
			return &Scripture{Reference: &ref, Text: strings.TrimSpace(m[3])}
		}
	}
	if m := refRE.FindStringSubmatch(value); m != nil {
		groups := extractNamedGroups(refRE, value)
		if bc, ok := groups["book_chapter"]; ok && bc != "" {
			return &Scripture{Reference: &bc, Text: ""}
		}
		if len(m) >= 3 {
			ref := strings.TrimSpace(m[1]) + " " + strings.TrimSpace(m[2])
			return &Scripture{Reference: &ref, Text: ""}
		}
	}
	return &Scripture{Reference: nil, Text: value}
}

func ParseScriptureValue(raw string) *Scripture {
	return ParseScriptureValueWithProfile(raw, nil)
}

func ParseRundown(db *sql.DB, rawText string) Rundown {
	return ParseRundownWithProfile(db, rawText, StaticDefaultParser())
}

func ParseRundownWithProfile(db *sql.DB, rawText string, profile *ParserProfile) Rundown {
	if profile == nil {
		profile = StaticDefaultParser()
	}
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
		SongCandidates:    []SongCandidate{},
	}
	dRE := dateRE
	if profile.dateRE != nil {
		dRE = profile.dateRE
	}
	if m := dRE.FindString(normalized); m != "" {
		parsed.Date = parseCalendarDate(m)
	}
	var sermonSpeaker string
	for _, rawLine := range lines {
		if dRE.MatchString(rawLine) && !strings.Contains(rawLine, ":") {
			continue
		}
		timing := extractTimingWithProfile(stripPrefixesWithProfile(rawLine, profile), profile)
		line := cleanLineWithProfile(rawLine, profile)
		if line == "" {
			continue
		}
		mapped := false

		// 1. Section Delimiters
		secRE := sectionRE
		if profile.sectionDelimiterRE != nil {
			secRE = profile.sectionDelimiterRE
		}
		if secRE.MatchString(line) {
			title := strings.TrimSpace(regexp.MustCompile(`\s*\(.*\)\s*$`).ReplaceAllString(line, ""))
			title = strings.Join(strings.Fields(title), " ")
			parsed.Items = append(parsed.Items, withTiming(Item{Type: "section", Title: title}, timing))
			mapped = true
		}

		// 2. Special Song
		if !mapped {
			spRE := specialRE
			if re, ok := profile.fieldREs["special_song"]; ok && re != nil {
				spRE = re
			}
			if m := spRE.FindStringSubmatch(line); m != nil {
				groups := extractNamedGroups(spRE, line)
				v := ""
				if val, ok := groups["value"]; ok {
					v = strings.TrimSpace(val)
				} else if len(m) > 1 {
					v = strings.TrimSpace(m[1])
				}
				if v == "" || v == "-" || v == "—" || strings.EqualFold(v, "none") {
					parsed.SpecialSong = nil
				} else {
					parsed.SpecialSong = &v
				}
				mapped = true
			}
		}

		// 3. Theme Verse
		if !mapped {
			thRE := themeRE
			if re, ok := profile.fieldREs["theme_verse"]; ok && re != nil {
				thRE = re
			}
			if m := thRE.FindStringSubmatch(line); m != nil {
				groups := extractNamedGroups(thRE, line)
				v := ""
				if val, ok := groups["value"]; ok {
					v = strings.TrimSpace(val)
				} else if len(m) > 1 {
					v = strings.TrimSpace(m[1])
				}
				parsed.ThemeVerse = ParseScriptureValueWithProfile(v, profile)
				mapped = true
			}
		}

		// 4. Verse Reading
		if !mapped {
			vrRE := verseRE
			if re, ok := profile.fieldREs["verse_reading"]; ok && re != nil {
				vrRE = re
			}
			if m := vrRE.FindStringSubmatch(line); m != nil {
				groups := extractNamedGroups(vrRE, line)
				v := ""
				if val, ok := groups["value"]; ok {
					v = strings.TrimSpace(val)
				} else if len(m) > 1 {
					v = strings.TrimSpace(m[1])
				}
				parsed.VerseReading = ParseScriptureValueWithProfile(v, profile)
				mapped = true
			}
		}

		// 5. Family Youth
		if !mapped {
			famRE := familyRE
			if re, ok := profile.fieldREs["family_youth"]; ok && re != nil {
				famRE = re
			}
			if m := famRE.FindStringSubmatch(line); m != nil {
				groups := extractNamedGroups(famRE, line)
				v := ""
				if val, ok := groups["value"]; ok {
					v = strings.TrimSpace(val)
				} else if len(m) > 1 {
					v = strings.TrimSpace(m[1])
				}
				if v == "" || v == "-" || v == "—" {
					parsed.FamilyYouth = nil
				} else {
					parsed.FamilyYouth = &v
				}
				mapped = true
			}
		}

		// 6. Sermon
		if !mapped {
			sermRE := sermonRE
			if re, ok := profile.fieldREs["sermon"]; ok && re != nil {
				sermRE = re
			}
			if m := sermRE.FindStringSubmatch(line); m != nil {
				groups := extractNamedGroups(sermRE, line)
				speaker := ""
				title := ""
				if sp, ok := groups["speaker"]; ok {
					speaker = strings.TrimSpace(regexp.MustCompile(`\s+"[^"]*"\s*$`).ReplaceAllString(sp, ""))
				} else if len(m) > 1 {
					speaker = strings.TrimSpace(regexp.MustCompile(`\s+"[^"]*"\s*$`).ReplaceAllString(m[1], ""))
				}
				if ti, ok := groups["title"]; ok {
					title = strings.TrimSpace(ti)
				} else {
					if len(m) > 2 && m[2] != "" {
						title = strings.TrimSpace(m[2])
					} else if len(m) > 3 && m[3] != "" {
						title = strings.TrimSpace(m[3])
					}
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

		// 7. Hymn & Song Matching
		if !mapped {
			hymnREs := profile.hymnREs
			if len(hymnREs) == 0 {
				hymnREs = []*regexp.Regexp{hymnRE}
			}
			for _, hre := range hymnREs {
				if m := hre.FindStringSubmatch(line); m != nil {
					groups := extractNamedGroups(hre, line)
					numStr := ""
					bookStr := ""
					if n, ok := groups["number"]; ok {
						numStr = n
					}
					if b, ok := groups["book"]; ok {
						bookStr = b
					}
					if numStr == "" && len(m) > 1 {
						for _, sm := range m[1:] {
							if _, err := strconv.Atoi(strings.TrimSpace(sm)); err == nil {
								numStr = strings.TrimSpace(sm)
								break
							}
						}
					}
					if numStr != "" {
						number, _ := strconv.Atoi(numStr)
						bookCode := profile.ResolveBook(bookStr)
						title, lyrics, incomplete := LookupHymnInBook(db, bookCode, number)
						item := Item{
							Type:       "hymn",
							BookCode:   bookCode,
							Number:     number,
							Title:      title,
							Lyrics:     lyrics,
							Incomplete: incomplete,
						}
						parsed.Items = append(parsed.Items, withTiming(item, timing))
						if incomplete && !containsInt(parsed.FailedHymnNumbers, number) {
							parsed.FailedHymnNumbers = append(parsed.FailedHymnNumbers, number)
						}
						candidate := SongCandidate{
							Line:       rawLine,
							BookCode:   bookCode,
							Number:     number,
							Title:      title,
							Lyrics:     lyrics,
							Incomplete: incomplete,
							Timing:     timing,
						}
						parsed.SongCandidates = append(parsed.SongCandidates, candidate)
						mapped = true
						break
					}
				}
			}
		}

		// 8. Role line matching
		if !mapped {
			if role := parseRoleLineWithProfile(line, profile); role != nil {
				name := role.Name
				if regexp.MustCompile(`(?i)^(?:Closing\s+Prayer|Doa\s+(?:Tutup|Penutup))$`).MatchString(role.Role) &&
					regexp.MustCompile(`(?i)^The\s+Speaker$`).MatchString(name) {
					if sermonSpeaker != "" {
						name = sermonSpeaker
					}
				}
				if regexp.MustCompile(`(?i)^(?:Closing\s+Prayer|Doa\s+(?:Tutup|Penutup))$`).MatchString(role.Role) {
					parsed.ClosingPrayerPerson = &name
				}
				parsed.Items = append(parsed.Items, withTiming(Item{Type: "role", Role: role.Role, Name: name}, timing))
				mapped = true
			}
		}

		// 9. Stray standalone date line
		if !mapped && dRE.MatchString(line) {
			mapped = true
		}

		// 10. Unmapped line
		if !mapped {
			parsed.UnmappedLines = append(parsed.UnmappedLines, rawLine)
		}
	}

	// Closing prayer speaker resolution
	if parsed.ClosingPrayerPerson != nil &&
		regexp.MustCompile(`(?i)^The\s+Speaker$`).MatchString(*parsed.ClosingPrayerPerson) &&
		sermonSpeaker != "" {
		parsed.ClosingPrayerPerson = &sermonSpeaker
		for i, item := range parsed.Items {
			if item.Type == "role" &&
				regexp.MustCompile(`(?i)^(?:Closing\s+Prayer|Doa\s+(?:Tutup|Penutup))$`).MatchString(item.Role) &&
				regexp.MustCompile(`(?i)^The\s+Speaker$`).MatchString(item.Name) {
				parsed.Items[i].Name = sermonSpeaker
			}
		}
	}

	parsed.FieldSuggestions = extractDynamicFieldSuggestions(db, lines, rawText)
	parsed.SongSetSuggestions = extractDynamicSongSetSuggestions(db, lines, rawText, profile)

	// Sync dynamic field suggestions into legacy parsed fields if missing
	if ref, ok := parsed.FieldSuggestions["scripture_reference"]; ok && ref != "" {
		if parsed.VerseReading == nil {
			parsed.VerseReading = &Scripture{Reference: &ref}
		} else if parsed.VerseReading.Reference == nil || *parsed.VerseReading.Reference == "" {
			parsed.VerseReading.Reference = &ref
		}
	}
	if txt, ok := parsed.FieldSuggestions["scripture_text"]; ok && txt != "" {
		if parsed.VerseReading == nil {
			parsed.VerseReading = &Scripture{Text: txt}
		} else if parsed.VerseReading.Text == "" {
			parsed.VerseReading.Text = txt
		}
	}
	if spk, ok := parsed.FieldSuggestions["sermon_speaker_name"]; ok && spk != "" {
		if parsed.Sermon == nil {
			parsed.Sermon = &Sermon{Speaker: spk}
		} else if parsed.Sermon.Speaker == "" {
			parsed.Sermon.Speaker = spk
		}
	}
	if title, ok := parsed.FieldSuggestions["sermon_title"]; ok && title != "" {
		if parsed.Sermon == nil {
			parsed.Sermon = &Sermon{Title: title}
		} else if parsed.Sermon.Title == "" {
			parsed.Sermon.Title = title
		}
	}
	if ss, ok := parsed.FieldSuggestions["special_song"]; ok && ss != "" && parsed.SpecialSong == nil {
		parsed.SpecialSong = &ss
	}
	if cp, ok := parsed.FieldSuggestions["closing_prayer_person"]; ok && cp != "" && parsed.ClosingPrayerPerson == nil {
		parsed.ClosingPrayerPerson = &cp
	}
	if fn, ok := parsed.FieldSuggestions["family_name"]; ok && fn != "" && parsed.FamilyName == nil {
		parsed.FamilyName = &fn
	}
	if fr, ok := parsed.FieldSuggestions["family_request"]; ok && fr != "" && parsed.FamilyPrayerRequest == nil {
		parsed.FamilyPrayerRequest = &fr
	}
	if yn, ok := parsed.FieldSuggestions["youth_name"]; ok && yn != "" && parsed.YouthName == nil {
		parsed.YouthName = &yn
	}
	if yr, ok := parsed.FieldSuggestions["youth_request"]; ok && yr != "" && parsed.YouthPrayerRequest == nil {
		parsed.YouthPrayerRequest = &yr
	}

	return parsed
}

type roleLine struct {
	Role string
	Name string
}

func parseRoleLineWithProfile(line string, profile *ParserProfile) *roleLine {
	if profile != nil && len(profile.hymnREs) > 0 {
		for _, re := range profile.hymnREs {
			if re.MatchString(line) {
				return nil
			}
		}
	} else if hymnHintRE.MatchString(line) {
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
	secRE := sectionRE
	if profile != nil && profile.sectionDelimiterRE != nil {
		secRE = profile.sectionDelimiterRE
	}
	if secRE.MatchString(line) && !strings.Contains(line, ":") {
		return nil
	}

	bRoleRE := bracketRole
	cRoleRE := colonRole
	ckRoleRE := clockRole
	if profile != nil && profile.bracketRoleRE != nil {
		bRoleRE = profile.bracketRoleRE
	}
	if profile != nil && profile.colonRoleRE != nil {
		cRoleRE = profile.colonRoleRE
	}
	if profile != nil && profile.clockRoleRE != nil {
		ckRoleRE = profile.clockRoleRE
	}

	var m []string
	if b := bRoleRE.FindStringSubmatch(line); b != nil {
		m = b
	} else if c := cRoleRE.FindStringSubmatch(line); c != nil {
		m = c
	} else {
		return nil
	}
	role := strings.TrimSpace(m[1])
	name := strings.TrimSpace(m[2])
	if role == "" || name == "" || ckRoleRE.MatchString(role) {
		return nil
	}
	return &roleLine{Role: role, Name: name}
}

func parseRoleLine(line string) *roleLine {
	return parseRoleLineWithProfile(line, nil)
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

func extractDynamicFieldSuggestions(db *sql.DB, lines []string, rawText string) map[string]string {
	suggestions := make(map[string]string)
	if db == nil {
		return suggestions
	}
	rows, err := db.Query(`
		SELECT variable_name, extraction_regex
		FROM predefined_fields
		WHERE is_active = 1 AND extraction_regex IS NOT NULL AND TRIM(extraction_regex) != ''
	`)
	if err != nil {
		return suggestions
	}
	defer rows.Close()

	type fieldPattern struct {
		variableName string
		re           *regexp.Regexp
	}
	var patterns []fieldPattern
	for rows.Next() {
		var varName, regexStr string
		if err := rows.Scan(&varName, &regexStr); err == nil {
			if translated, err := ValidateAndTranslateRegex(regexStr); err == nil {
				if compiled, err := regexp.Compile(translated); err == nil {
					patterns = append(patterns, fieldPattern{
						variableName: varName,
						re:           compiled,
					})
				}
			}
		}
	}

	for _, p := range patterns {
		found := false
		for _, line := range lines {
			if m := p.re.FindStringSubmatch(line); m != nil {
				groups := extractNamedGroups(p.re, line)
				val := ""
				if v, ok := groups["value"]; ok && strings.TrimSpace(v) != "" {
					val = strings.TrimSpace(v)
				} else if len(m) > 1 && strings.TrimSpace(m[1]) != "" {
					val = strings.TrimSpace(m[1])
				} else {
					val = strings.TrimSpace(m[0])
				}
				if t, ok := groups["title"]; ok && strings.TrimSpace(t) != "" {
					suggestions["sermon_title"] = strings.TrimSpace(t)
				}
				if val != "" {
					suggestions[p.variableName] = val
					found = true
					break
				}
			}
		}
		if !found {
			if m := p.re.FindStringSubmatch(rawText); m != nil {
				groups := extractNamedGroups(p.re, rawText)
				val := ""
				if v, ok := groups["value"]; ok && strings.TrimSpace(v) != "" {
					val = strings.TrimSpace(v)
				} else if len(m) > 1 && strings.TrimSpace(m[1]) != "" {
					val = strings.TrimSpace(m[1])
				} else {
					val = strings.TrimSpace(m[0])
				}
				if val != "" {
					suggestions[p.variableName] = val
				}
			}
		}
	}

	return suggestions
}

func extractDynamicSongSetSuggestions(db *sql.DB, lines []string, rawText string, profile *ParserProfile) map[string]SongSetSuggestion {
	suggestions := make(map[string]SongSetSuggestion)
	if db == nil {
		return suggestions
	}
	rows, err := db.Query(`
		SELECT variable_name, extraction_regex
		FROM song_set_entries
		WHERE extraction_regex IS NOT NULL AND TRIM(extraction_regex) != ''
	`)
	if err != nil {
		return suggestions
	}
	defer rows.Close()

	type songPattern struct {
		variableName string
		re           *regexp.Regexp
	}
	var patterns []songPattern
	for rows.Next() {
		var varName, regexStr string
		if err := rows.Scan(&varName, &regexStr); err == nil {
			if translated, err := ValidateAndTranslateRegex(regexStr); err == nil {
				if compiled, err := regexp.Compile(translated); err == nil {
					patterns = append(patterns, songPattern{
						variableName: varName,
						re:           compiled,
					})
				}
			}
		}
	}

	for _, p := range patterns {
		for _, line := range lines {
			if m := p.re.FindStringSubmatch(line); m != nil {
				groups := extractNamedGroups(p.re, line)
				numStr := ""
				bookStr := ""
				if n, ok := groups["number"]; ok {
					numStr = n
				}
				if b, ok := groups["book"]; ok {
					bookStr = b
				}
				if numStr == "" && len(m) > 1 {
					for _, sm := range m[1:] {
						if _, err := strconv.Atoi(strings.TrimSpace(sm)); err == nil {
							numStr = strings.TrimSpace(sm)
							break
						}
					}
				}
				if numStr != "" {
					num, _ := strconv.Atoi(numStr)
					bookCode := "SDAH"
					if profile != nil {
						bookCode = profile.ResolveBook(bookStr)
					} else if bookStr != "" {
						bookCode = strings.ToUpper(strings.TrimSpace(bookStr))
					}
					title, lyrics, _ := LookupHymnInBook(db, bookCode, num)
					suggestions[p.variableName] = SongSetSuggestion{
						VariableName: p.variableName,
						SongNumber:   num,
						SongBookCode: bookCode,
						Title:        title,
						Lyrics:       lyrics,
						MatchKind:    "regex",
					}
					break
				}
			}
		}
	}

	return suggestions
}
