package scripture

import (
	"strings"
	"unicode"
)

type BookName struct {
	ID        int
	Name      string
	ShortName string
}

type Alias struct {
	Alias  string
	BookID int
}

// AliasesFor is matcher-owned, keyed by translation code. Never a corpus field.
func AliasesFor(translation string) []Alias {
	switch strings.ToUpper(strings.TrimSpace(translation)) {
	case "KJV":
		return []Alias{
			{Alias: "ps", BookID: 19},
			{Alias: "psalm", BookID: 19},
			{Alias: "psalms", BookID: 19},
			{Alias: "sos", BookID: 22},
			{Alias: "song of songs", BookID: 22},
			{Alias: "song of solomon", BookID: 22},
		}
	default:
		return nil
	}
}

func normalize(s string) string {
	fields := strings.Fields(strings.ToLower(strings.TrimSpace(s)))
	return strings.Join(fields, " ")
}

var supportedTranslations = []string{"NKJV", "KJV", "TB", "NIV", "ESV", "BIMK", "AYT"}

func stripTranslationSuffix(value string) string {
	val := strings.TrimSpace(value)
	val = strings.TrimRight(val, ",;.")
	val = strings.TrimSpace(val)
	upper := strings.ToUpper(val)

	// 1. Check parenthetical format: "(NKJV)", "(TB)", etc.
	for _, code := range supportedTranslations {
		patt := "(" + code + ")"
		if strings.HasSuffix(upper, patt) {
			prefix := val[:len(val)-len(patt)]
			prefix = strings.TrimSpace(prefix)
			prefix = strings.TrimRight(prefix, ",;.")
			return strings.TrimSpace(prefix)
		}
	}

	// 2. Check bare suffix preceded by whitespace or comma: "Hebrews 1:1, 2, NKJV" or "Hebrews 1:1,2,NKJV" or "Hebrews 1:1 KJV"
	for _, code := range supportedTranslations {
		if strings.HasSuffix(upper, code) {
			prefix := val[:len(val)-len(code)]
			if len(prefix) > 0 {
				lastChar := prefix[len(prefix)-1]
				if unicode.IsSpace(rune(lastChar)) || lastChar == ',' || lastChar == ';' {
					prefix = strings.TrimSpace(prefix)
					prefix = strings.TrimRight(prefix, ",;.")
					return strings.TrimSpace(prefix)
				}
			}
		}
	}

	return val
}

// ParseRef splits a typed reference into a book part and verse numbers.
// The book part is not capped at two words and may contain hyphens.
// Supports both colon-based references (Book C:V, Book C:V-V) and whole-chapter references (Book C).
func ParseRef(raw string) (bookPart string, chapter, start, end int, isWholeChapter, ok bool) {
	value := strings.TrimSpace(strings.ReplaceAll(raw, "+", " "))
	value = stripExamplePrefix(value)
	value = stripTranslationSuffix(value)
	if value == "" {
		return "", 0, 0, 0, false, false
	}
	// Walk from the end looking for chapter:verse so the book name can be
	// any length, including hyphenated Indonesian names.
	colon := strings.LastIndex(value, ":")
	if colon > 0 {
		before := strings.TrimSpace(value[:colon])
		after := strings.TrimSpace(value[colon+1:])
		space := strings.LastIndexFunc(before, unicode.IsSpace)
		if space < 0 {
			return "", 0, 0, 0, false, false
		}
		bookPart = strings.TrimSpace(before[:space])
		chapterStr := strings.TrimSpace(before[space+1:])
		chapter, okCh := atoiPositive(chapterStr)
		if !okCh {
			return "", 0, 0, 0, false, false
		}
		start, end, okV := parseVerseSpan(after)
		if !okV || bookPart == "" {
			return "", 0, 0, 0, false, false
		}
		return bookPart, chapter, start, end, false, true
	}

	// No colon: check for whole-chapter reference "<Book> <Chapter>"
	space := strings.LastIndexFunc(value, unicode.IsSpace)
	if space <= 0 {
		return "", 0, 0, 0, false, false
	}
	bookPart = strings.TrimSpace(value[:space])
	chapterStr := strings.TrimSpace(value[space+1:])
	chapter, okCh := atoiPositive(chapterStr)
	if !okCh || bookPart == "" {
		return "", 0, 0, 0, false, false
	}
	return bookPart, chapter, 0, 0, true, true
}

func parseVerseSpan(after string) (start, end int, ok bool) {
	after = strings.TrimSpace(after)
	sep := -1
	for i, r := range after {
		if r == '-' || r == '–' || r == ',' {
			sep = i
			break
		}
	}
	if sep < 0 {
		n, okN := atoiPositive(after)
		return n, n, okN
	}
	left, okL := atoiPositive(strings.TrimSpace(after[:sep]))
	right, okR := atoiPositive(strings.TrimSpace(after[sep+1:]))
	if !okL || !okR || right < left {
		return 0, 0, false
	}
	return left, right, true
}

func atoiPositive(s string) (int, bool) {
	n := 0
	if s == "" {
		return 0, false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0, false
		}
		n = n*10 + int(r-'0')
	}
	if n <= 0 {
		return 0, false
	}
	return n, true
}

func stripExamplePrefix(value string) string {
	lower := strings.ToLower(value)
	for _, p := range []string{"e.g. ", "eg. ", "example: "} {
		if strings.HasPrefix(lower, p) {
			return strings.TrimSpace(value[len(p):])
		}
	}
	return value
}

// MatchBook picks the unique longest prefix among corpus names and scoped aliases.
// Ambiguous matches (two ids at the same length) are unmapped.
func MatchBook(bookPart string, names []BookName, aliases []Alias) (id int, canonical string, ok bool) {
	input := normalize(bookPart)
	if input == "" {
		return 0, "", false
	}
	type cand struct {
		id        int
		canonical string
		keyLen    int
	}
	var found []cand
	consider := func(key string, bookID int, canonicalName string) {
		k := normalize(key)
		if k == "" {
			return
		}
		if input == k || strings.HasPrefix(input, k+" ") {
			found = append(found, cand{id: bookID, canonical: canonicalName, keyLen: len(k)})
		}
	}
	byID := map[int]string{}
	for _, n := range names {
		byID[n.ID] = n.Name
		consider(n.Name, n.ID, n.Name)
		consider(n.ShortName, n.ID, n.Name)
	}
	for _, a := range aliases {
		consider(a.Alias, a.BookID, byID[a.BookID])
	}
	if len(found) == 0 {
		return 0, "", false
	}
	max := 0
	for _, c := range found {
		if c.keyLen > max {
			max = c.keyLen
		}
	}
	winnerID := 0
	winnerName := ""
	for _, c := range found {
		if c.keyLen != max {
			continue
		}
		if winnerID != 0 && c.id != winnerID {
			return 0, "", false
		}
		winnerID = c.id
		if c.canonical != "" {
			winnerName = c.canonical
		}
	}
	if winnerName == "" {
		winnerName = byID[winnerID]
	}
	if winnerName == "" {
		winnerName = bookPart
	}
	return winnerID, winnerName, true
}

const defaultSuggestLimit = 20

// SuggestBooks returns books whose name, short name, or scoped alias starts
// with q. A complete chapter:verse reference yields no suggestions — the
// operator has already left the book-picking step. Ambiguous prefixes return
// every candidate; uniqueness is the lookup's job, not the list's.
func SuggestBooks(q string, names []BookName, aliases []Alias, limit int) []BookName {
	if limit <= 0 || limit > defaultSuggestLimit {
		limit = defaultSuggestLimit
	}
	if strings.Contains(q, ":") {
		if _, _, _, _, _, ok := ParseRef(q); ok {
			return nil
		}
	}
	input := normalize(q)
	if input == "" {
		return nil
	}
	fields := strings.Fields(input)
	if len(fields) >= 2 {
		if _, ok := atoiPositive(fields[len(fields)-1]); ok {
			input = strings.Join(fields[:len(fields)-1], " ")
		}
	}
	if input == "" {
		return nil
	}
	byID := map[int]BookName{}
	for _, n := range names {
		byID[n.ID] = n
	}
	seen := map[int]struct{}{}
	var out []BookName
	consider := func(key string, n BookName) {
		k := normalize(key)
		if k == "" || n.ID == 0 {
			return
		}
		if k != input && !strings.HasPrefix(k, input) {
			return
		}
		if _, dup := seen[n.ID]; dup {
			return
		}
		seen[n.ID] = struct{}{}
		out = append(out, n)
	}
	for _, n := range names {
		consider(n.Name, n)
		consider(n.ShortName, n)
	}
	for _, a := range aliases {
		consider(a.Alias, byID[a.BookID])
	}
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}
