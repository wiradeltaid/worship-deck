import type { ParsedSongCandidate, ParserProfileRules } from './parser-rules';

export interface SongSetEntrySlot {
  variableName: string;
  title: string;
  position: number;
  extraction_regex?: string | null;
  extractionRegex?: string | null;
}

export interface SongSetSuggestion {
  variableName: string;
  songNumber: number;
  songBookCode: string;
  title: string;
  lyrics: string;
  sourceLine: string;
  matchKind: 'label' | 'positional';
}

export interface SongSetMatchingResult {
  suggestions: Record<string, SongSetSuggestion>;
  songOverflow: ParsedSongCandidate[];
  songSlotsUnfilled: string[];
}

/**
 * 3-pass dynamic song set matching algorithm:
 * Pass 1: Explicit label matching (matches labeled song lines against configured slots)
 * Pass 2: Positional mapping (maps sequential praise songs to slot family entries)
 * Pass 3: Diagnostics & omission (collects songOverflow and unfilled slots)
 */
export function matchSongSets(
  candidates: ParsedSongCandidate[],
  slots: SongSetEntrySlot[],
  config?: ParserProfileRules['song_set_matching']
): SongSetMatchingResult {
  const result: SongSetMatchingResult = {
    suggestions: {},
    songOverflow: [],
    songSlotsUnfilled: [],
  };

  const sortedSlots = [...slots].sort((a, b) => a.position - b.position);
  const slotMap = new Map<string, SongSetEntrySlot>();
  for (const s of sortedSlots) {
    slotMap.set(s.variableName, s);
  }

  const claimedCandidateIndices = new Set<number>();
  const claimedSlotVariables = new Set<string>();

  // --- Pass 1: Explicit Label Matching ---
  const labelSlots = config?.label_slots ?? [
    { label: 'Opening Song', target: 'ds_opening_song' },
    { label: 'Lagu Buka', target: 'ds_opening_song' },
    { label: 'Closing Song', target: 'ds_closing_song' },
    { label: 'Lagu Tutup', target: 'ds_closing_song' },
  ];

  candidates.forEach((candidate, cIdx) => {
    const lineLower = (candidate.line || '').toLowerCase();
    for (const mapping of labelSlots) {
      const lblLower = mapping.label.trim().toLowerCase();
      if (!lblLower) continue;
      if (lineLower.includes(lblLower)) {
        const target = mapping.target;
        if (slotMap.has(target) && !claimedSlotVariables.has(target)) {
          result.suggestions[target] = {
            variableName: target,
            songNumber: candidate.number,
            songBookCode: candidate.bookCode,
            title: candidate.title,
            lyrics: candidate.lyrics,
            sourceLine: candidate.line,
            matchKind: 'label',
          };
          claimedCandidateIndices.add(cIdx);
          claimedSlotVariables.add(target);
          break;
        }
      }
    }
  });

  // --- Pass 2: Positional Mapping for Slot Family ---
  const prefix = (config?.slot_family_prefix || 'praise_song').trim();
  const availableFamilySlots: SongSetEntrySlot[] = [];

  for (const slot of sortedSlots) {
    if (!claimedSlotVariables.has(slot.variableName)) {
      if (
        slot.variableName.startsWith(prefix) ||
        slot.variableName.toLowerCase().includes('praise')
      ) {
        availableFamilySlots.push(slot);
      }
    }
  }

  let familyIdx = 0;
  candidates.forEach((candidate, cIdx) => {
    if (claimedCandidateIndices.has(cIdx)) return;
    if (familyIdx < availableFamilySlots.length) {
      const slot = availableFamilySlots[familyIdx];
      familyIdx++;
      result.suggestions[slot.variableName] = {
        variableName: slot.variableName,
        songNumber: candidate.number,
        songBookCode: candidate.bookCode,
        title: candidate.title,
        lyrics: candidate.lyrics,
        sourceLine: candidate.line,
        matchKind: 'positional',
      };
      claimedCandidateIndices.add(cIdx);
      claimedSlotVariables.add(slot.variableName);
    }
  });

  // --- Pass 3: Diagnostics & Omission ---
  candidates.forEach((candidate, cIdx) => {
    if (!claimedCandidateIndices.has(cIdx)) {
      result.songOverflow.push(candidate);
    }
  });

  for (const slot of sortedSlots) {
    if (!claimedSlotVariables.has(slot.variableName)) {
      result.songSlotsUnfilled.push(slot.variableName);
    }
  }

  return result;
}
