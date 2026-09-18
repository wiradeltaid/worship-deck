package parse

import (
	"reflect"
	"testing"
)

func TestMatchSongSets_ThreePass(t *testing.T) {
	slots := []SongSetEntrySlot{
		{VariableName: "ds_opening_song", Title: "Opening Song", Position: 1},
		{VariableName: "praise_song_1", Title: "Praise 1", Position: 2},
		{VariableName: "praise_song_2", Title: "Praise 2", Position: 3},
		{VariableName: "praise_song_3", Title: "Praise 3", Position: 4},
		{VariableName: "ds_closing_song", Title: "Closing Song", Position: 5},
	}

	config := SongSetMatchingConfig{
		LabelSlots: []LabelSlotMapping{
			{Label: "Opening Song", Target: "ds_opening_song"},
			{Label: "Closing Song", Target: "ds_closing_song"},
		},
		SlotFamilyPrefix: "praise_song",
	}

	candidates := []SongCandidate{
		{Line: "Opening Song: SDAH 100", BookCode: "SDAH", Number: 100, Title: "Great Is Thy Faithfulness"},
		{Line: "Praise 1: SDAH 159", BookCode: "SDAH", Number: 159, Title: "Praise to the Lord"},
		{Line: "Praise 2: Hymn 250", BookCode: "SDAH", Number: 250, Title: "Faith of Our Fathers"},
		{Line: "Closing Song: SDAH 1", BookCode: "SDAH", Number: 1, Title: "Praise God, From Whom All Blessings Flow"},
	}

	result := MatchSongSets(candidates, slots, config)

	// Pass 1: Label matching
	openSug, ok := result.Suggestions["ds_opening_song"]
	if !ok || openSug.SongNumber != 100 || openSug.MatchKind != "label" {
		t.Errorf("expected ds_opening_song label match 100, got %+v", openSug)
	}
	closeSug, ok := result.Suggestions["ds_closing_song"]
	if !ok || closeSug.SongNumber != 1 || closeSug.MatchKind != "label" {
		t.Errorf("expected ds_closing_song label match 1, got %+v", closeSug)
	}

	// Pass 2: Positional matching
	p1, ok := result.Suggestions["praise_song_1"]
	if !ok || p1.SongNumber != 159 || p1.MatchKind != "positional" {
		t.Errorf("expected praise_song_1 positional match 159, got %+v", p1)
	}
	p2, ok := result.Suggestions["praise_song_2"]
	if !ok || p2.SongNumber != 250 || p2.MatchKind != "positional" {
		t.Errorf("expected praise_song_2 positional match 250, got %+v", p2)
	}

	// Pass 3: Diagnostics & omission
	if len(result.SongOverflow) != 0 {
		t.Errorf("expected 0 overflow, got %d", len(result.SongOverflow))
	}
	expectedUnfilled := []string{"praise_song_3"}
	if !reflect.DeepEqual(result.SongSlotsUnfilled, expectedUnfilled) {
		t.Errorf("expected unfilled %v, got %v", expectedUnfilled, result.SongSlotsUnfilled)
	}
}

func TestMatchSongSets_Overflow(t *testing.T) {
	// Only 1 praise slot configured, but 3 candidates provided
	slots := []SongSetEntrySlot{
		{VariableName: "praise_song_1", Title: "Praise 1", Position: 1},
	}
	config := SongSetMatchingConfig{
		SlotFamilyPrefix: "praise_song",
	}
	candidates := []SongCandidate{
		{Line: "Praise 1: SDAH 10", BookCode: "SDAH", Number: 10},
		{Line: "Praise 2: SDAH 20", BookCode: "SDAH", Number: 20},
		{Line: "Praise 3: SDAH 30", BookCode: "SDAH", Number: 30},
	}

	result := MatchSongSets(candidates, slots, config)

	if len(result.Suggestions) != 1 {
		t.Errorf("expected 1 suggestion, got %d", len(result.Suggestions))
	}
	if len(result.SongOverflow) != 2 {
		t.Fatalf("expected 2 overflow candidates, got %d", len(result.SongOverflow))
	}
	if result.SongOverflow[0].Number != 20 || result.SongOverflow[1].Number != 30 {
		t.Errorf("unexpected overflow candidates: %+v", result.SongOverflow)
	}
}
