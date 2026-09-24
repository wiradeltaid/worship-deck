/**
 * Auth middleware HTTP against the Go API: unauthenticated API → 401;
 * webhook secret gate stays matcher-exempt.
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-http-test-'));
const dbPath = path.join(tmp, 'http.db');
const AUTH_SECRET = createHash('sha256')
  .update(`auth-http-${Date.now()}`)
  .digest('hex');
const WEBHOOK_SECRET = 'test-webhook-secret';

function fetchRaw(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: opts.method || 'GET',
        headers: opts.headers || {},
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
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

async function waitForServer(base, output, attempts = 80) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchRaw(`${base}/login`);
      if (res.status && res.status < 500) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Go API did not become ready: ${lastErr}\n${output.join('')}`);
}

let child;
let base;

function startServer(port) {
  const output = [];
  const proc = spawn('go', ['run', './cmd/api'], {
    cwd: root,
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      AUTH_SECRET,
      AUTH_BOOTSTRAP_USER: 'admin',
      AUTH_BOOTSTRAP_PASSWORD: 'bootstrap-pass-99',
      WEBHOOK_SECRET,
      REPO_ROOT: root,
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout.on('data', (c) => output.push(c.toString()));
  proc.stderr.on('data', (c) => output.push(c.toString()));
  return { proc, output };
}

before(async () => {
  const failures = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const port = await reservePort();
    const started = startServer(port);
    try {
      await waitForServer(`http://127.0.0.1:${port}`, started.output);
      child = started.proc;
      base = `http://127.0.0.1:${port}`;
      return;
    } catch (err) {
      stopProcess(started.proc);
      failures.push(`attempt ${attempt} on port ${port}: ${err.message}\n${started.output.join('')}`);
    }
  }
  throw new Error(`Server did not become ready after 3 attempts:\n${failures.join('\n---\n')}`);
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
});

test('webhook returns 503 because webhook intake is disabled in code (WSD-H-05)', async () => {
  const res = await fetchRaw(`${base}/api/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': 'nope',
    },
    body: JSON.stringify({ text: 'SABBATH, JULY 11, 2026\n' }),
  });
  assert.equal(res.status, 503);
  assert.match(res.body, /Webhook intake is disabled in this release/);
});
