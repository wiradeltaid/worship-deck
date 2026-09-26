/**
 * POST /api/services/{id}/song-sets/{variableName}/save-to-book — the explicit
 * "Save to Song Book" action (UC-28 alternate flow, SCN-4, DEC-005 / AD-36).
 *
 * Ships in the same data_version step (6) as the upsertHymns bootstrap-once
 * change; the corpus-side semantics live in tests/dec005-song-book.test.mjs.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs';
import http from 'http';
import net from 'net';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { stopProcess } from './helpers/go-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'save-to-book-go-http-'));
const dbPath = path.join(tmp, 'test.db');
const AUTH_SECRET = createHash('sha256').update('save-to-book-secret').digest('hex');
const BOOTSTRAP_USER = 'admin';
const BOOTSTRAP_PASS = 'bootstrap-pass-99';

function fetchRaw(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { ...(opts.headers || {}) };
    if (opts.body) {
      headers['Content-Length'] = String(Buffer.byteLength(opts.body));
    }
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: opts.method || 'GET',
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      }
    );
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function cookieFrom(headers) {
  const raw = headers['set-cookie'];
  if (!raw) return '';
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((c) => String(c).split(';')[0]).join('; ');
}

let child;
let base;
let cookie = '';
const output = [];

before(async () => {
  const port = await reservePort();
  child = spawn('go', ['run', './cmd/api'], {
    cwd: root,
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      AUTH_SECRET,
      AUTH_BOOTSTRAP_USER: BOOTSTRAP_USER,
      AUTH_BOOTSTRAP_PASSWORD: BOOTSTRAP_PASS,
      REPO_ROOT: root,
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (c) => output.push(c.toString()));
  child.stderr.on('data', (c) => output.push(c.toString()));
  base = `http://127.0.0.1:${port}`;
  let lastErr;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetchRaw(`${base}/login`);
      if (res.status && res.status < 500) {
        const login = await fetchRaw(`${base}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: BOOTSTRAP_USER, password: BOOTSTRAP_PASS }),
        });
        assert.equal(login.status, 200, login.body);
        cookie = cookieFrom(login.headers);
        return;
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Go API did not become ready: ${lastErr}\n${output.join('')}`);
});

after(() => {
  stopProcess(child);
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

async function json(url, method = 'GET', body, extraHeaders = {}) {
  const headers = { Cookie: cookie, ...extraHeaders };
  const raw = body === undefined ? undefined : JSON.stringify(body);
  if (raw !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetchRaw(url, { method, headers, body: raw });
  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    parsed = res.body;
  }
  return { status: res.status, body: parsed };
}

function withDb(fn) {
  const database = new Database(dbPath);
  try {
    return fn(database);
  } finally {
    database.close();
  }
}

function storedLyrics(number) {
  return withDb(
    (d) =>
      d.prepare(`SELECT lyrics FROM hymns WHERE book_code = 'SDAH' AND number = ?`).get(number)
        ?.lyrics
  );
}

const ROUTE = (id, variableName) =>
  `${base}/api/services/${id}/song-sets/${variableName}/save-to-book`;

let serviceId;

test('setup: create the Service under test', async () => {
  const created = await json(`${base}/api/services`, 'POST', {
    raw_payload: [
      'SABBATH, JUNE 6, 2026',
      'DIVINE SERVICE',
      'Opening Song: SDAH #159',
      'Sermon: Pastor Ada',
    ].join('\n'),
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  serviceId = created.body.id;
  assert.ok(serviceId > 0);
});

test('save-to-book is gated: no session means 401 and no write', async () => {
  const before = storedLyrics(159);
  const res = await fetchRaw(ROUTE(serviceId, 'opening_song_bt'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'x', songNumber: 159 }),
  });
  assert.equal(res.status, 401);
  assert.equal(storedLyrics(159), before);
});

test('happy path writes the corrected text into hymns.lyrics', async () => {
  withDb((d) =>
    d
      .prepare(
        `INSERT INTO song_set_inputs (service_id, variable_name, song_number, updated_at)
         VALUES (?, 'opening_song_bt', 159, '2026-06-06T00:00:00Z')`
      )
      .run(serviceId)
  );
  const res = await json(ROUTE(serviceId, 'opening_song_bt'), 'POST', {
    text: 'corrected lyrics\n\nsecond slide',
    songNumber: 159,
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.song.number, 159);
  assert.equal(res.body.song.book_code, 'SDAH');
  assert.match(storedLyrics(159), /corrected lyrics/);
});

test('a moved song number refuses with 409 and leaves the book untouched (SCN-4)', async () => {
  const before = storedLyrics(159);
  // The entry now resolves to a different hymn than the editor showed.
  withDb((d) =>
    d
      .prepare(
        `UPDATE song_set_inputs SET song_number = 447 WHERE service_id = ? AND variable_name = 'opening_song_bt'`
      )
      .run(serviceId)
  );
  const res = await json(ROUTE(serviceId, 'opening_song_bt'), 'POST', {
    text: 'stale editor text',
    songNumber: 159,
  });
  assert.equal(res.status, 409);
  assert.match(String(res.body.error), /song changed under you/);
  assert.equal(storedLyrics(159), before, 'the shown hymn must not be written');
  assert.notEqual(storedLyrics(447), 'stale editor text');
});

test('a mismatched songBookCode also refuses with 409', async () => {
  const res = await json(ROUTE(serviceId, 'opening_song_bt'), 'POST', {
    text: 'wrong book',
    songNumber: 447,
    songBookCode: 'CHY',
  });
  assert.equal(res.status, 409);
});

test('empty or whitespace-only lyrics are refused with 400 and leave the book untouched', async () => {
  const before = storedLyrics(447);
  // Empty string
  const emptyRes = await json(ROUTE(serviceId, 'opening_song_bt'), 'POST', {
    text: '',
    songNumber: 447,
  });
  assert.equal(emptyRes.status, 400);
  assert.match(String(emptyRes.body.error), /text is required and cannot be empty/);
  assert.equal(storedLyrics(447), before);

  // Whitespace-only string
  const wsRes = await json(ROUTE(serviceId, 'opening_song_bt'), 'POST', {
    text: '   \n\t  ',
    songNumber: 447,
  });
  assert.equal(wsRes.status, 400);
  assert.match(String(wsRes.body.error), /text is required and cannot be empty/);
  assert.equal(storedLyrics(447), before);

  // Missing text property
  const missingRes = await json(ROUTE(serviceId, 'opening_song_bt'), 'POST', {
    songNumber: 447,
  });
  assert.equal(missingRes.status, 400);
  assert.match(String(missingRes.body.error), /text is required and cannot be empty/);
  assert.equal(storedLyrics(447), before);
});

test('an unknown variable_name is 400; a null song number is 400', async () => {
  const missingEntry = await json(ROUTE(serviceId, 'no_such_entry'), 'POST', {
    text: 'x',
    songNumber: 159,
  });
  assert.equal(missingEntry.status, 400);

  withDb((d) =>
    d
      .prepare(
        `INSERT INTO song_set_inputs (service_id, variable_name, song_number, updated_at)
         VALUES (?, 'closing_song_bt', NULL, '2026-06-06T00:00:00Z')`
      )
      .run(serviceId)
  );
  const noNumber = await json(ROUTE(serviceId, 'closing_song_bt'), 'POST', {
    text: 'x',
    songNumber: 159,
  });
  assert.equal(noNumber.status, 400);
});

test('a song number that resolves to no hymn row is 400', async () => {
  withDb((d) =>
    d
      .prepare(
        `UPDATE song_set_inputs SET song_number = 99999 WHERE service_id = ? AND variable_name = 'opening_song_bt'`
      )
      .run(serviceId)
  );
  const res = await json(ROUTE(serviceId, 'opening_song_bt'), 'POST', {
    text: 'x',
    songNumber: 99999,
  });
  assert.equal(res.status, 400);
  assert.match(String(res.body.error), /[Uu]nknown hymn/);
});

test('missing or malformed body fields are 400', async () => {
  withDb((d) =>
    d
      .prepare(
        `UPDATE song_set_inputs SET song_number = 159 WHERE service_id = ? AND variable_name = 'opening_song_bt'`
      )
      .run(serviceId)
  );
  const noNumber = await json(ROUTE(serviceId, 'opening_song_bt'), 'POST', {
    text: 'x',
  });
  assert.equal(noNumber.status, 400);

  const badNumber = await json(ROUTE(serviceId, 'opening_song_bt'), 'POST', {
    text: 'x',
    songNumber: '159',
  });
  assert.equal(badNumber.status, 400);
});
