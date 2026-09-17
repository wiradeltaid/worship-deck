// Hand-mirrored port: src/lib/lyrics.ts <-> internal/plan/lyrics.go
// A change to one is incomplete until the other matches. (DEC-004 S7)

import { getDb } from './db';

export type LyricSlide = {
  /** e.g. "1/3", "Reff", "Chorus" */
  label: string;
  text: string;
};

export type HymnRecord = {
  bookCode: string;
  number: number;
  title: string;
  lyrics: string;
};

/**
 * Resolve the song book code following the DEC-004 S3 three-step fallback order:
 *  1. explicit book code if non-empty
 *  2. global default book in song_books (is_default = 1)
 *  3. shipped DefaultSongBook constant ("SDAH")
 */
function resolveSongBookCode(explicitBook?: string): string {
  const explicit = explicitBook?.trim().toUpperCase();
  if (explicit) return explicit;
  try {
    const db = getDb();
    const row = db
      .prepare('SELECT book_code FROM song_books WHERE is_default = 1 LIMIT 1')
      .get() as { book_code?: string } | undefined;
    if (row?.book_code?.trim()) return row.book_code.trim().toUpperCase();
  } catch {
    // fallback if table does not exist or query fails
  }
  return 'SDAH';
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lookup hymn on (bookCode, number) pair with fallback to default book. */
export function lookupHymnByNumber(
  number: number,
  bookCode?: string
): HymnRecord | null {
  if (!Number.isInteger(number) || number <= 0) return null;
  const book = resolveSongBookCode(bookCode);
  const db = getDb();
  const row = db
    .prepare(
      'SELECT book_code, number, title, lyrics FROM hymns WHERE book_code = ? AND number = ?'
    )
    .get(book, number) as
    | { book_code: string; number: number; title: string; lyrics: string }
    | undefined;
  if (!row?.lyrics?.trim()) return null;
  return {
    bookCode: row.book_code,
    number: row.number,
    title: row.title,
    lyrics: row.lyrics,
  };
}

/**
 * Fuzzy title match against hymnal DB for a specific or default song book.
 * Prefers exact normalized match, then prefix/includes of the query.
 */
export function lookupHymnByTitleFuzzy(
  query: string,
  bookCode?: string
): HymnRecord | null {
  const needle = normalizeTitle(query);
  if (!needle) return null;
  const book = resolveSongBookCode(bookCode);

  const db = getDb();
  const rows = db
    .prepare(
      'SELECT book_code, number, title, lyrics FROM hymns WHERE book_code = ?'
    )
    .all(book) as {
    book_code: string;
    number: number;
    title: string;
    lyrics: string;
  }[];

  let best: { score: number; hymn: HymnRecord } | null = null;

  for (const row of rows) {
    if (!row.lyrics?.trim()) continue;
    const hay = normalizeTitle(row.title);
    if (!hay) continue;

    let score = 0;
    if (hay === needle) score = 100;
    else if (hay.startsWith(needle) || needle.startsWith(hay)) score = 80;
    else if (hay.includes(needle) || needle.includes(hay)) score = 60;
    else {
      // token overlap (e.g. "We Have This Hope" vs full title)
      const nTokens = needle.split(' ').filter(Boolean);
      const hTokens = new Set(hay.split(' ').filter(Boolean));
      const hits = nTokens.filter((t) => hTokens.has(t)).length;
      if (hits >= 3 && hits / nTokens.length >= 0.75) {
        score = 40 + hits;
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = {
        score,
        hymn: {
          bookCode: row.book_code,
          number: row.number,
          title: row.title,
          lyrics: row.lyrics,
        },
      };
    }
  }

  return best?.hymn ?? null;
}

/**
 * Fixed Template Skeleton Intercessory standing pair (not payload Song
 * Blocks). Their fixed lyric text now lives in the registry seed as two
 * General rows (`intercessory-671-lyric-1`, `intercessory-684-lyric-1` —
 * AD-20, Story 20.1), but this set still filters #671/#684 out of the weekly
 * hymn buckets (`slide-plan.ts`) so a rundown that lists either number cannot
 * claim a weekly song position.
 */
export const INTERCESSORY_STANDING_NUMBERS = [671, 684] as const;

type LyricSection = {
  kind: 'verse' | 'chorus' | 'reff' | 'body';
  verseIndex?: number;
  paragraphs: string[][];
};

const SECTION_HEADER =
  /^(Verse(?:\s+(\d+))?|Chorus(?:\s+(\d+))?|Reff(?:\s+(\d+))?|Refrain(?:\s+(\d+))?)\s*$/i;

/** Terminal punct, optionally followed by a closing quote/bracket. */
const TERMINAL_PUNCTUATION = /[.!,?;:]["'`’”)\]]?$/;
const PUNCT_WITH_SPACE = /[,:—\-\.!?;]['"`’”)\]]?\s+/g;

const PREPOSITIONS = new Set([
  'from', 'in', 'to', 'with', 'by', 'on', 'at', 'through', 'into', 'upon', 'unto',
  'and', 'but', 'or', 'for', 'nor', 'yet', 'so',
  'that', 'which', 'where', 'when', 'who', 'whose', 'whom', 'as', 'till', 'while'
]);

/**
 * Join section lines into continuous prose.
 * Terminal punctuation (`. , ! ? ; :`) → space; otherwise → `"; "`.
 */
export function joinLinesContinuous(lines: string[]): string {
  if (lines.length === 0) return '';
  let result = lines[0];
  for (let i = 1; i < lines.length; i++) {
    const sep = TERMINAL_PUNCTUATION.test(result) ? ' ' : '; ';
    result = `${result}${sep}${lines[i]}`;
  }
  return result;
}

export function computeCadence(lines: string[]): number {
  let charsBeforeSemi = 0;
  let countBeforeSemi = 0;
  let foundSemi = false;

  for (const l of lines) {
    countBeforeSemi++;
    const semiPos = l.indexOf(';');
    if (semiPos !== -1) {
      charsBeforeSemi += semiPos;
      foundSemi = true;
      break;
    } else {
      charsBeforeSemi += l.length;
    }
  }

  if (foundSemi && countBeforeSemi > 0) {
    return Math.round(charsBeforeSemi / countBeforeSemi);
  }
  if (lines.length === 0) return 30;
  const lens = lines.map((l) => l.length).sort((a, b) => a - b);
  return lens[Math.floor(lens.length / 2)] || 30;
}

export function computeDynamicMaxLen(stanzaLines: string[]): number {
  const cadence = computeCadence(stanzaLines);
  const rawLineCount = stanzaLines.length;

  // Base threshold around 37 chars (capacity for 46.67px bold font in 920px box)
  let maxLen = 37;

  if (cadence <= 26) {
    // Short-meter hymn (like Rescue the Perishing): double-length lines (>36) must split
    maxLen = 36;
  } else if (cadence >= 44) {
    // Long-meter hymn: natural lines are longer
    maxLen = Math.min(48, cadence + 2);
  }

  // Edge case 5: if stanza is already dense (>= 7 lines), raise threshold so we don't over-inflate vertical lines
  if (rawLineCount >= 7) {
    maxLen = Math.max(maxLen, 44);
  }

  return maxLen;
}

export function formatSmartPoeticLine(line: string, maxLen: number = 37): string[] {
  line = line.trim();
  if (line.length <= maxLen) return [line];

  const minIdx = Math.floor(line.length * 0.25);
  const maxIdx = Math.ceil(line.length * 0.75);
  const mid = Math.floor(line.length / 2);

  // Priority 1: punctuation near center
  let bestPunctIdx = -1;
  let bestPunctDist = Infinity;
  let match: RegExpExecArray | null;

  PUNCT_WITH_SPACE.lastIndex = 0;
  while ((match = PUNCT_WITH_SPACE.exec(line)) !== null) {
    const breakPos = match.index + match[0].trimEnd().length;
    if (breakPos >= minIdx && breakPos <= maxIdx) {
      const dist = Math.abs(breakPos - mid);
      if (dist < bestPunctDist) {
        bestPunctDist = dist;
        bestPunctIdx = breakPos;
      }
    }
  }

  if (bestPunctIdx !== -1) {
    const part1 = line.slice(0, bestPunctIdx).trim();
    const part2 = line.slice(bestPunctIdx).trim();
    return [...formatSmartPoeticLine(part1, maxLen), ...formatSmartPoeticLine(part2, maxLen)];
  }

  // Priority 2: preposition or conjunction boundary in middle zone
  const words = line.split(/\s+/);
  let charCount = 0;
  let bestPrepIdx = -1;
  let bestPrepDist = Infinity;

  for (let w = 0; w < words.length; w++) {
    const word = words[w].toLowerCase().replace(/[^a-z]/g, '');
    const wordStart = charCount;
    charCount += words[w].length + 1;

    if (w > 0 && PREPOSITIONS.has(word)) {
      if (wordStart >= minIdx && wordStart <= maxIdx) {
        const dist = Math.abs(wordStart - mid);
        if (dist < bestPrepDist) {
          bestPrepDist = dist;
          bestPrepIdx = wordStart;
        }
      }
    }
  }

  if (bestPrepIdx !== -1) {
    const part1 = line.slice(0, bestPrepIdx).trim();
    const part2 = line.slice(bestPrepIdx).trim();
    return [...formatSmartPoeticLine(part1, maxLen), ...formatSmartPoeticLine(part2, maxLen)];
  }

  // Priority 3: space closest to midpoint
  let bestSpaceIdx = -1;
  let bestSpaceDist = Infinity;
  for (let i = minIdx; i <= maxIdx; i++) {
    if (line[i] === ' ') {
      const dist = Math.abs(i - mid);
      if (dist < bestSpaceDist) {
        bestSpaceDist = dist;
        bestSpaceIdx = i;
      }
    }
  }

  if (bestSpaceIdx !== -1) {
    const part1 = line.slice(0, bestSpaceIdx).trim();
    const part2 = line.slice(bestSpaceIdx).trim();
    return [...formatSmartPoeticLine(part1, maxLen), ...formatSmartPoeticLine(part2, maxLen)];
  }

  return [line];
}

/**
 * Structures lyric lines into beautifully formatted hymn stanzas:
 * - Computes stanza meter cadence up to the first semicolon (';')
 * - Dynamically calculates character capacity from font size (46.67px bold) and slide box width
 * - Breaks lines at semicolons (';'), punctuation (',', ':', '-'), or preposition boundaries ('from', 'in', 'to', etc.)
 * - Guards against vertical over-density when a stanza already has >= 7 lines
 */
export function formatSmartPoeticLines(rawLines: string[]): string {
  const maxLen = computeDynamicMaxLen(rawLines);
  const result: string[] = [];
  for (const raw of rawLines) {
    const semiParts = raw.split(';');
    for (let sIdx = 0; sIdx < semiParts.length; sIdx++) {
      let part = semiParts[sIdx].trim();
      if (!part) continue;
      if (sIdx < semiParts.length - 1) {
        part = part + ';';
      }
      const broken = formatSmartPoeticLine(part, maxLen);
      for (const b of broken) {
        const bTrim = b.trim();
        if (bTrim) result.push(bTrim);
      }
    }
  }
  return result.join('\n');
}

function parseSections(lyrics: string): LyricSection[] {
  const normalized = lyrics.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');
  const sections: LyricSection[] = [];
  let current: LyricSection | null = null;
  let currentParagraph: string[] = [];
  let autoVerse = 0;

  const pushParagraph = () => {
    if (currentParagraph.length > 0) {
      if (!current) {
        current = { kind: 'body', paragraphs: [] };
      }
      current.paragraphs.push(currentParagraph);
      currentParagraph = [];
    }
  };

  const pushSection = () => {
    pushParagraph();
    if (current) {
      // Keep section even if paragraphs is empty so empty refrain placeholders exist
      sections.push(current);
      current = null;
    }
  };

  for (const raw of rawLines) {
    const line = raw.trim();
    const header = line.match(SECTION_HEADER);
    if (header) {
      pushSection();
      const kindRaw = header[1].toLowerCase();
      if (kindRaw.startsWith('verse')) {
        autoVerse += 1;
        const n = header[2] ? parseInt(header[2], 10) : autoVerse;
        current = { kind: 'verse', verseIndex: n, paragraphs: [] };
      } else if (kindRaw.startsWith('chorus')) {
        current = { kind: 'chorus', paragraphs: [] };
      } else {
        current = { kind: 'reff', paragraphs: [] };
      }
      continue;
    }

    if (line === '') {
      pushParagraph();
    } else {
      currentParagraph.push(line);
    }
  }

  pushSection();
  return sections;
}

/**
 * Inherit nearest preceding non-empty refrain for bodyless refrains (L3).
 */
function fillEmptyRefrains(sections: LyricSection[]): LyricSection[] {
  let nearestRefrainParagraphs: string[][] | null = null;

  return sections.map((s) => {
    if (s.kind === 'chorus' || s.kind === 'reff') {
      if (s.paragraphs.length > 0) {
        nearestRefrainParagraphs = s.paragraphs.map((p) => [...p]);
        return s;
      } else if (nearestRefrainParagraphs) {
        return {
          ...s,
          paragraphs: nearestRefrainParagraphs.map((p) => [...p]),
        };
      }
    }
    return s;
  });
}

export type SplitLyricsOptions = {
  /**
   * When true, use legacy continuous prose joining (`; ` / space).
   */
  continuousJoin?: boolean;
  preserveLineBreaks?: boolean;
};

/**
 * Split lyrics into labeled slides following DEC-004 S7 (L1-L6) with Smart Poetic Line Breaks:
 * - L1: Recognize Verse, Chorus, Reff, Refrain (with or without numbers)
 * - L2: Distinct refrains per verse preserved verbatim
 * - L3: Bodyless refrain inherits nearest preceding non-empty refrain
 * - L4: Slide order matches written order; no reordering / interleaving
 * - L5: Blank lines inside a section are hard slide breaks (one paragraph, one slide)
 * - L6: No character-budget or line-count splitting
 * - Verse labels are `n/total`; refrains are labeled `Reff` or `Chorus`
 * - Stanzas format with intelligent poetic line breaks (semicolons, balanced punctuation breaks)
 */
export function splitLyricsLabeled(
  lyrics: string,
  options?: SplitLyricsOptions
): LyricSlide[] {
  if (!lyrics?.trim()) return [];

  const useContinuous = options?.continuousJoin === true;

  let sections = parseSections(lyrics);
  sections = fillEmptyRefrains(sections);

  const verseTotal = sections.filter(
    (s) => s.kind === 'verse' && s.paragraphs.length > 0
  ).length;
  const slides: LyricSlide[] = [];

  for (const section of sections) {
    if (section.paragraphs.length === 0) continue;

    let label = '';
    if (section.kind === 'verse') {
      const n = section.verseIndex ?? 1;
      label = verseTotal > 0 ? `${n}/${verseTotal}` : String(n);
    } else if (section.kind === 'reff') {
      label = 'Reff';
    } else if (section.kind === 'chorus') {
      label = 'Chorus';
    }

    for (const paragraph of section.paragraphs) {
      if (paragraph.length === 0) continue;
      const text = useContinuous
        ? joinLinesContinuous(paragraph)
        : formatSmartPoeticLines(paragraph);
      slides.push({ label, text });
    }
  }

  // Fallback: unlabeled blank-line stanzas (no Verse/Chorus headers)
  if (slides.length === 0) {
    const stanzas = lyrics
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split(/\n\s*\n/);
    for (const stanza of stanzas) {
      const lines = stanza
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length > 0) {
        const text = useContinuous
          ? joinLinesContinuous(lines)
          : formatSmartPoeticLines(lines);
        slides.push({ label: '', text });
      }
    }
  }

  return slides;
}

/** Backward-compatible plain text slides (no labels). */
export function splitLyricsIntoSlides(
  lyrics: string,
  options?: SplitLyricsOptions
): string[] {
  return splitLyricsLabeled(lyrics, options).map((s) => s.text);
}
