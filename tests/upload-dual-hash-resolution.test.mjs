/**
 * SPEC-96-01: Dual-Hash Upload Reference Resolution & Consumer Parity Tests
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const uploadsModulePath = path.join(rootDir, 'src', 'lib', 'uploads.ts');
const imagesModulePath = path.join(rootDir, 'src', 'lib', 'images.ts');
const assetSafetyPath = path.join(rootDir, 'src', 'lib', 'registry', 'asset-safety.ts');
const queriesPath = path.join(rootDir, 'src', 'lib', 'services', 'queries.ts');

const {
  LOCAL_UPLOAD_REF,
  isLocalUploadRef,
  localUploadFilename,
  resolveLocalUploadFsPath,
  getUploadsDir,
} = await import(pathToFileURL(uploadsModulePath).href);

const { isSafeImageUrl } = await import(pathToFileURL(imagesModulePath).href);
const { isRegistryImageRef } = await import(pathToFileURL(assetSafetyPath).href);

const valid32Hash = '34645da1a600f8824686c0ae7104bc1d';
const valid64Hash = '758572555dd73f59b7059cf8e1d841eff62ff3b505831410d6b17e7cfc4fc8a2';

test('SPEC-96-01: isLocalUploadRef accepts discrete 32-hex and 64-hex upload paths across allowed extensions', () => {
  const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

  for (const ext of extensions) {
    const ref32 = `/api/uploads/${valid32Hash}.${ext}`;
    const ref64 = `/api/uploads/${valid64Hash}.${ext}`;

    assert.equal(isLocalUploadRef(ref32), true, `32-hex ref with .${ext} must be valid`);
    assert.equal(isLocalUploadRef(ref64), true, `64-hex ref with .${ext} must be valid`);
    assert.equal(isLocalUploadRef(ref32.toUpperCase()), true, 'Case-insensitive match required');
    assert.equal(isLocalUploadRef(ref64.toUpperCase()), true, 'Case-insensitive match required');
  }
});

test('SPEC-96-01: isLocalUploadRef strictly rejects invalid lengths and non-discrete hashes', () => {
  const invalidHashes = [
    'a'.repeat(31), // 31 chars (too short for 32)
    'b'.repeat(33), // 33 chars (between 32 and 64)
    'c'.repeat(48), // 48 chars (between 32 and 64)
    'd'.repeat(63), // 63 chars (too short for 64)
    'e'.repeat(65), // 65 chars (too long)
    'g'.repeat(32), // Non-hex character
    'h'.repeat(64), // Non-hex character
  ];

  for (const h of invalidHashes) {
    const ref = `/api/uploads/${h}.png`;
    assert.equal(isLocalUploadRef(ref), false, `Invalid hash length/format ${h} must be rejected`);
  }

  // Reject unsupported extensions
  assert.equal(isLocalUploadRef(`/api/uploads/${valid32Hash}.svg`), false);
  assert.equal(isLocalUploadRef(`/api/uploads/${valid64Hash}.exe`), false);
  assert.equal(isLocalUploadRef(`/api/uploads/${valid64Hash}.html`), false);

  // Reject path traversal attempts
  assert.equal(isLocalUploadRef(`/api/uploads/../${valid32Hash}.png`), false);
  assert.equal(isLocalUploadRef(`/api/uploads/subdir/${valid64Hash}.jpg`), false);
  assert.equal(isLocalUploadRef(`\\api\\uploads\\${valid64Hash}.png`), false);
});

test('SPEC-96-01: localUploadFilename extracts lowercase filename segment for both 32-hex and 64-hex', () => {
  const fn32 = localUploadFilename(`/api/uploads/${valid32Hash.toUpperCase()}.PNG`);
  assert.equal(fn32, `${valid32Hash}.png`);

  const fn64 = localUploadFilename(`/api/uploads/${valid64Hash.toUpperCase()}.JPG`);
  assert.equal(fn64, `${valid64Hash}.jpg`);

  assert.equal(localUploadFilename('/api/uploads/invalid.png'), null);
});

test('SPEC-96-01: resolveLocalUploadFsPath resolves full path on disk and guards against escaping', () => {
  const uploadsDir = path.resolve(getUploadsDir());

  const fsPath32 = resolveLocalUploadFsPath(`/api/uploads/${valid32Hash}.png`);
  assert.equal(fsPath32, path.resolve(uploadsDir, `${valid32Hash}.png`));

  const fsPath64 = resolveLocalUploadFsPath(`/api/uploads/${valid64Hash}.jpg`);
  assert.equal(fsPath64, path.resolve(uploadsDir, `${valid64Hash}.jpg`));

  assert.equal(resolveLocalUploadFsPath('/api/uploads/invalid.png'), null);
});

test('SPEC-96-01: isRegistryImageRef and isSafeImageUrl accept 64-hex SHA-256 local upload references', () => {
  const ref64 = `/api/uploads/${valid64Hash}.jpg`;
  assert.equal(isSafeImageUrl(ref64), true, 'isSafeImageUrl must accept 64-hex upload URL');
  assert.equal(isRegistryImageRef(ref64), true, 'isRegistryImageRef must accept 64-hex upload URL');

  const ref32 = `/api/uploads/${valid32Hash}.png`;
  assert.equal(isSafeImageUrl(ref32), true, 'isSafeImageUrl must accept 32-hex upload URL');
  assert.equal(isRegistryImageRef(ref32), true, 'isRegistryImageRef must accept 32-hex upload URL');
});

test('SPEC-96-01: queries.ts orphaned cleanup resolves 64-hex filenames for unlinking', () => {
  const content = fs.readFileSync(queriesPath, 'utf8');
  assert.ok(
    content.includes('resolveLocalUploadFsPath(`/api/uploads/${filename}`)'),
    'queries.ts must use resolveLocalUploadFsPath to locate orphaned files for unlinking'
  );
  assert.ok(
    content.includes('fs.unlinkSync(filePath)'),
    'queries.ts must unlink resolved file path'
  );
});

test('SPEC-96-01: Behavioral orphan cleanup removes 64-hex SHA-256 upload file on service deletion', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orphan-64-test-'));
  const testDbPath = path.join(tmpDir, 'test.db');
  const testUploadsDir = path.join(tmpDir, 'uploads');
  fs.mkdirSync(testUploadsDir, { recursive: true });

  const prevDbPath = process.env.DB_PATH;
  const prevUploads = process.env.UPLOADS_DIR;
  process.env.DB_PATH = testDbPath;
  process.env.UPLOADS_DIR = testUploadsDir;

  try {
    const { getDb } = await import(pathToFileURL(path.join(rootDir, 'src', 'lib', 'db', 'index.ts')).href);
    const { narrowCreateBody } = await import(pathToFileURL(path.join(rootDir, 'src', 'lib', 'services', 'body.ts')).href);
    const { createService } = await import(pathToFileURL(path.join(rootDir, 'src', 'lib', 'services', 'create-service.ts')).href);
    const { deleteService } = await import(pathToFileURL(path.join(rootDir, 'src', 'lib', 'services', 'queries.ts')).href);

    const test64Filename = `${valid64Hash}.jpg`;
    const test64FilePath = path.join(testUploadsDir, test64Filename);
    fs.writeFileSync(test64FilePath, 'dummy-image-bytes');
    assert.equal(fs.existsSync(test64FilePath), true);

    const rawPayload = 'SABBATH, OCTOBER 10, 2026\nDIVINE SERVICE\nOpening Song: SDAH #159';
    const narrowed = narrowCreateBody({
      raw_payload: rawPayload,
      familyPhotoUrl: `/api/uploads/${test64Filename}`,
    });
    assert.equal(narrowed.ok, true);
    const created = createService(getDb(), narrowed.value);
    assert.equal(created.ok, true);

    const deleted = deleteService(getDb(), created.id);
    assert.equal(deleted, true);
    assert.equal(
      fs.existsSync(test64FilePath),
      false,
      'Orphaned 64-hex SHA-256 upload file must be unlinked and deleted from disk'
    );
  } finally {
    process.env.DB_PATH = prevDbPath;
    process.env.UPLOADS_DIR = prevUploads;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
});

test('SPEC-96-01: Defect Injection — 64-hex SHA-256 rejection causes test failure', () => {
  const legacyRegexOnly32 = /^\/api\/uploads\/([a-f0-9]{32}\.(?:jpe?g|png|gif|webp))$/i;
  const ref64 = `/api/uploads/${valid64Hash}.jpg`;
  assert.equal(
    legacyRegexOnly32.test(ref64),
    false,
    'Defect proof: legacy 32-hex regex fails on 64-hex SHA-256 upload'
  );
  assert.equal(
    LOCAL_UPLOAD_REF.test(ref64),
    true,
    'Corrected dual-hash regex must pass on 64-hex SHA-256 upload'
  );
});
