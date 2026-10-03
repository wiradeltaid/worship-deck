export type ScriptureDisplayMode = 'per-verse' | 'inline';

export interface ScripturePageChunk {
  page: number; // 1-based
  totalPages: number;
  verses: Array<{ verse: number; text: string }>;
  text: string;
  displayReference: string;
}

export type ParsedRef = {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  isWholeChapter?: boolean;
};

/** Strip placeholder prefixes operators often leave in the field (e.g. from UI copy). */
function normalizeScriptureInput(raw: string): string {
  return decodeURIComponent(raw)
    .replace(/\+/g, ' ')
    .trim()
    .replace(/^(?:e\.g\.|eg\.|example:)\s*/i, '')
    .trim();
}

/** Parse refs like `John 4:23`, `Song of Solomon 1:1`, `Hakim-hakim 2:16`, or whole chapter `John 4`. */
export function parseScriptureRef(raw: string): ParsedRef | null {
  const value = normalizeScriptureInput(raw);
  if (!value) return null;

  const colon = value.lastIndexOf(':');
  if (colon > 0) {
    const before = value.slice(0, colon).trim();
    const after = value.slice(colon + 1).trim();
    const space = before.search(/\s+\S+$/);
    if (space < 0) return null;
    const book = before.slice(0, space).replace(/\s+/g, ' ').trim();
    const chapter = Number(before.slice(space + 1).trim());
    const span = after.match(/^(\d+)(?:\s*[-–]\s*(\d+)|\s*,\s*(\d+))?$/);
    if (!span) return null;
    const verseStart = Number(span[1]);
    const verseEnd = Number(span[2] || span[3] || span[1]);
    if (
      !book ||
      !Number.isInteger(chapter) ||
      !Number.isInteger(verseStart) ||
      !Number.isInteger(verseEnd) ||
      chapter <= 0 ||
      verseStart <= 0 ||
      verseEnd < verseStart
    ) {
      return null;
    }

    return { book, chapter, verseStart, verseEnd };
  }

  // Whole chapter lookup: "<Book> <Chapter>"
  const space = value.search(/\s+\S+$/);
  if (space <= 0) return null;
  const book = value.slice(0, space).replace(/\s+/g, ' ').trim();
  const chapterStr = value.slice(space + 1).trim();
  const chapter = Number(chapterStr);
  if (!book || !Number.isInteger(chapter) || chapter <= 0) {
    return null;
  }

  return { book, chapter, verseStart: 0, verseEnd: 0, isWholeChapter: true };
}

const COMMON_ALIASES: Record<string, string> = {
  ps: 'psalms',
  psalm: 'psalms',
  psalms: 'psalms',
  mazmur: 'mazmur',
  mzm: 'mazmur',
  jn: 'john',
  joh: 'john',
  john: 'john',
  yoh: 'yohanes',
  yohanes: 'yohanes',
  sos: 'song of solomon',
  'song of songs': 'song of solomon',
  'song of solomon': 'song of solomon',
  kidung: 'kidung agung',
  'kidung agung': 'kidung agung',
  mat: 'matthew',
  matt: 'matthew',
  matthew: 'matthew',
  matius: 'matius',
  luk: 'luke',
  luke: 'luke',
  lukas: 'lukas',
  mrk: 'mark',
  mark: 'mark',
  markus: 'markus',
  act: 'acts',
  acts: 'acts',
  kis: 'kisah para rasul',
  'kisah para rasul': 'kisah para rasul',
  rom: 'romans',
  romans: 'romans',
  roma: 'roma',
  gen: 'genesis',
  genesis: 'genesis',
  kej: 'kejadian',
  kejadian: 'kejadian',
  exo: 'exodus',
  exodus: 'exodus',
  kel: 'keluaran',
  keluaran: 'keluaran',
  rev: 'revelation',
  revelation: 'revelation',
  wahyu: 'wahyu',
};

export function normalizeBookName(name: string): string {
  const norm = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return COMMON_ALIASES[norm] || norm;
}

/**
 * Computes canonical cache key for a scripture reference across spellings/aliases.
 * Formats:
 * - Whole chapter: `${TRANSLATION}:${CANONICAL_BOOK}:${CHAPTER}:ALL`
 * - Verse span:    `${TRANSLATION}:${CANONICAL_BOOK}:${CHAPTER}:${START}:${END}`
 */
export function getCanonicalScriptureKey(ref: string, translation = 'KJV'): string {
  const t = (translation || 'KJV').trim().toUpperCase();
  const parsed = parseScriptureRef(ref);
  if (parsed) {
    const bookNorm = normalizeBookName(parsed.book);
    if (parsed.isWholeChapter) {
      return `${t}:${bookNorm}:${parsed.chapter}:ALL`;
    }
    return `${t}:${bookNorm}:${parsed.chapter}:${parsed.verseStart}:${parsed.verseEnd}`;
  }
  const clean = ref.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${t}:${clean}`;
}

/**
 * Formats verses according to display mode:
 * - 'per-verse': (1) Verse text\n(2) Next verse
 * - 'inline': (1) Verse text; (2) Next verse
 */
export function formatScriptureText(
  verses: Array<{ verse: number; text: string }>,
  mode: ScriptureDisplayMode = 'per-verse'
): string {
  if (!verses || verses.length === 0) return '';
  if (mode === 'per-verse') {
    return verses.map((v) => `(${v.verse}) ${v.text}`).join('\n');
  }
  return verses.map((v) => `(${v.verse}) ${v.text}`).join('; ');
}

/**
 * Chunks passage verses into sequential projection-safe pages.
 * Threshold: verse count > 8 OR character count > 900 triggers pagination.
 */
export function paginateScriptureVerses(
  baseReference: string,
  verses: Array<{ verse: number; text: string }>,
  mode: ScriptureDisplayMode = 'per-verse',
  maxVersesPerPage = 8,
  maxCharsPerPage = 900
): ScripturePageChunk[] {
  if (!verses || verses.length === 0) {
    return [
      {
        page: 1,
        totalPages: 1,
        verses: [],
        text: '',
        displayReference: baseReference,
      },
    ];
  }

  const singlePageText = formatScriptureText(verses, mode);
  if (verses.length <= maxVersesPerPage && singlePageText.length <= maxCharsPerPage) {
    return [
      {
        page: 1,
        totalPages: 1,
        verses,
        text: singlePageText,
        displayReference: baseReference,
      },
    ];
  }

  // Chunking by verse count and character limit
  const chunks: Array<Array<{ verse: number; text: string }>> = [];
  let currentChunk: Array<{ verse: number; text: string }> = [];
  let currentLen = 0;

  for (const v of verses) {
    const verseFormattedLen = `(${v.verse}) ${v.text}`.length + (mode === 'per-verse' ? 1 : 2);
    const wouldExceedVerses = currentChunk.length >= maxVersesPerPage;
    const wouldExceedChars = currentChunk.length > 0 && currentLen + verseFormattedLen > maxCharsPerPage;

    if (wouldExceedVerses || wouldExceedChars) {
      chunks.push(currentChunk);
      currentChunk = [v];
      currentLen = verseFormattedLen;
    } else {
      currentChunk.push(v);
      currentLen += verseFormattedLen;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  const totalPages = chunks.length;
  return chunks.map((chunk, idx) => {
    const page = idx + 1;
    const firstV = chunk[0].verse;
    const lastV = chunk[chunk.length - 1].verse;
    let displayReference = baseReference;
    if (totalPages > 1) {
      if (firstV === lastV) {
        displayReference = `${baseReference} (${firstV})`;
      } else {
        displayReference = `${baseReference} (${firstV}-${lastV})`;
      }
    }
    return {
      page,
      totalPages,
      verses: chunk,
      text: formatScriptureText(chunk, mode),
      displayReference,
    };
  });
}
