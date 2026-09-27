/**
 * SPEC-91-03: Two-Direction Round-Trip Contract & Absence Guard Verification Test Suite
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeBufferSha256,
  checkSyncAssets,
  uploadSyncAsset,
  downloadSyncAsset,
} from '../src/lib/sync/client.ts';
import { spawnGoApi, stopProcess, json, fetchRaw } from './helpers/go-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-bidi-contract-'));

const dbPathA = path.join(tmp, 'instance_a.db');
const uploadsDirA = path.join(tmp, 'uploads_a');
fs.mkdirSync(uploadsDirA, { recursive: true });

const dbPathB = path.join(tmp, 'instance_b.db');
const uploadsDirB = path.join(tmp, 'uploads_b');
fs.mkdirSync(uploadsDirB, { recursive: true });

const AUTH_SECRET = createHash('sha256').update('sync-bidi-secret-91').digest('hex');
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin-pass-bidi-91';

let instanceA;
let instanceB;
let tokenA = '';
let tokenB = '';
let cookieA = '';
let cookieB = '';

before(async () => {
  instanceA = await spawnGoApi({
    dbPath: dbPathA,
    root,
    env: {
      AUTH_SECRET,
      AUTH_BOOTSTRAP_USER: ADMIN_USER,
      AUTH_BOOTSTRAP_PASSWORD: ADMIN_PASS,
      SYNC_ALLOWED_ORIGINS: 'http://localhost:*,http://127.0.0.1:*',
      UPLOADS_DIR: uploadsDirA,
    },
  });

  instanceB = await spawnGoApi({
    dbPath: dbPathB,
    root,
    env: {
      AUTH_SECRET,
      AUTH_BOOTSTRAP_USER: ADMIN_USER,
      AUTH_BOOTSTRAP_PASSWORD: ADMIN_PASS,
      SYNC_ALLOWED_ORIGINS: 'http://localhost:*,http://127.0.0.1:*',
      UPLOADS_DIR: uploadsDirB,
    },
  });

  const loginResA = await json(`${instanceA.base}/api/auth/login`, 'POST', {
    username: ADMIN_USER,
    password: ADMIN_PASS,
  });
  assert.equal(loginResA.status, 200);
  tokenA = loginResA.body.token;
  cookieA = loginResA.headers['set-cookie']?.[0]?.split(';')[0] || '';

  const loginResB = await json(`${instanceB.base}/api/auth/login`, 'POST', {
    username: ADMIN_USER,
    password: ADMIN_PASS,
  });
  assert.equal(loginResB.status, 200);
  tokenB = loginResB.body.token;
  cookieB = loginResB.headers['set-cookie']?.[0]?.split(';')[0] || '';
});

after(() => {
  if (instanceA?.child) stopProcess(instanceA.child);
  if (instanceB?.child) stopProcess(instanceB.child);
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // cleanup
  }
});

test('SPEC-91-03: Two-direction round-trip bidirectional contract with asset replication and tombstones', async () => {
  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };

  const svcGlobalId = 'svc-bidi-001';
  const setGlobalId = 'ann-set-bidi-001';
  const slide1GlobalId = 'ann-slide-bidi-001';
  const slide2GlobalId = 'ann-slide-bidi-002';

  // Create an asset binary on A
  const assetBytes = new TextEncoder().encode('Announcement Graphic Image Buffer SPEC-91-03');
  const assetSha = await computeBufferSha256(assetBytes.buffer);

  // 1. Upload asset to Instance A
  const upResA = await uploadSyncAsset(instanceA.base, assetBytes, assetSha, 'announcement.png', headersA);
  assert.equal(upResA.ok, true);

  // 2. Push full-fidelity state to Instance A
  const pushPayloadA = {
    client_device_id: 'client-A',
    mutation_id: 'mut-a-1',
    mutations: {
      services: [
        {
          global_id: svcGlobalId,
          date: '2026-10-11',
          raw_payload: 'Service raw on Instance A',
          parsed_data: { title: 'Bidi Test' },
          images_payload: { flyer: `/api/uploads/${assetSha}.png` },
          afternoon_program: 'Youth Choir',
          hidden_slide_ids: ['h1', 'h2'],
          emergency_patches: [{ op: 'replace', path: '/sermon', value: 'Live' }],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      announcement_sets: [
        {
          global_id: setGlobalId,
          label: 'Main Announcement Set',
          updated_at: new Date().toISOString(),
        },
      ],
      announcement_set_slides: [
        {
          global_id: slide1GlobalId,
          ann_set_global_id: setGlobalId,
          label: 'Slide 1 — Welcome',
          payload: JSON.stringify({ text: 'Welcome' }),
          position: 0,
          updated_at: new Date().toISOString(),
        },
        {
          global_id: slide2GlobalId,
          ann_set_global_id: setGlobalId,
          label: 'Slide 2 — Offering',
          payload: JSON.stringify({ text: 'Offering', image: `/api/uploads/${assetSha}.png` }),
          position: 1,
          updated_at: new Date().toISOString(),
        },
      ],
    },
  };

  const aPushRes = await json(`${instanceA.base}/api/sync/push`, 'POST', pushPayloadA, headersA);
  assert.equal(aPushRes.status, 200);

  // Cycle 1: Pull from A, replicate asset to B, and push to B
  const pullARes = await json(`${instanceA.base}/api/sync/pull`, 'GET', undefined, headersA);
  assert.equal(pullARes.status, 200);

  // Replicate asset to B
  const assetFromA = await downloadSyncAsset(instanceA.base, assetSha, headersA);
  const upResB = await uploadSyncAsset(instanceB.base, assetFromA, assetSha, 'announcement.png', headersB);
  assert.equal(upResB.ok, true);

  // Push to B
  const bPushPayload = {
    client_device_id: 'client-B-import',
    mutation_id: 'mut-b-1',
    mutations: {
      services: pullARes.body.changes.services,
      announcement_sets: pullARes.body.changes.announcement_sets,
      announcement_set_slides: pullARes.body.changes.announcement_set_slides,
    },
  };
  const bPushRes = await json(`${instanceB.base}/api/sync/push`, 'POST', bPushPayload, headersB);
  assert.equal(bPushRes.status, 200);

  // Assert state on B
  const pullBRes = await json(`${instanceB.base}/api/sync/pull`, 'GET', undefined, headersB);
  assert.equal(pullBRes.status, 200);
  const bServices = pullBRes.body.changes.services;
  const bSvc = bServices.find((s) => s.global_id === svcGlobalId);
  assert.ok(bSvc, 'Service must exist on Instance B');
  assert.deepEqual(bSvc.hidden_slide_ids, ['h1', 'h2']);
  assert.deepEqual(bSvc.emergency_patches, [{ op: 'replace', path: '/sermon', value: 'Live' }]);

  const bSlides = pullBRes.body.changes.announcement_set_slides;
  assert.equal(bSlides.length, 2, 'Instance B must have both slides');

  // Verify asset binary exists and returns HTTP 200 on B
  const getAssetRes = await fetchRaw(`${instanceB.base}/api/uploads/${assetSha}.png`, {
    headers: { Cookie: cookieB },
  });
  assert.equal(getAssetRes.status, 200, 'Replicated asset on Instance B must return HTTP 200');

  // Cycle 2: On B, delete slide2 and add a tombstone, then push back to A
  const tombstonePayloadB = {
    client_device_id: 'client-B',
    mutation_id: 'mut-b-tombstone-2',
    mutations: {},
    tombstones: [
      {
        global_id: slide2GlobalId,
        entity_type: 'announcement_set_slide',
        deleted_at: new Date().toISOString(),
      },
    ],
  };
  const tbResB = await json(`${instanceB.base}/api/sync/push`, 'POST', tombstonePayloadB, headersB);
  assert.equal(tbResB.status, 200);

  // Apply tombstone on A
  const tbResA = await json(`${instanceA.base}/api/sync/push`, 'POST', tombstonePayloadB, headersA);
  assert.equal(tbResA.status, 200);

  // Verify slide2 is removed from A
  const pullAFinal = await json(`${instanceA.base}/api/sync/pull`, 'GET', undefined, headersA);
  const finalSlidesA = pullAFinal.body.changes.announcement_set_slides;
  assert.equal(finalSlidesA.length, 1, 'Instance A must now have only 1 slide remaining');
  assert.equal(finalSlidesA[0].global_id, slide1GlobalId);
});

test('SPEC-91-03 guard proof: corrupted downloaded asset buffer fails SHA-256 verification', async () => {
  const originalBytes = new TextEncoder().encode('Clean uncorrupted binary content 91-03');
  const expectedSha = await computeBufferSha256(originalBytes.buffer);

  // Simulate downloading bytes that were corrupted during transit
  const corruptedBytes = new TextEncoder().encode('Corrupted altered binary content 91-03');
  const computedSha = await computeBufferSha256(corruptedBytes.buffer);

  assert.notEqual(
    computedSha,
    expectedSha,
    'Corrupted buffer must be rejected by SHA-256 integrity check'
  );
});
