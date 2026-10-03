import { getDb } from './db';

export type ScriptureVerse = {
  verse: number;
  text: string;
};

export type ScripturePassage = {
  reference: string;
  chapter?: number;
  isWholeChapter?: boolean;
  is_whole_chapter?: boolean;
  verses?: ScriptureVerse[];
  text: string;
  translation: string;
};

/**
 * Strip source markup like `@9was@7` / `@6…@5` — the export encoded the words
 * the 1611 translators supplied (printed italic in the KJV) this way. The
 * committed corpus at `data/en/bible-translation/kjv.json` is already clean and
 * `npm run corpus:verify` fails if a marker reappears, so this now guards
 * verses that reached the table by some other route.
 */
export function stripVerseMarkup(text: string): string {
  return text.replace(/@\d+/g, '').replace(/\s{2,}/g, ' ').trim();
}

import { parseScriptureRef, type ParsedRef } from './scripture-format';
export { parseScriptureRef, type ParsedRef };

type BookName = { id: number; name: string; shortName: string };

function aliasesFor(translation: string): Array<{ alias: string; bookId: number }> {
  if (translation.trim().toUpperCase() !== 'KJV') return [];
  return [
    { alias: 'ps', bookId: 19 },
    { alias: 'psalm', bookId: 19 },
    { alias: 'psalms', bookId: 19 },
    { alias: 'sos', bookId: 22 },
    { alias: 'song of songs', bookId: 22 },
    { alias: 'song of solomon', bookId: 22 },
  ];
}

function normalizeBookKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export type ScriptureBookSuggestion = {
  name: string;
  shortName: string;
};

const DEFAULT_SUGGEST_LIMIT = 20;

/** Prefix suggestions for the operator autocomplete. A complete ref is empty. */
export function suggestBooks(
  q: string,
  names: BookName[],
  aliases: Array<{ alias: string; bookId: number }>,
  limit = DEFAULT_SUGGEST_LIMIT
): ScriptureBookSuggestion[] {
  const cap =
    limit <= 0 || limit > DEFAULT_SUGGEST_LIMIT ? DEFAULT_SUGGEST_LIMIT : limit;
  if (q.includes(':') && parseScriptureRef(q)) return [];
  let input = normalizeBookKey(q);
  if (!input) return [];
  const fields = input.split(' ');
  if (fields.length >= 2 && /^\d+$/.test(fields[fields.length - 1] ?? '')) {
    const n = Number(fields[fields.length - 1]);
    if (Number.isInteger(n) && n > 0) {
      input = fields.slice(0, -1).join(' ');
    }
  }
  if (!input) return [];
  const byId = new Map(names.map((n) => [n.id, n]));
  const seen = new Set<number>();
  const out: ScriptureBookSuggestion[] = [];
  const consider = (key: string, book: BookName | undefined) => {
    if (!book) return;
    const k = normalizeBookKey(key);
    if (!k || (k !== input && !k.startsWith(input))) return;
    if (seen.has(book.id)) return;
    seen.add(book.id);
    out.push({ name: book.name, shortName: book.shortName });
  };
  for (const n of names) {
    consider(n.name, n);
    consider(n.shortName, n);
  }
  for (const a of aliases) {
    consider(a.alias, byId.get(a.bookId));
  }
  return out.slice(0, cap);
}

function matchBook(
  bookPart: string,
  names: BookName[],
  aliases: Array<{ alias: string; bookId: number }>
): { id: number; canonicalName: string } | null {
  const input = normalizeBookKey(bookPart);
  if (!input) return null;
  const byId = new Map(names.map((n) => [n.id, n.name]));
  const found: Array<{ id: number; canonical: string; keyLen: number }> = [];
  const consider = (key: string, bookId: number, canonical: string) => {
    const k = normalizeBookKey(key);
    if (!k) return;
    if (input === k || input.startsWith(`${k} `)) {
      found.push({ id: bookId, canonical, keyLen: k.length });
    }
  };
  for (const n of names) {
    consider(n.name, n.id, n.name);
    consider(n.shortName, n.id, n.name);
  }
  for (const a of aliases) {
    consider(a.alias, a.bookId, byId.get(a.bookId) ?? '');
  }
  if (found.length === 0) return null;
  const max = Math.max(...found.map((c) => c.keyLen));
  const longest = found.filter((c) => c.keyLen === max);
  const ids = new Set(longest.map((c) => c.id));
  if (ids.size !== 1) return null;
  const winner = longest[0];
  return {
    id: winner.id,
    canonicalName: winner.canonical || byId.get(winner.id) || bookPart,
  };
}

function loadBookNames(translationCode: string): BookName[] {
  const db = getDb();
  try {
    const named = db
      .prepare(
        `SELECT book_id AS id, name, short_name AS shortName
           FROM bible_book_names WHERE translation_code = ?`
      )
      .all(translationCode) as BookName[];
    if (named.length > 0) return named;
  } catch {
    // Tests and databases created before bible_book_names still read bible_books.
  }
  return db
    .prepare(`SELECT id, name, short_name AS shortName FROM bible_books`)
    .all() as BookName[];
}

function resolveBookId(
  bookName: string,
  translationCode: string
): { id: number; canonicalName: string } | null {
  return matchBook(
    bookName,
    loadBookNames(translationCode),
    aliasesFor(translationCode)
  );
}

/** True when the named translation holds no verses in the table. */
export function isBibleTranslationEmpty(translationCode: string): boolean {
  const code = translationCode.trim().toUpperCase();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM bible_verses WHERE translation_code = ?`
    )
    .get(code) as { n: number };
  return !row || row.n === 0;
}

/**
 * Look up scripture text for a reference in the named translation. For deck
 * theme/verse slides, do NOT call this — use rundown-supplied scripture only.
 */
export function lookupScripture(
  ref: string,
  translationCode: string
): ScripturePassage | null {
  const code = translationCode.trim().toUpperCase();
  const parsed = parseScriptureRef(ref);
  if (!parsed) return null;

  const matched = resolveBookId(parsed.book, code);
  if (matched == null) return null;

  const db = getDb();
  let rows: Array<{ verse: number; verse_text: string }>;
  if (parsed.isWholeChapter) {
    rows = db
      .prepare(
        `SELECT verse, verse_text FROM bible_verses
         WHERE book_id = ? AND chapter = ? AND translation_code = ?
         ORDER BY verse ASC`
      )
      .all(matched.id, parsed.chapter, code) as Array<{
      verse: number;
      verse_text: string;
    }>;
  } else {
    rows = db
      .prepare(
        `SELECT verse, verse_text FROM bible_verses
         WHERE book_id = ? AND chapter = ? AND verse >= ? AND verse <= ?
           AND translation_code = ?
         ORDER BY verse ASC`
      )
      .all(
        matched.id,
        parsed.chapter,
        parsed.verseStart,
        parsed.verseEnd,
        code
      ) as Array<{
      verse: number;
      verse_text: string;
    }>;
  }

  if (rows.length === 0) return null;

  const verses = rows.map((r) => ({
    verse: r.verse,
    text: stripVerseMarkup(r.verse_text),
  }));

  if (parsed.isWholeChapter) {
    const text = verses.map((v) => `(${v.verse}) ${v.text}`).join('\n');
    const reference = `${matched.canonicalName} ${parsed.chapter}`;
    return {
      reference,
      chapter: parsed.chapter,
      isWholeChapter: true,
      is_whole_chapter: true,
      verses,
      text,
      translation: code,
    };
  }

  const text = verses.map((v) => v.text).join(' ');
  const reference =
    parsed.verseStart === parsed.verseEnd
      ? `${matched.canonicalName} ${parsed.chapter}:${parsed.verseStart}`
      : `${matched.canonicalName} ${parsed.chapter}:${parsed.verseStart}-${parsed.verseEnd}`;

  return {
    reference,
    chapter: parsed.chapter,
    verses,
    text,
    translation: code,
  };
}

/** Book suggestions for the named translation. Operator autocomplete only. */
export function suggestScriptureBooks(
  q: string,
  translationCode: string
): ScriptureBookSuggestion[] {
  const code = translationCode.trim().toUpperCase();
  return suggestBooks(q, loadBookNames(code), aliasesFor(code));
}
