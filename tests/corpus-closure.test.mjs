/**
 * AD-25 / AD-26 / AD-28 structural guards.
 *
 * Surfaces this guard actually protects (and only these):
 * - Corpus table names derived from `internal/db/schema.sql` CREATE TABLE
 *   rows named `hymns`, `bible_*`, or `song_*` (the live Go DDL). A new
 *   table matching that pattern is watched the moment it is added — the
 *   allowlist that used to sit here could not fail when DDL grew.
 * - Operator/admin write paths: `INSERT` / `UPDATE` / `DELETE FROM` those
 *   tables in `internal/httpapi/` (the live API) and in `src/` except the
 *   Node boot module `src/lib/db/index.ts`.
 * - AD-26 never-filter: `WHERE locale =|LIKE|IN|<>|!=` in `internal/httpapi/`
 *   and the Node corpus readers (`src/lib/corpus.ts`, `src/lib/scripture.ts`,
 *   `src/lib/db/index.ts`).
 * - AD-28: an `aliases` field on any JSON under `data/`; an unkeyed alias
 *   identifier (`BOOK_ALIASES`, `bookAliases`) or a file-level `const/var
 *   aliases` in `src/`, `internal/`, `spa/src/`. Matcher-owned
 *   `AliasesFor(translation)` / `aliasesFor(translation)` are keyed and
 *   allowed.
 *
 * Proof (re-runnable; inject, watch fail, revert — 2026-08-20):
 * 1. Go write: `INSERT INTO hymns` in `internal/httpapi/hymns.go` →
 *    "no operator or administrator write path into a corpus table" fails.
 * 2. TS write: `db.exec('UPDATE bible_verses SET verse_text = 1')` in
 *    `src/lib/scripture.ts` → same assertion fails.
 * 3. Locale predicate: `WHERE locale = ?` in `internal/httpapi/hymns.go` →
 *    "listing endpoints never filter corpus rows by locale" fails.
 * 4. JSON aliases: `"aliases": {}` on `data/en/bible-translation/kjv.json`
 *    translation object → "corpus files must not carry an aliases field" fails.
 * 5. Unkeyed identifier: `const BOOK_ALIASES = {}` in `src/lib/scripture.ts` →
 *    "no unkeyed alias list survives" fails.
 * 6. File-level aliases: `const aliases = []` at module top of
 *    `src/lib/scripture.ts` → same assertion fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(repoRoot, 'internal', 'db', 'schema.sql');
const dbIndexRel = 'src/lib/db/index.ts';

function isCorpusTable(name) {
  return name === 'hymns' || name.startsWith('bible_') || name.startsWith('song_');
}

const ddlText = fs.readFileSync(schemaPath, 'utf8');
const corpusTables = [
  ...ddlText.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g),
].map((m) => m[1]).filter(isCorpusTable);

test('Go startup DDL yields at least the shipped bible and hymn tables', () => {
  assert.ok(corpusTables.includes('hymns'));
  assert.ok(corpusTables.includes('bible_verses'));
  assert.ok(corpusTables.includes('bible_translations'));
  assert.ok(corpusTables.includes('bible_book_names'));
});

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function walkFiles(relDir, extRe) {
  const files = [];
  const walk = (absDir) => {
    if (!fs.existsSync(absDir)) return;
    for (const entry of fs.readdirSync(absDir)) {
      const abs = path.join(absDir, entry);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        walk(abs);
        continue;
      }
      if (extRe.test(entry)) files.push(abs);
    }
  };
  walk(path.join(repoRoot, relDir));
  return files;
}

function writePattern(table) {
  return new RegExp(
    `\\b(?:INSERT\\s+(?:OR\\s+\\w+\\s+)?INTO\\s+${table}\\b|UPDATE\\s+${table}\\b|DELETE\\s+FROM\\s+${table}\\b)`,
    'i'
  );
}

/** DEC-005 / AD-36: the explicit save-to-book route is the one sanctioned operator write into hymns. */
const ALLOWED_CORPUS_WRITES = new Set([
  'internal/httpapi/song_sets.go writes hymns',
  // Hub weekly inputs — not corpus hymn/book data (DEC-004 song_set_inputs).
  'internal/httpapi/services.go writes song_set_inputs',
  // Admin registry entry rename migrating weekly inputs (SPEC-13-06).
  'internal/httpapi/song_set_entries.go writes song_set_inputs',
  // Admin registry trio — not song-book corpus (DEC-004 song_set_layouts).
  'internal/httpapi/song_set_entries.go writes song_set_layouts',
  // Admin song-books CRUD contract (.how/registry/02-contracts/05-song-books.md, DEC-005 / AD-36).
  'internal/httpapi/song_books.go writes song_books',
  // Admin song set master entries (DEC-004 / AD-31 / commit 28a0574).
  'internal/httpapi/song_set_entries.go writes song_set_entries',
]);

test('no operator or administrator write path into a corpus table', () => {
  const offenders = [];
  const scan = (abs, skipRel) => {
    const rel = path.relative(repoRoot, abs).replace(/\\/g, '/');
    if (rel === skipRel) return;
    // Go test fixtures are not runtime write paths; Go only compiles _test.go under `go test`.
    if (rel.endsWith('_test.go')) return;
    const code = stripComments(fs.readFileSync(abs, 'utf8'));
    for (const table of corpusTables) {
      if (writePattern(table).test(code)) {
        const hit = `${rel} writes ${table}`;
        if (!ALLOWED_CORPUS_WRITES.has(hit)) offenders.push(hit);
      }
    }
  };
  for (const abs of walkFiles('internal/httpapi', /\.go$/)) scan(abs);
  for (const abs of walkFiles('src', /\.(ts|tsx)$/)) scan(abs, dbIndexRel);
  assert.deepEqual(offenders, []);
});

function hasLocaleListingFilter(code) {
  // Strip one-time null-backfill migrations: `locale IS NULL OR locale = ''` is not a listing filter.
  const cleaned = code.replace(/locale\s+IS\s+NULL\s+OR\s+locale\s*=\s*(?:''|""|``)/gi, '');
  // Split on SQL-ish string / template boundaries or semicolons/backticks to evaluate per statement
  // rather than spanning across unrelated statements in a file.
  const statements = cleaned.split(/[`'"]|;|\bprepare\s*\(|\bexec\s*\(|\bquery(?:row)?\s*\(/i);
  for (const stmt of statements) {
    const whereIdx = stmt.search(/\bWHERE\b/i);
    if (whereIdx !== -1) {
      const whereClause = stmt.slice(whereIdx);
      if (/\blocale\b\s*(=|LIKE|IN\b|<>|!=)/i.test(whereClause)) {
        return true;
      }
    }
  }
  return false;
}

test('listing endpoints never filter corpus rows by locale', () => {
  const offenders = [];
  const scan = (abs) => {
    const rel = path.relative(repoRoot, abs).replace(/\\/g, '/');
    // Go test files are test fixtures, not listing endpoints.
    if (rel.endsWith('_test.go')) return;
    const code = stripComments(fs.readFileSync(abs, 'utf8'));
    if (hasLocaleListingFilter(code)) offenders.push(rel);
  };
  for (const abs of walkFiles('internal/httpapi', /\.go$/)) scan(abs);
  for (const rel of ['src/lib/corpus.ts', 'src/lib/scripture.ts', dbIndexRel]) {
    scan(path.join(repoRoot, rel));
  }
  assert.deepEqual(offenders, []);
});

function jsonHasAliases(value) {
  if (Array.isArray(value)) return value.some(jsonHasAliases);
  if (value && typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'aliases')) return true;
    return Object.values(value).some(jsonHasAliases);
  }
  return false;
}

function walkDataJson(absDir, files = []) {
  if (!fs.existsSync(absDir)) return files;
  for (const entry of fs.readdirSync(absDir)) {
    const abs = path.join(absDir, entry);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      walkDataJson(abs, files);
      continue;
    }
    if (entry.endsWith('.json')) files.push(abs);
  }
  return files;
}

test('corpus files must not carry an aliases field', () => {
  const offenders = walkDataJson(path.join(repoRoot, 'data'))
    .filter((abs) => {
      try {
        return jsonHasAliases(JSON.parse(fs.readFileSync(abs, 'utf8')));
      } catch {
        return false;
      }
    })
    .map((abs) => path.relative(repoRoot, abs).replace(/\\/g, '/'));
  assert.deepEqual(offenders, []);
});

const UNKEYED_IDENT = /\b(?:BOOK_ALIASES|bookAliases)\b/;
const TOP_LEVEL_ALIASES =
  /^(?:export\s+)?(?:const|let|var)\s+aliases\b/m;

test('no unkeyed alias list survives in source', () => {
  const offenders = [];
  const scan = (abs) => {
    const rel = path.relative(repoRoot, abs).replace(/\\/g, '/');
    const code = stripComments(fs.readFileSync(abs, 'utf8'));
    if (UNKEYED_IDENT.test(code) || TOP_LEVEL_ALIASES.test(code)) {
      offenders.push(rel);
    }
  };
  for (const abs of walkFiles('src', /\.(ts|tsx)$/)) scan(abs);
  for (const abs of walkFiles('internal', /\.go$/)) scan(abs);
  for (const abs of walkFiles('spa/src', /\.(ts|tsx)$/)) scan(abs);
  assert.deepEqual(offenders, []);
});

/**
 * Exactly one bible corpus ships until leftover `bible_books` display columns
 * are dropped (AD-27 remainder). A second committed corpus would make the last
 * reconciler own every book name.
 */
test('exactly one bible corpus is committed until bible_books display columns drop', () => {
  const tracked = execFileSync(
    'git',
    ['ls-files', '--', 'data/*/bible-translation/*.json'],
    { cwd: repoRoot, encoding: 'utf8' }
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  assert.deepEqual(
    tracked,
    ['data/en/bible-translation/kjv.json'],
    'a second committed corpus arms AD-27 leftover display columns on bible_books'
  );
});
