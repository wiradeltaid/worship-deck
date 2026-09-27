/**
 * SPEC-91-02: Bidirectional Asset Discovery and Hydration Pipeline Test Suite
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractUploadHashes,
  computeBufferSha256,
  checkSyncAssets,
  uploadSyncAsset,
  downloadSyncAsset,
} from '../src/lib/sync/client.ts';
import { spawnGoApi, stopProcess, json } from './helpers/go-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-hydration-'));
const dbPath = path.join(tmp, 'test_hydration.db');
const uploadsDir = path.join(tmp, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const AUTH_SECRET = createHash('sha256').update('sync-hydration-secret').digest('hex');
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin-secret-pass-92';

let instance;
let adminToken = '';

before(async () => {
  instance = await spawnGoApi({
    dbPath,
    root,
    env: {
      AUTH_SECRET,
      AUTH_BOOTSTRAP_USER: ADMIN_USER,
      AUTH_BOOTSTRAP_PASSWORD: ADMIN_PASS,
      SYNC_ALLOWED_ORIGINS: 'http://localhost:*,http://127.0.0.1:*',
      UPLOADS_DIR: uploadsDir,
    },
  });

  const loginRes = await json(`${instance.base}/api/auth/login`, 'POST', {
    username: ADMIN_USER,
    password: ADMIN_PASS,
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.token);
  adminToken = loginRes.body.token;
});

after(() => {
  if (instance?.child) {
    stopProcess(instance.child);
  }
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // cleanup
  }
});

test('SPEC-91-02: extractUploadHashes extracts, deduplicates, and normalizes hashes from complex payloads', () => {
  const hash1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const hash2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
  const hashUpper = 'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789';

  const payload = {
    services: [
      {
        images_payload: JSON.stringify({
          bg: `/api/uploads/${hash1}.png`,
          duplicate: `/api/uploads/${hash1}.png`,
          poster: `/api/uploads/${hashUpper}.jpg`,
        }),
      },
    ],
    announcement_items: [
      { image_url: `/api/uploads/${hash2}.png` },
      { image_url: hash1 }, // direct hash
    ],
    empty_list: [],
    nil_field: null,
  };

  const extracted = extractUploadHashes(payload);
  assert.equal(extracted.length, 3, 'Should extract exactly 3 unique lowercase hashes');
  assert.ok(extracted.includes(hash1.toLowerCase()));
  assert.ok(extracted.includes(hash2.toLowerCase()));
  assert.ok(extracted.includes(hashUpper.toLowerCase()));
});

test('SPEC-91-02: computeBufferSha256 returns accurate SHA-256 hex string', async () => {
  const content = new TextEncoder().encode('WorshipDeck Test Binary Asset Content 2026');
  const expectedSha = createHash('sha256').update(content).digest('hex');

  const actualSha = await computeBufferSha256(content.buffer);
  assert.equal(actualSha, expectedSha);
});

test('SPEC-91-02: Check, upload, download, and SHA-256 verification of sync assets', async () => {
  const assetBytes = Buffer.from('WorshipDeck Hydration Binary Payload Checksum Verification', 'utf8');
  const expectedSha = createHash('sha256').update(assetBytes).digest('hex');

  const headers = { Authorization: `Bearer ${adminToken}` };

  // 1. Initial check: asset should be reported missing
  const checkInitial = await checkSyncAssets(instance.base, [expectedSha], headers);
  assert.deepEqual(checkInitial.missing, [expectedSha], 'Asset must be reported missing before upload');

  // 2. Upload asset
  const uploadRes = await uploadSyncAsset(instance.base, assetBytes, expectedSha, 'sample.png', headers);
  assert.equal(uploadRes.ok, true);
  assert.equal(uploadRes.sha256, expectedSha);

  // 3. Post-upload check: asset must now exist
  const checkPost = await checkSyncAssets(instance.base, [expectedSha], headers);
  assert.deepEqual(checkPost.missing, [], 'Asset must not be missing after upload');

  // 4. Download and verify integrity
  const downloadedBuf = await downloadSyncAsset(instance.base, expectedSha, headers);
  const downloadedSha = await computeBufferSha256(downloadedBuf);
  assert.equal(downloadedSha, expectedSha, 'Downloaded buffer must verify against expected SHA-256');
});

test('SPEC-91-02 guard proof: computeBufferSha256 detects corrupted or tampered bytes', async () => {
  const originalBytes = new TextEncoder().encode('Original untampered asset bytes');
  const expectedSha = createHash('sha256').update(originalBytes).digest('hex');

  // Corrupt a byte
  const corruptedBytes = new TextEncoder().encode('Corrupted untampered asset bytes');
  const actualSha = await computeBufferSha256(corruptedBytes.buffer);

  assert.notEqual(
    actualSha,
    expectedSha,
    'Corrupted buffer must not match the expected SHA-256 hash'
  );
});
