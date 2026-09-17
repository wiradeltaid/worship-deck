package plan

import (
	"reflect"
	"strings"
	"testing"
)

func TestSplitLyricsLabeled_DEC004_S7(t *testing.T) {
	// L1: Reff 1 / Chorus 2 are recognized as refrain headers
	t.Run("L1 numbered refrains recognized", func(t *testing.T) {
		input := "Verse 1\nLine 1\nReff 1\nRefrain 1 text\nVerse 2\nLine 2\nChorus 2\nRefrain 2 text"
		got := SplitLyricsLabeled(input)
		expected := []LyricSlide{
			{Label: "1/2", Text: "Line 1"},
			{Label: "Reff", Text: "Refrain 1 text"},
			{Label: "2/2", Text: "Line 2"},
			{Label: "Chorus", Text: "Refrain 2 text"},
		}
		if !reflect.DeepEqual(got, expected) {
			t.Fatalf("expected %+v, got %+v", expected, got)
		}
	})

	// L2: Two verses each with distinct refrain body survive verbatim
	t.Run("L2 distinct refrains preserved", func(t *testing.T) {
		input := "Verse 1\nV1 text\nChorus\nChorus 1 distinct\nVerse 2\nV2 text\nChorus\nChorus 2 distinct"
		got := SplitLyricsLabeled(input)
		expected := []LyricSlide{
			{Label: "1/2", Text: "V1 text"},
			{Label: "Chorus", Text: "Chorus 1 distinct"},
			{Label: "2/2", Text: "V2 text"},
			{Label: "Chorus", Text: "Chorus 2 distinct"},
		}
		if !reflect.DeepEqual(got, expected) {
			t.Fatalf("expected %+v, got %+v", expected, got)
		}
	})

	// L3: Bodyless refrain inherits nearest preceding non-empty refrain
	t.Run("L3 bodyless refrain inherits nearest preceding", func(t *testing.T) {
		input := "Verse 1\nV1 text\nChorus\nChorus Alpha\nVerse 2\nV2 text\nChorus\nVerse 3\nV3 text\nChorus\nChorus Beta\nVerse 4\nV4 text\nChorus"
		got := SplitLyricsLabeled(input)
		expected := []LyricSlide{
			{Label: "1/4", Text: "V1 text"},
			{Label: "Chorus", Text: "Chorus Alpha"},
			{Label: "2/4", Text: "V2 text"},
			{Label: "Chorus", Text: "Chorus Alpha"},
			{Label: "3/4", Text: "V3 text"},
			{Label: "Chorus", Text: "Chorus Beta"},
			{Label: "4/4", Text: "V4 text"},
			{Label: "Chorus", Text: "Chorus Beta"},
		}
		if !reflect.DeepEqual(got, expected) {
			t.Fatalf("expected %+v, got %+v", expected, got)
		}
	})

	// L4: Slide order equals written order; no verse->refrain interleaving invented
	t.Run("L4 emitted order equals written order", func(t *testing.T) {
		input := "Verse 1\nV1 text\nVerse 2\nV2 text\nChorus\nChorus text"
		got := SplitLyricsLabeled(input)
		expected := []LyricSlide{
			{Label: "1/2", Text: "V1 text"},
			{Label: "2/2", Text: "V2 text"},
			{Label: "Chorus", Text: "Chorus text"},
		}
		if !reflect.DeepEqual(got, expected) {
			t.Fatalf("expected %+v, got %+v", expected, got)
		}
	})

	// L5: Blank line inside one verse produces two slides
	t.Run("L5 blank line inside section produces multiple slides", func(t *testing.T) {
		input := "Verse 1\nLine 1\nLine 2\n\nLine 3\nLine 4"
		got := SplitLyricsLabeled(input)
		expected := []LyricSlide{
			{Label: "1/1", Text: "Line 1\nLine 2"},
			{Label: "1/1", Text: "Line 3\nLine 4"},
		}
		if !reflect.DeepEqual(got, expected) {
			t.Fatalf("expected %+v, got %+v", expected, got)
		}
	})

	// L6: Section far longer than 320 chars with no blank line produces one slide
	t.Run("L6 no char budget splitting", func(t *testing.T) {
		var lines []string
		for i := 0; i < 15; i++ {
			lines = append(lines, "This is a long verse line to exceed budget")
		}
		input := "Verse 1\n" + strings.Join(lines, "\n")
		got := SplitLyricsLabeled(input)
		if len(got) != 1 {
			t.Fatalf("expected 1 slide, got %d", len(got))
		}
		if len(got[0].Text) <= 320 {
			t.Fatalf("expected text > 320 chars, got %d", len(got[0].Text))
		}
	})
}


func TestSmartPoeticLineBreaks(t *testing.T) {
	// 1. Semicolon line breaks
	t.Run("semicolons break into separate lines", func(t *testing.T) {
		input := "Verse 1\nGod Himself is with us; Let us all adore Him,\nAnd with awe appear before Him."
		got := SplitLyricsLabeled(input)
		expected := "God Himself is with us;\nLet us all adore Him,\nAnd with awe appear before Him."
		if len(got) != 1 || got[0].Text != expected {
			t.Fatalf("expected:\n%q\ngot:\n%q", expected, got[0].Text)
		}
	})

	// 2. Lines exceeding 46 chars break at center punctuation
	t.Run("long line breaks at center comma", func(t *testing.T) {
		input := "Verse 1\nPraise to the Lord, the Almighty, the King of creation!"
		got := SplitLyricsLabeled(input)
		expected := "Praise to the Lord, the Almighty,\nthe King of creation!"
		if len(got) != 1 || got[0].Text != expected {
			t.Fatalf("expected:\n%q\ngot:\n%q", expected, got[0].Text)
		}
	})

	// 3. Short lines remain intact
	t.Run("short line stays intact", func(t *testing.T) {
		input := "Verse 1\nAlleluia! Alleluia!"
		got := SplitLyricsLabeled(input)
		expected := "Alleluia! Alleluia!"
		if len(got) != 1 || got[0].Text != expected {
			t.Fatalf("expected:\n%q\ngot:\n%q", expected, got[0].Text)
		}
	})
}
