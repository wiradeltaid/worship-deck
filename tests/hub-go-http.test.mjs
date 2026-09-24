/**
 * Remaining Hub verbs on the Go API: hymns, scripture,
 * admin settings/accounts/registry, webhook intake.
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-go-http-'));
const dbPath = path.join(tmp, 'test.db');
const AUTH_SECRET = createHash('sha256').update('hub-go-http-secret').digest('hex');
const WEBHOOK_SECRET = 'hub-go-webhook-secret';
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
      WEBHOOK_SECRET,
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

test('retired /api/announcements routes return 404 for all verbs', async () => {
  const verbs = ['GET', 'POST', 'PUT'];
  for (const method of verbs) {
    const res = await json(`${base}/api/announcements`, method, method === 'GET' ? undefined : {});
    assert.equal(res.status, 404, `${method} /api/announcements expected 404, got ${res.status}`);
  }
  const itemVerbs = ['GET', 'PATCH', 'DELETE'];
  for (const method of itemVerbs) {
    const res = await json(`${base}/api/announcements/123`, method, method === 'GET' ? undefined : {});
    assert.equal(res.status, 404, `${method} /api/announcements/123 expected 404, got ${res.status}`);
  }
});

test('GET /api/hymns returns seeded SDAH entries', async () => {
  const res = await json(`${base}/api/hymns?q=159`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.hymns));
  assert.ok(res.body.hymns.some((h) => h.number === 159));
});

test('GET /api/scripture looks up a KJV verse from the bootstrapped corpus', async () => {
  const res = await json(`${base}/api/scripture?ref=John+3:16&translation=KJV`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(typeof res.body.text, 'string');
  assert.ok(res.body.text.length > 0);
});

test('GET /api/scripture matches Song of Solomon and echoes the canonical name', async () => {
  const res = await json(
    `${base}/api/scripture?ref=${encodeURIComponent('Song of Solomon 1:1')}&translation=KJV`
  );
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.match(res.body.reference, /^Song of Solomon 1:1$/);
});

test('GET /api/scripture aliases ps to Psalms and does not echo the typed form', async () => {
  const res = await json(`${base}/api/scripture?ref=ps+23:1&translation=KJV`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.reference, 'Psalms 23:1');
});

test('GET /api/scripture?q= suggests John and not 1 John', async () => {
  const res = await json(`${base}/api/scripture?q=jo&translation=KJV`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.translation, 'KJV');
  const names = (res.body.suggestions || []).map((s) => s.name);
  assert.ok(names.includes('John'), JSON.stringify(names));
  assert.ok(!names.includes('1 John'), JSON.stringify(names));
});

test('GET /api/scripture?q= stays empty for a complete reference', async () => {
  const res = await json(
    `${base}/api/scripture?q=${encodeURIComponent('John 3:16')}&translation=KJV`
  );
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.suggestions, []);
});

test('GET /api/scripture without ref or q is 400', async () => {
  const res = await json(`${base}/api/scripture`);
  assert.equal(res.status, 400);
});

test('GET /api/admin/settings and accounts and artifacts on a fresh hub', async () => {
  const settings = await json(`${base}/api/admin/settings`);
  assert.equal(settings.status, 200);
  assert.equal(typeof settings.body.pptx_retention_days, 'number');
  assert.ok(['en', 'id'].includes(settings.body.ui_locale));
  assert.equal(settings.body.default_bible_translation, 'KJV');
  assert.equal(settings.body.default_bible_translation_resolved, 'KJV');
  assert.equal(settings.body.default_bible_translation_installed, true);

  const accounts = await json(`${base}/api/admin/accounts`);
  assert.equal(accounts.status, 200);
  assert.ok(accounts.body.accounts.some((a) => a.username === BOOTSTRAP_USER));

  const artifacts = await json(`${base}/api/admin/artifacts`);
  assert.equal(artifacts.status, 200);
  assert.ok(artifacts.body.templates.length > 0);
});

test('POST /api/webhook returns 503 because webhook intake is disabled in code (WSD-H-05)', async () => {
  const res = await json(
    `${base}/api/webhook`,
    'POST',
    {
      text: [
        'SABBATH, JUNE 6, 2026',
        'DIVINE SERVICE',
        'Opening Song: SDAH #159',
        'Sermon: Pastor Ada',
      ].join('\n'),
      images: ['https://example.com/a.png', 'http://127.0.0.1/evil.png'],
    },
    { 'x-webhook-secret': WEBHOOK_SECRET }
  );
  assert.equal(res.status, 503, JSON.stringify(res.body));
  assert.equal(res.body.error, 'Webhook intake is disabled in this release');
});

test('GET /api/scripture returns 400 for an unknown translation', async () => {
  const res = await json(`${base}/api/scripture?ref=John+3:16&translation=NIV`);
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Unknown bible translation "NIV"/);
});

test('GET /api/bible-translations lists installed corpora with locale and no filter', async () => {
  const res = await json(`${base}/api/bible-translations`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(Array.isArray(res.body.translations));
  const kjv = res.body.translations.find((row) => row.code === 'KJV');
  assert.ok(kjv, JSON.stringify(res.body.translations));
  assert.equal(kjv.locale, 'en');
  assert.equal(typeof kjv.name, 'string');
  assert.equal(typeof kjv.licence, 'string');
  assert.equal(typeof kjv.provenance, 'string');
  assert.equal(res.body.default_bible_translation_resolved, 'KJV');
});

test('an uninstalled default_bible_translation is inert and not rewritten', async () => {
  const put = await json(`${base}/api/admin/settings`, 'PUT', {
    default_bible_translation: 'NIV',
  });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal(put.body.default_bible_translation, 'NIV');
  assert.equal(put.body.default_bible_translation_installed, false);
  assert.equal(put.body.default_bible_translation_resolved, 'KJV');

  const lookup = await json(`${base}/api/scripture?ref=John+3:16`);
  assert.equal(lookup.status, 200, JSON.stringify(lookup.body));
  assert.equal(lookup.body.translation, 'KJV');

  const listed = await json(`${base}/api/bible-translations`);
  assert.equal(listed.body.default_bible_translation, 'NIV');
  assert.equal(listed.body.default_bible_translation_installed, false);
  assert.equal(listed.body.default_bible_translation_resolved, 'KJV');

  const restore = await json(`${base}/api/admin/settings`, 'PUT', {
    default_bible_translation: 'KJV',
  });
  assert.equal(restore.status, 200);
  assert.equal(restore.body.default_bible_translation, 'KJV');
  assert.equal(restore.body.default_bible_translation_installed, true);
});

test('PUT /api/admin/settings accepts ui_locale and rejects unknown values', async () => {
  const ok = await json(`${base}/api/admin/settings`, 'PUT', { ui_locale: 'id' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.ui_locale, 'id');

  const empty = await json(`${base}/api/admin/settings`, 'PUT', {});
  assert.equal(empty.status, 400);

  const bad = await json(`${base}/api/admin/settings`, 'PUT', {
    ui_locale: 'fr',
    slide_transition: 'push',
  });
  assert.equal(bad.status, 400);
  assert.match(String(bad.body.error), /en|id/);

  const got = await json(`${base}/api/admin/settings`);
  assert.equal(got.body.ui_locale, 'id');
  assert.notEqual(got.body.slide_transition, 'push');
});

test('GET /api/scripture returns 503 when the translation table is empty', async () => {
  const database = new Database(dbPath);
  try {
    database.prepare('DELETE FROM bible_verses WHERE translation_code = ?').run('KJV');
  } finally {
    database.close();
  }
  const res = await json(`${base}/api/scripture?ref=John+3:16&translation=KJV`);
  assert.equal(res.status, 503);
  assert.match(res.body.error, /KJV corpus is empty/);
  assert.match(res.body.error, /reconciled from that file on boot/);
});
