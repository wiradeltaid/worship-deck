#!/usr/bin/env node
/**
 * Reseed or restore song book hymns from the committed corpus files (e.g. data/song-book/sdah.json).
 *
 * Background:
 * The song book bootstrap (DEC-005 / AD-36) runs once on initial database creation. If hymn lyrics
 * are accidentally emptied (e.g. via an empty Save-to-Book action) or deleted, standard startup
 * does not restore them because the bootstrap marker (song_book_bootstrapped_<CODE>) prevents
 * overwriting operator edits.
 *
 * This maintenance script diagnoses and restores hymns directly from the authoritative corpus.
 *
 * Usage:
 *   node scripts/reseed-hymns.mjs                    # Diagnose / dry-run check
 *   node scripts/reseed-hymns.mjs --apply            # Restore missing or empty-lyric hymns
 *   node scripts/reseed-hymns.mjs --apply --hymn=469 # Restore only a specific hymn
 *   node scripts/reseed-hymns.mjs --apply --force    # Overwrite all hymns to match corpus exactly
 *   node scripts/reseed-hymns.mjs --book=SDAH        # Specify song book (default: SDAH)
 *   node scripts/reseed-hymns.mjs --db=/path/to.db   # Specify SQLite database path
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// 1. Parse Arguments
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FORCE = args.includes('--force');

const hymnArg = args.find((a) => a.startsWith('--hymn='));
const TARGET_HYMN = hymnArg ? parseInt(hymnArg.slice('--hymn='.length).trim(), 10) : null;

const bookArg = args.find((a) => a.startsWith('--book='));
const BOOK_CODE = (bookArg ? bookArg.slice('--book='.length).trim() : 'SDAH').toUpperCase();

const dbArg = args.find((a) => a.startsWith('--db='));
const DB_PATH = dbArg
  ? path.resolve(dbArg.slice('--db='.length).trim())
  : process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(root, 'data.db');

// ---------------------------------------------------------------------------
// 2. Load Corpus File
// ---------------------------------------------------------------------------
const corpusFilename = `${BOOK_CODE.toLowerCase()}.json`;
const corpusPath = path.join(root, 'data', 'song-book', corpusFilename);

if (!fs.existsSync(corpusPath)) {
  console.error(`Error: Corpus file not found at: ${corpusPath}`);
  process.exit(1);
}

let corpus;
try {
  corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
} catch (err) {
  console.error(`Error parsing corpus JSON: ${err.message}`);
  process.exit(1);
}

const corpusHymns = Array.isArray(corpus?.hymns) ? corpus.hymns : [];
if (corpusHymns.length === 0) {
  console.error(`Error: Corpus contains no hymns: ${corpusPath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Connect to Database (better-sqlite3 or node:sqlite)
// ---------------------------------------------------------------------------
if (!fs.existsSync(DB_PATH)) {
  console.error(`Error: Database file not found at: ${DB_PATH}`);
  process.exit(1);
}

let db;
try {
  const Database = (await import('better-sqlite3')).default;
  db = new Database(DB_PATH, { readonly: !APPLY, fileMustExist: true });
} catch {
  const { DatabaseSync } = await import('node:sqlite');
  db = new DatabaseSync(DB_PATH, { readOnly: !APPLY });
}

console.log('=== Hymn Corpus Reseeder ===');
console.log(`Database : ${DB_PATH}`);
console.log(`Song Book: ${BOOK_CODE} (${corpus.book?.name || 'Unknown'})`);
console.log(`Corpus   : ${corpusPath} (${corpusHymns.length} hymns)`);
console.log(`Mode     : ${APPLY ? (FORCE ? 'APPLY (FORCE OVERWRITE ALL)' : 'APPLY (RESTORE MISSING/EMPTY)') : 'DRY-RUN / DIAGNOSE (read-only)'}`);
if (TARGET_HYMN != null) {
  console.log(`Target   : Hymn #${TARGET_HYMN} only`);
}
console.log('');

// ---------------------------------------------------------------------------
// 4. Diagnose and Reseed
// ---------------------------------------------------------------------------
const readHymn = db.prepare('SELECT number, title, lyrics FROM hymns WHERE book_code = ? AND number = ?');
const insertHymn = APPLY ? db.prepare('INSERT INTO hymns (book_code, number, title, lyrics) VALUES (?, ?, ?, ?)') : null;
const updateHymn = APPLY ? db.prepare('UPDATE hymns SET title = ?, lyrics = ? WHERE book_code = ? AND number = ?') : null;

let matchedCount = 0;
let missingCount = 0;
let emptyLyricsCount = 0;
let modifiedCount = 0;
let insertedCount = 0;
let updatedCount = 0;

const anomalies = [];

for (const h of corpusHymns) {
  if (TARGET_HYMN != null && h.number !== TARGET_HYMN) {
    continue;
  }

  const row = readHymn.get(BOOK_CODE, h.number);

  if (!row) {
    missingCount++;
    anomalies.push({ number: h.number, status: 'MISSING', corpusTitle: h.title });
    if (APPLY) {
      insertHymn.run(BOOK_CODE, h.number, h.title, h.lyrics);
      insertedCount++;
    }
  } else {
    const dbLyrics = typeof row.lyrics === 'string' ? row.lyrics : '';
    const isEmpty = dbLyrics.trim().length === 0;

    if (isEmpty) {
      emptyLyricsCount++;
      anomalies.push({ number: h.number, status: 'EMPTY_LYRICS', corpusTitle: h.title, dbTitle: row.title });
      if (APPLY) {
        updateHymn.run(h.title, h.lyrics, BOOK_CODE, h.number);
        updatedCount++;
      }
    } else if (dbLyrics !== h.lyrics || row.title !== h.title) {
      modifiedCount++;
      anomalies.push({
        number: h.number,
        status: 'MODIFIED',
        corpusTitle: h.title,
        dbTitle: row.title,
        corpusLyricsLen: h.lyrics.length,
        dbLyricsLen: dbLyrics.length,
      });
      if (APPLY && FORCE) {
        updateHymn.run(h.title, h.lyrics, BOOK_CODE, h.number);
        updatedCount++;
      }
    } else {
      matchedCount++;
    }
  }
}

// Ensure song_books entry exists
const readBook = db.prepare('SELECT book_code FROM song_books WHERE book_code = ?').get(BOOK_CODE);
if (!readBook && APPLY) {
  const insertBook = db.prepare(`
    INSERT INTO song_books (book_code, name, locale, licence, provenance, is_default, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  insertBook.run(
    BOOK_CODE,
    String(corpus.book?.name || BOOK_CODE).trim(),
    String(corpus.book?.language || 'en').trim(),
    corpus.book?.licence ? String(corpus.book.licence).trim() : null,
    corpus.book?.attribution ? String(corpus.book.attribution).trim() : null,
    1
  );
  console.log(`[song_books] Seeded song book record for ${BOOK_CODE}`);
}

// Ensure bootstrap marker is set if applied
if (APPLY) {
  const marker = `song_book_bootstrapped_${BOOK_CODE}`;
  try {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(marker, '1');
  } catch (err) {
    // Non-fatal if settings table is structured differently
  }
}

// ---------------------------------------------------------------------------
// 5. Output Report
// ---------------------------------------------------------------------------
console.log('--- Diagnosis Report ---');
console.log(`Matching / Complete : ${matchedCount}`);
console.log(`Missing Hymns       : ${missingCount}`);
console.log(`Empty Lyrics Hymns  : ${emptyLyricsCount}`);
console.log(`Modified Hymns      : ${modifiedCount}`);

if (anomalies.length > 0) {
  console.log('\nAnomalies detected:');
  for (const a of anomalies.slice(0, 20)) {
    if (a.status === 'MISSING') {
      console.log(`  #${a.number}: MISSING from database ("${a.corpusTitle}")`);
    } else if (a.status === 'EMPTY_LYRICS') {
      console.log(`  #${a.number}: EMPTY LYRICS in database ("${a.dbTitle || a.corpusTitle}")`);
    } else if (a.status === 'MODIFIED') {
      console.log(`  #${a.number}: MODIFIED ("${a.dbTitle}" vs "${a.corpusTitle}", lyrics len ${a.dbLyricsLen} vs ${a.corpusLyricsLen})`);
    }
  }
  if (anomalies.length > 20) {
    console.log(`  ... and ${anomalies.length - 20} more`);
  }
}

if (APPLY) {
  console.log(`\nActions Applied:`);
  console.log(`  Inserted: ${insertedCount}`);
  console.log(`  Updated : ${updatedCount}`);
  console.log('Database reseed complete.');
} else if (missingCount > 0 || emptyLyricsCount > 0) {
  console.log('\nTo restore missing and empty hymns, run with --apply:');
  console.log(`  node scripts/reseed-hymns.mjs --apply --book=${BOOK_CODE}`);
} else {
  console.log('\nAll checked hymns are complete and present.');
}
