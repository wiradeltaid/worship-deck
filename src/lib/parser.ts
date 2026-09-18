import { getDb } from './db/index';
import {
  parseRundownWithProfile as parseWithRules,
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

export function parseRundown(rawText: string): ParsedRundown {
  return parseWithRules(rawText, null, lookupHymn);
}

export function parseRundownWithProfile(
  rawText: string,
  profile?: ParserProfileRules | null
): ParsedRundown {
  return parseWithRules(rawText, profile, lookupHymn);
}
