export type ScriptureDisplayMode = 'per-verse' | 'inline';
export type ScriptureTypographyMode = 'chapter' | 'verse';

export interface ScriptureVerseItem {
  verse: number;
  text: string;
  label?: string;
  isContinuation?: boolean;
  continuationIndex?: number;
  continuationCount?: number;
}

export interface ScripturePageChunk {
  page: number; // 1-based
  totalPages: number;
  verses: ScriptureVerseItem[];
  text: string;
  displayReference: string;
  typographyMode: ScriptureTypographyMode;
  isContinuation: boolean;
  continuationIndex: number;
  continuationCount: number;
}

export const CHARS_PER_LINE = 60;
export const HARD_LINES = 10;
export const TARGET_LINES = 8;
export const ISOLATE_AT_CHARACTERS = 450;
export const INLINE_MAX_SOURCE_VERSES = 12;

/**
 * Calculates conservative segmented visual line count for a set of verses.
 */
export function estimateScriptureLines(
  verses: ScriptureVerseItem[],
  mode: ScriptureDisplayMode = 'per-verse'
): number {
  if (!verses || verses.length === 0) return 0;
  if (mode === 'per-verse') {
    let totalLines = 0;
    for (const v of verses) {
      const label = v.label !== undefined ? (v.label.endsWith(' ') ? v.label : `${v.label} `) : `(${v.verse}) `;
      const fullText = label + v.text;
      const segments = fullText.split('\n');
      for (const seg of segments) {
        totalLines += Math.max(1, Math.ceil(seg.length / CHARS_PER_LINE));
      }
    }
    return totalLines;
  }
  // Inline mode: joined text
  const joinedText = verses
    .map((v) => (v.label !== undefined ? (v.label.endsWith(' ') ? v.label : `${v.label} `) : `(${v.verse}) `) + v.text)
    .join('; ');
  return Math.max(1, Math.ceil(joinedText.length / CHARS_PER_LINE));
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
  verses: ScriptureVerseItem[],
  mode: ScriptureDisplayMode = 'per-verse'
): string {
  if (!verses || verses.length === 0) return '';
  const renderItem = (v: ScriptureVerseItem) => {
    const prefix = v.label !== undefined ? (v.label.endsWith(' ') ? v.label : `${v.label} `) : `(${v.verse}) `;
    return prefix + v.text;
  };
  if (mode === 'per-verse') {
    return verses.map(renderItem).join('\n');
  }
  return verses.map(renderItem).join('; ');
}

function partitionLongVerse(
  v: ScriptureVerseItem,
  mode: ScriptureDisplayMode
): ScriptureVerseItem[][] {
  const fullText = v.text;
  const fragmentsText: string[] = [];
  let remaining = fullText;
  let isFirst = true;

  while (remaining.length > 0) {
    const label = isFirst ? (v.label !== undefined ? v.label : `(${v.verse})`) : `(${v.verse}, continued)`;
    const maxChars = TARGET_LINES * CHARS_PER_LINE - (label.length + 1);

    if (remaining.length <= maxChars) {
      fragmentsText.push(remaining);
      break;
    }

    // Find break point at last space within maxChars
    let breakIdx = remaining.lastIndexOf(' ', maxChars);
    if (breakIdx <= 0) {
      // Pathological unbroken token: break at maxChars boundary
      breakIdx = maxChars;
      fragmentsText.push(remaining.slice(0, breakIdx));
      remaining = remaining.slice(breakIdx);
    } else {
      // Include space in current fragment so concatenating .join('') strictly restores exact text
      fragmentsText.push(remaining.slice(0, breakIdx + 1));
      remaining = remaining.slice(breakIdx + 1);
    }
    isFirst = false;
  }

  const count = fragmentsText.length;
  return fragmentsText.map((fText, idx) => {
    const isCont = idx > 0;
    const label = isCont ? `(${v.verse}, continued)` : (v.label !== undefined ? v.label : `(${v.verse})`);
    return [
      {
        verse: v.verse,
        text: fText,
        label,
        isContinuation: isCont,
        continuationIndex: idx + 1,
        continuationCount: count,
      },
    ];
  });
}

/**
 * Chunks passage verses into sequential projection-safe pages using visual line budgets.
 * - HARD_LINES = 10 normal ceiling
 * - TARGET_LINES = 8 continuation ceiling
 * - ISOLATE_AT_CHARACTERS = 450 both-sides sealed isolation
 */
export function paginateScriptureVerses(
  baseReference: string,
  verses: ScriptureVerseItem[],
  mode: ScriptureDisplayMode = 'per-verse',
  typographyModeOrMaxVerses?: ScriptureTypographyMode | number,
  maxCharsPerPage = 900
): ScripturePageChunk[] {
  let typographyMode: ScriptureTypographyMode | undefined;
  let legacyMaxVerses: number | undefined;

  if (typeof typographyModeOrMaxVerses === 'string') {
    typographyMode = typographyModeOrMaxVerses;
  } else if (typeof typographyModeOrMaxVerses === 'number') {
    legacyMaxVerses = typographyModeOrMaxVerses;
  }

  const resolvedTypographyMode: ScriptureTypographyMode =
    typographyMode || (verses && verses.length > 4 ? 'chapter' : 'verse');

  if (!verses || verses.length === 0) {
    return [
      {
        page: 1,
        totalPages: 1,
        verses: [],
        text: '',
        displayReference: baseReference,
        typographyMode: resolvedTypographyMode,
        isContinuation: false,
        continuationIndex: 1,
        continuationCount: 1,
      },
    ];
  }

  // Backward compatibility: If caller explicitly provided numeric maxVerses (legacy SPEC-98 behavior)
  if (legacyMaxVerses !== undefined) {
    const singlePageText = formatScriptureText(verses, mode);
    if (verses.length <= legacyMaxVerses && singlePageText.length <= maxCharsPerPage) {
      return [
        {
          page: 1,
          totalPages: 1,
          verses,
          text: singlePageText,
          displayReference: baseReference,
          typographyMode: resolvedTypographyMode,
          isContinuation: false,
          continuationIndex: 1,
          continuationCount: 1,
        },
      ];
    }

    const legacyChunks: ScriptureVerseItem[][] = [];
    let curChunk: ScriptureVerseItem[] = [];
    let curLen = 0;

    for (const v of verses) {
      const verseFormattedLen = `(${v.verse}) ${v.text}`.length + (mode === 'per-verse' ? 1 : 2);
      const wouldExceedVerses = curChunk.length >= legacyMaxVerses;
      const wouldExceedChars = curChunk.length > 0 && curLen + verseFormattedLen > maxCharsPerPage;

      if (wouldExceedVerses || wouldExceedChars) {
        legacyChunks.push(curChunk);
        curChunk = [v];
        curLen = verseFormattedLen;
      } else {
        curChunk.push(v);
        curLen += verseFormattedLen;
      }
    }

    if (curChunk.length > 0) {
      legacyChunks.push(curChunk);
    }

    const totalPages = legacyChunks.length;
    return legacyChunks.map((chunk, idx) => {
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
        typographyMode: resolvedTypographyMode,
        isContinuation: false,
        continuationIndex: 1,
        continuationCount: 1,
      };
    });
  }

  const chunks: ScriptureVerseItem[][] = [];
  let currentChunk: ScriptureVerseItem[] = [];

  for (const v of verses) {
    const isLongVerse = v.text.length >= ISOLATE_AT_CHARACTERS;

    if (isLongVerse) {
      // 1. Pre-flush any accumulated prior verses
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
      }

      // 2. Isolate long verse
      const vLines = estimateScriptureLines([v], mode);
      if (vLines <= HARD_LINES) {
        chunks.push([
          {
            ...v,
            label: v.label !== undefined ? v.label : `(${v.verse}) `,
            isContinuation: false,
            continuationIndex: 1,
            continuationCount: 1,
          },
        ]);
      } else {
        // Partition into continuation fragments
        const subChunks = partitionLongVerse(v, mode);
        chunks.push(...subChunks);
      }

      // 3. Post-flush: currentChunk remains empty so subsequent verses start on a new page
      continue;
    }

    // Normal verse accumulation within line budget
    const candidateChunk = [...currentChunk, v];
    const candidateLines = estimateScriptureLines(candidateChunk, mode);
    const wouldExceedInline = mode === 'inline' && candidateChunk.length > INLINE_MAX_SOURCE_VERSES;

    if (currentChunk.length > 0 && (candidateLines > HARD_LINES || wouldExceedInline)) {
      chunks.push(currentChunk);
      const vAloneLines = estimateScriptureLines([v], mode);
      if (vAloneLines > HARD_LINES) {
        const subChunks = partitionLongVerse(v, mode);
        chunks.push(...subChunks);
        currentChunk = [];
      } else {
        currentChunk = [v];
      }
    } else if (currentChunk.length === 0 && candidateLines > HARD_LINES) {
      const subChunks = partitionLongVerse(v, mode);
      chunks.push(...subChunks);
      currentChunk = [];
    } else {
      currentChunk.push(v);
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  const totalPages = chunks.length;
  return chunks.map((chunk, idx) => {
    const page = idx + 1;
    const firstV = chunk[0];
    const lastV = chunk[chunk.length - 1];
    const isCont = Boolean(firstV.isContinuation || (firstV.continuationIndex && firstV.continuationIndex > 1));
    const cIndex = firstV.continuationIndex || 1;
    const cCount = firstV.continuationCount || 1;

    let displayReference = baseReference;
    if (cCount > 1) {
      displayReference = isCont
        ? `${baseReference} (${firstV.verse}, continued)`
        : `${baseReference} (${firstV.verse})`;
    } else if (totalPages > 1) {
      if (firstV.verse === lastV.verse) {
        displayReference = `${baseReference} (${firstV.verse})`;
      } else {
        displayReference = `${baseReference} (${firstV.verse}-${lastV.verse})`;
      }
    }

    return {
      page,
      totalPages,
      verses: chunk,
      text: formatScriptureText(chunk, mode),
      displayReference,
      typographyMode: resolvedTypographyMode,
      isContinuation: isCont,
      continuationIndex: cIndex,
      continuationCount: cCount,
    };
  });
}
