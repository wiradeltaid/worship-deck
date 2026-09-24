import { getDb } from './db/index';
import {
  parseRundownStatic,
  parseRundownWithProfile as parseWithRules,
  extractPredefinedFields,
  extractSongSetEntries,
  type ParserProfileRules,
  type ParsedRundown,
} from './parser-rules';

export * from './parser-rules';

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

/**
 * Primary static rundown parser (SPEC-70: profile customization retired in favor of dynamic regexes).
 * Intakes raw text, parses built-in liturgy statically, and enriches with dynamic predefined_fields and song_set_entries regex suggestions.
 */
export function parseRundown(rawText: string): ParsedRundown {
  const parsed = parseRundownStatic(rawText, lookupHymn);

  try {
    const database = getDb();
    const fields = database
      .prepare(
        `SELECT variable_name, extraction_regex FROM predefined_fields WHERE is_active = 1 AND extraction_regex IS NOT NULL`
      )
      .all() as Array<{ variable_name: string; extraction_regex: string | null }>;
    if (fields && fields.length > 0) {
      parsed.fieldSuggestions = extractPredefinedFields(rawText, fields);
    }

    const entries = database
      .prepare(
        `SELECT variable_name, extraction_regex FROM song_set_entries WHERE extraction_regex IS NOT NULL`
      )
      .all() as Array<{ variable_name: string; extraction_regex: string | null }>;
    if (entries && entries.length > 0) {
      parsed.songSetSuggestions = extractSongSetEntries(
        rawText,
        entries,
        lookupHymn,
        resolveSongBookCode()
      );
    }
  } catch {
    // safely ignore if tables or db not initialized
  }

  return parsed;
}

/**
 * @deprecated Custom profile parsing is retired per SPEC-70. Retained as compatibility wrapper for golden fixture tests.
 */
export function parseRundownWithProfile(
  rawText: string,
  profile?: ParserProfileRules | null
): ParsedRundown {
  const parsed = parseWithRules(rawText, profile, lookupHymn);

  try {
    const database = getDb();
    const fields = database
      .prepare(
        `SELECT variable_name, extraction_regex FROM predefined_fields WHERE is_active = 1 AND extraction_regex IS NOT NULL`
      )
      .all() as Array<{ variable_name: string; extraction_regex: string | null }>;
    if (fields && fields.length > 0) {
      parsed.fieldSuggestions = extractPredefinedFields(rawText, fields);
    }

    const entries = database
      .prepare(
        `SELECT variable_name, extraction_regex FROM song_set_entries WHERE extraction_regex IS NOT NULL`
      )
      .all() as Array<{ variable_name: string; extraction_regex: string | null }>;
    if (entries && entries.length > 0) {
      parsed.songSetSuggestions = extractSongSetEntries(
        rawText,
        entries,
        lookupHymn,
        resolveSongBookCode()
      );
    }
  } catch {
    // safely ignore if tables or db not initialized
  }

  return parsed;
}
