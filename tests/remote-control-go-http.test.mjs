/**
 * Acceptance tests for Remote Relay and Pairing in Go (Story 5-1).
 *
 * Covers all 10 acceptance criteria:
 * 1. POST /api/present/{id}/remote/pair claims presenting role, returns short-lived single-use code.
 *    Called again while unclaimed, returns new code and invalidates the old one.
 * 2. POST .../remote/claim with valid code binds caller as remote and returns session state.
 *    Wrong, expired, or already-used code is 400 with opaque body.
 * 3. Second claim against live pairing is 409, and first remote keeps working.
 * 4. POST .../remote/intent accepts the 6 existing intents and rejects unknown type with 400.
 *    Intent from caller without live pairing is 409.
 * 5. GET .../remote/stream emits text/event-stream, delivers intent posted by paired remote,
 *    and closes older stream when same role reconnects.
 * 6. Second client claiming presenting role takes it; first client's stream is closed and pairing ends.
 * 7. DELETE .../remote/pair ends pairing and is idempotent (second call is 204).
 * 8. Every one of 5 paths returns 401 without session (asserted in go-http-gate.test.mjs too).
 * 9. API restart ends every pairing (simulated by restarting / new Go process).
 * 10. Registered in package.json scripts.test.
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-control-go-http-'));
const dbPath = path.join(tmp, 'test.db');
const AUTH_SECRET = createHash('sha256').update('remote-control-go-secret').digest('hex');

const OPERATOR_USER_1 = 'operator1';
const OPERATOR_PASS_1 = 'operator-pass-1';
const OPERATOR_USER_2 = 'operator2';
const OPERATOR_PASS_2 = 'operator-pass-2';

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
let cookieOp1 = '';
let cookieOp2 = '';
let serviceId = 1;
const output = [];

async function startServer(targetDbPath) {
  const port = await reservePort();
  const proc = spawn('go', ['run', './cmd/api'], {
    cwd: root,
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: targetDbPath,
      AUTH_SECRET,
      AUTH_BOOTSTRAP_USER: OPERATOR_USER_1,
      AUTH_BOOTSTRAP_PASSWORD: OPERATOR_PASS_1,
      REPO_ROOT: root,
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout.on('data', (c) => output.push(c.toString()));
  proc.stderr.on('data', (c) => output.push(c.toString()));
  const serverBase = `http://127.0.0.1:${port}`;
  let lastErr;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetchRaw(`${serverBase}/login`);
      if (res.status && res.status < 500) {
        return { proc, serverBase };
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  stopProcess(proc);
  throw new Error(`Go API did not become ready: ${lastErr}\n${output.join('')}`);
}

before(async () => {
  const server = await startServer(dbPath);
  child = server.proc;
  base = server.serverBase;

  // Login Op1
  const login1 = await fetchRaw(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: OPERATOR_USER_1, password: OPERATOR_PASS_1 }),
  });
  assert.equal(login1.status, 200, login1.body);
  cookieOp1 = cookieFrom(login1.headers);

  // Create operator 2 account
  const createAcc = await fetchRaw(`${base}/api/admin/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieOp1 },
    body: JSON.stringify({
      username: OPERATOR_USER_2,
      password: OPERATOR_PASS_2,
      role: 'operator',
    }),
  });
  assert.equal(createAcc.status, 201, createAcc.body);

  // Login Op2
  const login2 = await fetchRaw(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: OPERATOR_USER_2, password: OPERATOR_PASS_2 }),
  });
  assert.equal(login2.status, 200, login2.body);
  cookieOp2 = cookieFrom(login2.headers);

  // Create a test service
  const createSvc = await fetchRaw(`${base}/api/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieOp1 },
    body: JSON.stringify({
      raw_payload: 'SABBATH, AUGUST 22, 2026\nDIVINE SERVICE\nOpening Song: SDAH #159',
    }),
  });
  assert.equal(createSvc.status, 201, createSvc.body);
  const svcBody = JSON.parse(createSvc.body);
  serviceId = svcBody.id;
});

after(() => {
  stopProcess(child);
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

async function apiRequest(endpoint, { method = 'GET', body, cookie = cookieOp1 } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetchRaw(`${base}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    parsed = res.body;
  }
  return { status: res.status, headers: res.headers, body: parsed, raw: res.body };
}

test('1. POST /api/present/{id}/remote/pair claims presenting role and returns single-use code', async () => {
  // Clear any existing pairing
  await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'DELETE', cookie: cookieOp1 });

  const res1 = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'POST', cookie: cookieOp1 });
  assert.equal(res1.status, 200);
  assert.ok(res1.body.code, 'Must return a code');
  assert.equal(typeof res1.body.code, 'string');
  const code1 = res1.body.code;

  // Called again while first code is unclaimed -> returns a NEW code, old one invalidated
  const res2 = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'POST', cookie: cookieOp1 });
  assert.equal(res2.status, 200);
  const code2 = res2.body.code;
  assert.notEqual(code1, code2, 'New code must be issued');

  // Claim with code1 must fail (400)
  const claimOld = await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { code: code1 },
  });
  assert.equal(claimOld.status, 400);

  // Claim with code2 succeeds
  const claimNew = await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { code: code2 },
  });
  assert.equal(claimNew.status, 200);
  assert.equal(claimNew.body.paired, true);
});

test('2. POST /api/present/{id}/remote/claim with wrong, expired, or used code returns 400 opaque error', async () => {
  // Clear pairing
  await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'DELETE', cookie: cookieOp1 });

  const pair = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'POST', cookie: cookieOp1 });
  assert.equal(pair.status, 200);
  const validCode = pair.body.code;

  // 1. Wrong code -> 400
  const claimWrong = await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { code: '000000' === validCode ? '111111' : '000000' },
  });
  assert.equal(claimWrong.status, 400);
  assert.equal(typeof claimWrong.body.error, 'string');

  // 2. Valid code claim -> 200
  const claimValid = await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { code: validCode },
  });
  assert.equal(claimValid.status, 200);

  // 3. Already-used code claim -> 400 (or 409 if paired, but if unpaired first it is 400)
  // Delete pairing then try to reuse the already-used code
  await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'DELETE', cookie: cookieOp1 });
  const claimReused = await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { code: validCode },
  });
  assert.equal(claimReused.status, 400);
});

test('3. Second claim against a live pairing is 409 and first remote keeps working', async () => {
  await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'DELETE', cookie: cookieOp1 });

  const pair = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'POST', cookie: cookieOp1 });
  const code = pair.body.code;

  // Op2 pairs as first remote
  const claim1 = await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { code },
  });
  assert.equal(claim1.status, 200);

  // Second claim attempt while live pairing exists -> 409
  const claim2 = await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: cookieOp1,
    body: { code },
  });
  assert.equal(claim2.status, 409);

  // Prove first remote keeps working by posting intent
  const intentRes = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { type: 'blank', blank: true, planIdentity: 'test-plan' },
  });
  assert.equal(intentRes.status, 200);
  assert.equal(intentRes.body.ok, true);
});

test('4. POST /api/present/{id}/remote/intent accepts the 6 existing intents and rejects unknown type with 400 / unpaired with 409', async () => {
  // Clear & Pair Op2 as remote
  await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'DELETE', cookie: cookieOp1 });
  const pair = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'POST', cookie: cookieOp1 });
  await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { code: pair.body.code },
  });

  const validIntents = [
    { type: 'sync', index: 2, blank: false, transition: 'fade', planIdentity: 'plan1' },
    { type: 'blank', blank: true, planIdentity: 'plan1' },
    { type: 'transition', transition: 'push', planIdentity: 'plan1' },
    { type: 'background', background: 'https://example.com/bg.jpg', planIdentity: 'plan1' },
    { type: 'scripture', reference: 'John 3:16', text: 'For God so loved...', planIdentity: 'plan1' },
    { type: 'clear-scripture', planIdentity: 'plan1' },
    { type: 'media-play', planIdentity: 'plan1' },
    { type: 'media-pause', planIdentity: 'plan1' },
    { type: 'media-stop', planIdentity: 'plan1' },
    { type: 'media-fade', planIdentity: 'plan1' },
    { type: 'media-seek', timeSeconds: 15.5, planIdentity: 'plan1' },
    { type: 'media-toggle-project', planIdentity: 'plan1' },
    { type: 'media-select-item', id: 'item-1', planIdentity: 'plan1' },
    { type: 'media-toggle-shuffle', planIdentity: 'plan1' },
    { type: 'media-cycle-repeat', planIdentity: 'plan1' },
    { type: 'media-reorder-item', id: 'item-1', direction: 'up', planIdentity: 'plan1' },
    { type: 'media-reorder-item', id: 'item-1', direction: 'down', planIdentity: 'plan1' },
    { type: 'media-set-volume', volume: 0.8, planIdentity: 'plan1' },
    { type: 'media-set-mute', muted: true, planIdentity: 'plan1' },
    { type: 'guest-arm', planIdentity: 'plan1' },
    { type: 'guest-disarm', planIdentity: 'plan1' },
    { type: 'guest-project', projected: true, planIdentity: 'plan1' },
    { type: 'guest-project', projected: false, planIdentity: 'plan1' },
    { type: 'request-reopen-projector', planIdentity: 'plan1' },
  ];

  for (const intent of validIntents) {
    const res = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
      method: 'POST',
      cookie: cookieOp2,
      body: intent,
    });
    assert.equal(res.status, 200, `Intent type ${intent.type} should be accepted`);
  }

  // Invalid payload validation: negative seek time -> 400
  const invalidSeek = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { type: 'media-seek', timeSeconds: -5, planIdentity: 'plan1' },
  });
  assert.equal(invalidSeek.status, 400);

  // Invalid payload validation: empty item id -> 400
  const invalidSelectItem = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { type: 'media-select-item', id: '', planIdentity: 'plan1' },
  });
  assert.equal(invalidSelectItem.status, 400);

  // SPEC-116-02: Invalid reorder direction or empty id -> 400
  const invalidReorderDir = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { type: 'media-reorder-item', id: 'item-1', direction: 'sideways', planIdentity: 'plan1' },
  });
  assert.equal(invalidReorderDir.status, 400);

  const invalidReorderId = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { type: 'media-reorder-item', id: '', direction: 'up', planIdentity: 'plan1' },
  });
  assert.equal(invalidReorderId.status, 400);

  // SPEC-116-02: Out-of-bounds volume -> 400
  const invalidVolLow = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { type: 'media-set-volume', volume: -0.1, planIdentity: 'plan1' },
  });
  assert.equal(invalidVolLow.status, 400);

  const invalidVolHigh = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { type: 'media-set-volume', volume: 1.5, planIdentity: 'plan1' },
  });
  assert.equal(invalidVolHigh.status, 400);

  // SPEC-116-02: Non-boolean muted -> 400
  const invalidMute = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { type: 'media-set-mute', muted: 'yes', planIdentity: 'plan1' },
  });
  assert.equal(invalidMute.status, 400);

  // SPEC-116-03: Invalid non-boolean guest-project -> 400
  const invalidGuestProject = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { type: 'guest-project', projected: 'active', planIdentity: 'plan1' },
  });
  assert.equal(invalidGuestProject.status, 400);

  // Unknown intent type -> 400
  const invalidIntent = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { type: 'unknown-action', foo: 'bar' },
  });
  assert.equal(invalidIntent.status, 400);

  // Intent from caller holding no live pairing (Op1 is presenting client, not remote) -> 409
  const unpairedIntent = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp1,
    body: { type: 'blank', blank: false, planIdentity: 'plan1' },
  });
  assert.equal(unpairedIntent.status, 409);
});

test('5. GET /api/present/{id}/remote/stream emits SSE, delivers intent, and closes older stream on reconnect', async () => {
  await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'DELETE', cookie: cookieOp1 });
  const pair = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'POST', cookie: cookieOp1 });
  await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { code: pair.body.code },
  });

  // Open presenter SSE stream
  const u = new URL(`${base}/api/present/${serviceId}/remote/stream?role=presenter`);
  let streamClosedOld = false;
  let receivedData = [];

  const reqOld = http.request(
    {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET',
      headers: { Cookie: cookieOp1, Accept: 'text/event-stream' },
    },
    (res) => {
      assert.equal(res.statusCode, 200);
      assert.match(String(res.headers['content-type']), /text\/event-stream/);
      assert.equal(res.headers['x-accel-buffering'], 'no');
      res.on('data', (chunk) => {
        receivedData.push(chunk.toString());
      });
      res.on('end', () => {
        streamClosedOld = true;
      });
    }
  );
  reqOld.end();

  // Wait for stream to establish
  await new Promise((r) => setTimeout(r, 200));

  // Post intent from remote
  const intentPayload = { type: 'blank', blank: true, planIdentity: 'stream-test' };
  await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp2,
    body: intentPayload,
  });

  // Wait for delivery
  await new Promise((r) => setTimeout(r, 200));
  const fullOutput = receivedData.join('');
  assert.match(fullOutput, /"type":"blank"/);
  assert.match(fullOutput, /"planIdentity":"stream-test"/);

  // Reconnect presenter stream -> closes older stream
  const reqNew = http.request(
    {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET',
      headers: { Cookie: cookieOp1, Accept: 'text/event-stream' },
    },
    (res) => {
      assert.equal(res.statusCode, 200);
    }
  );
  reqNew.end();

  await new Promise((r) => setTimeout(r, 300));
  assert.equal(streamClosedOld, true, 'Older stream must be closed upon reconnection of same role');
  reqNew.destroy();
});

test('6. A second client claiming presenting role takes it; first stream closed and pairing ends', async () => {
  await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'DELETE', cookie: cookieOp1 });

  // Op1 claims presenting role and pairs Op2
  const pair1 = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'POST', cookie: cookieOp1 });
  await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { code: pair1.body.code },
  });

  // Op1 opens presenter stream
  let op1StreamClosed = false;
  const u = new URL(`${base}/api/present/${serviceId}/remote/stream?role=presenter`);
  const reqOp1 = http.request(
    {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET',
      headers: { Cookie: cookieOp1, Accept: 'text/event-stream' },
    },
    (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        op1StreamClosed = true;
      });
      res.on('close', () => {
        op1StreamClosed = true;
      });
    }
  );
  reqOp1.on('error', () => {
    op1StreamClosed = true;
  });
  reqOp1.end();
  await new Promise((r) => setTimeout(r, 200));

  // Op2 (different user) claims presenting role via POST pair
  const pair2 = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'POST', cookie: cookieOp2 });
  assert.equal(pair2.status, 200);

  // Wait for stream closure
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(op1StreamClosed, true, 'Op1 presenter stream must be closed when role is taken by Op2');

  // Previous pairing with Op2 as remote is now ended; remote intent must fail with 409
  const intentAfterTakeover = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { type: 'blank', blank: false, planIdentity: 'p' },
  });
  // Op2 is now presenter, not remote, so intent must be 409
  assert.equal(intentAfterTakeover.status, 409);
});

test('7. DELETE /api/present/{id}/remote/pair ends pairing and is idempotent (204)', async () => {
  // Establish pairing
  const pair = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'POST', cookie: cookieOp1 });
  await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { code: pair.body.code },
  });

  // First DELETE -> 204
  const del1 = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'DELETE', cookie: cookieOp1 });
  assert.equal(del1.status, 204);

  // Second DELETE -> 204 (idempotent)
  const del2 = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'DELETE', cookie: cookieOp1 });
  assert.equal(del2.status, 204);

  // Pairing is gone -> intent is 409
  const intent = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { type: 'blank', blank: true, planIdentity: 'p' },
  });
  assert.equal(intent.status, 409);
});

test('8. SPEC-121-02: Unauthenticated pairing boundary, rate limiting, and capability-token authorization', async () => {
  // Gated presenter endpoints return 401 without cookie
  const gatedEndpoints = [
    { path: `/api/present/${serviceId}/remote/pair`, method: 'POST' },
    { path: `/api/present/${serviceId}/remote/pair`, method: 'DELETE' },
  ];
  for (const ep of gatedEndpoints) {
    const res = await apiRequest(ep.path, { method: ep.method, cookie: '' });
    assert.equal(res.status, 401, `${ep.method} ${ep.path} must return 401 without cookie`);
  }

  // Stream without token or cookie is refused (401 or 409)
  const streamNoAuth = await apiRequest(`/api/present/${serviceId}/remote/stream`, { method: 'GET', cookie: '' });
  assert.ok(streamNoAuth.status === 401 || streamNoAuth.status === 409 || streamNoAuth.status === 403);

  // Intent without token or cookie is refused with 409
  const intentNoAuth = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: '',
    body: { type: 'blank', blank: true, planIdentity: 'p' },
  });
  assert.equal(intentNoAuth.status, 409);

  // Claim without cookie: invalid PIN returns 400
  const claimInvalid = await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: '',
    body: { code: '000000' },
  });
  assert.equal(claimInvalid.status, 400);

  // Reset pairing & issue fresh PIN from presenter (Op1)
  await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'DELETE', cookie: cookieOp1 });
  const freshPair = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'POST', cookie: cookieOp1 });
  assert.equal(freshPair.status, 200);

  // Clean mobile smartphone without cookie successfully claims pairing via PIN
  const mobileClaim = await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: '', // Clean phone, no cookie!
    body: { code: freshPair.body.code },
  });
  assert.equal(mobileClaim.status, 200, 'Unauthenticated mobile phone must successfully claim pairing');
  assert.equal(mobileClaim.body.paired, true);
  assert.ok(mobileClaim.body.token, 'Must return capability session token');
  const mobileToken = mobileClaim.body.token;

  // Mobile smartphone dispatches intent carrying capability token (without cookies!)
  const mobileIntent = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: '',
    body: { type: 'blank', blank: true, planIdentity: 'p', token: mobileToken },
  });
  assert.equal(mobileIntent.status, 200, 'Mobile client with token must successfully dispatch intent without cookies');

  // Sibling authenticated session cannot hijack presenter stream role without presenter credentials
  const hijackRes = await apiRequest(`/api/present/${serviceId}/remote/stream?role=presenter`, {
    method: 'GET',
    cookie: cookieOp2, // Op2 tries to hijack Op1's presenter stream
  });
  assert.equal(hijackRes.status, 403, 'Sibling session must be rejected with 403 when trying to claim presenter role');

  // Remote capability token cannot hijack presenter stream role
  const tokenHijackRes = await apiRequest(`/api/present/${serviceId}/remote/stream?role=presenter&token=${mobileToken}`, {
    method: 'GET',
    cookie: '',
  });
  assert.equal(tokenHijackRes.status, 403, 'Remote token must be rejected with 403 when trying to claim presenter role');

  // Capability token cannot authenticate operator or admin endpoints outside remote API
  const adminWithToken = await fetchRaw(`${base}/api/admin/accounts`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${mobileToken}`, 'X-Remote-Token': mobileToken },
  });
  assert.equal(adminWithToken.status, 401, 'Remote capability token must never authenticate admin endpoints');

  const pairWithToken = await fetchRaw(`${base}/api/present/${serviceId}/remote/pair`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${mobileToken}`, 'X-Remote-Token': mobileToken },
  });
  assert.equal(pairWithToken.status, 401, 'Remote capability token must never authenticate pair endpoint');

  // Unpair defense:
  // 1. Remote capability token cannot delete pairing
  const tokenDelete = await fetchRaw(`${base}/api/present/${serviceId}/remote/pair`, {
    method: 'DELETE',
    headers: { 'X-Remote-Token': mobileToken },
  });
  assert.equal(tokenDelete.status, 401, 'Unauthenticated request with capability token cannot delete pairing');

  // 2. Unauthorized session cannot delete pairing (must be active presenter or admin)
  // Pair Op2 as presenter on a new service (service 2)
  const pairOp2 = await apiRequest(`/api/present/2/remote/pair`, { method: 'POST', cookie: cookieOp2 });
  assert.equal(pairOp2.status, 200);

  // Another non-admin user (if we had op3, or op1 acting as admin)
  // Admin (cookieOp1) can delete pairing created by Op2
  const adminDelete = await apiRequest(`/api/present/2/remote/pair`, { method: 'DELETE', cookie: cookieOp1 });
  assert.equal(adminDelete.status, 204, 'Admin must be able to delete active pairing created by other presenters');

  // Rate limiting defense on POST /claim: 5 failed attempts trigger 429
  const bruteForceServiceId = 999;
  const pairForBruteForce = await apiRequest(`/api/present/${bruteForceServiceId}/remote/pair`, { method: 'POST', cookie: cookieOp1 });

  for (let i = 0; i < 5; i++) {
    const failRes = await apiRequest(`/api/present/${bruteForceServiceId}/remote/claim`, {
      method: 'POST',
      cookie: '',
      body: { code: '999999' },
    });
    assert.equal(failRes.status, 400);
  }
  // 6th attempt within 1 minute must be rate limited with 429
  const rateLimitedRes = await apiRequest(`/api/present/${bruteForceServiceId}/remote/claim`, {
    method: 'POST',
    cookie: '',
    body: { code: pairForBruteForce.body.code },
  });
  assert.equal(rateLimitedRes.status, 429, '6th failed claim attempt within 1 minute must return HTTP 429');

  // Parallel burst rate-limiting test (Terra Codex requirement)
  const parallelServiceId = 998;
  const parallelCodes = ['100001', '100002', '100003', '100004', '100005', '100006', '100007', '100008'];
  const parallelResults = await Promise.all(
    parallelCodes.map((c) =>
      apiRequest(`/api/present/${parallelServiceId}/remote/claim`, {
        method: 'POST',
        cookie: '',
        body: { code: c },
      })
    )
  );
  const count400 = parallelResults.filter((r) => r.status === 400).length;
  const count429 = parallelResults.filter((r) => r.status === 429).length;
  assert.ok(count400 <= 5, `At most 5 failed attempts allowed (got ${count400})`);
  assert.ok(count429 >= 3, `Excess attempts must receive 429 (got ${count429})`);
});

test('9. An API restart ends every pairing (memory-only, no DB table)', async () => {
  // 1. Establish pairing on current running API
  const pair = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'POST', cookie: cookieOp1 });
  const claim = await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { code: pair.body.code },
  });
  assert.equal(claim.status, 200);

  // Confirm remote intent works
  const intent1 = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { type: 'blank', blank: true, planIdentity: 'p' },
  });
  assert.equal(intent1.status, 200);

  // 2. Kill current Go API and spawn a fresh one with the same DB
  stopProcess(child);
  const restarted = await startServer(dbPath);
  child = restarted.proc;
  base = restarted.serverBase;

  // Re-login to get valid session cookies on new instance
  const login = await fetchRaw(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: OPERATOR_USER_2, password: OPERATOR_PASS_2 }),
  });
  assert.equal(login.status, 200);
  const newCookieOp2 = cookieFrom(login.headers);

  // 3. Remote's next intent must be 409 (no pairing survived restart)
  const intentAfterRestart = await apiRequest(`/api/present/${serviceId}/remote/intent`, {
    method: 'POST',
    cookie: newCookieOp2,
    body: { type: 'blank', blank: true, planIdentity: 'p' },
  });
  assert.equal(intentAfterRestart.status, 409);
});

test('10. SPEC-118-04: Token-based remote resume, session token re-binding, and revocation', async () => {
  // Clear any existing pairing
  await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'DELETE', cookie: cookieOp1 });

  // 1. Host creates pair
  const pair = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'POST', cookie: cookieOp1 });
  assert.equal(pair.status, 200);

  // 2. Remote claims code and receives session_token
  const claim = await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { code: pair.body.code },
  });
  assert.equal(claim.status, 200);
  assert.ok(claim.body.token, 'Must return token');
  assert.equal(typeof claim.body.token, 'string');
  const validToken = claim.body.token;

  // 3. Resume with valid session_token returns 200 and paired: true
  const resumeValid = await apiRequest(`/api/present/${serviceId}/remote/resume`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { token: validToken },
  });
  assert.equal(resumeValid.status, 200);
  assert.equal(resumeValid.body.paired, true);
  assert.equal(resumeValid.body.token, validToken);

  // 4. Resume with invalid token returns 401
  const resumeInvalid = await apiRequest(`/api/present/${serviceId}/remote/resume`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { token: 'invalid-token-123' },
  });
  assert.equal(resumeInvalid.status, 401);

  // 5. Host creating a new pair revokes the prior session_token (AD-37 single-controller invariant)
  const newPair = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'POST', cookie: cookieOp1 });
  assert.equal(newPair.status, 200);

  const resumeAfterRevocation = await apiRequest(`/api/present/${serviceId}/remote/resume`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { token: validToken },
  });
  assert.equal(resumeAfterRevocation.status, 401);
});

test('11. SPEC-119-02: Go backend merges state and retains playlistManifest across throttled clock updates', async () => {
  await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'DELETE', cookie: cookieOp1 });
  const pair = await apiRequest(`/api/present/${serviceId}/remote/pair`, { method: 'POST', cookie: cookieOp1 });

  // 1. Host posts initial media state with full playlistManifest
  const postInitial = await apiRequest(`/api/present/${serviceId}/remote/state`, {
    method: 'POST',
    cookie: cookieOp1,
    body: {
      media: {
        activeId: 'm-track-1',
        isPlaying: true,
        currentTime: 0,
        playlistManifest: [
          { id: 'm-track-1', name: 'Amazing Grace', type: 'audio', duration: 240 },
          { id: 'm-track-2', name: 'How Great Thou Art', type: 'audio', duration: 180 },
        ],
      },
    },
  });
  assert.equal(postInitial.status, 200);

  // 2. Host posts subsequent throttled clock packet (omits playlistManifest)
  const postThrottledClock = await apiRequest(`/api/present/${serviceId}/remote/state`, {
    method: 'POST',
    cookie: cookieOp1,
    body: {
      media: {
        currentTime: 12.5,
      },
    },
  });
  assert.equal(postThrottledClock.status, 200);

  // 3. Remote claims pairing and receives merged state
  const claim = await apiRequest(`/api/present/${serviceId}/remote/claim`, {
    method: 'POST',
    cookie: cookieOp2,
    body: { code: pair.body.code },
  });
  assert.equal(claim.status, 200);
  assert.ok(claim.body.state, 'Claim must return cached session state');
  assert.equal(claim.body.state.media.currentTime, 12.5, 'Latest currentTime is reflected');
  assert.equal(claim.body.state.media.isPlaying, true, 'Prior isPlaying flag is preserved');
  assert.equal(claim.body.state.media.activeId, 'm-track-1', 'Prior activeId is preserved');
  assert.ok(Array.isArray(claim.body.state.media.playlistManifest), 'playlistManifest is preserved');
  assert.equal(claim.body.state.media.playlistManifest.length, 2, 'Full playlistManifest items retained');
  assert.equal(claim.body.state.media.playlistManifest[0].name, 'Amazing Grace');
});
