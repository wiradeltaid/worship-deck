import { getDb } from './db/index';
import { localIsoDate } from './images';

export type ParsedItem =
  | { type: 'role'; role: string; name: string; timing?: string | null }
  | {
      type: 'hymn';
      number: number;
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

/** Strip addendum markers `》` and `[  ]`. */
function stripPrefixes(line: string): string {
  return line
    .replace(/^》\s*/, '')
    .replace(/^\[\s*\]\s*/, '')
    .trim();
}

const TIMING_RANGE_RE =
  /\(\s*\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2}\s*\/?\s*\d*\s*min?\s*\)/gi;
const TIMING_MINUTES_RE = /\(\s*\d+\s*min(?:ute)?s?\s*\)/gi;
const TIMING_M_RE = /\(\s*\d+\s*m\s*\)/gi;

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

/** Strip duration timings like `(5m)`, `(45m)`, and section time ranges. */
function stripTimings(line: string): string {
  return line
    .replace(TIMING_RANGE_RE, '')
    .replace(TIMING_MINUTES_RE, '')
    .replace(TIMING_M_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Strip prefixes; keep timings for run-sheet (use stripTimings for role matching). */
function cleanLine(line: string): string {
  return stripTimings(stripPrefixes(line));
}

function withTiming<T extends ParsedItem>(item: T, timing: string | null): T {
  if (!timing) return item;
  return { ...item, timing };
}

function isSectionHeader(line: string): boolean {
  return /^(BIBLE\s+TALK|DIVINE\s+SERVICE|BREAK)\b/i.test(line);
}

function parseSermonLine(
  line: string
): ParsedSermon | null {
  const m = line.match(
    /^Sermon\s*[:\-]\s*(.+?)(?:\s+"([^"]+)"|\s+[“"]([^”"]+)[”"])?\s*$/i
  );
  if (!m) return null;
  const speaker = m[1].replace(/\s+"[^"]*"\s*$/, '').trim();
  const title = (m[2] || m[3] || '').trim();
  if (!speaker) return null;
  return { speaker, title };
}

function parseSpecialSong(line: string): string | null | undefined {
  const m = line.match(/^Special\s+Song\s*[:\-]\s*(.*)$/i);
  if (!m) return undefined;
  const value = m[1].trim();
  if (!value || value === '-' || value === '—' || /^none$/i.test(value)) {
    return null;
  }
  return value;
}

/** Split "Acts 18:9,10 — text" / "John 4:23: text" into reference + text. */
export function parseScriptureValue(raw: string): ParsedScripture | null {
  const value = raw.trim();
  if (!value || value === '-' || value === '—') return null;

  const split = value.match(
    /^(.+?)\s+(\d+:[\d,\-–]+)(?:\s*[—–\-:]\s*|\s+)(.+)$/
  );
  if (split) {
    return {
      reference: `${split[1].trim()} ${split[2].trim()}`,
      text: split[3].trim(),
    };
  }

  const refOnly = value.match(
    /^(.+?)\s+(\d+:[\d,\-–]+)\s*$/
  );
  if (refOnly) {
    return {
      reference: `${refOnly[1].trim()} ${refOnly[2].trim()}`,
      text: '',
    };
  }

  return { reference: null, text: value };
}

function parseThemeVerse(line: string): ParsedScripture | null | undefined {
  const m = line.match(/^Theme(?:\s+Verse)?\s*[:\-]\s*(.*)$/i);
  if (!m) return undefined;
  return parseScriptureValue(m[1]);
}

function parseVerseReading(line: string): ParsedScripture | null | undefined {
  const m = line.match(
    /^(?:Verse\s+Reading|Memory\s+(?:Verse|Text)|Ayat\s+Bacaan)\s*[:\-]\s*(.*)$/i
  );
  if (!m) return undefined;
  return parseScriptureValue(m[1]);
}

function parseFamilyYouth(line: string): string | null | undefined {
  const m = line.match(
    /^(?:Family(?:\s*&\s*|\s+and\s+|\/\s*)Youth(?:\s+of\s+the\s+Week)?|Family\s+of\s+the\s+Week|Youth\s+of\s+the\s+Week|Keluarga(?:\s*&\s*|\s+dan\s+)Pemuda)\s*[:\-]\s*(.*)$/i
  );
  if (!m) return undefined;
  const value = m[1].trim();
  if (!value || value === '-' || value === '—') return null;
  return value;
}

function parseRoleLine(line: string): { role: string; name: string } | null {
  // Avoid treating hymn/sermon/special-song lines as roles
  if (/(?:SDAH|Hymn|#)\s*\d+/i.test(line)) return null;
  if (/^Sermon\s*[:\-]/i.test(line)) return null;
  if (/^Special\s+Song\s*[:\-]/i.test(line)) return null;
  if (/^Theme(?:\s+Verse)?\s*[:\-]/i.test(line)) return null;
  if (
    /^(?:Verse\s+Reading|Memory\s+(?:Verse|Text)|Ayat\s+Bacaan)\s*[:\-]/i.test(
      line
    )
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
  if (isSectionHeader(line) && !line.includes(':')) return null;

  const bracket = line.match(/^\[([^\]]+)\]\s*(.+)$/);
  const m = bracket || line.match(/^(.+?)\s*[:\-]\s*(.+)$/);
  if (!m) return null;

  const role = m[1].trim();
  const name = m[2].trim();
  if (!role || !name) return null;
  if (/^\d{1,2}:\d{2}$/.test(role)) return null;

  return { role, name };
}

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
  const db = getDb();
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

  return {
    title: `Unknown ${book} ${number}`,
    lyrics: '',
    incomplete: true,
  };
}

export function parseRundown(rawText: string): ParsedRundown {
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
  };

  const dateRegex =
    /(?:20\d{2}-\d{2}-\d{2})|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}/i;
  const hymnRegex = /(?:SDAH|Hymn|#)\s*(\d+)/i;

  const dateMatch = normalizedText.match(dateRegex);
  if (dateMatch) {
    parsed.date = parseCalendarDate(dateMatch[0]);
  }

  let sermonSpeaker: string | null = null;

  for (const rawLine of lines) {
    if (rawLine.match(dateRegex) && !rawLine.includes(':')) {
      continue;
    }

    const timing = extractTiming(stripPrefixes(rawLine));
    const line = cleanLine(rawLine);
    if (!line) continue;

    let mapped = false;

    // Section headers (BIBLE TALK / DIVINE SERVICE / Break)
    if (isSectionHeader(line)) {
      const title = line
        .replace(/\s*\(.*\)\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      parsed.items.push(withTiming({ type: 'section', title }, timing));
      mapped = true;
    }

    // Special Song
    if (!mapped) {
      const special = parseSpecialSong(line);
      if (special !== undefined) {
        parsed.specialSong = special;
        mapped = true;
      }
    }

    // Theme verse (optional; standing default applied at PPTX time)
    if (!mapped) {
      const theme = parseThemeVerse(line);
      if (theme !== undefined) {
        parsed.themeVerse = theme;
        mapped = true;
      }
    }

    // Verse Reading / Memory Verse
    if (!mapped) {
      const verse = parseVerseReading(line);
      if (verse !== undefined) {
        parsed.verseReading = verse;
        mapped = true;
      }
    }

    // Family & Youth of the Week
    if (!mapped) {
      const family = parseFamilyYouth(line);
      if (family !== undefined) {
        parsed.familyYouth = family;
        mapped = true;
      }
    }

    // Sermon
    if (!mapped) {
      const sermon = parseSermonLine(line);
      if (sermon) {
        parsed.sermon = sermon;
        sermonSpeaker = sermon.speaker;
        parsed.items.push(
          withTiming(
            {
              type: 'role' as const,
              role: 'Sermon',
              name: sermon.title
                ? `${sermon.speaker} — ${sermon.title}`
                : sermon.speaker,
            },
            timing
          )
        );
        mapped = true;
      }
    }

    // Hymns (prefer DB title over rundown trailing text)
    if (!mapped) {
      const hymnMatch = line.match(hymnRegex);
      if (hymnMatch) {
        const number = parseInt(hymnMatch[1], 10);
        const found = lookupHymn(number);
        parsed.items.push(
          withTiming(
            {
              type: 'hymn' as const,
              number,
              title: found.title,
              lyrics: found.lyrics,
              ...(found.incomplete ? { incomplete: true as const } : {}),
            },
            timing
          )
        );
        if (found.incomplete && !parsed.failedHymnNumbers.includes(number)) {
          parsed.failedHymnNumbers.push(number);
        }
        mapped = true;
      }
    }

    // Roles (incl. Closing Prayer → The Speaker)
    if (!mapped) {
      const role = parseRoleLine(line);
      if (role) {
        let name = role.name;
        if (
          /^Closing\s+Prayer$/i.test(role.role) &&
          /^The\s+Speaker$/i.test(name)
        ) {
          name = sermonSpeaker || name;
        }
        if (/^Closing\s+Prayer$/i.test(role.role)) {
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

  // If Closing Prayer used The Speaker before sermon was seen (unlikely),
  // or was set to literal, re-resolve from structured sermon.
  if (
    parsed.closingPrayerPerson &&
    /^The\s+Speaker$/i.test(parsed.closingPrayerPerson) &&
    sermonSpeaker
  ) {
    parsed.closingPrayerPerson = sermonSpeaker;
    for (const item of parsed.items) {
      if (
        item.type === 'role' &&
        /^Closing\s+Prayer$/i.test(item.role) &&
        /^The\s+Speaker$/i.test(item.name)
      ) {
        item.name = sermonSpeaker;
      }
    }
  }

  return parsed;
}
