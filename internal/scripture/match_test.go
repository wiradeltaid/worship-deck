package scripture

import (
	"strings"
	"testing"
	"unicode"
)

func names() []BookName {
	return []BookName{
		{ID: 43, Name: "John", ShortName: "John"},
		{ID: 62, Name: "1 John", ShortName: "1 Jn"},
		{ID: 19, Name: "Psalms", ShortName: "Ps"},
		{ID: 22, Name: "Song of Solomon", ShortName: "Song"},
		{ID: 44, Name: "Kisah Para Rasul", ShortName: "Kis."},
		{ID: 7, Name: "Hakim-hakim", ShortName: "Hak."},
		{ID: 11, Name: "1 Raja-raja", ShortName: "1 Raj."},
	}
}

func TestParseRefLongNames(t *testing.T) {
	cases := []struct {
		in             string
		book           string
		ch, start, end int
		isWhole        bool
	}{
		{"John 4:23", "John", 4, 23, 23, false},
		{"Song of Solomon 1:1", "Song of Solomon", 1, 1, 1, false},
		{"Kisah Para Rasul 1:8", "Kisah Para Rasul", 1, 8, 8, false},
		{"Hakim-hakim 2:16", "Hakim-hakim", 2, 16, 16, false},
		{"1 Raja-raja 3:5", "1 Raja-raja", 3, 5, 5, false},
		{"e.g. Acts 18:9,10", "Acts", 18, 9, 10, false},
		{"John+4:23", "John", 4, 23, 23, false},
		{"John 4", "John", 4, 0, 0, true},
		{"Song of Solomon 2", "Song of Solomon", 2, 0, 0, true},
		{"1 Korintus 13", "1 Korintus", 13, 0, 0, true},
		{"Mazmur 23", "Mazmur", 23, 0, 0, true},
	}
	for _, c := range cases {
		book, ch, start, end, isWhole, ok := ParseRef(c.in)
		if !ok {
			t.Fatalf("ParseRef(%q) failed", c.in)
		}
		if book != c.book || ch != c.ch || start != c.start || end != c.end || isWhole != c.isWhole {
			t.Fatalf("ParseRef(%q)=%q %d:%d-%d (whole=%v) want %q %d:%d-%d (whole=%v)",
				c.in, book, ch, start, end, isWhole, c.book, c.ch, c.start, c.end, c.isWhole)
		}
	}
}

func TestMatchBookLongestPrefix(t *testing.T) {
	id, name, ok := MatchBook("Song of Solomon", names(), AliasesFor("KJV"))
	if !ok || id != 22 || name != "Song of Solomon" {
		t.Fatalf("got id=%d name=%q ok=%v", id, name, ok)
	}
	id, name, ok = MatchBook("Song", names(), nil)
	if !ok || id != 22 || name != "Song of Solomon" {
		t.Fatalf("short name: id=%d name=%q", id, name)
	}
	id, name, ok = MatchBook("ps", names(), AliasesFor("KJV"))
	if !ok || id != 19 || name != "Psalms" {
		t.Fatalf("alias: id=%d name=%q", id, name)
	}
	id, name, ok = MatchBook("Hakim-hakim", names(), nil)
	if !ok || id != 7 {
		t.Fatalf("hyphen: id=%d ok=%v", id, ok)
	}
	id, name, ok = MatchBook("John", names(), nil)
	if !ok || id != 43 || name != "John" {
		t.Fatalf("John vs 1 John: id=%d name=%q", id, name)
	}
	_, _, ok = MatchBook("Unknown", names(), nil)
	if ok {
		t.Fatal("unknown must fail closed")
	}
}

func TestSuggestBooksPrefixAndAlias(t *testing.T) {
	hits := SuggestBooks("jo", names(), nil, 20)
	got := map[string]bool{}
	for _, h := range hits {
		got[h.Name] = true
	}
	if !got["John"] {
		t.Fatalf("Jo should suggest John, got %#v", hits)
	}
	if got["1 John"] {
		t.Fatal("Jo must not suggest 1 John — that name does not start with jo")
	}

	ps := SuggestBooks("ps", names(), AliasesFor("KJV"), 20)
	if len(ps) != 1 || ps[0].Name != "Psalms" {
		t.Fatalf("ps alias: %#v", ps)
	}

	if SuggestBooks("John 4:23", names(), nil, 20) != nil {
		t.Fatal("a complete ref must not open the suggestion list")
	}

	chapter := SuggestBooks("John 3", names(), nil, 20)
	if len(chapter) != 1 || chapter[0].Name != "John" {
		t.Fatalf("trailing chapter is stripped: %#v", chapter)
	}

	if SuggestBooks("xx", names(), nil, 20) != nil {
		t.Fatal("unknown prefix is empty, not a guess")
	}
}

func TestParseRefTranslationSuffix(t *testing.T) {
	cases := []struct {
		in             string
		book           string
		ch, start, end int
		isWhole        bool
		ok             bool
	}{
		{"Hebrews 1:1, 2 (NKJV)", "Hebrews", 1, 1, 2, false, true},
		{"Hebrews 1:1, 2 (NKJV).", "Hebrews", 1, 1, 2, false, true},
		{"Hebrews 1:1, 2, NKJV", "Hebrews", 1, 1, 2, false, true},
		{"Hebrews 1:1, 2, NKJV.", "Hebrews", 1, 1, 2, false, true},
		{"Hebrews 1:1,2,NKJV", "Hebrews", 1, 1, 2, false, true},
		{"1 Korintus 13, TB", "1 Korintus", 13, 0, 0, true, true},
		{"1 Korintus 13, TB.", "1 Korintus", 13, 0, 0, true, true},
		{"John 3:16, KJV", "John", 3, 16, 16, false, true},
		{"John 3:16, KJV;", "John", 3, 16, 16, false, true},
		{"1 Korintus 13 (TB)", "1 Korintus", 13, 0, 0, true, true},
		{"John 3:16 KJV", "John", 3, 16, 16, false, true},
		{"Yohanes 3:16 (TB)", "Yohanes", 3, 16, 16, false, true},
		{"Romans 8:28 (ESV)", "Romans", 8, 28, 28, false, true},
		{"John 3:16, sermon notes", "", 0, 0, 0, false, false},
		{"John 3:16 (sermon notes)", "", 0, 0, 0, false, false},
		{"John 3:16 (commentary)", "", 0, 0, 0, false, false},
	}

	for _, c := range cases {
		book, ch, start, end, isWhole, ok := ParseRef(c.in)
		if ok != c.ok {
			t.Fatalf("ParseRef(%q) ok=%v, want %v", c.in, ok, c.ok)
		}
		if c.ok {
			if book != c.book || ch != c.ch || start != c.start || end != c.end || isWhole != c.isWhole {
				t.Fatalf("ParseRef(%q)=%q %d:%d-%d (whole=%v) want %q %d:%d-%d (whole=%v)",
					c.in, book, ch, start, end, isWhole, c.book, c.ch, c.start, c.end, c.isWhole)
			}
		}
	}
}

func TestDefectInjectionTranslationSuffixWithoutComma(t *testing.T) {
	// 1. Defect proof: a whitespace-only stripper fails to strip no-space comma translation suffix
	whitespaceOnlyStrip := func(val string) string {
		val = strings.TrimSpace(val)
		upper := strings.ToUpper(val)
		for _, code := range supportedTranslations {
			if strings.HasSuffix(upper, code) {
				prefix := val[:len(val)-len(code)]
				if len(prefix) > 0 && unicode.IsSpace(rune(prefix[len(prefix)-1])) {
					return strings.TrimSpace(prefix)
				}
			}
		}
		return val
	}

	unstripped := whitespaceOnlyStrip("Hebrews 1:1,2,NKJV")
	if unstripped != "Hebrews 1:1,2,NKJV" {
		t.Fatalf("expected whitespace-only stripper to leave 'Hebrews 1:1,2,NKJV' untouched, got %q", unstripped)
	}

	// 2. Production ParseRef with comma-prefix support succeeds on "Hebrews 1:1,2,NKJV"
	book, ch, start, end, isWhole, ok := ParseRef("Hebrews 1:1,2,NKJV")
	if !ok || book != "Hebrews" || ch != 1 || start != 1 || end != 2 || isWhole {
		t.Fatalf("ParseRef('Hebrews 1:1,2,NKJV') failed: %q %d:%d-%d ok=%v", book, ch, start, end, ok)
	}

	// 3. Defect proof: without trailing punctuation cleanup, "Hebrews 1:1, 2, NKJV" leaves trailing comma
	noPunctCleanupStrip := func(val string) string {
		val = strings.TrimSpace(val)
		upper := strings.ToUpper(val)
		for _, code := range supportedTranslations {
			if strings.HasSuffix(upper, code) {
				prefix := val[:len(val)-len(code)]
				return strings.TrimSpace(prefix)
			}
		}
		return val
	}
	trailingComma := noPunctCleanupStrip("Hebrews 1:1, 2, NKJV")
	if trailingComma != "Hebrews 1:1, 2," {
		t.Fatalf("expected no-cleanup stripper to leave 'Hebrews 1:1, 2,', got %q", trailingComma)
	}
	colon := strings.LastIndex(trailingComma, ":")
	after := strings.TrimSpace(trailingComma[colon+1:])
	_, _, okSpan := parseVerseSpan(after)
	if okSpan {
		t.Fatalf("parseVerseSpan must reject un-sanitized trailing comma %q", after)
	}

	// But clean ParseRef with production stripTranslationSuffix succeeds
	bookClean, chClean, startClean, endClean, isWholeClean, okClean := ParseRef("Hebrews 1:1, 2, NKJV")
	if !okClean || bookClean != "Hebrews" || chClean != 1 || startClean != 1 || endClean != 2 || isWholeClean {
		t.Fatalf("ParseRef('Hebrews 1:1, 2, NKJV') failed: %q %d:%d-%d ok=%v", bookClean, chClean, startClean, endClean, okClean)
	}
}
