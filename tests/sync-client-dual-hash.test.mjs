/**
 * SPEC-93-02: Sync Client Dual-Hash Extraction & Asset Reference Model Test Suite
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractUploadHashes,
  extractUploadAssetRefs,
} from '../src/lib/sync/client.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function scanUploadRegexContract(clientSource) {
  const findings = [];
  if (!clientSource.includes('(?:[a-f0-9]{32}|[a-f0-9]{64})')) {
    findings.push('uploadPathRegex must enforce discrete 32 or 64 hex characters');
  }
  if (!clientSource.includes('(?:\/api)?\/uploads\/')) {
    findings.push('uploadPathRegex must match both /api/uploads/ and legacy /uploads/ paths');
  }
  return findings;
}

test('SPEC-93-02: Static contract scanning for discrete dual-hash upload regex', () => {
  const clientPath = path.join(root, 'src', 'lib', 'sync', 'client.ts');
  const clientSource = fs.readFileSync(clientPath, 'utf8');
  assert.deepEqual(scanUploadRegexContract(clientSource), []);
});

test('SPEC-93-02: extractUploadHashes extracts 32-hex and 64-hex paths with /api/uploads/ and /uploads/', () => {
  const fixture = {
    services: [
      {
        id: 1,
        title: 'Sunday Service',
        raw_payload: JSON.stringify({
          slides: [
            {
              background_image: '/api/uploads/34645da1a600f8824686c0ae7104bc1d.png',
            },
            {
              background_image: '/uploads/c30a2f96e172ee46173398f9dca001d5.jpg',
            },
            {
              background_image: '/api/uploads/5c6834af7d25ed672b3bb5a07ef66bdb1a87efdb311e2ea4eae8ef6b961d1e56.webp',
            },
            {
              background_image: '/uploads/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.png',
            },
          ],
        }),
      },
    ],
    background_library: [
      {
        id: 10,
        url: '/api/uploads/34645da1a600f8824686c0ae7104bc1d.png', // duplicate of first slide
      },
    ],
  };

  const hashes = extractUploadHashes(fixture);
  assert.equal(hashes.length, 4, 'Should extract exactly 4 deduplicated hashes');
  assert.deepEqual(hashes, [
    '34645da1a600f8824686c0ae7104bc1d',
    '5c6834af7d25ed672b3bb5a07ef66bdb1a87efdb311e2ea4eae8ef6b961d1e56',
    'c30a2f96e172ee46173398f9dca001d5',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  ]);
});

test('SPEC-93-02: extractUploadAssetRefs returns structured asset reference metadata', () => {
  const payload = {
    announcements: [
      {
        image_url: '/api/uploads/34645da1a600f8824686c0ae7104bc1d.png',
      },
      {
        image_url: '/uploads/5c6834af7d25ed672b3bb5a07ef66bdb1a87efdb311e2ea4eae8ef6b961d1e56.webp',
      },
    ],
  };

  const refs = extractUploadAssetRefs(payload);
  assert.equal(refs.length, 2);

  const ref1 = refs.find((r) => r.hash === '34645da1a600f8824686c0ae7104bc1d');
  assert.ok(ref1);
  assert.equal(ref1.filename, '34645da1a600f8824686c0ae7104bc1d.png');
  assert.equal(ref1.extension, 'png');

  const ref2 = refs.find((r) => r.hash === '5c6834af7d25ed672b3bb5a07ef66bdb1a87efdb311e2ea4eae8ef6b961d1e56');
  assert.ok(ref2);
  assert.equal(ref2.filename, '5c6834af7d25ed672b3bb5a07ef66bdb1a87efdb311e2ea4eae8ef6b961d1e56.webp');
  assert.equal(ref2.extension, 'webp');
});

test('SPEC-93-02: extractUploadHashes strictly excludes non-upload digests and ambiguous lengths', () => {
  const metadataOnlyPayload = {
    song_set_layouts: [
      {
        role: 'title',
        seed_hash: '7219112486d4ca790a1bc760ea42bcad5e3ec3dc76865228c2c77d943ff78fbb',
      },
    ],
    bible_translations: [
      {
        code: 'kjv',
        content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    ],
    entities: [
      {
        global_id: '01923456-789a-7bcd-ef01-23456789abcd',
      },
    ],
    ambiguous_paths: [
      '/api/uploads/' + 'a'.repeat(31) + '.png',
      '/api/uploads/' + 'a'.repeat(33) + '.png',
      '/api/uploads/' + 'a'.repeat(63) + '.png',
      '/api/uploads/' + 'a'.repeat(65) + '.png',
      'https://external.org/images/34645da1a600f8824686c0ae7104bc1d.png',
    ],
  };

  const hashes = extractUploadHashes(metadataOnlyPayload);
  assert.equal(hashes.length, 0, 'Must extract ZERO hashes for non-upload metadata and ambiguous paths');
});

test('SPEC-93-02: Defect injection proof — pre-SPEC-93 regex fails 32-hex extraction', () => {
  const preSpec93Regex = /\/api\/uploads\/([a-f0-9]{64})\.[a-z0-9]+/gi;
  const legacyPath = '/api/uploads/34645da1a600f8824686c0ae7104bc1d.png';

  preSpec93Regex.lastIndex = 0;
  const match = preSpec93Regex.exec(legacyPath);
  assert.equal(match, null, 'Pre-SPEC-93 64-hex only regex must fail to match legacy 32-hex path');
});
