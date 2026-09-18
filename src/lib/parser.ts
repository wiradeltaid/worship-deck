import { BUILTIN_DEFAULT_RULES_JSON } from './parser-constants';
import { localIsoDate } from './images';

let dbProvider: (() => any) | null = null;
export function setDbProvider(fn: () => any) {
  dbProvider = fn;
}

export type ParsedItem =
  | { type: 'role'; role: string; name: string; timing?: string | null }
  | {
      type: 'hymn';
      number: number;
      bookCode?: string;
      title: string;
      lyrics: string;
      incomplete?: boolean;
      timing?: string | null;
    }
  | { type: 'section'; title: string; timing?: string | null };

export interface ParsedSermon {
  speaker: string;
  title: string;
}

/** Sender-supplied scripture text (theme / verse reading). */
export interface ParsedScripture {
  reference: string | null;
  text: string;
  /** Corpus that produced `text` when the operator resolved the reference. */
  translation?: string;
}

export interface ParsedSongCandidate {
  line: string;
  bookCode: string;
  number: number;
  title: string;
  lyrics: string;
  incomplete?: boolean;
  label?: string;
  timing?: string | null;
}

export interface ParserProfileRules {
  schema_version: number;
  preprocess?: {
    strip_prefixes?: string[];
    timing_patterns?: string[];
  };
  date_pattern?: string;
  section_delimiter_pattern?: string;
  hymn_patterns?: Array<{
    pattern: string;
    flags?: string[];
  }>;
  book_aliases?: Record<string, string>;
  default_book?: string;
  field_rules?: Record<string, { pattern: string }>;
  scripture_split_pattern?: string;
  scripture_ref_pattern?: string;
  role_patterns?: {
    bracket_role?: string;
    colon_role?: string;
    clock_role?: string;
  };
  song_set_matching?: {
    label_slots?: Array<{ label: string; target: string }>;
    slot_family_prefix?: string;
  };
}

export interface ParsedRundown {
  date: string | null;
  items: ParsedItem[];
  unmappedLines: string[];
  /** SDAH numbers that failed hymnal lookup (FR-2). */
  failedHymnNumbers: number[];
  sermon: ParsedSermon | null;
  /** null/empty when Special Song is `-` (none). */
  specialSong: string | null;
  closingPrayerPerson: string | null;
  /** null → PPTX uses standing default theme verse. */
  themeVerse: ParsedScripture | null;
  /** null → omit Verse Reading slide. */
  verseReading: ParsedScripture | null;
  /** Freeform family/youth-of-the-week text; null → omit slide. Legacy combined field. */
  familyYouth: string | null;
  /** Family-of-the-week prayer request (Slide 56). */
  familyPrayerRequest: string | null;
  /** Youth-of-the-week prayer request (Slide 56). */
  youthPrayerRequest: string | null;
  /** Family-of-the-week name (Slide 56). */
  familyName?: string | null;
  /** Youth-of-the-week name (Slide 56). */
  youthName?: string | null;
  songCandidates?: ParsedSongCandidate[];
}

export function compileProfileRegex(pattern: string, flagsArr?: string[]): RegExp {
  const flags = new Set<string>(flagsArr ?? []);
  let pat = pattern;
  if (pat.includes('(?i)')) {
    flags.add('i');
    pat = pat.replace(/\(\?i\)/g, '');
  }
  return new RegExp(pat, Array.from(flags).join(''));
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseCalendarDate(rawDate: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [y, m, d] = rawDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== m - 1 ||
      dt.getUTCDate() !== d
    ) {
      return null;
    }
    return rawDate;
  }

  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return null;
  return localIsoDate(d);
}

const TIMING_RANGE_RE =
  /\(\s*\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2}\s*\/?\s*\d*\s*min?\s*\)/gi;
const TIMING_MINUTES_RE = /\(\s*\d+\s*min(?:ute)?s?\s*\)/gi;
const TIMING_M_RE = /\(\s*\d+\s*m\s*\)/gi;

/** Strip addendum markers `》` and `[  ]`. */
export function stripPrefixes(line: string): string {
  return line
    .replace(/^》\s*/, '')
    .replace(/^\[\s*\]\s*/, '')
    .trim();
}

/** Extract duration timings like `(5m)`, `(45m)`, and section time ranges. */
export function extractTiming(line: string): string | null {
  const found: string[] = [];
  for (const re of [TIMING_RANGE_RE, TIMING_MINUTES_RE, TIMING_M_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      found.push(m[0].replace(/^\(|\)$/g, '').trim());
    }
  }
  if (found.length === 0) return null;
  return found.join(' · ');
}

function extractTimingWithProfile(line: string, profile?: ParserProfileRules | null): string | null {
  const timingPatterns = profile?.preprocess?.timing_patterns;
  if (!timingPatterns || timingPatterns.length === 0) {
    return extractTiming(line);
  }
  const found: string[] = [];
  for (const pat of timingPatterns) {
    const re = compileProfileRegex(pat, ['g']);
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      found.push(m[0].replace(/^\(|\)$/g, '').trim());
    }
  }
  if (found.length === 0) return null;
  return found.join(' · ');
}

/** Strip duration timings like `(5m)`, `(45m)`, and section time ranges. */
function stripTimings(line: string): string {
  return line
    .replace(TIMING_RANGE_RE, '')
    .replace(TIMING_MINUTES_RE, '')
    .replace(TIMING_M_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripTimingsWithProfile(line: string, profile?: ParserProfileRules | null): string {
  const timingPatterns = profile?.preprocess?.timing_patterns;
  if (!timingPatterns || timingPatterns.length === 0) {
    return stripTimings(line);
  }
  let res = line;
  for (const pat of timingPatterns) {
    const re = compileProfileRegex(pat, ['g']);
    res = res.replace(re, '');
  }
  return res.replace(/\s{2,}/g, ' ').trim();
}

function stripPrefixesWithProfile(line: string, profile?: ParserProfileRules | null): string {
  let cleaned = line.trim();
  const stripPatterns = profile?.preprocess?.strip_prefixes;
  if (stripPatterns && stripPatterns.length > 0) {
    for (const pat of stripPatterns) {
      const re = compileProfileRegex(pat);
      cleaned = cleaned.replace(re, '').trim();
    }
    return cleaned;
  }
  return stripPrefixes(line);
}

/** Strip prefixes; keep timings for run-sheet (use stripTimings for role matching). */
function cleanLineWithProfile(line: string, profile?: ParserProfileRules | null): string {
  return stripTimingsWithProfile(stripPrefixesWithProfile(line, profile), profile);
}

function cleanLine(line: string): string {
  return cleanLineWithProfile(line, null);
}

function withTiming<T extends ParsedItem>(item: T, timing: string | null): T {
  if (!timing) return item;
  return { ...item, timing };
}

export function resolveBookAlias(aliasOrCode: string | undefined, profile?: ParserProfileRules | null): string {
  const cleaned = aliasOrCode?.trim().toUpperCase() ?? '';
  if (!cleaned) {
    if (profile?.default_book) {
      return profile.default_book.trim().toUpperCase();
    }
    return resolveSongBookCode();
  }
  if (profile?.book_aliases) {
    const target = profile.book_aliases[cleaned];
    if (target) return target.trim().toUpperCase();
  }
  return cleaned;
}

function resolveSongBookCode(explicitBook?: string): string {
  const explicit = explicitBook?.trim().toUpperCase();
  if (explicit) return explicit;
  if (dbProvider) {
    try {
      const db = dbProvider();
      const row = db
        .prepare('SELECT book_code FROM song_books WHERE is_default = 1 LIMIT 1')
        .get() as { book_code?: string } | undefined;
      if (row?.book_code?.trim()) return row.book_code.trim().toUpperCase();
    } catch {
      // fallback if table does not exist or query fails
    }
  }
  return 'SDAH';
}

/** Resolve a hymn on (bookCode, number) from the hymns table (lyrics + incomplete flag). */
export function lookupHymn(
  number: number,
  bookCode?: string
): {
  title: string;
  lyrics: string;
  incomplete?: boolean;
} {
  const book = resolveSongBookCode(bookCode);
  if (dbProvider) {
    try {
      const db = dbProvider();
      const hymnRecord = db
        .prepare(
          'SELECT title, lyrics FROM hymns WHERE book_code = ? AND number = ?'
        )
        .get(book, number) as { title: string; lyrics: string } | undefined;

      if (hymnRecord) {
        if (!hymnRecord.lyrics?.trim()) {
          return {
            title: hymnRecord.title || `Unknown ${book} ${number}`,
            lyrics: '',
            incomplete: true,
          };
        }
        return { title: hymnRecord.title, lyrics: hymnRecord.lyrics };
      }
    } catch {
      // fallback if table does not exist or query fails
    }
  }

  return {
    title: `Unknown ${book} ${number}`,
    lyrics: '',
    incomplete: true,
  };
}

/** Split "Acts 18:9,10 — text" / "John 4:23: text" into reference + text. */
export function parseScriptureValueWithProfile(
  raw: string,
  profile?: ParserProfileRules | null
): ParsedScripture | null {
  const value = raw.trim();
  if (!value || value === '-' || value === '—') return null;

  const splitPattern =
    profile?.scripture_split_pattern ??
    '^(.+?)\\s+(\\d+:[\\d,\\-–]+)(?:\\s*[—–\\-:]\\s*|\\s+)(.+)$';
  const split = value.match(compileProfileRegex(splitPattern));
  if (split) {
    const groups = (split as any).groups ?? {};
    if (groups.book_chapter && groups.text) {
      return {
        reference: groups.book_chapter.trim(),
        text: groups.text.trim(),
      };
    }
    if (split.length >= 4) {
      return {
        reference: `${split[1].trim()} ${split[2].trim()}`,
        text: split[3].trim(),
      };
    }
  }

  const refPattern =
    profile?.scripture_ref_pattern ?? '^(.+?)\\s+(\\d+:[\\d,\\-–]+)\\s*$';
  const refOnly = value.match(compileProfileRegex(refPattern));
  if (refOnly) {
    const groups = (refOnly as any).groups ?? {};
    if (groups.book_chapter) {
      return {
        reference: groups.book_chapter.trim(),
        text: '',
      };
    }
    if (refOnly.length >= 3) {
      return {
        reference: `${refOnly[1].trim()} ${refOnly[2].trim()}`,
        text: '',
      };
    }
  }

  return { reference: null, text: value };
}

export function parseScriptureValue(raw: string): ParsedScripture | null {
  return parseScriptureValueWithProfile(raw, null);
}

function parseRoleLineWithProfile(
  line: string,
  profile: ParserProfileRules
): { role: string; name: string } | null {
  // Avoid treating hymn lines as roles
  if (profile.hymn_patterns && profile.hymn_patterns.length > 0) {
    for (const hp of profile.hymn_patterns) {
      if (compileProfileRegex(hp.pattern, hp.flags).test(line)) {
        return null;
      }
    }
  } else if (/(?:SDAH|Hymn|#)\s*\d+/i.test(line)) {
    return null;
  }

  // Avoid treating field rules lines as roles
  if (/^Sermon\s*[:\-]/i.test(line)) return null;
  if (/^Special\s+Song\s*[:\-]/i.test(line)) return null;
  if (/^Theme(?:\s+Verse)?\s*[:\-]/i.test(line)) return null;
  if (
    /^(?:Verse\s+Reading|Memory\s+(?:Verse|Text)|Ayat\s+Bacaan)\s*[:\-]/i.test(line)
  ) {
    return null;
  }
  if (
    /^(?:Family(?:\s*&\s*|\s+and\s+|\/\s*)Youth|Family\s+of\s+the\s+Week|Youth\s+of\s+the\s+Week|Keluarga)/i.test(
      line
    )
  ) {
    return null;
  }

  const secPat =
    profile.section_delimiter_pattern ??
    '^(BIBLE\\s+TALK|DIVINE\\s+SERVICE|BREAK)\\b';
  if (compileProfileRegex(secPat).test(line) && !line.includes(':')) {
    return null;
  }

  const bracketPat =
    profile.role_patterns?.bracket_role ?? '^\\[([^\\]]+)\\]\\s*(.+)$';
  const colonPat =
    profile.role_patterns?.colon_role ?? '^(.+?)\\s*[:\\-]\\s*(.+)$';
  const clockPat = profile.role_patterns?.clock_role ?? '^\\d{1,2}:\\d{2}$';

  const bracket = line.match(compileProfileRegex(bracketPat));
  const m = bracket || line.match(compileProfileRegex(colonPat));
  if (!m) return null;

  const groups = (m as any).groups ?? {};
  const role = (groups.role || m[1] || '').trim();
  const name = (groups.name || m[2] || '').trim();
  if (!role || !name) return null;
  if (compileProfileRegex(clockPat).test(role)) return null;

  return { role, name };
}

export function parseRundown(rawText: string): ParsedRundown {
  let profile: ParserProfileRules | null = null;
  try {
    profile = JSON.parse(BUILTIN_DEFAULT_RULES_JSON) as ParserProfileRules;
  } catch {
    profile = null;
  }
  return parseRundownWithProfile(rawText, profile);
}

export function parseRundownWithProfile(
  rawText: string,
  profileInput?: ParserProfileRules | null
): ParsedRundown {
  let profile: ParserProfileRules;
  if (!profileInput) {
    try {
      profile = JSON.parse(BUILTIN_DEFAULT_RULES_JSON) as ParserProfileRules;
    } catch {
      profile = {
        schema_version: 1,
        date_pattern:
          '(?:20\\d{2}-\\d{2}-\\d{2})|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+\\d{1,2},?\\s+20\\d{2}',
        section_delimiter_pattern: '^(BIBLE\\s+TALK|DIVINE\\s+SERVICE|BREAK)\\b',
        hymn_patterns: [{ pattern: '(?:(?<book>SDAH|Hymn|#))\\s*#?\\s*(?<number>\\d+)', flags: ['i'] }],
        book_aliases: { SDAH: 'SDAH', HYMN: 'SDAH', '#': 'SDAH' },
        default_book: 'SDAH',
      };
    }
  } else {
    profile = profileInput;
  }

  const normalizedText = normalizeNewlines(rawText);
  const lines = normalizedText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsed: ParsedRundown = {
    date: null,
    items: [],
    unmappedLines: [],
    failedHymnNumbers: [],
    sermon: null,
    specialSong: null,
    closingPrayerPerson: null,
    themeVerse: null,
    verseReading: null,
    familyYouth: null,
    familyPrayerRequest: null,
    youthPrayerRequest: null,
    familyName: null,
    youthName: null,
    songCandidates: [],
  };

  const datePattern =
    profile.date_pattern ??
    '(?:20\\d{2}-\\d{2}-\\d{2})|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+\\d{1,2},?\\s+20\\d{2}';
  const dateRegex = compileProfileRegex(datePattern);

  const dateMatch = normalizedText.match(dateRegex);
  if (dateMatch) {
    parsed.date = parseCalendarDate(dateMatch[0]);
  }

  let sermonSpeaker: string | null = null;

  for (const rawLine of lines) {
    if (rawLine.match(dateRegex) && !rawLine.includes(':')) {
      continue;
    }

    const timing = extractTimingWithProfile(stripPrefixesWithProfile(rawLine, profile), profile);
    const line = cleanLineWithProfile(rawLine, profile);
    if (!line) continue;

    let mapped = false;

    // 1. Section headers
    const secPat =
      profile.section_delimiter_pattern ??
      '^(BIBLE\\s+TALK|DIVINE\\s+SERVICE|BREAK)\\b';
    const secRE = compileProfileRegex(secPat);
    if (secRE.test(line)) {
      const title = line
        .replace(/\s*\(.*\)\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      parsed.items.push(withTiming({ type: 'section', title }, timing));
      mapped = true;
    }

    // 2. Special Song
    if (!mapped) {
      const spRule = profile.field_rules?.special_song?.pattern ?? '^Special\\s+Song\\s*[:\\-]\\s*(.*)$';
      const spRE = compileProfileRegex(spRule);
      const m = line.match(spRE);
      if (m) {
        const groups = (m as any).groups ?? {};
        const val = (groups.value !== undefined ? groups.value : m[1] || '').trim();
        if (!val || val === '-' || val === '—' || /^none$/i.test(val)) {
          parsed.specialSong = null;
        } else {
          parsed.specialSong = val;
        }
        mapped = true;
      }
    }

    // 3. Theme verse
    if (!mapped) {
      const thRule = profile.field_rules?.theme_verse?.pattern ?? '^Theme(?:\\s+Verse)?\\s*[:\\-]\\s*(.*)$';
      const thRE = compileProfileRegex(thRule);
      const m = line.match(thRE);
      if (m) {
        const groups = (m as any).groups ?? {};
        const val = (groups.value !== undefined ? groups.value : m[1] || '').trim();
        parsed.themeVerse = parseScriptureValueWithProfile(val, profile);
        mapped = true;
      }
    }

    // 4. Verse Reading
    if (!mapped) {
      const vrRule =
        profile.field_rules?.verse_reading?.pattern ??
        '^(?:Verse\\s+Reading|Memory\\s+(?:Verse|Text)|Ayat\\s+Bacaan)\\s*[:\\-]\\s*(.*)$';
      const vrRE = compileProfileRegex(vrRule);
      const m = line.match(vrRE);
      if (m) {
        const groups = (m as any).groups ?? {};
        const val = (groups.value !== undefined ? groups.value : m[1] || '').trim();
        parsed.verseReading = parseScriptureValueWithProfile(val, profile);
        mapped = true;
      }
    }

    // 5. Family & Youth of the Week
    if (!mapped) {
      const famRule =
        profile.field_rules?.family_youth?.pattern ??
        '^(?:Family(?:\\s*&\\s*|\\s+and\\s+|/\\s*)Youth(?:\\s+of\\s+the\\s+Week)?|Family\\s+of\\s+the\\s+Week|Youth\\s+of\\s+the\\s+Week|Keluarga(?:\\s*&\\s*|\\s+dan\\s+)Pemuda)\\s*[:\\-]\\s*(.*)$';
      const famRE = compileProfileRegex(famRule);
      const m = line.match(famRE);
      if (m) {
        const groups = (m as any).groups ?? {};
        const val = (groups.value !== undefined ? groups.value : m[1] || '').trim();
        if (!val || val === '-' || val === '—') {
          parsed.familyYouth = null;
        } else {
          parsed.familyYouth = val;
        }
        mapped = true;
      }
    }

    // 6. Sermon
    if (!mapped) {
      const sermRule =
        profile.field_rules?.sermon?.pattern ??
        '^Sermon\\s*[:\\-]\\s*(?<speaker>.+?)(?:\\s+"(?<title>[^"]+)"|\\s+[“"](?<title>[^”"]+)[”"])?\\s*$';
      const sermRE = compileProfileRegex(sermRule);
      const m = line.match(sermRE);
      if (m) {
        const groups = (m as any).groups ?? {};
        let speaker = (groups.speaker || m[1] || '').replace(/\s+"[^"]*"\s*$/, '').trim();
        let title = (groups.title || m[2] || m[3] || '').trim();
        if (speaker) {
          parsed.sermon = { speaker, title };
          sermonSpeaker = speaker;
          parsed.items.push(
            withTiming(
              {
                type: 'role' as const,
                role: 'Sermon',
                name: title ? `${speaker} — ${title}` : speaker,
              },
              timing
            )
          );
          mapped = true;
        }
      }
    }

    // 7. Hymns / Song candidates
    if (!mapped) {
      const hymnPatterns = profile.hymn_patterns ?? [
        { pattern: '(?:(?<book>SDAH|Hymn|#))\\s*#?\\s*(?<number>\\d+)', flags: ['i'] },
      ];
      for (const hp of hymnPatterns) {
        const re = compileProfileRegex(hp.pattern, hp.flags);
        const m = line.match(re);
        if (m) {
          const groups = (m as any).groups ?? {};
          let numStr = groups.number;
          let bookStr = groups.book;
          if (!numStr && m.length > 1) {
            for (let i = 1; i < m.length; i++) {
              if (/^\d+$/.test(m[i]?.trim() ?? '')) {
                numStr = m[i].trim();
                break;
              }
            }
          }
          if (numStr) {
            const number = parseInt(numStr, 10);
            const bookCode = resolveBookAlias(bookStr, profile);
            const found = lookupHymn(number, bookCode);
            const item: ParsedItem = {
              type: 'hymn' as const,
              number,
              bookCode,
              title: found.title,
              lyrics: found.lyrics,
              ...(found.incomplete ? { incomplete: true as const } : {}),
            };
            parsed.items.push(withTiming(item, timing));
            if (found.incomplete && !parsed.failedHymnNumbers.includes(number)) {
              parsed.failedHymnNumbers.push(number);
            }
            parsed.songCandidates?.push({
              line: rawLine,
              bookCode,
              number,
              title: found.title,
              lyrics: found.lyrics,
              incomplete: found.incomplete,
              timing,
            });
            mapped = true;
            break;
          }
        }
      }
    }

    // 8. Roles
    if (!mapped) {
      const role = parseRoleLineWithProfile(line, profile);
      if (role) {
        let name = role.name;
        if (
          /^(?:Closing\s+Prayer|Doa\s+(?:Tutup|Penutup))$/i.test(role.role) &&
          /^The\s+Speaker$/i.test(name)
        ) {
          name = sermonSpeaker || name;
        }
        if (/^(?:Closing\s+Prayer|Doa\s+(?:Tutup|Penutup))$/i.test(role.role)) {
          parsed.closingPrayerPerson = name;
        }
        parsed.items.push(
          withTiming({ type: 'role' as const, role: role.role, name }, timing)
        );
        mapped = true;
      }
    }

    if (!mapped && line.match(dateRegex)) {
      mapped = true;
    }

    if (!mapped) {
      parsed.unmappedLines.push(rawLine);
    }
  }

  if (
    parsed.closingPrayerPerson &&
    /^The\s+Speaker$/i.test(parsed.closingPrayerPerson) &&
    sermonSpeaker
  ) {
    parsed.closingPrayerPerson = sermonSpeaker;
    for (const item of parsed.items) {
      if (
        item.type === 'role' &&
        /^(?:Closing\s+Prayer|Doa\s+(?:Tutup|Penutup))$/i.test(item.role) &&
        /^The\s+Speaker$/i.test(item.name)
      ) {
        item.name = sermonSpeaker;
      }
    }
  }

  return parsed;
}
