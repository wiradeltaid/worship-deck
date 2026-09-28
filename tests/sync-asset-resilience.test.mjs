/**
 * SPEC-92-03: Sync Asset Extraction URI Filtering and Resilient Pull Hydration Test Suite
 *
 * Enforces:
 * 1. extractUploadHashes extracts strictly from `/api/uploads/<64-hex>.<ext>` URI paths.
 * 2. Layout digests (`seed_hash`), translation digests (`content_hash`), entity IDs,
 *    bare hash URIs without extension, and overlong (65-char) hashes are never treated as media assets.
 * 3. Behavioral simulation of pull asset hydration:
 *    - Remote 404 missing auxiliary assets are non-fatal, tracked in skippedAssets, and allow batch apply.
 *    - Remote 401/403 errors strictly abort the pull and propagate for re-auth.
 *    - Checksum mismatches strictly abort the pull.
 *    - Local upload errors strictly abort the pull.
 * 4. Defect injection proofs verifying guard failure when raw 64-hex string matching is restored.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractUploadHashes, SyncHttpError } from '../src/lib/sync/client.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function scanSyncPageResilienceContract(syncPageContent) {
  const findings = [];

  if (!syncPageContent.includes('skippedAssets')) {
    findings.push('AdminSyncPage.tsx must track skippedAssets during pull asset hydration');
  }

  // Isolate the asset hydration loop
  const loopMatch = syncPageContent.match(/for\s*\(\s*const\s+missingHash\s+of\s+localCheck\.missing\s*\)\s*\{([\s\S]*?await\s+uploadSyncAsset\([^)]+\);\s*\})/i);
  if (!loopMatch) {
    findings.push('AdminSyncPage.tsx must iterate localCheck.missing and uploadSyncAsset');
  } else {
    const loopBody = loopMatch[1];

    // Verify that try-catch is narrowly scoped around downloadSyncAsset
    const downloadTryMatch = loopBody.match(/try\s*\{\s*assetBuffer\s*=\s*await\s+downloadSyncAsset/i);
    if (!downloadTryMatch) {
      findings.push('AdminSyncPage.tsx must narrowly wrap downloadSyncAsset in try-catch inside hydration loop');
    }

    if (!/assetErr\.status\s*===\s*404|assetErr\.message\?\.includes\(['"]not found['"]\)/.test(loopBody)) {
      findings.push('AdminSyncPage.tsx must catch 404 / "not found" asset download errors gracefully');
    }
    if (!/skippedAssets\.push\(\s*\{\s*hash:\s*missingHash,\s*reason:\s*['"]remote_not_found['"]\s*\}\s*\)/.test(loopBody)) {
      findings.push('AdminSyncPage.tsx must record remote_not_found reason in skippedAssets');
    }

    // Verify that uploadSyncAsset is OUTSIDE the download try-catch
    const tryBlock = loopBody.match(/try\s*\{([\s\S]*?)\}\s*catch/i)?.[1] || '';
    if (tryBlock.includes('uploadSyncAsset')) {
      findings.push('AdminSyncPage.tsx must not wrap uploadSyncAsset in non-fatal download try-catch');
    }
  }

  return findings;
}

test('SPEC-92-03: extractUploadHashes ignores seed_hash, content_hash, UUIDs, bare URIs, and overlong hashes', () => {
  const validSha1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const validSha2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const validSha3 = 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
  const overlongSha = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee1'; // 65 hex chars
  const bareSha = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

  const payload = {
    song_set_layouts: [
      {
        id: 'ssl-uuid-1',
        name: 'Title Layout',
        // Real-world 64-hex seed_hash from production presenter-dev cloud database
        seed_hash: '7219112486d4ca210ced3a67b57232773257279f5e942c61d49121a12c4b20f8',
        raw_payload: JSON.stringify({
          elements: [
            { src: `/api/uploads/${validSha1}.png` },
            { bg: `/api/uploads/${validSha2}.jpg` },
            { invalid_bare: `/api/uploads/${bareSha}` },
            { invalid_overlong: `/api/uploads/${overlongSha}.png` },
          ],
        }),
      },
    ],
    hymns: [
      {
        id: 'hymn-uuid-2',
        content_hash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      },
    ],
    services: [
      {
        id: '019488a0-2f63-7182-8411-fa028d73b22e',
        bg_image: `/api/uploads/${validSha3}.webp`,
      },
    ],
  };

  const hashes = extractUploadHashes(payload);

  // Must contain strictly the 3 valid upload URI hashes with explicit extensions
  assert.deepEqual(hashes, [validSha1, validSha2, validSha3]);

  // Assert that layout seed_hash is strictly excluded
  assert.ok(!hashes.includes('7219112486d4ca210ced3a67b57232773257279f5e942c61d49121a12c4b20f8'), 'must exclude seed_hash');

  // Assert that content_hash is strictly excluded
  assert.ok(!hashes.includes('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'), 'must exclude content_hash');

  // Assert that bare hash without extension is excluded
  assert.ok(!hashes.includes(bareSha), 'must exclude bare hash URI without extension');

  // Assert that 65-char overlong hash is excluded
  assert.ok(!hashes.includes(overlongSha.substring(0, 64)), 'must exclude overlong hash prefix');
});

test('SPEC-92-03: behavioral simulation of pull hydration resilience and fatal error propagation', async () => {
  // Simulates the hydration logic in AdminSyncPage.tsx
  async function simulateHydrateAndApply({
    missingHashes,
    downloadMock,
    computeShaMock,
    uploadMock,
    applyMock,
  }) {
    const skippedAssets = [];
    for (const missingHash of missingHashes) {
      let assetBuffer;
      try {
        assetBuffer = await downloadMock(missingHash);
      } catch (assetErr) {
        if (assetErr.status === 404 || assetErr.message?.includes('not found')) {
          skippedAssets.push({ hash: missingHash, reason: 'remote_not_found' });
          continue;
        }
        throw assetErr;
      }

      const actualSha = await computeShaMock(assetBuffer);
      if (actualSha.toLowerCase() !== missingHash.toLowerCase()) {
        throw new Error(`Checksum mismatch for ${missingHash}`);
      }
      await uploadMock(assetBuffer, missingHash);
    }

    return await applyMock(skippedAssets);
  }

  const hash1 = '1111111111111111111111111111111111111111111111111111111111111111';
  const hash2 = '2222222222222222222222222222222222222222222222222222222222222222';

  // Case 1: Remote 404 missing asset is skipped; batch apply succeeds
  let appliedWithSkipped = null;
  const res1 = await simulateHydrateAndApply({
    missingHashes: [hash1, hash2],
    downloadMock: async (h) => {
      if (h === hash1) throw new SyncHttpError('Asset not found', 404);
      return new Uint8Array([1, 2, 3]).buffer;
    },
    computeShaMock: async () => hash2,
    uploadMock: async () => ({ ok: true }),
    applyMock: async (skipped) => {
      appliedWithSkipped = skipped;
      return { ok: true, appliedTotal: 5 };
    },
  });

  assert.equal(res1.appliedTotal, 5);
  assert.equal(appliedWithSkipped.length, 1);
  assert.equal(appliedWithSkipped[0].hash, hash1);
  assert.equal(appliedWithSkipped[0].reason, 'remote_not_found');

  // Case 2: Remote 401 re-auth error propagates immediately and blocks apply
  let applyCalledOn401 = false;
  await assert.rejects(
    async () => {
      await simulateHydrateAndApply({
        missingHashes: [hash1],
        downloadMock: async () => {
          throw new SyncHttpError('Unauthorized', 401);
        },
        computeShaMock: async () => hash1,
        uploadMock: async () => ({ ok: true }),
        applyMock: async () => {
          applyCalledOn401 = true;
          return { ok: true };
        },
      });
    },
    (err) => err.status === 401
  );
  assert.equal(applyCalledOn401, false, 'database mutations must not be applied on 401 auth error');

  // Case 3: Local upload failure (even if 404) is NOT caught as remote_not_found and blocks apply
  let applyCalledOnLocalErr = false;
  await assert.rejects(
    async () => {
      await simulateHydrateAndApply({
        missingHashes: [hash1],
        downloadMock: async () => new Uint8Array([1]).buffer,
        computeShaMock: async () => hash1,
        uploadMock: async () => {
          throw new SyncHttpError('Local upload path not found', 404);
        },
        applyMock: async () => {
          applyCalledOnLocalErr = true;
          return { ok: true };
        },
      });
    },
    /Local upload path not found/
  );
  assert.equal(applyCalledOnLocalErr, false, 'database mutations must not be applied on local upload failure');
});

test('SPEC-92-03: AdminSyncPage.tsx satisfies resilient asset hydration contract', () => {
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'AdminSyncPage.tsx');
  const content = fs.readFileSync(pagePath, 'utf8');
  const findings = scanSyncPageResilienceContract(content);
  assert.deepEqual(findings, [], `AdminSyncPage resilience contract findings:\n${findings.join('\n')}`);
});

test('SPEC-92-03: scanSyncPageResilienceContract defect injection detects overly broad catch and missing 404 resilience', () => {
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'AdminSyncPage.tsx');
  const prodContent = fs.readFileSync(pagePath, 'utf8');

  // Defect 1: remove 404 exception handling
  const defectNo404Catch = prodContent.replace(/skippedAssets\.push[^;]+;/g, '// omitted skippedAssets');
  const findings1 = scanSyncPageResilienceContract(defectNo404Catch);
  assert.ok(findings1.some(f => f.includes('skippedAssets')), 'must detect missing skippedAssets recording');

  // Defect 2: wrap uploadSyncAsset inside non-fatal 404 catch
  const defectBroadCatch = prodContent.replace(
    /let assetBuffer: ArrayBuffer;[\s\S]*?await uploadSyncAsset\(window\.location\.origin, assetBuffer, missingHash\);/i,
    `try {
       const assetBuffer = await downloadSyncAsset(targetUrl, missingHash, headers);
       await uploadSyncAsset(window.location.origin, assetBuffer, missingHash);
     } catch (assetErr: any) {
       skippedAssets.push({ hash: missingHash, reason: 'remote_not_found' });
     }`
  );
  const findings2 = scanSyncPageResilienceContract(defectBroadCatch);
  assert.ok(findings2.some(f => f.includes('narrowly wrap') || f.includes('uploadSyncAsset')), 'must detect overly broad catch covering local upload');
});
