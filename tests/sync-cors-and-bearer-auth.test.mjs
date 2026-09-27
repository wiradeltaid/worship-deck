/**
 * SPEC-88: Go API CORS, Bearer Token Auth, and Dual-Instance Cross-Machine Sync
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnGoApi, stopProcess, fetchRaw, json } from './helpers/go-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-cors-auth-'));
const dbPathA = path.join(tmp, 'test_instance_a.db');
const dbPathB = path.join(tmp, 'test_instance_b.db');
const AUTH_SECRET = createHash('sha256').update('sync-cors-bearer-secret').digest('hex');
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin-secret-pass-88';

let instanceA;
let instanceB;
let adminTokenB = '';
let operatorTokenB = '';

before(async () => {
  // Spawn Instance A (Simulates Local Workstation)
  instanceA = await spawnGoApi({
    dbPath: dbPathA,
    root,
    env: {
      AUTH_SECRET,
      AUTH_BOOTSTRAP_USER: ADMIN_USER,
      AUTH_BOOTSTRAP_PASSWORD: ADMIN_PASS,
      SYNC_ALLOWED_ORIGINS: 'http://localhost:*,http://127.0.0.1:*,https://approved.church.org',
    },
  });

  // Spawn Instance B (Simulates Remote Cloud Instance)
  instanceB = await spawnGoApi({
    dbPath: dbPathB,
    root,
    env: {
      AUTH_SECRET,
      AUTH_BOOTSTRAP_USER: ADMIN_USER,
      AUTH_BOOTSTRAP_PASSWORD: ADMIN_PASS,
      SYNC_ALLOWED_ORIGINS: 'http://localhost:*,http://127.0.0.1:*,https://approved.church.org',
    },
  });

  // Authenticate Admin on Instance B
  const loginRes = await json(`${instanceB.base}/api/auth/login`, 'POST', {
    username: ADMIN_USER,
    password: ADMIN_PASS,
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.token, 'login response must include token');
  adminTokenB = loginRes.body.token;

  // Create an Operator account on Instance B to verify 403 non-admin refusal
  const cookieHeader = loginRes.headers['set-cookie']?.[0]?.split(';')[0] || '';
  const opRes = await json(
    `${instanceB.base}/api/admin/accounts`,
    'POST',
    {
      username: 'opuser',
      password: 'op-secret-pass-88',
      role: 'operator',
    },
    { Cookie: cookieHeader }
  );
  assert.ok(opRes.status === 200 || opRes.status === 201, 'operator account created');

  const opLoginRes = await json(`${instanceB.base}/api/auth/login`, 'POST', {
    username: 'opuser',
    password: 'op-secret-pass-88',
  });
  assert.equal(opLoginRes.status, 200);
  operatorTokenB = opLoginRes.body.token;
});

after(() => {
  if (instanceA?.child) stopProcess(instanceA.child);
  if (instanceB?.child) stopProcess(instanceB.child);
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

test('SPEC-88-01: OPTIONS preflight on /api/sync/* returns 204 with full CORS headers for approved origin', async () => {
  const approvedOrigin = 'http://localhost:5173';
  const res = await fetchRaw(`${instanceB.base}/api/sync/pull`, {
    method: 'OPTIONS',
    headers: {
      Origin: approvedOrigin,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Authorization, Content-Type',
    },
  });

  assert.equal(res.status, 204);
  assert.equal(res.headers['access-control-allow-origin'], approvedOrigin);
  assert.match(res.headers['access-control-allow-methods'] || '', /GET/);
  assert.match(res.headers['access-control-allow-methods'] || '', /POST/);
  assert.match(res.headers['access-control-allow-methods'] || '', /OPTIONS/);
  assert.match(res.headers['access-control-allow-headers'] || '', /Authorization/);
  assert.match(res.headers['access-control-allow-headers'] || '', /X-Content-SHA256/);
  assert.equal(res.headers['access-control-max-age'], '86400');
  assert.match(res.headers['vary'] || '', /Origin/);
});

test('SPEC-88-01: OPTIONS preflight on /api/auth/login returns 204 with CORS headers for approved origin', async () => {
  const approvedOrigin = 'https://approved.church.org';
  const res = await fetchRaw(`${instanceB.base}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: approvedOrigin,
    },
  });

  assert.equal(res.status, 204);
  assert.equal(res.headers['access-control-allow-origin'], approvedOrigin);
  assert.match(res.headers['vary'] || '', /Origin/);
});

test('SPEC-88-01: Unapproved origin in Origin header fails closed without Access-Control-Allow-Origin', async () => {
  const unapprovedOrigin = 'http://malicious-external-site.com';
  const res = await fetchRaw(`${instanceB.base}/api/sync/pull`, {
    method: 'OPTIONS',
    headers: {
      Origin: unapprovedOrigin,
    },
  });

  assert.equal(res.status, 204);
  assert.equal(
    res.headers['access-control-allow-origin'],
    undefined,
    'must not emit Access-Control-Allow-Origin for unapproved origin'
  );
});

test('SPEC-88-02: POST /api/auth/login returns session token in JSON body and HttpOnly cookie', async () => {
  const res = await json(`${instanceB.base}/api/auth/login`, 'POST', {
    username: ADMIN_USER,
    password: ADMIN_PASS,
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.role, 'admin');
  assert.ok(typeof res.body.token === 'string' && res.body.token.length > 20);
  const setCookie = res.headers['set-cookie'];
  assert.ok(setCookie, 'HttpOnly cookie must still be issued');
});

test('SPEC-88-01: GET /api/sync/pull with valid Bearer token returns 200 without cookie', async () => {
  const res = await json(`${instanceB.base}/api/sync/pull`, 'GET', undefined, {
    Authorization: `Bearer ${adminTokenB}`,
    Origin: 'http://localhost:3000',
  });

  assert.equal(res.status, 200);
  assert.ok(res.body.changes);
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:3000');
  assert.match(res.headers['vary'] || '', /Origin/);
});

test('SPEC-88-01: GET /api/sync/pull without cookie or token returns HTTP 401', async () => {
  const res = await json(`${instanceB.base}/api/sync/pull`, 'GET', undefined, {
    Accept: 'application/json',
  });

  assert.equal(res.status, 401);
  assert.match(res.body.error || '', /Unauthorized/);
});

test('SPEC-88-01: GET /api/sync/pull with invalid or forged Bearer token returns HTTP 401', async () => {
  const res = await json(`${instanceB.base}/api/sync/pull`, 'GET', undefined, {
    Authorization: 'Bearer invalid.forged.token.here',
    Accept: 'application/json',
  });

  assert.equal(res.status, 401);
  assert.match(res.body.error || '', /Unauthorized/);
});

test('SPEC-88-01: GET /api/sync/pull with operator Bearer token returns HTTP 403 Forbidden', async () => {
  const res = await json(`${instanceB.base}/api/sync/pull`, 'GET', undefined, {
    Authorization: `Bearer ${operatorTokenB}`,
    Accept: 'application/json',
  });

  assert.equal(res.status, 403);
  assert.match(res.body.error || '', /Forbidden/);
});

test('SPEC-88-01: Non-sync endpoints reject Bearer tokens without cookie', async () => {
  // /api/admin/background-library must NOT accept Bearer token
  const res = await json(`${instanceB.base}/api/admin/background-library`, 'GET', undefined, {
    Authorization: `Bearer ${adminTokenB}`,
    Accept: 'application/json',
  });

  assert.equal(res.status, 401, 'non-sync endpoint must reject Bearer token');
});

test('SPEC-88-04: Dual-Instance cross-machine sync push and pull via Bearer authentication', async () => {
  const mutationId = 'mut-dual-' + Date.now();
  const globalId = 'dual-service-test-01';

  // 1. Push a new service from Instance A context into Instance B using Instance B Bearer Token
  const pushPayload = {
    client_device_id: 'device-instance-a',
    mutation_id: mutationId,
    base_rev: 0,
    mutations: {
      services: [
        {
          global_id: globalId,
          date: '2026-11-20',
          raw_payload: 'Dual Instance Cross-Machine Sync Service Payload',
          afternoon_program: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      hymns: [],
      song_set_entries: [],
      background_library_images: [],
      announcement_items: [],
    },
    tombstones: [],
  };

  const pushRes = await json(
    `${instanceB.base}/api/sync/push`,
    'POST',
    pushPayload,
    {
      Authorization: `Bearer ${adminTokenB}`,
      Origin: 'http://localhost:5173',
    }
  );

  assert.equal(pushRes.status, 200);
  assert.equal(pushRes.body.ok, true);
  assert.equal(pushRes.body.applied_count, 1);
  assert.equal(pushRes.headers['access-control-allow-origin'], 'http://localhost:5173');

  // 2. Verify Instance B returns the newly pushed service on pull
  const pullRes = await json(`${instanceB.base}/api/sync/pull`, 'GET', undefined, {
    Authorization: `Bearer ${adminTokenB}`,
    Origin: 'http://localhost:5173',
  });

  assert.equal(pullRes.status, 200);
  const found = pullRes.body.changes.services.find((s) => s.global_id === globalId);
  assert.ok(found, 'Instance B must return the synchronized service');
  assert.equal(found.raw_payload, 'Dual Instance Cross-Machine Sync Service Payload');
});

test('SPEC-88-01: Stale or invalid cookie falls back to valid sync Bearer token without blocking', async () => {
  // Pass an expired/invalid auth_session cookie alongside a valid Bearer token
  const res = await json(`${instanceB.base}/api/sync/pull`, 'GET', undefined, {
    Authorization: `Bearer ${adminTokenB}`,
    Cookie: 'auth_session=invalid.stale.expired.session.token',
    Origin: 'http://localhost:5173',
  });

  assert.equal(res.status, 200, 'valid bearer token must succeed even if cookie is stale');
  assert.ok(res.body.changes);
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
});

test('SPEC-88-02: Successful login response carrying bearer token has Cache-Control: no-store and Vary: Origin, Cookie', async () => {
  const approvedOrigin = 'http://localhost:5173';
  const res = await json(
    `${instanceB.base}/api/auth/login`,
    'POST',
    {
      username: ADMIN_USER,
      password: ADMIN_PASS,
    },
    {
      Origin: approvedOrigin,
    }
  );

  assert.equal(res.status, 200);
  assert.match(String(res.headers['cache-control'] || ''), /no-store/);
  assert.match(String(res.headers['vary'] || ''), /Origin/);
  assert.match(String(res.headers['vary'] || ''), /Cookie/);
});
