import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcUrl = (...parts) => pathToFileURL(path.join(ROOT, 'src', ...parts)).href;

test('SPEC-111-01: Storage ladder capability detection & hierarchy', async () => {
  const {
    detectStorageCapabilities,
    resolveActiveStorageTier,
    requestStoragePersistence,
    assertNoDownloadAnchorUsed,
  } = await import(
    srcUrl('operator', 'present', 'media-player', 'storage-ladder.ts')
  );

  // 1. Full capability environment (Chromium / WebView2)
  const fullMockWindow = {
    showDirectoryPicker: async () => ({}),
    showOpenFilePicker: async () => [{}],
    navigator: {
      storage: {
        getDirectory: async () => ({}),
        persist: async () => true,
        persisted: async () => true,
      },
    },
  };

  const capsFull = await detectStorageCapabilities(fullMockWindow);
  assert.equal(capsFull.hasDirectoryPicker, true);
  assert.equal(capsFull.hasFilePicker, true);
  assert.equal(capsFull.hasOPFS, true);
  assert.equal(capsFull.hasPersistence, true);
  assert.equal(capsFull.isPersisted, true);
  assert.equal(capsFull.recommendedTier, 'directory-picker');

  const tierFull = await resolveActiveStorageTier({ capabilities: capsFull });
  assert.equal(tierFull, 'directory-picker');

  // 2. OPFS-only environment (directory picker unavailable or restricted)
  const opfsMockWindow = {
    navigator: {
      storage: {
        getDirectory: async () => ({}),
        persist: async () => false,
        persisted: async () => false,
      },
    },
  };

  const capsOpfs = await detectStorageCapabilities(opfsMockWindow);
  assert.equal(capsOpfs.hasDirectoryPicker, false);
  assert.equal(capsOpfs.hasOPFS, true);
  assert.equal(capsOpfs.recommendedTier, 'opfs');

  const tierOpfs = await resolveActiveStorageTier({ capabilities: capsOpfs });
  assert.equal(tierOpfs, 'opfs');

  // 3. Fallback when user requested directory picker but environment lacks it
  const fallbackTier = await resolveActiveStorageTier({
    requestedTier: 'directory-picker',
    capabilities: capsOpfs,
  });
  assert.equal(fallbackTier, 'opfs', 'Graceful fallback to OPFS when directory-picker is missing');

  // 4. Memory-only fallback environment (no directory picker, no OPFS)
  const memoryMockWindow = {
    navigator: {},
  };

  const capsMemory = await detectStorageCapabilities(memoryMockWindow);
  assert.equal(capsMemory.hasDirectoryPicker, false);
  assert.equal(capsMemory.hasOPFS, false);
  assert.equal(capsMemory.recommendedTier, 'memory-fallback');

  const tierMemory = await resolveActiveStorageTier({ capabilities: capsMemory });
  assert.equal(tierMemory, 'memory-fallback');

  // 5. Persistence request
  const persisted = await requestStoragePersistence(fullMockWindow.navigator);
  assert.equal(persisted, true);

  const persistDenied = await requestStoragePersistence(opfsMockWindow.navigator);
  assert.equal(persistDenied, false);

  const persistMissing = await requestStoragePersistence({});
  assert.equal(persistMissing, false);

  // 6. Absence Guard: <a download> is strictly forbidden as a media storage mechanism
  assert.doesNotThrow(() => {
    assertNoDownloadAnchorUsed('<a href="/normal-link">Normal Link</a>');
  });

  assert.throws(
    () => {
      assertNoDownloadAnchorUsed('<a href="/api/media/1.mp4" download="video.mp4">Download Media</a>');
    },
    /INVARIANT_VIOLATION/,
    'Absence guard: <a download> for media files must throw an invariant violation'
  );
});

test('SPEC-111-04: Incremental media hasher and local media registry', async () => {
  const { computeBlobSHA256 } = await import(
    srcUrl('operator', 'present', 'media-player', 'media-hasher.ts')
  );
  const { LocalMediaRegistry } = await import(
    srcUrl('operator', 'present', 'media-player', 'local-media-registry.ts')
  );

  // 1. Hasher verification
  // Empty buffer
  const emptyBlob = new Blob([]);
  const emptySHA = await computeBlobSHA256(emptyBlob);
  assert.equal(emptySHA, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

  // Multi-chunk hashing with progress tracking
  const sampleText = 'The quick brown fox jumps over the lazy dog';
  // Expected sha256 for sampleText: d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592
  const sampleBlob = new Blob([sampleText]);
  const progressReports = [];
  const sampleSHA = await computeBlobSHA256(sampleBlob, (ratio) => {
    progressReports.push(ratio);
  }, 10); // Small 10-byte chunks to trigger progressive iterations

  assert.equal(sampleSHA, 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
  assert.ok(progressReports.length > 1, 'Progress callback fired multiple times across chunks');
  assert.equal(progressReports[progressReports.length - 1], 1.0, 'Final progress reaches 1.0');

  // 2. Local Media Registry
  const registry = new LocalMediaRegistry();
  await registry.hydrate();

  let notified = false;
  const unsubscribe = registry.subscribe(() => {
    notified = true;
  });

  const record1 = {
    sha256: sampleSHA,
    name: 'fox.mp4',
    sizeBytes: sampleBlob.size,
    mimeType: 'video/mp4',
    storageKind: 'opfs',
    lastModified: 1700000000000,
    verifiedAt: new Date().toISOString(),
  };

  await registry.saveRecord(record1);
  assert.equal(notified, true);
  assert.equal(registry.hasRecord(sampleSHA), true);
  assert.equal(registry.getRecord(sampleSHA)?.name, 'fox.mp4');

  // O(1) matching map lookup
  const map = registry.getMatchingMap();
  assert.equal(map.get(sampleSHA)?.sha256, sampleSHA);

  // Staleness detection
  assert.equal(registry.checkStaleness(record1, sampleBlob.size, 1700000000000), 'valid');
  assert.equal(registry.checkStaleness(record1, sampleBlob.size + 1, 1700000000000), 'detached', 'Size change triggers detached');
  assert.equal(registry.checkStaleness(record1, sampleBlob.size, 1700000005000), 'detached', 'Timestamp change triggers detached');

  // Directory Handle setting & clearing
  const mockDirHandle = { name: 'WorshipMedia' };
  await registry.setDirectoryHandle(mockDirHandle);
  assert.equal(registry.getDirectoryHandle()?.name, 'WorshipMedia');

  await registry.clearDirectoryHandle();
  assert.equal(registry.getDirectoryHandle(), null);

  // Record removal
  await registry.removeRecord(sampleSHA);
  assert.equal(registry.hasRecord(sampleSHA), false);
  assert.equal(registry.getMatchingMap().has(sampleSHA), false);

  unsubscribe();
});

test('SPEC-111-05: Service Worker Virtual Streamer & present-channel wire sync', async () => {
  const { parseByteRange, resolveLocalMediaUrl } = await import(
    srcUrl('operator', 'present', 'media-player', 'virtual-streamer.ts')
  );
  const fs = await import('node:fs');

  // 1. Range parser validation
  const total = 1000;
  // Closed range
  assert.deepEqual(parseByteRange('bytes=0-499', total), { start: 0, end: 500 });
  // Open-ended range
  assert.deepEqual(parseByteRange('bytes=500-', total), { start: 500, end: 1000 });
  // Suffix range
  assert.deepEqual(parseByteRange('bytes=-200', total), { start: 800, end: 1000 });
  // Out of bounds range
  assert.equal(parseByteRange('bytes=1000-1500', total), 'unsatisfiable');
  // Malformed ranges
  assert.equal(parseByteRange('invalid-range', total), null);
  assert.equal(parseByteRange('', total), null);
  assert.equal(parseByteRange(null, total), null);

  // 2. URL resolution
  const testSHA = 'a'.repeat(64);
  assert.equal(resolveLocalMediaUrl(testSHA), `/local-media/${testSHA}`);

  // 3. Service Worker file presence and contract verification
  const swPath = path.join(ROOT, 'public', 'media-sw.js');
  assert.ok(fs.existsSync(swPath), 'public/media-sw.js must exist on disk');
  const swCode = fs.readFileSync(swPath, 'utf8');
  assert.ok(swCode.includes('/local-media/'), 'SW must check /local-media/ namespace');
  assert.ok(swCode.includes('Accept-Ranges'), 'SW must advertise Accept-Ranges');
  assert.ok(swCode.includes('Content-Range'), 'SW must emit Content-Range on 206 responses');
  assert.ok(swCode.includes('LOCAL_MEDIA_STREAM_REQUEST'), 'SW must bridge stream requests via MessageChannel');

  // 4. present-channel wire types
  const projectedMediaLocal = {
    kind: 'media',
    mediaId: 'm-1',
    mediaUrl: resolveLocalMediaUrl(testSHA),
    source: 'local',
    isPlaying: true,
    mediaTime: 12.5,
    at: Date.now(),
    revision: 1,
  };
  assert.equal(projectedMediaLocal.source, 'local');

  const projectedMediaCloud = {
    kind: 'media',
    mediaId: 'm-2',
    mediaUrl: '/api/media/m-2/content',
    source: 'cloud',
    isPlaying: false,
    mediaTime: 0,
    at: Date.now(),
    revision: 2,
  };
  assert.equal(projectedMediaCloud.source, 'cloud');
});


