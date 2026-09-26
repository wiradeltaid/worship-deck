/**
 * SPEC-85-01: Song-Set "Save to Book" Dirty State Guard & Safety Threshold
 */

export function computeSongSetLyricsDirtyState({
  isLyricOpen,
  currentLyricText,
  baselineLyricText,
}: {
  isLyricOpen: boolean;
  currentLyricText: string;
  baselineLyricText: string;
}): boolean {
  if (!isLyricOpen) return false;
  const current = (currentLyricText || '').trim();
  const baseline = (baselineLyricText || '').trim();
  return current.length > 0 && current !== baseline;
}

export function validateSaveToBookLyrics(lyricText: string): { valid: boolean; error?: string } {
  if (!lyricText || lyricText.trim().length === 0) {
    return { valid: false, error: 'Cannot save empty lyrics to song book' };
  }
  return { valid: true };
}
