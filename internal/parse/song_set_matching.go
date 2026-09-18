package parse

import (
	"sort"
	"strings"
)

type SongSetEntrySlot struct {
	VariableName string `json:"variableName"`
	Title        string `json:"title"`
	Position     int    `json:"position"`
}

type SongSetSuggestion struct {
	VariableName string `json:"variableName"`
	SongNumber   int    `json:"songNumber"`
	SongBookCode string `json:"songBookCode"`
	Title        string `json:"title"`
	Lyrics       string `json:"lyrics"`
	SourceLine   string `json:"sourceLine"`
	MatchKind    string `json:"matchKind"` // "label" or "positional"
}

type SongSetMatchingResult struct {
	Suggestions      map[string]SongSetSuggestion `json:"suggestions"`
	SongOverflow     []SongCandidate              `json:"songOverflow"`
	SongSlotsUnfilled []string                    `json:"songSlotsUnfilled"`
}

// MatchSongSets executes the 3-pass dynamic matching algorithm:
// Pass 1: Label matching (matches explicit labels against configured slots)
// Pass 2: Positional mapping (maps sequential praise candidates to slot family entries)
// Pass 3: Diagnostics & omission (collects songOverflow and songSlotsUnfilled)
func MatchSongSets(
	candidates []SongCandidate,
	slots []SongSetEntrySlot,
	config SongSetMatchingConfig,
) SongSetMatchingResult {
	result := SongSetMatchingResult{
		Suggestions:       make(map[string]SongSetSuggestion),
		SongOverflow:      []SongCandidate{},
		SongSlotsUnfilled: []string{},
	}

	// Sort slots by position ASC
	sortedSlots := make([]SongSetEntrySlot, len(slots))
	copy(sortedSlots, slots)
	sort.Slice(sortedSlots, func(i, j int) bool {
		return sortedSlots[i].Position < sortedSlots[j].Position
	})

	slotMap := make(map[string]SongSetEntrySlot)
	for _, s := range sortedSlots {
		slotMap[s.VariableName] = s
	}

	claimedCandidateIndices := make(map[int]bool)
	claimedSlotVariables := make(map[string]bool)

	// --- Pass 1: Explicit Label Matching ---
	for cIdx, candidate := range candidates {
		lineLower := strings.ToLower(candidate.Line)
		for _, mapping := range config.LabelSlots {
			lblLower := strings.ToLower(strings.TrimSpace(mapping.Label))
			if lblLower == "" {
				continue
			}
			if strings.Contains(lineLower, lblLower) {
				target := mapping.Target
				// Check if target slot exists and is not yet claimed
				if _, exists := slotMap[target]; exists && !claimedSlotVariables[target] {
					result.Suggestions[target] = SongSetSuggestion{
						VariableName: target,
						SongNumber:   candidate.Number,
						SongBookCode: candidate.BookCode,
						Title:        candidate.Title,
						Lyrics:       candidate.Lyrics,
						SourceLine:   candidate.Line,
						MatchKind:    "label",
					}
					claimedCandidateIndices[cIdx] = true
					claimedSlotVariables[target] = true
					break
				}
			}
		}
	}

	// --- Pass 2: Positional Mapping for Slot Family ---
	prefix := strings.TrimSpace(config.SlotFamilyPrefix)
	if prefix == "" {
		prefix = "praise_song"
	}

	// Gather available slot family slots sorted by position
	var availableFamilySlots []SongSetEntrySlot
	for _, slot := range sortedSlots {
		if !claimedSlotVariables[slot.VariableName] {
			if strings.HasPrefix(slot.VariableName, prefix) || strings.Contains(strings.ToLower(slot.VariableName), "praise") {
				availableFamilySlots = append(availableFamilySlots, slot)
			}
		}
	}

	// Also gather any other available slots if needed
	var otherAvailableSlots []SongSetEntrySlot
	for _, slot := range sortedSlots {
		if !claimedSlotVariables[slot.VariableName] {
			isFamily := strings.HasPrefix(slot.VariableName, prefix) || strings.Contains(strings.ToLower(slot.VariableName), "praise")
			if !isFamily {
				otherAvailableSlots = append(otherAvailableSlots, slot)
			}
		}
	}

	familyIdx := 0
	for cIdx, candidate := range candidates {
		if claimedCandidateIndices[cIdx] {
			continue
		}
		if familyIdx < len(availableFamilySlots) {
			slot := availableFamilySlots[familyIdx]
			familyIdx++
			result.Suggestions[slot.VariableName] = SongSetSuggestion{
				VariableName: slot.VariableName,
				SongNumber:   candidate.Number,
				SongBookCode: candidate.BookCode,
				Title:        candidate.Title,
				Lyrics:       candidate.Lyrics,
				SourceLine:   candidate.Line,
				MatchKind:    "positional",
			}
			claimedCandidateIndices[cIdx] = true
			claimedSlotVariables[slot.VariableName] = true
		}
	}

	// --- Pass 3: Diagnostics & Omission ---
	for cIdx, candidate := range candidates {
		if !claimedCandidateIndices[cIdx] {
			result.SongOverflow = append(result.SongOverflow, candidate)
		}
	}

	for _, slot := range sortedSlots {
		if !claimedSlotVariables[slot.VariableName] {
			result.SongSlotsUnfilled = append(result.SongSlotsUnfilled, slot.VariableName)
		}
	}

	return result
}
