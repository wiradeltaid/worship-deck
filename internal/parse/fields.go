package parse

import (
	"database/sql"
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
)

var structuredKeys = []string{
	"themeVerse", "verseReading", "familyYouth", "familyPrayerRequest",
	"youthPrayerRequest", "familyName", "youthName", "sermon", "specialSong", "closingPrayerPerson",
	"songSets",
	"sermonSpeaker", "sermonTitle",
}

func HasStructuredFields(body map[string]any) bool {
	src := body
	if f, ok := body["fields"]; ok {
		m, ok := f.(map[string]any)
		if !ok {
			return false
		}
		src = m
	}
	for _, k := range structuredKeys {
		if _, ok := src[k]; ok {
			return true
		}
	}
	return false
}

func ApplyStructuredFields(db *sql.DB, parsed *Rundown, body map[string]any) {
	src := body
	if f, ok := body["fields"]; ok {
		if m, ok := f.(map[string]any); ok {
			src = m
		}
	}
	if v, ok := src["themeVerse"]; ok {
		parsed.ThemeVerse = coerceScripture(v)
	}
	if v, ok := src["verseReading"]; ok {
		parsed.VerseReading = coerceScripture(v)
	}
	if v, ok := src["familyYouth"]; ok {
		parsed.FamilyYouth = coerceNullableString(v)
	}
	if _, ok := src["familyPrayerRequest"]; ok {
		parsed.FamilyPrayerRequest = coerceNullableString(src["familyPrayerRequest"])
		parsed.FamilyYouth = nil
	}
	if _, ok := src["youthPrayerRequest"]; ok {
		parsed.YouthPrayerRequest = coerceNullableString(src["youthPrayerRequest"])
		parsed.FamilyYouth = nil
	}
	if _, ok := src["familyName"]; ok {
		parsed.FamilyName = coerceNullableString(src["familyName"])
	}
	if _, ok := src["youthName"]; ok {
		parsed.YouthName = coerceNullableString(src["youthName"])
	}
	if v, ok := src["specialSong"]; ok {
		parsed.SpecialSong = coerceSpecialSong(v)
	}
	if v, ok := src["sermon"]; ok {
		parsed.Sermon = coerceSermon(v)
		applySermonItem(parsed)
	} else if _, hasSpeaker := src["sermonSpeaker"]; hasSpeaker || hasKey(src, "sermonTitle") {
		speaker, _ := src["sermonSpeaker"].(string)
		title, _ := src["sermonTitle"].(string)
		speaker = strings.TrimSpace(speaker)
		title = strings.TrimSpace(title)
		if speaker == "" {
			parsed.Sermon = nil
		} else {
			parsed.Sermon = &Sermon{Speaker: speaker, Title: title}
		}
		applySermonItem(parsed)
	}
	if v, ok := src["closingPrayerPerson"]; ok {
		person := coerceNullableString(v)
		if person != nil && regexp.MustCompile(`(?i)^the\s+speaker$`).MatchString(strings.TrimSpace(*person)) && parsed.Sermon != nil && parsed.Sermon.Speaker != "" {
			s := parsed.Sermon.Speaker
			person = &s
		}
		parsed.ClosingPrayerPerson = person
		applyClosingItem(parsed)
	}
	if db != nil {
		if v, ok := src["songSets"]; ok {
			validateSongSetNumbers(db, parsed, v)
		}
	}
}

// validateSongSetNumbers checks each Song Set entry's song number against the
// hymn corpus (DEC-004 / FR-32). The weekly inputs themselves are persisted by
// the Hub write path into song_set_inputs, keyed by variable_name — parsed_data
// no longer carries positional hymn overlays. A number whose lyrics cannot be
// resolved is reported through FailedHymnNumbers; a number that resolves is
// cleared from that list so a corrected entry stops warning.
func validateSongSetNumbers(db *sql.DB, parsed *Rundown, v any) {
	m, ok := v.(map[string]any)
	if !ok {
		return
	}
	for _, entry := range m {
		em, ok := entry.(map[string]any)
		if !ok {
			continue
		}
		n := CoerceSongNumber(em["songNumber"])
		if n == nil {
			continue
		}
		bookCode, _ := em["songBookCode"].(string)
		_, _, incomplete := LookupHymnInBook(db, bookCode, *n)
		if incomplete {
			parsed.FailedHymnNumbers = appendUniqueInt(parsed.FailedHymnNumbers, *n)
		} else {
			parsed.FailedHymnNumbers = withoutInt(parsed.FailedHymnNumbers, *n)
		}
	}
}

func hasKey(m map[string]any, k string) bool {
	_, ok := m[k]
	return ok
}

func coerceScripture(v any) *Scripture {
	if v == nil {
		return nil
	}
	if s, ok := v.(string); ok {
		return ParseScriptureValue(s)
	}
	m, ok := v.(map[string]any)
	if !ok {
		return nil
	}
	var ref *string
	if r, ok := m["reference"].(string); ok && strings.TrimSpace(r) != "" {
		t := strings.TrimSpace(r)
		ref = &t
	}
	text := ""
	if t, ok := m["text"].(string); ok {
		text = strings.TrimSpace(t)
	}
	if ref == nil && text == "" {
		return nil
	}
	translation := ""
	if t, ok := m["translation"].(string); ok {
		translation = strings.ToUpper(strings.TrimSpace(t))
	}
	return &Scripture{Reference: ref, Text: text, Translation: translation}
}

func coerceNullableString(v any) *string {
	if v == nil {
		return nil
	}
	s, ok := v.(string)
	if !ok {
		return nil
	}
	t := strings.TrimSpace(s)
	if t == "" {
		return nil
	}
	return &t
}

func coerceSpecialSong(v any) *string {
	if v == nil {
		return nil
	}
	s, ok := v.(string)
	if !ok {
		return nil
	}
	t := strings.TrimSpace(s)
	if t == "" || t == "-" || t == "—" || strings.EqualFold(t, "none") {
		return nil
	}
	return &t
}

func coerceSermon(v any) *Sermon {
	if v == nil {
		return nil
	}
	m, ok := v.(map[string]any)
	if !ok {
		return nil
	}
	speaker := strings.TrimSpace(asAnyString(m["speaker"]))
	title := strings.TrimSpace(asAnyString(m["title"]))
	if speaker == "" {
		return nil
	}
	return &Sermon{Speaker: speaker, Title: title}
}

func asAnyString(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return strings.Trim(string(b), `"`)
}

func applySermonItem(parsed *Rundown) {
	idx := indexRole(parsed.Items, "Sermon")
	if parsed.Sermon == nil {
		if idx >= 0 {
			parsed.Items = append(parsed.Items[:idx], parsed.Items[idx+1:]...)
		}
		return
	}
	name := parsed.Sermon.Speaker
	if parsed.Sermon.Title != "" {
		name = parsed.Sermon.Speaker + " — " + parsed.Sermon.Title
	}
	item := Item{Type: "role", Role: "Sermon", Name: name}
	if idx >= 0 {
		parsed.Items[idx] = item
	} else {
		parsed.Items = append(parsed.Items, item)
	}
}

func applyClosingItem(parsed *Rundown) {
	idx := indexRole(parsed.Items, "Closing Prayer")
	if parsed.ClosingPrayerPerson == nil {
		if idx >= 0 {
			parsed.Items = append(parsed.Items[:idx], parsed.Items[idx+1:]...)
		}
		return
	}
	item := Item{Type: "role", Role: "Closing Prayer", Name: *parsed.ClosingPrayerPerson}
	if idx >= 0 {
		parsed.Items[idx] = item
	} else {
		parsed.Items = append(parsed.Items, item)
	}
}

func indexRole(items []Item, role string) int {
	re := regexp.MustCompile(`(?i)^` + regexp.QuoteMeta(role) + `$`)
	for i, it := range items {
		if it.Type == "role" && re.MatchString(it.Role) {
			return i
		}
	}
	return -1
}

func CoerceSongNumber(v any) *int {
	if v == nil {
		return nil
	}
	switch t := v.(type) {
	case float64:
		n := int(t)
		if n > 0 {
			return &n
		}
	case string:
		m := regexp.MustCompile(`(\d{1,4})`).FindStringSubmatch(strings.TrimSpace(t))
		if len(m) == 2 {
			n, err := strconv.Atoi(m[1])
			if err == nil && n > 0 {
				return &n
			}
		}
	}
	return nil
}

func withoutInt(xs []int, n int) []int {
	out := make([]int, 0, len(xs))
	for _, x := range xs {
		if x != n {
			out = append(out, x)
		}
	}
	return out
}

func appendUniqueInt(xs []int, n int) []int {
	for _, x := range xs {
		if x == n {
			return xs
		}
	}
	return append(xs, n)
}
