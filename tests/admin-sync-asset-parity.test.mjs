/**
 * SPEC-93-03: Admin Sync Page Asset Hydration Parity & Push Resilience Test Suite
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verifyAndResolveSyncAsset,
  resolvePullOutcomeMessage,
} from '../src/lib/sync/client.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function scanSyncPageAssetParityContract(source) {
  const findings = [];
  if (!source.includes('extractUploadAssetRefs(')) {
    findings.push('AdminSyncPage must extract structured asset references using extractUploadAssetRefs');
  }
  if (!source.includes('verifyAndResolveSyncAsset(')) {
    findings.push('AdminSyncPage must verify and resolve sync assets via verifyAndResolveSyncAsset');
  }
  if (!source.includes('await uploadSyncAsset(targetUrl, assetBuffer, missingHash, filename, headers)')) {
    findings.push('executePush must forward canonical filename to uploadSyncAsset');
  }
  if (!source.includes('await uploadSyncAsset(window.location.origin, assetBuffer, missingHash, filename)')) {
    findings.push('executePull must forward canonical filename to uploadSyncAsset');
  }
  if (!source.includes('resolvePullOutcomeMessage(')) {
    findings.push('AdminSyncPage must resolve pull outcome message via resolvePullOutcomeMessage');
  }
  return findings;
}

test('SPEC-93-03: Static contract scanning for AdminSyncPage asset hydration parity and outcome fidelity', () => {
  const syncPagePath = path.join(root, 'spa', 'src', 'pages', 'AdminSyncPage.tsx');
  const syncPageSource = fs.readFileSync(syncPagePath, 'utf8');

  assert.deepEqual(scanSyncPageAssetParityContract(syncPageSource), []);
});

test('SPEC-93-03: Defect injection proofs for AdminSyncPage contract scanner', () => {
  const syncPagePath = path.join(root, 'spa', 'src', 'pages', 'AdminSyncPage.tsx');
  const syncPageSource = fs.readFileSync(syncPagePath, 'utf8');

  // Defect 1: Missing extractUploadAssetRefs
  const def1 = syncPageSource.replaceAll('extractUploadAssetRefs(', 'extractUploadHashes(');
  assert.ok(scanSyncPageAssetParityContract(def1).length > 0);

  // Defect 2: Missing verifyAndResolveSyncAsset
  const def2 = syncPageSource.replaceAll('verifyAndResolveSyncAsset(', '/* bypassed */(');
  assert.ok(scanSyncPageAssetParityContract(def2).length > 0);

  // Defect 3: Dropping filename in push
  const def3 = syncPageSource.replace(
    'await uploadSyncAsset(targetUrl, assetBuffer, missingHash, filename, headers)',
    'await uploadSyncAsset(targetUrl, assetBuffer, missingHash, "", headers)'
  );
  assert.ok(scanSyncPageAssetParityContract(def3).length > 0);

  // Defect 4: Dropping filename in pull
  const def4 = syncPageSource.replace(
    'await uploadSyncAsset(window.location.origin, assetBuffer, missingHash, filename)',
    'await uploadSyncAsset(window.location.origin, assetBuffer, missingHash)'
  );
  assert.ok(scanSyncPageAssetParityContract(def4).length > 0);

  // Defect 5: Bypassing resolvePullOutcomeMessage
  const def5 = syncPageSource.replace('resolvePullOutcomeMessage(', '/* bypassed */(');
  assert.ok(scanSyncPageAssetParityContract(def5).length > 0);
});

test('SPEC-93-03: verifyAndResolveSyncAsset enforces discrete format and dual-mode verification', async () => {
  const sampleBuf = Buffer.from('test-content-verification-spec-93');
  const valid64Sha = createHash('sha256').update(sampleBuf).digest('hex');
  const legacy32 = '34645da1a600f8824686c0ae7104bc1d';

  // 1. Valid 64-hex SHA-256 acceptance with canonical filename
  const res64 = await verifyAndResolveSyncAsset(valid64Sha, sampleBuf, {
    hash: valid64Sha,
    filename: `${valid64Sha}.webp`,
    extension: 'webp',
  });
  assert.equal(res64.filename, `${valid64Sha}.webp`);

  // 2. Reject 64-hex SHA-256 mismatch on non-empty buffer
  const corruptedBuf = Buffer.from('different-corrupted-bytes');
  await assert.rejects(
    async () => {
      await verifyAndResolveSyncAsset(valid64Sha, corruptedBuf);
    },
    /Asset checksum verification failed/
  );

  // 3. Valid non-empty 32-hex legacy token acceptance with canonical filename
  const res32 = await verifyAndResolveSyncAsset(legacy32, sampleBuf, {
    hash: legacy32,
    filename: `${legacy32}.png`,
    extension: 'png',
  });
  assert.equal(res32.filename, `${legacy32}.png`);

  // 4. Reject empty buffer for legacy 32-hex token
  await assert.rejects(
    async () => {
      await verifyAndResolveSyncAsset(legacy32, new ArrayBuffer(0));
    },
    /Empty asset buffer for legacy asset/
  );

  // 5. Reject malformed non-hex or non-discrete lengths (e.g. 31, 33, 63, 65, or non-hex)
  const invalidHashes = [
    'a'.repeat(31),
    'a'.repeat(33),
    'a'.repeat(63),
    'a'.repeat(65),
    'non-hex-identifier-with-32-chars!',
  ];
  for (const bad of invalidHashes) {
    await assert.rejects(
      async () => {
        await verifyAndResolveSyncAsset(bad, sampleBuf);
      },
      /Invalid asset identifier format/
    );
  }
});

test('SPEC-93-03: resolvePullOutcomeMessage enforces outcome fidelity', () => {
  // 1. Zero skipped assets -> success status
  const successOutcome = resolvePullOutcomeMessage(15, 0);
  assert.equal(successOutcome.type, 'success');
  assert.ok(successOutcome.text.includes('Pull completed successfully! Applied 15 updates'));

  // 2. Non-zero skipped assets -> degraded error status with missing assets notice
  const degradedOutcome = resolvePullOutcomeMessage(15, 3);
  assert.equal(degradedOutcome.type, 'error');
  assert.ok(degradedOutcome.text.includes('Sync completed with missing assets: applied 15 updates'));
  assert.ok(degradedOutcome.text.includes('3 media assets could not be downloaded'));
});
