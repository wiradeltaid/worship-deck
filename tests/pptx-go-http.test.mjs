/**
 * FR-14: Go GET /api/services/{id}/pptx assembles the plan and execs the worker.
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
import { fileURLToPath, pathToFileURL } from 'url';
import { stopProcess } from './helpers/go-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-go-http-'));
const dbPath = path.join(tmp, 'test.db');
const AUTH_SECRET = createHash('sha256').update('pptx-go-http-secret').digest('hex');

process.env.DB_PATH = dbPath;
process.env.AUTH_SECRET = AUTH_SECRET;
delete process.env.IMAGE_URL_ALLOWLIST;

const srcUrl = (...parts) => pathToFileURL(path.join(root, 'src', ...parts)).href;

const { getDb } = await import(srcUrl('lib', 'db', 'index.ts'));
const { createAccount, getAccountByUsername } = await import(
  srcUrl('lib', 'auth', 'accounts.ts')
);
const { signSession, SESSION_COOKIE } = await import(
  srcUrl('lib', 'auth', 'session.ts')
);
const { parseRundown } = await import(srcUrl('lib', 'parser.ts'));

const OPERATOR = {
  username: 'pptx-operator',
  password: 'pw-operator-99',
  role: 'operator',
};
createAccount(OPERATOR);
const account = getAccountByUsername(OPERATOR.username);
const cookie = await signSession({
  uid: account.id,
  role: account.role,
  tv: account.token_version,
});

const parsed = parseRundown(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-rundown.txt'), 'utf8')
);
parsed.verseReading = {
  reference: 'Romans 12:2, NKJV',
  text: 'Do not be conformed to this world, but be transformed.',
};
parsed.specialSong = 'The Sanjaya Family Quartet';
parsed.sermon = {
  speaker: 'Ps. Timotius Wicaksana',
  title: 'Rooted And Rising',
};
parsed.closingPrayerPerson = 'Mr. Tirta Baskara';
parsed.familyPrayerRequest = 'Pray for the Prasetya family as they move house';
parsed.youthPrayerRequest = 'Pray for the youth camp in Lembang';

const db = getDb();
const inserted = db
  .prepare(
    `INSERT INTO services (date, raw_payload, parsed_data) VALUES (?, ?, ?)`
  )
  .run('2026-07-11', 'synthetic-rundown', JSON.stringify(parsed));
const serviceId = Number(inserted.lastInsertRowid);

function fetchRaw(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'GET',
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        );
      }
    );
    req.on('error', reject);
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

let child;
let base;
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
      REPO_ROOT: root,
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
      if (res.status && res.status < 500) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Go API did not become ready: ${lastErr}\n${output.join('')}`
  );
});

after(() => {
  stopProcess(child);
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

test('signed-in operator downloads an offline PPTX from Go', async () => {
  const res = await fetchRaw(`${base}/api/services/${serviceId}/pptx`, {
    cookie: `${SESSION_COOKIE}=${cookie}`,
  });
  assert.equal(res.status, 200, res.body.toString('utf8').slice(0, 500) + '\n' + output.join(''));
  assert.match(
    String(res.headers['content-type'] || ''),
    /presentationml.presentation/
  );
  assert.equal(res.body.subarray(0, 2).toString(), 'PK');
  const { default: JSZip } = await import(
    pathToFileURL(path.join(root, 'node_modules', 'jszip', 'lib', 'index.js')).href
  );
  const zip = await JSZip.loadAsync(res.body);
  const parts = Object.keys(zip.files).filter((n) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(n)
  );
  assert.ok(parts.length > 5, `expected several slides, got ${parts.length}`);
  let text = '';
  for (const name of parts) {
    text += await zip.file(name).async('string');
  }
  assert.ok(text.includes('2026-07-11'), 'welcome date missing from deck');
  assert.ok(text.includes('Romans 12:2'), 'verse citation missing from deck');
});

test('anonymous GET pptx is 401', async () => {
  const res = await fetchRaw(`${base}/api/services/${serviceId}/pptx`);
  assert.equal(res.status, 401);
});

test('SPEC-78: GET /api/services/{id}/pptx defaults to word wrap enabled (wrap="square")', async () => {
  const res = await fetchRaw(`${base}/api/services/${serviceId}/pptx`, {
    cookie: `${SESSION_COOKIE}=${cookie}`,
  });
  assert.equal(res.status, 200);
  const { default: JSZip } = await import(
    pathToFileURL(path.join(root, 'node_modules', 'jszip', 'lib', 'index.js')).href
  );
  const zip = await JSZip.loadAsync(res.body);
  const slide1Xml = await zip.file('ppt/slides/slide1.xml').async('string');
  const bodyPrMatches = slide1Xml.match(/<a:bodyPr[^>]*>/g) || [];
  assert.ok(bodyPrMatches.length > 0, 'expected slide 1 text bodyPr elements');
  for (const b of bodyPrMatches) {
    assert.match(b, /wrap="square"/);
    assert.doesNotMatch(b, /wrap="none"/);
  }
});

test('SPEC-78: GET /api/services/{id}/pptx?wrap=false disables word wrap (wrap="none")', async () => {
  const res = await fetchRaw(`${base}/api/services/${serviceId}/pptx?wrap=false`, {
    cookie: `${SESSION_COOKIE}=${cookie}`,
  });
  assert.equal(res.status, 200);
  const { default: JSZip } = await import(
    pathToFileURL(path.join(root, 'node_modules', 'jszip', 'lib', 'index.js')).href
  );
  const zip = await JSZip.loadAsync(res.body);
  const slide1Xml = await zip.file('ppt/slides/slide1.xml').async('string');
  const bodyPrMatches = slide1Xml.match(/<a:bodyPr[^>]*>/g) || [];
  assert.ok(bodyPrMatches.length > 0, 'expected slide 1 text bodyPr elements');
  for (const b of bodyPrMatches) {
    assert.match(b, /wrap="none"/);
    assert.doesNotMatch(b, /wrap="square"/);
  }
});

test('SPEC-78: GET /api/services/{id}/pptx?wrap=0 disables word wrap (wrap="none")', async () => {
  const res = await fetchRaw(`${base}/api/services/${serviceId}/pptx?wrap=0`, {
    cookie: `${SESSION_COOKIE}=${cookie}`,
  });
  assert.equal(res.status, 200);
  const { default: JSZip } = await import(
    pathToFileURL(path.join(root, 'node_modules', 'jszip', 'lib', 'index.js')).href
  );
  const zip = await JSZip.loadAsync(res.body);
  const slide1Xml = await zip.file('ppt/slides/slide1.xml').async('string');
  const bodyPrMatches = slide1Xml.match(/<a:bodyPr[^>]*>/g) || [];
  assert.ok(bodyPrMatches.length > 0, 'expected slide 1 text bodyPr elements');
  for (const b of bodyPrMatches) {
    assert.match(b, /wrap="none"/);
  }
});
