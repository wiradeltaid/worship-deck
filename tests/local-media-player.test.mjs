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

test('SPEC-111-06: Two-Tab MediaDrawer & Accessible 4-State Badge Contract (No Emojis)', async () => {
  const fs = await import('node:fs');

  // 1. Structural inspection of MediaStatusBadge
  const badgeSourcePath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaStatusBadge.tsx');
  assert.ok(fs.existsSync(badgeSourcePath), 'MediaStatusBadge.tsx must exist');
  const badgeCode = fs.readFileSync(badgeSourcePath, 'utf8');

  // Absence guard: No emoji characters in badge component
  // Unicode ranges for emojis: \p{Extended_Pictographic}
  const emojiRegex = /\p{Extended_Pictographic}/u;
  assert.equal(
    emojiRegex.test(badgeCode),
    false,
    'Absence guard: MediaStatusBadge must strictly avoid emoji characters'
  );

  // Accessible 4-state labels
  assert.ok(badgeCode.includes('Streaming'), 'Must contain visible label "Streaming"');
  assert.ok(badgeCode.includes('Mengunduh'), 'Must contain visible label "Mengunduh"');
  assert.ok(badgeCode.includes('Tersedia di lokal'), 'Must contain visible label "Tersedia di lokal"');
  assert.ok(badgeCode.includes('File terlepas'), 'Must contain visible label "File terlepas"');
  assert.ok(badgeCode.includes('role="progressbar"'), 'Must have role="progressbar" for downloading');
  assert.ok(badgeCode.includes('aria-valuenow'), 'Must have aria-valuenow attribute');

  // 2. Structural inspection of MediaDrawer two-tab layout
  const drawerSourcePath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaDrawer.tsx');
  assert.ok(fs.existsSync(drawerSourcePath), 'MediaDrawer.tsx must exist');
  const drawerCode = fs.readFileSync(drawerSourcePath, 'utf8');

  assert.ok(drawerCode.includes('Pustaka Cloud'), 'Must contain "Pustaka Cloud" tab');
  assert.ok(drawerCode.includes('Media Laptop'), 'Must contain "Media Laptop" tab');
  assert.ok(drawerCode.includes('tab-cloud'), 'Must contain data-testid="tab-cloud"');
  assert.ok(drawerCode.includes('tab-local'), 'Must contain data-testid="tab-local"');
  assert.ok(drawerCode.includes('btn-add-local-media'), 'Must provide "btn-add-local-media" manual import');
});

test('SPEC-111-07: Conscious Downloader Engine, Preflight Bulk Calculation, and Abort Verification', async () => {
  const { ConsciousDownloaderEngine } = await import(
    srcUrl('operator', 'present', 'media-player', 'downloader-engine.ts')
  );
  const { localMediaRegistry } = await import(
    srcUrl('operator', 'present', 'media-player', 'local-media-registry.ts')
  );

  const engine = new ConsciousDownloaderEngine();

  // 1. Bulk preflight calculation
  const mockItems = [
    { id: '1', name: 'Song 1', url: '/1.mp3', sha256: 'a'.repeat(64), size: 10 * 1024 * 1024, type: 'audio' },
    { id: '2', name: 'Song 2', url: '/2.mp3', sha256: 'b'.repeat(64), size: 25 * 1024 * 1024, type: 'audio' },
  ];
  const preflight = engine.calculateBulkPreflight(mockItems);
  assert.equal(preflight.count, 2);
  assert.equal(preflight.totalSizeBytes, 35 * 1024 * 1024);
  assert.equal(preflight.totalSizeFormatted, '35.0 MB');

  // Gigabyte formatting check
  const largePreflight = engine.calculateBulkPreflight([
    { id: '3', name: 'Large Video', url: '/large.mp4', sha256: 'c'.repeat(64), size: 1.5 * 1024 * 1024 * 1024, type: 'video' },
  ]);
  assert.equal(largePreflight.totalSizeFormatted, '1.50 GB');

  // 2. Cancellation
  const cancelSHA = 'd'.repeat(64);
  engine.enqueueItem({
    id: '4',
    name: 'Cancelled.mp4',
    url: 'http://localhost:9999/dummy',
    sha256: cancelSHA,
    size: 1000,
    type: 'video',
  });
  engine.cancelDownload(cancelSHA);
  assert.equal(engine.getProgress(cancelSHA)?.state, 'cancelled');

  // 3. Invariant: Unlinking from local registry leaves physical file intact
  const testDirHandle = {
    name: 'TestMediaDir',
    files: new Map([['test.mp4', { name: 'test.mp4' }]]),
  };
  await localMediaRegistry.setDirectoryHandle(testDirHandle);

  const record = {
    sha256: 'e'.repeat(64),
    name: 'test.mp4',
    sizeBytes: 500,
    mimeType: 'video/mp4',
    storageKind: 'directory-handle',
    lastModified: 1700000000000,
    verifiedAt: new Date().toISOString(),
  };
  await localMediaRegistry.saveRecord(record);
  assert.equal(localMediaRegistry.hasRecord(record.sha256), true);

  // Unlink
  await localMediaRegistry.removeRecord(record.sha256);
  assert.equal(localMediaRegistry.hasRecord(record.sha256), false);
  // Physical directory handle and its file are untouched
  assert.equal(testDirHandle.files.has('test.mp4'), true, 'Physical file must remain intact in directory handle');
});

test('SPEC-111-08: Local-first routing 4-condition predicate & MediaTopBar fixed 44px slot', async () => {
  const { routePlaybackSource } = await import(
    srcUrl('operator', 'present', 'media-player', 'playback-router.ts')
  );
  const { localMediaRegistry } = await import(
    srcUrl('operator', 'present', 'media-player', 'local-media-registry.ts')
  );
  const fs = await import('node:fs');

  const validSHA = 'f'.repeat(64);
  const localItem = {
    id: 'item-100',
    name: 'Song.mp4',
    url: '/api/uploads/song.mp4',
    sha256: validSHA,
    size: 2048,
    type: 'video',
  };

  // Condition 1: Not in index -> falls back to cloud
  const res1 = routePlaybackSource(localItem, { customSWActive: true });
  assert.equal(res1.canRouteLocal, false);
  assert.equal(res1.source, 'cloud');
  assert.equal(res1.reason, 'not-in-local-index');

  // Register in local index
  await localMediaRegistry.saveRecord({
    sha256: validSHA,
    name: 'Song.mp4',
    sizeBytes: 2048,
    mimeType: 'video/mp4',
    storageKind: 'opfs',
    lastModified: 1700000000000,
    verifiedAt: new Date().toISOString(),
  });

  // Condition 2: SW controller missing -> falls back to cloud
  const res2 = routePlaybackSource(localItem, { customSWActive: false });
  assert.equal(res2.canRouteLocal, false);
  assert.equal(res2.source, 'cloud');
  assert.equal(res2.reason, 'sw-controller-missing');

  // Condition 3: File stale on disk -> falls back to cloud
  const res3 = routePlaybackSource(localItem, {
    customSWActive: true,
    currentSizeBytes: 9999, // size changed!
  });
  assert.equal(res3.canRouteLocal, false);
  assert.equal(res3.source, 'cloud');
  assert.equal(res3.reason, 'file-stale-or-detached');

  // Condition 4: All predicates met -> Local priority!
  const res4 = routePlaybackSource(localItem, {
    customSWActive: true,
    currentSizeBytes: 2048,
    currentLastModified: 1700000000000,
  });
  assert.equal(res4.canRouteLocal, true);
  assert.equal(res4.source, 'local');
  assert.equal(res4.resolvedUrl, `/local-media/${validSHA}`);
  assert.equal(res4.reason, 'all-predicates-met');

  // Missing sha256 -> falls back to cloud
  const noShaItem = { id: 'item-200', name: 'NoSha.mp3', url: '/no-sha.mp3', type: 'audio' };
  const resNoSha = routePlaybackSource(noShaItem, { customSWActive: true });
  assert.equal(resNoSha.canRouteLocal, false);
  assert.equal(resNoSha.source, 'cloud');
  assert.equal(resNoSha.reason, 'no-sha256');

  // 2. Structural verification of MediaTopBar
  const topBarPath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaTopBar.tsx');
  assert.ok(fs.existsSync(topBarPath), 'MediaTopBar.tsx must exist');
  const topBarCode = fs.readFileSync(topBarPath, 'utf8');

  // Fixed height 44px (h-11)
  assert.ok(topBarCode.includes('h-11'), 'Must have fixed h-11 slot for zero layout shift');
  assert.ok(topBarCode.includes('data-testid="media-top-bar"'), 'Must have test ID');
  assert.ok(topBarCode.includes('media-top-bar-play'), 'Must contain play button');
  assert.ok(topBarCode.includes('media-top-bar-fade'), 'Must contain 3s fade button');
  assert.ok(topBarCode.includes('media-top-bar-mute'), 'Must contain mute button');
  assert.ok(topBarCode.includes('media-top-bar-take-off'), 'Must contain take-off button');
  assert.ok(topBarCode.includes('media-source-indicator'), 'Must contain source indicator');
  assert.ok(topBarCode.includes('e.preventDefault()'), 'Must contain spacebar focus safety handlers');

  // Verification that MediaTopBar is mounted in PresenterOperator
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const presenterCode = fs.readFileSync(presenterPath, 'utf8');
  assert.ok(presenterCode.includes('<MediaTopBar'), 'PresenterOperator must mount MediaTopBar');
});





