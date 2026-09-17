// Hand-mirrored port: internal/plan/lyrics.go <-> src/lib/lyrics.ts
// A change to one is incomplete until the other matches. (DEC-004 S7)

package plan

import (
	"regexp"
	"sort"
	"strconv"
	"strings"
)

var (
	sectionHeader  = regexp.MustCompile(`(?i)^(Verse(?:\s+(\d+))?|Chorus(?:\s+(\d+))?|Reff(?:\s+(\d+))?|Refrain(?:\s+(\d+))?)\s*$`)
	terminalPunct  = regexp.MustCompile(`[.!,?;:]["'` + "`" + `’”)\]]?$`)
	punctWithSpace = regexp.MustCompile(`[,:—\-\.!?;]['"` + "`" + `’”)\]]?\s+`)
)

var prepositions = map[string]struct{}{
	"from": {}, "in": {}, "to": {}, "with": {}, "by": {}, "on": {}, "at": {},
	"through": {}, "into": {}, "upon": {}, "unto": {},
	"and": {}, "but": {}, "or": {}, "for": {}, "nor": {}, "yet": {}, "so": {},
	"that": {}, "which": {}, "where": {}, "when": {}, "who": {}, "whose": {},
	"whom": {}, "as": {}, "till": {}, "while": {},
}

type lyricSection struct {
	kind       string
	verseIndex int
	paragraphs [][]string
}

type LyricSlide struct {
	Label string
	Text  string
}

func joinLinesContinuous(lines []string) string {
	if len(lines) == 0 {
		return ""
	}
	result := lines[0]
	for i := 1; i < len(lines); i++ {
		sep := "; "
		if terminalPunct.MatchString(result) {
			sep = " "
		}
		result = result + sep + lines[i]
	}
	return result
}

func computeCadence(lines []string) int {
	charsBeforeSemi := 0
	countBeforeSemi := 0
	foundSemi := false

	for _, l := range lines {
		countBeforeSemi++
		semiPos := strings.Index(l, ";")
		if semiPos != -1 {
			charsBeforeSemi += semiPos
			foundSemi = true
			break
		} else {
			charsBeforeSemi += len(l)
		}
	}

	if foundSemi && countBeforeSemi > 0 {
		return charsBeforeSemi / countBeforeSemi
	}
	if len(lines) == 0 {
		return 30
	}
	lens := make([]int, len(lines))
	for i, l := range lines {
		lens[i] = len(l)
	}
	sort.Ints(lens)
	return lens[len(lens)/2]
}

func computeDynamicMaxLen(stanzaLines []string) int {
	cadence := computeCadence(stanzaLines)
	rawLineCount := len(stanzaLines)

	// Base threshold around 37 chars (capacity for 46.67px bold font in 920px box)
	maxLen := 37

	if cadence <= 26 {
		// Short-meter hymn (like Rescue the Perishing): double-length lines (>36) must split
		maxLen = 36
	} else if cadence >= 44 {
		// Long-meter hymn: natural lines are longer
		maxLen = cadence + 2
		if maxLen > 48 {
			maxLen = 48
		}
	}

	// Edge case: if stanza is already dense (>= 7 lines), raise threshold so we don't over-inflate vertical lines
	if rawLineCount >= 7 {
		if maxLen < 44 {
			maxLen = 44
		}
	}

	return maxLen
}

func cleanWord(w string) string {
	var sb strings.Builder
	for _, r := range w {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

func formatSmartPoeticLine(line string, maxLen int) []string {
	line = strings.TrimSpace(line)
	if len(line) <= maxLen {
		return []string{line}
	}

	minIdx := int(float64(len(line)) * 0.25)
	maxIdx := int(float64(len(line)) * 0.75)
	mid := len(line) / 2

	// Priority 1: punctuation near center
	matches := punctWithSpace.FindAllStringIndex(line, -1)
	bestPunctIdx := -1
	bestPunctDist := 999999

	for _, loc := range matches {
		breakPos := loc[0] + len(strings.TrimRight(line[loc[0]:loc[1]], " \t\r\n"))
		if breakPos >= minIdx && breakPos <= maxIdx {
			dist := breakPos - mid
			if dist < 0 {
				dist = -dist
			}
			if dist < bestPunctDist {
				bestPunctDist = dist
				bestPunctIdx = breakPos
			}
		}
	}

	if bestPunctIdx != -1 {
		part1 := strings.TrimSpace(line[:bestPunctIdx])
		part2 := strings.TrimSpace(line[bestPunctIdx:])
		return append(formatSmartPoeticLine(part1, maxLen), formatSmartPoeticLine(part2, maxLen)...)
	}

	// Priority 2: preposition or conjunction boundary in middle zone
	words := strings.Fields(line)
	charCount := 0
	bestPrepIdx := -1
	bestPrepDist := 999999

	for w, word := range words {
		cleaned := strings.ToLower(cleanWord(word))
		wordStart := charCount
		charCount += len(word) + 1

		if w > 0 {
			if _, isPrep := prepositions[cleaned]; isPrep {
				if wordStart >= minIdx && wordStart <= maxIdx {
					dist := wordStart - mid
					if dist < 0 {
						dist = -dist
					}
					if dist < bestPrepDist {
						bestPrepDist = dist
						bestPrepIdx = wordStart
					}
				}
			}
		}
	}

	if bestPrepIdx != -1 {
		part1 := strings.TrimSpace(line[:bestPrepIdx])
		part2 := strings.TrimSpace(line[bestPrepIdx:])
		return append(formatSmartPoeticLine(part1, maxLen), formatSmartPoeticLine(part2, maxLen)...)
	}

	// Priority 3: space closest to midpoint
	bestSpaceIdx := -1
	bestSpaceDist := 999999
	for i := minIdx; i <= maxIdx; i++ {
		if line[i] == ' ' {
			dist := i - mid
			if dist < 0 {
				dist = -dist
			}
			if dist < bestSpaceDist {
				bestSpaceDist = dist
				bestSpaceIdx = i
			}
		}
	}

	if bestSpaceIdx != -1 {
		part1 := strings.TrimSpace(line[:bestSpaceIdx])
		part2 := strings.TrimSpace(line[bestSpaceIdx:])
		return append(formatSmartPoeticLine(part1, maxLen), formatSmartPoeticLine(part2, maxLen)...)
	}

	return []string{line}
}

// FormatSmartPoeticLines structures lyric lines into beautifully formatted hymn stanzas:
// - Computes stanza meter cadence up to the first semicolon (';')
// - Dynamically calculates character capacity from font size (46.67px bold) and slide box width
// - Breaks lines at semicolons (';'), punctuation (',', ':', '-'), or preposition boundaries ('from', 'in', 'to', etc.)
// - Guards against vertical over-density when a stanza already has >= 7 lines
func FormatSmartPoeticLines(rawLines []string) string {
	maxLen := computeDynamicMaxLen(rawLines)
	var result []string
	for _, raw := range rawLines {
		semiParts := strings.Split(raw, ";")
		for sIdx, sp := range semiParts {
			part := strings.TrimSpace(sp)
			if part == "" {
				continue
			}
			if sIdx < len(semiParts)-1 {
				part = part + ";"
			}
			broken := formatSmartPoeticLine(part, maxLen)
			for _, b := range broken {
				bTrim := strings.TrimSpace(b)
				if bTrim != "" {
					result = append(result, bTrim)
				}
			}
		}
	}
	return strings.Join(result, "\n")
}

func parseSections(lyrics string) []lyricSection {
	normalized := strings.ReplaceAll(strings.ReplaceAll(lyrics, "\r\n", "\n"), "\r", "\n")
	rawLines := strings.Split(normalized, "\n")
	var sections []lyricSection
	var current *lyricSection
	var currentParagraph []string
	autoVerse := 0

	pushParagraph := func() {
		if len(currentParagraph) > 0 {
			if current == nil {
				current = &lyricSection{kind: "body"}
			}
			current.paragraphs = append(current.paragraphs, currentParagraph)
			currentParagraph = nil
		}
	}

	pushSection := func() {
		pushParagraph()
		if current != nil {
			sections = append(sections, *current)
			current = nil
		}
	}

	for _, raw := range rawLines {
		line := strings.TrimSpace(raw)
		m := sectionHeader.FindStringSubmatch(line)
		if m != nil {
			pushSection()
			kindRaw := strings.ToLower(m[1])
			cur := lyricSection{}
			if strings.HasPrefix(kindRaw, "verse") {
				autoVerse++
				n := autoVerse
				if m[2] != "" {
					if parsed, err := strconv.Atoi(m[2]); err == nil {
						n = parsed
					}
				}
				cur.kind = "verse"
				cur.verseIndex = n
			} else if strings.HasPrefix(kindRaw, "chorus") {
				cur.kind = "chorus"
			} else {
				cur.kind = "reff"
			}
			current = &cur
			continue
		}

		if line == "" {
			pushParagraph()
		} else {
			currentParagraph = append(currentParagraph, line)
		}
	}

	pushSection()
	return sections
}

func fillEmptyRefrains(sections []lyricSection) []lyricSection {
	var nearestRefrainParagraphs [][]string
	out := make([]lyricSection, len(sections))

	for i, s := range sections {
		if s.kind == "chorus" || s.kind == "reff" {
			if len(s.paragraphs) > 0 {
				nearestRefrainParagraphs = make([][]string, len(s.paragraphs))
				for pi, p := range s.paragraphs {
					nearestRefrainParagraphs[pi] = append([]string{}, p...)
				}
				out[i] = s
				continue
			} else if nearestRefrainParagraphs != nil {
				copied := make([][]string, len(nearestRefrainParagraphs))
				for pi, p := range nearestRefrainParagraphs {
					copied[pi] = append([]string{}, p...)
				}
				s.paragraphs = copied
				out[i] = s
				continue
			}
		}
		out[i] = s
	}
	return out
}

// SplitLyricsLabeled splits hymn lyrics into slides following DEC-004 S7 (L1-L6):
// - L1: Recognize Verse, Chorus, Reff, Refrain (with or without numbers)
// - L2: Distinct refrains per verse preserved verbatim
// - L3: Bodyless refrain inherits nearest preceding non-empty refrain
// - L4: Slide order matches written order; no reordering / interleaving
// - L5: Blank lines inside a section are hard slide breaks (one paragraph, one slide)
// - L6: No character-budget or line-count splitting
// - Verse labels are n/total; refrains are labeled Reff or Chorus
func SplitLyricsLabeled(lyrics string) []LyricSlide {
	if strings.TrimSpace(lyrics) == "" {
		return nil
	}
	sections := fillEmptyRefrains(parseSections(lyrics))
	verseTotal := 0
	for _, s := range sections {
		if s.kind == "verse" && len(s.paragraphs) > 0 {
			verseTotal++
		}
	}
	var slides []LyricSlide
	for _, section := range sections {
		if len(section.paragraphs) == 0 {
			continue
		}
		label := ""
		switch section.kind {
		case "verse":
			n := section.verseIndex
			if n == 0 {
				n = 1
			}
			if verseTotal > 0 {
				label = itoa(n) + "/" + itoa(verseTotal)
			} else {
				label = itoa(n)
			}
		case "reff":
			label = "Reff"
		case "chorus":
			label = "Chorus"
		}
		for _, paragraph := range section.paragraphs {
			if len(paragraph) == 0 {
				continue
			}
			text := FormatSmartPoeticLines(paragraph)
			slides = append(slides, LyricSlide{Label: label, Text: text})
		}
	}
	if len(slides) == 0 {
		normalized := strings.ReplaceAll(strings.ReplaceAll(lyrics, "\r\n", "\n"), "\r", "\n")
		for _, stanza := range regexpSplitBlank(normalized) {
			var lines []string
			for _, l := range strings.Split(strings.TrimSpace(stanza), "\n") {
				l = strings.TrimSpace(l)
				if l != "" {
					lines = append(lines, l)
				}
			}
			if len(lines) > 0 {
				slides = append(slides, LyricSlide{Text: FormatSmartPoeticLines(lines)})
			}
		}
	}
	return slides
}

func regexpSplitBlank(s string) []string {
	var parts []string
	cur := strings.Builder{}
	blank := 0
	for _, line := range strings.Split(s, "\n") {
		if strings.TrimSpace(line) == "" {
			blank++
			if blank >= 1 && cur.Len() > 0 {
				parts = append(parts, cur.String())
				cur.Reset()
			}
			continue
		}
		blank = 0
		if cur.Len() > 0 {
			cur.WriteByte('\n')
		}
		cur.WriteString(line)
	}
	if cur.Len() > 0 {
		parts = append(parts, cur.String())
	}
	return parts
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [12]byte
	i := len(b)
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}
