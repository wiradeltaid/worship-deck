/**
 * SPEC-93-01: Dual-Hash Sync Endpoints & Write-Path SHA-256 Uploads Test Suite
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnGoApi, stopProcess, json, fetchRaw, parseCookie } from './helpers/go-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-endpoints-'));
const dbPath = path.join(tmp, 'test_endpoints.db');
const uploadsDir = path.join(tmp, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const AUTH_SECRET = createHash('sha256').update('sync-endpoints-secret-93').digest('hex');
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin-secret-pass-93';

let instance;
let adminToken = '';
let adminCookie = '';

// Pre-seed a 32-hex legacy asset in uploadsDir
const legacy32Hex = '34645da1a600f8824686c0ae7104bc1d';
const legacyFilename = `${legacy32Hex}.png`;
const legacyBytes = Buffer.from('fake-legacy-png-content-32hex');
fs.writeFileSync(path.join(uploadsDir, legacyFilename), legacyBytes);

export function scanUploadsWritePathContract(source) {
  const findings = [];
  if (!source.includes('sha256.Sum256(') && !source.includes('sha256.New()')) {
    findings.push('writeUpload must compute SHA-256 content digest');
  }
  if (source.includes('rand.Read(')) {
    findings.push('writeUpload must not use random bytes for file naming');
  }
  return findings;
}

export function scanSyncAssetDiscreteValidationContract(source) {
  const findings = [];
  if (!source.includes('(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{64})')) {
    findings.push('sync_assets.go must enforce strict discrete 32 or 64 hex character validator');
  }
  if (!source.includes('path traversal is forbidden')) {
    findings.push('syncAssetUpload must forbid path traversal in filenames');
  }
  if (!source.includes('does not match declared identifier')) {
    findings.push('syncAssetUpload must verify filename stem matches declared identifier');
  }
  return findings;
}

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
  adminCookie = parseCookie(loginRes.headers['set-cookie']);
});

after(() => {
  if (instance?.child) {
    stopProcess(instance.child);
  }
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {}
});

test('SPEC-93-01: Static contract scanning for uploads write-path and sync asset discrete validation', () => {
  const uploadsPath = path.join(root, 'internal', 'httpapi', 'uploads.go');
  const syncAssetsPath = path.join(root, 'internal', 'httpapi', 'sync_assets.go');

  const uploadsSource = fs.readFileSync(uploadsPath, 'utf8');
  const syncAssetsSource = fs.readFileSync(syncAssetsPath, 'utf8');

  assert.deepEqual(scanUploadsWritePathContract(uploadsSource), []);
  assert.deepEqual(scanSyncAssetDiscreteValidationContract(syncAssetsSource), []);
});

test('SPEC-93-01: Defect injection proofs for contract scanners', () => {
  const uploadsPath = path.join(root, 'internal', 'httpapi', 'uploads.go');
  const syncAssetsPath = path.join(root, 'internal', 'httpapi', 'sync_assets.go');

  const uploadsSource = fs.readFileSync(uploadsPath, 'utf8');
  const syncAssetsSource = fs.readFileSync(syncAssetsPath, 'utf8');

  // Defect 1: Random hex in uploads
  const defectiveUploads = uploadsSource.replace('sha256.Sum256(', 'rand.Read(');
  assert.ok(scanUploadsWritePathContract(defectiveUploads).length > 0);

  // Defect 2: Loose regex in sync assets
  const defectiveSync1 = syncAssetsSource.replace(
    '(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{64})',
    '[a-fA-F0-9]{32,64}'
  );
  assert.ok(scanSyncAssetDiscreteValidationContract(defectiveSync1).length > 0);

  // Defect 3: Missing path traversal check
  const defectiveSync2 = syncAssetsSource.replace(
    'path traversal is forbidden',
    '/* skipped check */'
  );
  assert.ok(scanSyncAssetDiscreteValidationContract(defectiveSync2).length > 0);
});

test('SPEC-93-01: POST /api/sync/assets/check validates discrete dual-hash lengths and returns missing assets', async () => {
  const valid64Hex = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  // 1. Both discrete lengths (32 and 64) accepted
  const checkRes = await json(
    `${instance.base}/api/sync/assets/check`,
    'POST',
    {
      hashes: [legacy32Hex, valid64Hex],
    },
    {
      Authorization: `Bearer ${adminToken}`,
    }
  );
  assert.equal(checkRes.status, 200);
  assert.ok(Array.isArray(checkRes.body.missing));
  // legacy32Hex is pre-seeded on disk -> should NOT be missing
  assert.ok(!checkRes.body.missing.includes(legacy32Hex), 'Pre-seeded 32-hex asset must be found');
  // valid64Hex is not on disk -> should be missing
  assert.ok(checkRes.body.missing.includes(valid64Hex), 'Unseeded 64-hex asset must be missing');

  // 2. Reject ambiguous lengths (31, 33, 63, 65 hex characters) with HTTP 400
  const invalidLengths = [
    'a'.repeat(31),
    'a'.repeat(33),
    'a'.repeat(63),
    'a'.repeat(65),
    'not-hex-at-all-32-chars-long-here',
  ];

  for (const badHash of invalidLengths) {
    const badRes = await json(
      `${instance.base}/api/sync/assets/check`,
      'POST',
      { hashes: [badHash] },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.equal(badRes.status, 400, `Expected 400 for bad hash length: ${badHash.length}`);
  }
});

test('SPEC-93-01: GET /api/sync/assets/{hash} serves 32-hex legacy assets with exact basename lookup', async () => {
  // 1. Existing 32-hex asset download
  const res = await fetch(`${instance.base}/api/sync/assets/${legacy32Hex}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const downloadedBuf = Buffer.from(await res.arrayBuffer());
  assert.deepEqual(downloadedBuf, legacyBytes);
  assert.equal(res.headers.get('X-Content-SHA256'), legacy32Hex);

  // 2. Reject non-discrete hash length with 400
  const badRes = await fetch(`${instance.base}/api/sync/assets/${'b'.repeat(33)}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(badRes.status, 400);

  // 3. Unknown asset returns 404
  const unknown64 = '1111111111111111111111111111111111111111111111111111111111111111';
  const notFoundRes = await fetch(`${instance.base}/api/sync/assets/${unknown64}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(notFoundRes.status, 404);
});

test('SPEC-93-01: POST /api/sync/assets/upload enforces filename safety, stem parity, and dual-mode verification', async () => {
  const content = Buffer.from('test-image-content-for-spec-93-upload');
  const contentSha = createHash('sha256').update(content).digest('hex');

  // 1. Upload 64-hex SHA-256 asset successfully
  const uploadRes = await fetch(
    `${instance.base}/api/sync/assets/upload?filename=${contentSha}.png`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Content-SHA256': contentSha,
        'Content-Type': 'image/png',
      },
      body: content,
    }
  );
  assert.equal(uploadRes.status, 200);
  const uploadBody = await uploadRes.json();
  assert.equal(uploadBody.ok, true);
  assert.equal(uploadBody.sha256, contentSha);
  assert.equal(uploadBody.filename, `${contentSha}.png`);
  assert.equal(uploadBody.deduplicated, false);

  // Verify file on disk
  assert.ok(fs.existsSync(path.join(uploadsDir, `${contentSha}.png`)));

  // 2. Deduplication check: uploading same content again returns deduplicated: true
  const dedupRes = await fetch(
    `${instance.base}/api/sync/assets/upload?filename=${contentSha}.png`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Content-SHA256': contentSha,
        'Content-Type': 'image/png',
      },
      body: content,
    }
  );
  assert.equal(dedupRes.status, 200);
  const dedupBody = await dedupRes.json();
  assert.equal(dedupBody.deduplicated, true);

  // 3. Reject 64-hex hash mismatch
  const tamperedContent = Buffer.from('tampered-content');
  const otherUnseededSha = createHash('sha256').update(Buffer.from('unseeded-content')).digest('hex');
  const mismatchRes = await fetch(
    `${instance.base}/api/sync/assets/upload?filename=${otherUnseededSha}.png`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Content-SHA256': otherUnseededSha,
        'Content-Type': 'image/png',
      },
      body: tamperedContent,
    }
  );
  assert.equal(mismatchRes.status, 400);
  const mismatchBody = await mismatchRes.json();
  assert.equal(mismatchBody.error, 'hash_mismatch');

  // 4. Reject path traversal in filename parameter
  const traversalRes = await fetch(
    `${instance.base}/api/sync/assets/upload?filename=../../evil.png`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Content-SHA256': contentSha,
        'Content-Type': 'image/png',
      },
      body: content,
    }
  );
  assert.equal(traversalRes.status, 400);

  // 5. Reject filename stem mismatch (conflicting hash stem in filename)
  const conflictingHash = '1111111111111111111111111111111111111111111111111111111111111111';
  const mismatchStemRes = await fetch(
    `${instance.base}/api/sync/assets/upload?filename=${conflictingHash}.png`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Content-SHA256': contentSha,
        'Content-Type': 'image/png',
      },
      body: content,
    }
  );
  assert.equal(mismatchStemRes.status, 400);

  // 6. Upload 32-hex legacy asset with filename preservation
  const legacyUploadId = 'c30a2f96e172ee46173398f9dca001d5';
  const legacyContent = Buffer.from('legacy-32hex-file-data');
  const legacyUploadRes = await fetch(
    `${instance.base}/api/sync/assets/upload?filename=${legacyUploadId}.webp`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Content-SHA256': legacyUploadId,
        'Content-Type': 'image/webp',
      },
      body: legacyContent,
    }
  );
  assert.equal(legacyUploadRes.status, 200);
  const legacyUploadBody = await legacyUploadRes.json();
  assert.equal(legacyUploadBody.ok, true);
  assert.equal(legacyUploadBody.filename, `${legacyUploadId}.webp`);
  assert.ok(fs.existsSync(path.join(uploadsDir, `${legacyUploadId}.webp`)));
});

test('SPEC-93-01: POST /api/upload writes content SHA-256 filenames and deduplicates across extension aliases', async () => {
  // Construct a minimal valid PNG
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);
  const pngSha = createHash('sha256').update(pngHeader).digest('hex');

  // Multipart form upload
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample.png"\r\nContent-Type: image/png\r\n\r\n`),
    pngHeader,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const res = await fetch(`${instance.base}/api/upload`, {
    method: 'POST',
    headers: {
      Cookie: adminCookie,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.url, `/api/uploads/${pngSha}.png`);
  assert.ok(fs.existsSync(path.join(uploadsDir, `${pngSha}.png`)));

  // Second upload with same bytes but alias extension .jpeg: cross-extension deduplication reuses .png URL
  const multipartBodyJpeg = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample.jpeg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    pngHeader,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const res2 = await fetch(`${instance.base}/api/upload`, {
    method: 'POST',
    headers: {
      Cookie: adminCookie,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBodyJpeg,
  });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.url, `/api/uploads/${pngSha}.png`);

  // Assert only exactly ONE file with this stem exists in uploads directory
  const filesOnDisk = fs.readdirSync(uploadsDir).filter((f) => f.startsWith(pngSha));
  assert.equal(filesOnDisk.length, 1, `Expected exactly 1 file for stem ${pngSha}, found: ${filesOnDisk}`);
});

test('SPEC-93-01: GET /api/uploads/{filename} enforces discrete 32 or 64 hex character grammar', async () => {
  // 1. Serving discrete 32-hex legacy file succeeds
  const res32 = await fetch(`${instance.base}/api/uploads/${legacyFilename}`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(res32.status, 200);

  // 2. Reject non-discrete hex lengths with 404
  const invalidFilenames = [
    `${'a'.repeat(31)}.png`,
    `${'a'.repeat(33)}.png`,
    `${'a'.repeat(63)}.png`,
    `${'a'.repeat(65)}.png`,
  ];

  for (const badName of invalidFilenames) {
    const resBad = await fetch(`${instance.base}/api/uploads/${badName}`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(resBad.status, 404, `Expected 404 for invalid filename length: ${badName}`);
  }
});

test('SPEC-93-01: POST /api/sync/assets/upload supports friendly filenames, header fallbacks, and uppercase hex', async () => {
  const content = Buffer.from('uppercase-and-fallback-headers-content');
  const contentSha = createHash('sha256').update(content).digest('hex');
  const upperSha = contentSha.toUpperCase();

  // 1. Friendly filename (e.g. announcement.png) preserves extension and saves under hash stem
  const friendlyRes = await fetch(
    `${instance.base}/api/sync/assets/upload?filename=announcement.png`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Content-SHA256': contentSha,
        'Content-Type': 'image/png',
      },
      body: content,
    }
  );
  assert.equal(friendlyRes.status, 200);
  const friendlyBody = await friendlyRes.json();
  assert.equal(friendlyBody.ok, true);
  assert.equal(friendlyBody.filename, `${contentSha}.png`);

  // 2. Test X-Asset-Identifier header fallback and X-Filename header fallback with uppercase
  const otherContent = Buffer.from('another-content-for-fallback-headers');
  const otherSha = createHash('sha256').update(otherContent).digest('hex');
  const res = await fetch(`${instance.base}/api/sync/assets/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'X-Asset-Identifier': otherSha.toUpperCase(),
      'X-Filename': `${otherSha}.jpg`,
      'Content-Type': 'image/jpeg',
    },
    body: otherContent,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.sha256, otherSha);
  assert.equal(body.filename, `${otherSha}.jpg`);
});

test('SPEC-93-01: OPTIONS preflight allowlist includes X-Asset-Identifier and X-Filename headers', async () => {
  const res = await fetch(`${instance.base}/api/sync/assets/upload`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'X-Asset-Identifier, X-Filename, X-Content-SHA256',
    },
  });
  assert.equal(res.status, 204);
  const allowHeaders = res.headers.get('Access-Control-Allow-Headers') || '';
  assert.ok(allowHeaders.includes('X-Asset-Identifier'), 'Allow-Headers must include X-Asset-Identifier');
  assert.ok(allowHeaders.includes('X-Filename'), 'Allow-Headers must include X-Filename');
  assert.ok(allowHeaders.includes('X-Content-SHA256'), 'Allow-Headers must include X-Content-SHA256');
});

test('SPEC-93-01: Concurrent cross-extension sync upload deduplication produces single file on disk', async () => {
  const concurrentContent = Buffer.from('concurrent-cross-extension-bytes-spec-93');
  const concurrentSha = createHash('sha256').update(concurrentContent).digest('hex');

  // Trigger concurrent uploads with different extensions (.png and .webp)
  const [resA, resB] = await Promise.all([
    fetch(`${instance.base}/api/sync/assets/upload?filename=${concurrentSha}.png`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Content-SHA256': concurrentSha,
        'Content-Type': 'image/png',
      },
      body: concurrentContent,
    }),
    fetch(`${instance.base}/api/sync/assets/upload?filename=${concurrentSha}.webp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Content-SHA256': concurrentSha,
        'Content-Type': 'image/webp',
      },
      body: concurrentContent,
    }),
  ]);

  assert.equal(resA.status, 200);
  assert.equal(resB.status, 200);
  const bodyA = await resA.json();
  const bodyB = await resB.json();

  assert.ok(bodyA.ok && bodyB.ok);
  // Exactly one should be deduplicated: true, and the other deduplicated: false
  assert.notEqual(bodyA.deduplicated, bodyB.deduplicated);

  // Exactly one file with this stem exists on disk
  const filesOnDisk = fs.readdirSync(uploadsDir).filter((f) => f.startsWith(concurrentSha));
  assert.equal(filesOnDisk.length, 1, `Expected exactly 1 file on disk for stem ${concurrentSha}, found: ${filesOnDisk}`);
});
