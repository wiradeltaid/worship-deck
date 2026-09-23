/**
 * Go API gate: gated JSON is 401 without a session; exempt paths are not.
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'go-http-gate-'));
const dbPath = path.join(tmp, 'test.db');
const AUTH_SECRET = createHash('sha256').update('go-http-gate-secret').digest('hex');

process.env.DB_PATH = dbPath;
process.env.AUTH_SECRET = AUTH_SECRET;

const { getDb } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href
);
getDb();

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'GET',
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
  for (let i = 0; i < 60; i++) {
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

test('unauthenticated API returns 401', async () => {
  const res = await fetchRaw(`${base}/api/services`);
  assert.equal(res.status, 401);
  assert.match(res.body, /Unauthorized/);
  assert.match(String(res.headers['cache-control'] || ''), /no-store/);
});

test('exempt login API is not 401 for a missing cookie', async () => {
  const res = await fetchRaw(`${base}/api/auth/login`);
  assert.notEqual(res.status, 401);
});

test('a prefix lookalike of an exempt path stays gated', async () => {
  const res = await fetchRaw(`${base}/api/webhookfoo`);
  assert.equal(res.status, 401);
});

test('unauthenticated GET /branding asset returns 200 with SVG content (SPEC-66)', async () => {
  const res = await fetchRaw(`${base}/branding/worship-deck-icon-square.svg`);
  assert.equal(res.status, 200);
  assert.match(String(res.headers['content-type'] || ''), /^image\/svg\+xml/);
  assert.match(res.body, /<svg/);
});

test('prefix lookalike of /branding stays gated (SPEC-66)', async () => {
  const res = await fetchRaw(`${base}/brandingfoo`);
  assert.equal(res.status, 307);
  assert.match(String(res.headers['location'] || ''), /^\/login\?next=/);
});

test('GET pptx is gated', async () => {
  const res = await fetchRaw(`${base}/api/services/1/pptx`);
  assert.equal(res.status, 401);
});

// What this proves, and what it does not: a 401 here can come from the gate OR
// from the handler's own sessionFrom check, and both are present by design.
// The proof that these paths are inside the AD-5 boundary is
// `internal/gate/gate_test.go`, which fails when a path is exempted; this test
// still passes in that state because the handler catches it. Verified by
// injecting `/api/present` into exemptPrefixes on 2026-08-22.
test('every remote control path is gated (401 without a session)', async () => {
  const paths = [
    { path: '/api/present/1/remote/pair', method: 'POST' },
    { path: '/api/present/1/remote/claim', method: 'POST' },
    { path: '/api/present/1/remote/stream', method: 'GET' },
    { path: '/api/present/1/remote/intent', method: 'POST' },
    { path: '/api/present/1/remote/pair', method: 'DELETE' },
  ];
  for (const { path: p, method } of paths) {
    const u = new URL(`${base}${p}`);
    const res = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname,
          method,
          headers: { Accept: 'application/json' },
        },
        (r) => {
          const chunks = [];
          r.on('data', (c) => chunks.push(c));
          r.on('end', () =>
            resolve({
              status: r.statusCode,
              headers: r.headers,
              body: Buffer.concat(chunks).toString('utf8'),
            })
          );
        }
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(res.status, 401, `${method} ${p} must be 401 without session`);
    assert.match(res.body, /Unauthorized/);
  }
});
