/**
 * HTTP contract for `/api/services` against the Go API.
 * Status codes and JSON bodies must match the Next handlers.
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
import { stopProcess } from './helpers/go-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'services-go-http-'));
const dbPath = path.join(tmp, 'test.db');
const AUTH_SECRET = createHash('sha256').update('services-go-http-secret').digest('hex');
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

const SERVICES_URL = () => `${base}/api/services`;
const itemUrl = (id) => `${SERVICES_URL()}/${id}`;
const UNSAFE_IMAGE = 'http://127.0.0.1/evil.png';
const RAW = (dateLine, extra = '') =>
  [
    dateLine,
    'DIVINE SERVICE',
    'Opening Song: SDAH #159',
    'Sermon: Pastor Adam',
    'Closing Prayer: The Speaker',
    ...(extra ? [extra] : []),
  ].join('\n');

async function envelope(url, method = 'GET', rawBody) {
  const headers = { Cookie: cookie };
  if (rawBody !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetchRaw(url, { method, headers, body: rawBody });
  let body;
  try {
    body = JSON.parse(res.body);
  } catch {
    body = res.body;
  }
  return { status: res.status, body };
}

const getServices = (search = '') => envelope(`${SERVICES_URL()}${search}`);
const postRaw = (rawBody) => envelope(SERVICES_URL(), 'POST', rawBody);
const post = (body) => postRaw(JSON.stringify(body));
const putRaw = (id, rawBody) => envelope(itemUrl(id), 'PUT', rawBody);
const put = (id, body) => putRaw(id, JSON.stringify(body));
const del = (id, body) =>
  envelope(
    itemUrl(id),
    'DELETE',
    body === undefined ? undefined : JSON.stringify(body)
  );
const getOne = (id) => envelope(itemUrl(id));

async function createdService(body) {
  const res = await post(body);
  assert.equal(res.status, 201, `setup create failed: ${JSON.stringify(res.body)}`);
  return res.body.id;
}

async function tokenOf(id) {
  const { body } = await getServices();
  const found = body.services.find((s) => s.id === id);
  assert.ok(found, `service ${id} missing from GET /api/services`);
  return found.updated_at;
}

async function storedImages(id) {
  const { body, status } = await getOne(id);
  assert.equal(status, 200);
  return body.images_payload;
}

const sortedKeys = (obj) => Object.keys(obj).sort();

test('GET returns the { services, q, count } envelope', async () => {
  const id = await createdService({ raw_payload: RAW('SABBATH, JANUARY 3, 2026') });
  const { status, body } = await getServices();
  assert.equal(status, 200);
  assert.deepEqual(sortedKeys(body), ['count', 'q', 'services']);
  assert.equal(body.q, null);
  assert.ok(Array.isArray(body.services));
  assert.equal(body.count, body.services.length);
  assert.ok(body.count >= 1);
  const item = body.services.find((s) => s.id === id);
  assert.ok(item);
  assert.deepEqual(sortedKeys(item), [
    'created_at',
    'date',
    'id',
    'parsed_data',
    'raw_payload',
    'updated_at',
  ]);
  assert.equal(item.date, '2026-01-03');
  assert.equal(typeof item.raw_payload, 'string');
  assert.equal(typeof item.updated_at, 'string');
  assert.ok(item.parsed_data && typeof item.parsed_data === 'object');
});

test('GET /api/services/{id} returns verbatim raw_payload with unicode, emoji, and formatting over HTTP', async () => {
  const verbatim = `  SABBATH, DECEMBER 12, 2026
  DIVINE SERVICE 🎉

• Welcome Visitors
• Offertory: Special Offering
• Special Music: Youth Choir "Amazing Grace"

Pastoral Notes:
— Practice at 4:30 PM.`;

  const id = await createdService({ raw_payload: verbatim });
  const one = await getOne(id);
  assert.equal(one.status, 200);
  assert.equal(one.body.raw_payload, verbatim, 'raw_payload must be returned verbatim over HTTP');
});

test('GET ?q= LIKE-matches the date and the raw payload', async () => {
  const id = await createdService({
    raw_payload: RAW('SABBATH, JANUARY 10, 2026', 'http-token-january-ten'),
  });
  const byDate = await getServices('?q=2026-01-10');
  assert.equal(byDate.status, 200);
  assert.equal(byDate.body.q, '2026-01-10');
  assert.deepEqual(
    byDate.body.services.map((s) => s.id),
    [id]
  );
  const byRaw = await getServices('?q=http-token-january-ten');
  assert.equal(byRaw.status, 200);
  assert.deepEqual(
    byRaw.body.services.map((s) => s.id),
    [id]
  );
  const noMatch = await getServices('?q=zzz-no-such-service-zzz');
  assert.equal(noMatch.status, 200);
  assert.deepEqual(noMatch.body, {
    services: [],
    q: 'zzz-no-such-service-zzz',
    count: 0,
  });
  const blank = await getServices('?q=%20%20');
  assert.equal(blank.status, 200);
  assert.equal(blank.body.q, null);
  assert.ok(blank.body.count >= 1);
});

test('POST valid rundown returns 201 with the create envelope', async () => {
  const { status, body } = await post({
    raw_payload: RAW('SABBATH, JANUARY 17, 2026'),
  });
  assert.equal(status, 201);
  assert.deepEqual(sortedKeys(body), [
    'date',
    'failedHymnNumbers',
    'id',
    'message',
  ]);
  assert.equal(body.message, 'Service created successfully');
  assert.ok(Number.isInteger(body.id) && body.id > 0);
  assert.equal(body.date, '2026-01-17');
  assert.deepEqual(body.failedHymnNumbers, []);
});

test('POST reports unresolved hymn numbers in failedHymnNumbers', async () => {
  const { status, body } = await post({
    raw_payload: `SABBATH, JANUARY 24, 2026
DIVINE SERVICE
Opening Song: SDAH #9999
Sermon: Pastor Adam`,
  });
  assert.equal(status, 201);
  assert.deepEqual(body.failedHymnNumbers, [9999]);
});

test('POST malformed JSON returns 400 Invalid JSON', async () => {
  const { status, body } = await postRaw('{not json');
  assert.equal(status, 400);
  assert.deepEqual(body, { error: 'Invalid JSON' });
});

test('POST non-object body returns 400 Invalid body', async () => {
  for (const raw of ['5', '"a string"', '[1,2]', 'null', 'true']) {
    const { status, body } = await postRaw(raw);
    assert.equal(status, 400, raw);
    assert.deepEqual(body, { error: 'Invalid body' }, raw);
  }
});

test('POST without raw_payload returns 400 raw_payload is required', async () => {
  for (const payload of [{}, { raw_payload: '   ' }, { raw_payload: 42 }]) {
    const { status, body } = await post(payload);
    assert.equal(status, 400, JSON.stringify(payload));
    assert.deepEqual(body, { error: 'raw_payload is required' });
  }
});

test('POST undated rundown returns 400 with the date message', async () => {
  const { status, body } = await post({
    raw_payload: 'no date anywhere in this text',
  });
  assert.equal(status, 400);
  assert.deepEqual(body, {
    error: 'Could not parse service date from raw_payload',
  });
});

test('POST on a taken date returns 409, allowSecond returns 201', async () => {
  const firstId = await createdService({
    raw_payload: RAW('SABBATH, FEBRUARY 7, 2026'),
  });
  const collision = await post({ raw_payload: RAW('SABBATH, FEBRUARY 7, 2026') });
  assert.equal(collision.status, 409);
  assert.deepEqual(collision.body, {
    error: 'Service already exists for this date',
    existingId: firstId,
    date: '2026-02-07',
  });
  const second = await post({
    raw_payload: RAW('SABBATH, FEBRUARY 7, 2026'),
    allowSecond: true,
  });
  assert.equal(second.status, 201);
  assert.equal(second.body.date, '2026-02-07');
  assert.notEqual(second.body.id, firstId);
});

test('PUT with a matching updated_at returns 200 with the update envelope', async () => {
  const id = await createdService({ raw_payload: RAW('SABBATH, MARCH 7, 2026') });
  const { status, body } = await put(id, {
    updated_at: await tokenOf(id),
    raw_payload: RAW('SABBATH, MARCH 7, 2026', 'edited-over-http'),
    participantsRaw: 'Elder: Ada',
  });
  assert.equal(status, 200);
  assert.deepEqual(sortedKeys(body), [
    'failedHymnNumbers',
    'message',
    'updated_at',
  ]);
  assert.equal(body.message, 'Service updated successfully');
  assert.deepEqual(body.failedHymnNumbers, []);
  const one = await getOne(id);
  assert.match(one.body.raw_payload, /edited-over-http/);
});

test('PUT malformed JSON returns 400 Invalid JSON instead of 500', async () => {
  const id = await createdService({ raw_payload: RAW('SABBATH, MARCH 14, 2026') });
  const { status, body } = await putRaw(id, '{not json');
  assert.equal(status, 400);
  assert.deepEqual(body, { error: 'Invalid JSON' });
});

test('PUT non-object body returns 400 Invalid body', async () => {
  const id = await createdService({ raw_payload: RAW('SABBATH, MARCH 21, 2026') });
  const { status, body } = await putRaw(id, '"a string"');
  assert.equal(status, 400);
  assert.deepEqual(body, { error: 'Invalid body' });
});

test('PUT without updated_at returns the concurrency 400', async () => {
  const id = await createdService({ raw_payload: RAW('SABBATH, MARCH 28, 2026') });
  for (const payload of [
    { raw_payload: RAW('SABBATH, MARCH 28, 2026') },
    { updated_at: '   ', raw_payload: RAW('SABBATH, MARCH 28, 2026') },
    { updated_at: 7, raw_payload: RAW('SABBATH, MARCH 28, 2026') },
  ]) {
    const { status, body } = await put(id, payload);
    assert.equal(status, 400, JSON.stringify(payload));
    assert.deepEqual(body, {
      error: 'updated_at is required for concurrent edit protection',
    });
  }
});

test('PUT with neither raw_payload nor structured fields returns 400', async () => {
  const id = await createdService({ raw_payload: RAW('SABBATH, APRIL 4, 2026') });
  const { status, body } = await put(id, { updated_at: await tokenOf(id) });
  assert.equal(status, 400);
  assert.deepEqual(body, { error: 'Missing raw_payload or structured fields' });
});

test('PUT on an unknown id returns 404 Service not found', async () => {
  const { status, body } = await put(999999, {
    updated_at: '2026-01-01 00:00:00',
    raw_payload: RAW('SABBATH, APRIL 11, 2026'),
  });
  assert.equal(status, 404);
  assert.deepEqual(body, { error: 'Service not found' });
});

test('PUT with a stale updated_at returns 409 and leaves the row unchanged', async () => {
  const id = await createdService({ raw_payload: RAW('SABBATH, APRIL 18, 2026') });
  const before = await getOne(id);
  const currentToken = await tokenOf(id);
  const { status, body } = await put(id, {
    updated_at: '1999-01-01 00:00:00',
    raw_payload: RAW('SABBATH, APRIL 18, 2026', 'must-not-persist'),
  });
  assert.equal(status, 409);
  assert.deepEqual(body, {
    error: 'Conflict: service was modified; refresh and retry',
    updated_at: currentToken,
  });
  const after = await getOne(id);
  assert.equal(after.body.raw_payload, before.body.raw_payload);
  assert.equal(await tokenOf(id), currentToken);
});

test('PUT keeps the stored image payload when the body omits images', async () => {
  const id = await createdService({
    raw_payload: RAW('SABBATH, APRIL 25, 2026'),
    images: ['https://example.com/a.png'],
    sermonGraphicUrl: 'https://example.com/sermon.png',
  });
  const kept = await put(id, {
    updated_at: await tokenOf(id),
    raw_payload: RAW('SABBATH, APRIL 25, 2026'),
    participantsRaw: 'Elder: Ada',
  });
  assert.equal(kept.status, 200);
  assert.deepEqual(await storedImages(id), {
    images: ['https://example.com/a.png'],
    sermonGraphicUrl: 'https://example.com/sermon.png',
    familyPhotoUrl: null,
    youthPhotoUrl: null,
  });
  const replaced = await put(id, {
    updated_at: await tokenOf(id),
    raw_payload: RAW('SABBATH, APRIL 25, 2026'),
    images: [],
  });
  assert.equal(replaced.status, 200);
  assert.deepEqual(await storedImages(id), {
    images: [],
    sermonGraphicUrl: 'https://example.com/sermon.png',
    familyPhotoUrl: null,
    youthPhotoUrl: null,
  });
});

test('PUT with an unsafe image URL returns 400 once the gates pass', async () => {
  const id = await createdService({ raw_payload: RAW('SABBATH, MAY 2, 2026') });
  const { status, body } = await put(id, {
    updated_at: await tokenOf(id),
    raw_payload: RAW('SABBATH, MAY 2, 2026'),
    sermonGraphicUrl: UNSAFE_IMAGE,
  });
  assert.equal(status, 400);
  assert.deepEqual(sortedKeys(body), ['error']);
  assert.match(body.error, /sermonGraphicUrl/);
});

test('DELETE without updated_at returns the concurrency 400', async () => {
  const id = await createdService({ raw_payload: RAW('SABBATH, MAY 8, 2026') });
  const missing = await del(id);
  assert.equal(missing.status, 400);
  assert.deepEqual(missing.body, {
    error: 'updated_at is required for concurrent edit protection',
  });
  const blank = await del(id, { updated_at: '   ' });
  assert.equal(blank.status, 400);
});

test('DELETE removes an existing service, then reports 404', async () => {
  const id = await createdService({ raw_payload: RAW('SABBATH, MAY 9, 2026') });
  const token = await tokenOf(id);
  const stale = await del(id, { updated_at: '1999-01-01 00:00:00' });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.updated_at, token);
  const removed = await del(id, { updated_at: token });
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.body, { message: 'Service deleted successfully' });
  const again = await del(id, { updated_at: token });
  assert.equal(again.status, 404);
  assert.deepEqual(again.body, { error: 'Service not found' });
  const unknown = await del(999999, { updated_at: token });
  assert.equal(unknown.status, 404);
  assert.deepEqual(unknown.body, { error: 'Service not found' });
});

test('two PUTs with the same token: only one writes (sub-second stamp)', async () => {
  const id = await createdService({ raw_payload: RAW('SABBATH, MAY 16, 2026') });
  const token = await tokenOf(id);
  const payload = {
    updated_at: token,
    raw_payload: RAW('SABBATH, MAY 16, 2026'),
  };
  const [a, b] = await Promise.all([put(id, payload), put(id, payload)]);
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [200, 409]);
  const winner = a.status === 200 ? a : b;
  assert.notEqual(winner.body.updated_at, token);
  assert.match(String(winner.body.updated_at), /\.\d{3}$/);
});

test('a non-numeric id returns 400 Invalid Service ID on PUT and DELETE', async () => {
  for (const id of ['abc', '0', '-1', '1.5', '1e3', ' 1', '01x']) {
    const removed = await del(id);
    assert.equal(removed.status, 400, `DELETE ${id}`);
    assert.deepEqual(removed.body, { error: 'Invalid Service ID' }, `DELETE ${id}`);
    const updated = await putRaw(id, '{not json');
    assert.equal(updated.status, 400, `PUT ${id}`);
    assert.deepEqual(updated.body, { error: 'Invalid Service ID' }, `PUT ${id}`);
  }
});

test('error precedence: the date 400 wins over a bad image URL on POST', async () => {
  const { status, body } = await post({
    raw_payload: 'no date anywhere in this text',
    sermonGraphicUrl: UNSAFE_IMAGE,
  });
  assert.equal(status, 400);
  assert.deepEqual(body, {
    error: 'Could not parse service date from raw_payload',
  });
});

test('error precedence: the 404 wins over a bad image URL on PUT', async () => {
  const { status, body } = await put(999999, {
    updated_at: '2026-01-01 00:00:00',
    raw_payload: RAW('SABBATH, MAY 16, 2026'),
    sermonGraphicUrl: UNSAFE_IMAGE,
  });
  assert.equal(status, 404);
  assert.deepEqual(body, { error: 'Service not found' });
});

test('error precedence: the 409 wins over a bad image URL on PUT', async () => {
  const id = await createdService({ raw_payload: RAW('SABBATH, MAY 23, 2026') });
  const currentToken = await tokenOf(id);
  const { status, body } = await put(id, {
    updated_at: '1999-01-01 00:00:00',
    raw_payload: RAW('SABBATH, MAY 23, 2026'),
    sermonGraphicUrl: UNSAFE_IMAGE,
  });
  assert.equal(status, 409);
  assert.deepEqual(body, {
    error: 'Conflict: service was modified; refresh and retry',
    updated_at: currentToken,
  });
});

test('GET /api/session returns the bootstrap operator', async () => {
  const { status, body } = await envelope(`${base}/api/session`);
  assert.equal(status, 200);
  assert.equal(body.username, BOOTSTRAP_USER);
  assert.equal(body.role, 'admin');
  assert.ok(['en', 'id'].includes(body.ui_locale));
});
