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
  sourceLine?: string;
  matchKind?: string;
}

export interface SongSetMatchingResult {
  suggestions: Record<string, SongSetSuggestion>;
  songSlotsUnfilled: string[];
}
