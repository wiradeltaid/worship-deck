// Planning artifacts cite the code: file paths, and symbol names in backticks.
// When a story renames or deletes what they cite and nobody repairs the citation,
// the document keeps saying something the code stopped doing. That is how
// `data/hymns.json`, `seedBibleCorpus` and `READ_ONLY_BASE_TYPES` survived in the
// spine after the change sets that removed them.
//
// This is a RATCHET, not a spell-checker. The set of citations that do not
// resolve is pinned below, each with the reason it is allowed. A new unresolvable
// citation fails the suite; repairing one and forgetting this list also fails it,
// so the list cannot quietly rot into a wildcard.
//
// WHAT THIS GUARD DOES NOT COVER, stated so it is not read as more than it is:
// a prose claim that cites nothing. "The seed is missing-only" is unverifiable
// here whether or not it is true. Only citation-bearing claims are checked.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS = [
  '.how/_platform/ARCHITECTURE-SPINE.md',
  '.how/_platform/design-system.md',
];

// Citations allowed not to resolve, each with why. Keyed "<basename>|<citation>".
// A dated record, a supersession sentence, or a [TARGET] state legitimately names
// something the tree does not hold.
const ALLOWED = new Map(Object.entries({
  // --- paths a shipped rename left behind, still named by dated records ---
  'ARCHITECTURE-SPINE.md|data/en/song-book/sdah.json': 'AD-26 is decided but unbuilt; Story 22.3 creates this path',

  // --- symbols a shipped change removed, still named by records ---
  'ARCHITECTURE-SPINE.md|isKjvCorpusEmpty': 'the rename sentence isKjvCorpusEmpty() -> isBibleTranslationEmpty(code)',
  'ARCHITECTURE-SPINE.md|songset1': 'AD-19 names it as the REJECTED spelling — "songset1 re-imports the positional reading this decision exists to remove"',
}));

// Citations this guard must not chase: commit SHAs, PPTX media names, and the
// Next.js docs that live under node_modules rather than in this repo.
const NOT_A_CITATION = /^(?:[0-9a-f]{7,40}|image\d+|docs\/0\d-)/;

const PATH_RE = /`?\b((?:src|tests|scripts|data|public)\/[A-Za-z0-9_./-]+\.[a-z]{2,4})\b/g;
// also matches the `name()` form, which is how most function citations are written
const SYM_RE = /`([a-z][A-Za-z0-9]{7,}|[A-Z][A-Z0-9_]{7,})(?:\(\))?`/g;

function sourceIndex() {
  const files = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
      else files.push(p);
    }
  };
  ['src', 'tests', 'scripts', 'data', 'internal'].forEach((d) => walk(path.join(ROOT, d)));
  const text = files
    // This file names every retired symbol in ALLOWED. Indexing it would make
    // each one "exist" in the source and silently disarm the guard.
    .filter((f) => path.basename(f) !== 'doc-citations.test.mjs')
    .filter((f) => /\.(ts|tsx|mjs|js|json|go)$/.test(f))
    .map((f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } })
    .join('\n');
  return { files, text };
}

const { text: SOURCE } = sourceIndex();

// A cited path that is GIT-IGNORED is legitimately absent, not rot: AGENTS.md
// documents `data/local/default-registry.json` as where private congregation data
// goes, and the spine cites it for exactly that reason. Checking the working tree
// alone made this guard pass on a developer machine that has the file and fail in
// CI, which does not — a false negative locally and a false positive in CI.
const ignoredPaths = (() => {
  const missing = new Set();
  for (const rel of DOCS) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    for (const m of fs.readFileSync(abs, 'utf8').matchAll(PATH_RE)) {
      if (!fs.existsSync(path.join(ROOT, m[1]))) missing.add(m[1]);
    }
  }
  if (!missing.size) return new Set();
  try {
    // `check-ignore` exits 1 when nothing matches, which is not an error here
    const out = execFileSync('git', ['check-ignore', '--stdin'],
      { cwd: ROOT, input: [...missing].join('\n'), encoding: 'utf8' });
    return new Set(out.split(/\r?\n/).map((s) => s.trim().replace(/\\/g, '/')).filter(Boolean));
  } catch (err) {
    if (err.status === 1) return new Set();
    throw err;
  }
})();

function unresolved() {
  const found = [];
  for (const rel of DOCS) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const base = path.basename(rel);
    const body = fs.readFileSync(abs, 'utf8');
    const seen = new Set();
    for (const m of body.matchAll(PATH_RE)) {
      const c = m[1];
      if (seen.has(c) || NOT_A_CITATION.test(c)) continue;
      seen.add(c);
      if (!fs.existsSync(path.join(ROOT, c)) && !ignoredPaths.has(c)) found.push({ base, c });
    }
    for (const m of body.matchAll(SYM_RE)) {
      const c = m[1];
      if (seen.has(c) || NOT_A_CITATION.test(c)) continue;
      seen.add(c);
      if (!SOURCE.includes(c)) found.push({ base, c });
    }
  }
  return found;
}

test('every code citation in a planning artifact resolves, or is a pinned exception', () => {
  const missing = unresolved()
    .filter(({ base, c }) => !ALLOWED.has(`${base}|${c}`))
    .map(({ base, c }) => `${base} cites ${c}, which is not in the tree`);

  assert.deepEqual(missing, [],
    'A planning artifact cites code that does not exist. Repair the citation, or — if it is a '
    + 'dated record, a supersession sentence, or a [TARGET] state — add it to ALLOWED with the reason.\n'
    + missing.join('\n'));
});

test('the exception list carries no entry that has since been repaired', () => {
  const live = new Set(unresolved().map(({ base, c }) => `${base}|${c}`));
  const stale = [...ALLOWED.keys()].filter((k) => !live.has(k));

  assert.deepEqual(stale, [],
    'These exceptions no longer describe anything: the citation now resolves, or the text was '
    + 'removed. Delete them so the list cannot drift into a wildcard.\n' + stale.join('\n'));
});
