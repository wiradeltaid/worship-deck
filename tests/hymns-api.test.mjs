/**
 * GET /api/hymns query contract: `all`, `numbers`, `q`, `limit`, malformed params.
 * Proven against the Go API on a bootstrapped SQLite DB.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { json, parseCookie, spawnGoApi, stopProcess } from './helpers/go-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hymns-api-test-'));
const dbPath = path.join(tmp, 'test.db');
const AUTH_SECRET = createHash('sha256').update('hymns-go-http-secret').digest('hex');
const BOOTSTRAP_USER = 'admin';
const BOOTSTRAP_PASS = 'bootstrap-pass-99';

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 40;

let child;
let base;
let cookie;
let seededHymns = [];
let seededNumbers = [];

before(async () => {
  ({ child, base } = await spawnGoApi({
    dbPath,
    root,
    env: {
      AUTH_SECRET,
      AUTH_BOOTSTRAP_USER: BOOTSTRAP_USER,
      AUTH_BOOTSTRAP_PASSWORD: BOOTSTRAP_PASS,
    },
  }));
  const login = await json(`${base}/api/auth/login`, 'POST', {
    username: BOOTSTRAP_USER,
    password: BOOTSTRAP_PASS,
  });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  cookie = parseCookie(login.headers['set-cookie']);
  const all = await json(`${base}/api/hymns?all=1`, 'GET', undefined, { cookie });
  assert.equal(all.status, 200);
  seededHymns = all.body.hymns;
  seededNumbers = seededHymns.map((h) => h.number);
});

after(() => {
  stopProcess(child);
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

/** Rows whose number or title literally contains `needle` (client semantics). */
function literalMatches(needle) {
  const q = needle.toLowerCase();
  return seededHymns.filter(
    (h) => String(h.number).includes(q) || h.title.toLowerCase().includes(q)
  );
}

async function call(search) {
  const res = await json(`${base}/api/hymns${search}`, 'GET', undefined, { cookie });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(Array.isArray(res.body.hymns), 'body.hymns must be an array');
  return res.body.hymns;
}

function assertSortedByNumber(hymns) {
  for (let i = 1; i < hymns.length; i++) {
    assert.ok(
      hymns[i - 1].number < hymns[i].number,
      'rows must be ascending and unique by number'
    );
  }
}

test('corpus is seeded so the assertions below are meaningful', () => {
  assert.ok(seededNumbers.length > MAX_LIMIT, 'need more hymns than the cap');
});

test('no params returns the default page of the index', async () => {
  const hymns = await call('');
  assert.equal(hymns.length, DEFAULT_LIMIT);
  assertSortedByNumber(hymns);
  assert.deepEqual(
    hymns.map((h) => h.number),
    seededNumbers.slice(0, DEFAULT_LIMIT)
  );
  assert.equal(typeof hymns[0].title, 'string');
});

test('q matches number or title substrings, capped at the default limit', async () => {
  const byTitle = await call('?q=amaz');
  assert.ok(byTitle.length > 0);
  assert.ok(byTitle.length <= DEFAULT_LIMIT);
  for (const hymn of byTitle) {
    assert.ok(
      hymn.title.toLowerCase().includes('amaz') ||
        String(hymn.number).includes('amaz'),
      `unexpected match: ${hymn.number} - ${hymn.title}`
    );
  }
  assertSortedByNumber(byTitle);

  const byNumber = await call('?q=15');
  assert.ok(byNumber.length > 0);
  for (const hymn of byNumber) {
    assert.ok(
      String(hymn.number).includes('15') || hymn.title.toLowerCase().includes('15')
    );
  }
});

test('q escapes LIKE wildcards: % and _ are literals, not patterns', async () => {
  for (const raw of ['%', '_', '%%', 'a%b', '_a_']) {
    const hymns = await call(`?q=${encodeURIComponent(raw)}`);
    const expected = literalMatches(raw);
    assert.equal(
      hymns.length,
      Math.min(expected.length, DEFAULT_LIMIT),
      `q=${JSON.stringify(raw)} must match literally`
    );
    for (const hymn of hymns) {
      assert.ok(
        hymn.title.toLowerCase().includes(raw.toLowerCase()) ||
          String(hymn.number).includes(raw),
        `q=${JSON.stringify(raw)} returned a non-literal match: ${hymn.title}`
      );
    }
  }

  const sample = seededHymns.find((h) => h.title.length >= 8);
  assert.ok(sample, 'need a title long enough to slice');
  const slice = sample.title.slice(1, 6);
  const wildcarded = `${slice.slice(0, 2)}_${slice.slice(3)}`;
  assert.ok((await call(`?q=${encodeURIComponent(slice)}`)).length > 0);
  assert.equal(
    (await call(`?q=${encodeURIComponent(wildcarded)}`)).length,
    Math.min(literalMatches(wildcarded).length, DEFAULT_LIMIT)
  );
});

test('q escapes backslashes so the ESCAPE character cannot be smuggled in', async () => {
  for (const raw of ['\\', '\\%', '100\\']) {
    const hymns = await call(`?q=${encodeURIComponent(raw)}`);
    assert.equal(hymns.length, Math.min(literalMatches(raw).length, DEFAULT_LIMIT));
  }
});

test('q with no match returns an empty list, not an error', async () => {
  const hymns = await call('?q=zzzznotahymnzzzz');
  assert.deepEqual(hymns, []);
});

test('limit widens the page up to the cap', async () => {
  assert.equal((await call('?limit=3')).length, 3);
  assert.equal((await call('?limit=40')).length, MAX_LIMIT);
  assert.equal((await call('?limit=500')).length, MAX_LIMIT);
  assert.equal((await call('?q=e&limit=40')).length, MAX_LIMIT);
});

test('malformed limit falls back to the default instead of 400', async () => {
  for (const raw of ['abc', '', '0', '-5', '1.5.2', '20abc', 'NaN']) {
    const hymns = await call(`?limit=${encodeURIComponent(raw)}`);
    assert.equal(
      hymns.length,
      DEFAULT_LIMIT,
      `limit=${JSON.stringify(raw)} should fall back to ${DEFAULT_LIMIT}`
    );
  }
});

test('numbers returns exactly the requested hymns, ascending', async () => {
  const wanted = [seededNumbers[9], seededNumbers[2], seededNumbers[0]];
  const hymns = await call(`?numbers=${wanted.join(',')}`);
  assert.deepEqual(
    hymns.map((h) => h.number),
    [...wanted].sort((a, b) => a - b)
  );
  assertSortedByNumber(hymns);
});

test('numbers ignores malformed and duplicate entries', async () => {
  const first = seededNumbers[0];
  const second = seededNumbers[1];
  const hymns = await call(
    `?numbers=${first},abc,,${first}, ${second} ,-3,1e3,${9999999}`
  );
  assert.deepEqual(
    hymns.map((h) => h.number),
    [first, second]
  );
});

test('numbers with nothing usable returns an empty list', async () => {
  assert.deepEqual(await call('?numbers='), []);
  assert.deepEqual(await call('?numbers=abc,-1,0'), []);
  assert.deepEqual(await call('?numbers=99999999'), []);
});

test('numbers takes precedence over q and ignores limit', async () => {
  const wanted = seededNumbers.slice(0, 20);
  const hymns = await call(`?numbers=${wanted.join(',')}&q=amaz&limit=2`);
  assert.deepEqual(
    hymns.map((h) => h.number),
    wanted
  );
});

test('all=1 still returns the whole index, unaffected by limit', async () => {
  for (const search of ['?all=1', '?all=true', '?all=1&limit=5', '?all=1&q=amaz']) {
    const hymns = await call(search);
    assert.equal(hymns.length, seededNumbers.length, search);
  }
  assertSortedByNumber(await call('?all=1'));
});

test('all=0 is not a truthy flag and falls through to the default page', async () => {
  const hymns = await call('?all=0');
  assert.equal(hymns.length, DEFAULT_LIMIT);
});

test('GET /api/hymns returns bookCode and can filter by book_code', async () => {
  const defaultList = await call('?limit=5');
  assert.ok(defaultList.length > 0);
  assert.equal(defaultList[0].bookCode, 'SDAH');

  const filtered = await call('?book_code=SDAH&numbers=1');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].bookCode, 'SDAH');
  assert.equal(filtered[0].number, 1);
});

test('SPEC-60: GET /api/hymns 404s when book_code is not registered in song_books', async () => {
  const res = await json(`${base}/api/hymns?book_code=UNREGISTERED_BOOK`, 'GET', undefined, { cookie });
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'Song book not found');

  const resCamel = await json(`${base}/api/hymns?bookCode=UNREGISTERED_BOOK`, 'GET', undefined, { cookie });
  assert.equal(resCamel.status, 404);
  assert.equal(resCamel.body.error, 'Song book not found');
});
