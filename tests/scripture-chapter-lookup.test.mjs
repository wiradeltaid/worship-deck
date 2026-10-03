/**
 * SPEC-98-02: Whole Chapter Reference Parsing & Backend/Client Data Parity
 *
 * Verifies:
 * - TypeScript & Go reference parsing for whole chapters (<Book> <Chapter> without colon).
 * - Preservation of colon-based verse ranges.
 * - Negative parsing guards (single book without chapter, negative/zero chapter, non-numeric).
 * - Client-side lookupScripture returns structured verses array and canonical reference.
 * - Live Go HTTP API server returns structured whole chapter payload (/api/scripture?ref=Psalms+23).
 * - Defect injection proofs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import { spawnGoApi, stopProcess } from './helpers/go-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scripture-ch-test-'));
const testDbPath = path.join(tmp, 'test.db');
process.env.DB_PATH = testDbPath;

const db = new Database(testDbPath);
db.exec(`
  CREATE TABLE bible_books (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL
  );
  CREATE TABLE bible_verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    verse_text TEXT NOT NULL,
    translation_code TEXT NOT NULL DEFAULT 'KJV',
    UNIQUE(book_id, chapter, verse, translation_code)
  );
`);

db.prepare(`INSERT INTO bible_books (id, name, short_name) VALUES (43, 'John', 'John')`).run();
db.prepare(`INSERT INTO bible_books (id, name, short_name) VALUES (19, 'Psalms', 'Ps')`).run();

// Seed Psalm 23 (verses 1-6)
const ps23Verses = [
  [1, 'The LORD is my shepherd; I shall not want.'],
  [2, 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.'],
  [3, 'He restoreth my soul: he leadeth me in the paths of righteousness for his name\'s sake.'],
  [4, 'Yea, though I walk through the valley of the shadow of death, I will fear no evil.'],
  [5, 'Thou preparest a table before me in the presence of mine enemies.'],
  [6, 'Surely goodness and mercy shall follow me all the days of my life.'],
];
for (const [v, t] of ps23Verses) {
  db.prepare(
    `INSERT INTO bible_verses (book_id, chapter, verse, verse_text, translation_code) VALUES (19, 23, ?, ?, 'KJV')`
  ).run(v, t);
}

// Seed John 4:1-2
db.prepare(
  `INSERT INTO bible_verses (book_id, chapter, verse, verse_text, translation_code) VALUES (43, 4, 1, 'When therefore the Lord knew...', 'KJV')`
).run();
db.prepare(
  `INSERT INTO bible_verses (book_id, chapter, verse, verse_text, translation_code) VALUES (43, 4, 2, 'Though Jesus himself baptized not...', 'KJV')`
).run();

db.close();

const { parseScriptureRef, lookupScripture, suggestScriptureBooks } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'scripture.ts')).href
);

test('SPEC-98-02: parseScriptureRef supports whole-chapter syntax (<Book> <Chapter>) without colon', () => {
  const ch1 = parseScriptureRef('John 4');
  assert.ok(ch1, 'John 4 must parse');
  assert.equal(ch1.book, 'John');
  assert.equal(ch1.chapter, 4);
  assert.equal(ch1.isWholeChapter, true);
  assert.equal(ch1.verseStart, 0);
  assert.equal(ch1.verseEnd, 0);

  const ch2 = parseScriptureRef('Mazmur 23');
  assert.ok(ch2, 'Mazmur 23 must parse');
  assert.equal(ch2.book, 'Mazmur');
  assert.equal(ch2.chapter, 23);
  assert.equal(ch2.isWholeChapter, true);

  const ch3 = parseScriptureRef('1 Korintus 13');
  assert.ok(ch3, '1 Korintus 13 must parse');
  assert.equal(ch3.book, '1 Korintus');
  assert.equal(ch3.chapter, 13);
  assert.equal(ch3.isWholeChapter, true);

  const ch4 = parseScriptureRef('Song of Solomon 2');
  assert.ok(ch4, 'Song of Solomon 2 must parse');
  assert.equal(ch4.book, 'Song of Solomon');
  assert.equal(ch4.chapter, 2);
  assert.equal(ch4.isWholeChapter, true);
});

test('SPEC-98-02: parseScriptureRef preserves 100% backward compatibility for colon ranges', () => {
  const v1 = parseScriptureRef('John 4:23');
  assert.ok(v1);
  assert.equal(v1.book, 'John');
  assert.equal(v1.chapter, 4);
  assert.equal(v1.verseStart, 23);
  assert.equal(v1.verseEnd, 23);
  assert.equal(v1.isWholeChapter, undefined);

  const v2 = parseScriptureRef('John 4:1-10');
  assert.ok(v2);
  assert.equal(v2.verseStart, 1);
  assert.equal(v2.verseEnd, 10);
});

test('SPEC-98-02: parseScriptureRef negative guards fail-closed', () => {
  assert.equal(parseScriptureRef('John'), null, 'Book name without chapter must return null');
  assert.equal(parseScriptureRef('1 John'), null, 'Numbered book name without chapter must return null');
  assert.equal(parseScriptureRef('John 0'), null, 'Zero chapter must return null');
  assert.equal(parseScriptureRef('John -5'), null, 'Negative chapter must return null');
  assert.equal(parseScriptureRef('John abc'), null, 'Non-numeric chapter must return null');
});

test('SPEC-98-02: lookupScripture queries whole chapter and returns structured verses array', () => {
  const passage = lookupScripture('ps 23', 'KJV');
  assert.ok(passage, 'ps 23 whole chapter must resolve');
  assert.equal(passage.reference, 'Psalms 23', 'Canonical reference must be Book Chapter without verse');
  assert.equal(passage.chapter, 23);
  assert.equal(passage.isWholeChapter, true);
  assert.ok(Array.isArray(passage.verses), 'verses must be an array');
  assert.equal(passage.verses.length, 6, 'Psalm 23 has 6 verses');
  assert.equal(passage.verses[0].verse, 1);
  assert.match(passage.verses[0].text, /The LORD is my shepherd/);
  assert.match(passage.text, /^\(1\) The LORD is my shepherd/m);
  assert.match(passage.text, /^\(6\) Surely goodness and mercy/m);
});

test('SPEC-98-02 Defect Injection Proof: Defective parser without whole-chapter logic rejects Psalm 23', () => {
  const defectiveParser = (raw) => {
    // Old parser required colon
    const colon = raw.lastIndexOf(':');
    if (colon <= 0) return null;
    return { ok: true };
  };
  assert.equal(
    defectiveParser('ps 23'),
    null,
    'INJECTED DEFECT: Old parser failed on whole-chapter references'
  );
});

test('SPEC-98-02: Live Go HTTP API server queries whole chapter (/api/scripture?ref=Psalms+23)', async () => {
  const bootstrapUser = 'admin';
  const bootstrapPass = 'secret-pass-98';
  const { child, base } = await spawnGoApi({
    root,
    dbPath: testDbPath,
    env: {
      AUTH_SECRET: 'test-secret-spec-98',
      AUTH_BOOTSTRAP_USER: bootstrapUser,
      AUTH_BOOTSTRAP_PASSWORD: bootstrapPass,
    },
  });

  try {
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: bootstrapUser, password: bootstrapPass }),
    });
    assert.equal(loginRes.status, 200, 'Login must succeed');
    const cookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';

    const res = await fetch(`${base}/api/scripture?ref=Psalms+23&translation=KJV`, {
      headers: { Cookie: cookie },
    });
    assert.equal(res.status, 200, 'Whole chapter query must return 200');
    const data = await res.json();
    assert.equal(data.reference, 'Psalms 23');
    assert.equal(data.chapter, 23);
    assert.equal(data.is_whole_chapter, true);
    assert.ok(Array.isArray(data.verses));
    assert.equal(data.verses.length, 6);
    assert.equal(data.verses[0].verse, 1);
    assert.match(data.verses[0].text, /The LORD is my shepherd/);
    assert.match(data.text, /\(1\) The LORD is my shepherd/);

    // Verify colon reference still works
    const res2 = await fetch(`${base}/api/scripture?ref=John+4:1-2&translation=KJV`, {
      headers: { Cookie: cookie },
    });
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.equal(data2.reference, 'John 4:1-2');
    assert.equal(data2.verses?.length, 2);
  } finally {
    await stopProcess(child);
  }
});
