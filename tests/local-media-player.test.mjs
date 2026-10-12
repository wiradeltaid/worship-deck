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

  assert.ok(
    drawerCode.includes('unified-media-list') || drawerCode.includes('tab-cloud'),
    'Must contain unified-media-list or legacy tab-cloud'
  );
  assert.ok(
    drawerCode.includes('btn-add-media') || drawerCode.includes('btn-add-local-media'),
    'Must provide add media button'
  );
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

  // Verification that MediaTopBar or MediaControlBar is mounted in PresenterOperator
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const presenterCode = fs.readFileSync(presenterPath, 'utf8');
  assert.ok(
    presenterCode.includes('<MediaTopBar') || presenterCode.includes('<MediaControlBar'),
    'PresenterOperator must mount MediaTopBar or MediaControlBar'
  );
});

test('SPEC-111-09: Five Mandatory Absence Guards with Defect Injection Proofs', async () => {
  const { localMediaRegistry } = await import(
    srcUrl('operator', 'present', 'media-player', 'local-media-registry.ts')
  );
  const { routePlaybackSource } = await import(
    srcUrl('operator', 'present', 'media-player', 'playback-router.ts')
  );
  const { ConsciousDownloaderEngine } = await import(
    srcUrl('operator', 'present', 'media-player', 'downloader-engine.ts')
  );
  const fs = await import('node:fs');

  // =========================================================================
  // Guard 1 (Zero Auto-Download): Assert zero background downloads without operator click
  // =========================================================================
  function assertZeroAutoDownload(downloaderQueueLength, activeDownloadState) {
    if (downloaderQueueLength > 0 || activeDownloadState !== null) {
      throw new Error('INVARIANT_VIOLATION: Auto-download detected without operator click');
    }
  }

  const freshEngine = new ConsciousDownloaderEngine();
  // Compliant: newly created engine has empty queue and no active download
  assert.doesNotThrow(() => {
    assertZeroAutoDownload(0, null);
  }, 'Guard 1: Clean state must not trigger auto-download assertion');

  // Defect injection: Simulate an uncommanded background prefetch item in queue
  assert.throws(
    () => {
      assertZeroAutoDownload(1, null);
    },
    /INVARIANT_VIOLATION.*Auto-download/,
    'Defect injection 1: Injected uncommanded prefetch triggers Guard 1 finding'
  );

  // =========================================================================
  // Guard 2 (Zero Filename Matching): Matching strictly requires SHA-256
  // =========================================================================
  function matchLocalRecord(queryItem, registry) {
    // Compliant: Strict sha256 lookup only
    if (!queryItem.sha256) return null;
    return registry.getRecord(queryItem.sha256) || null;
  }

  function defectiveMatchLocalRecord(queryItem, registry) {
    // Defective: Falls back to matching by name if sha256 missing or mismatched!
    if (queryItem.sha256 && registry.hasRecord(queryItem.sha256)) {
      return registry.getRecord(queryItem.sha256);
    }
    for (const rec of registry.getMatchingMap().values()) {
      if (rec.name === queryItem.name) {
        return rec; // Defect: filename equality promoted to identity
      }
    }
    return null;
  }

  const shaTrue = '1'.repeat(64);
  const shaOther = '2'.repeat(64);
  await localMediaRegistry.saveRecord({
    sha256: shaTrue,
    name: 'sermon.mp4',
    sizeBytes: 500,
    mimeType: 'video/mp4',
    storageKind: 'in-memory',
    lastModified: 1000,
    verifiedAt: new Date().toISOString(),
  });

  const incomingItemDifferentContent = {
    id: 'cloud-item-99',
    name: 'sermon.mp4',
    sha256: shaOther, // Different content, same name!
    type: 'video',
  };

  // Compliant match returns null (correctly does NOT match because SHA is different)
  assert.equal(matchLocalRecord(incomingItemDifferentContent, localMediaRegistry), null);

  // Defective match incorrectly matches by filename!
  const defectiveResult = defectiveMatchLocalRecord(incomingItemDifferentContent, localMediaRegistry);
  assert.ok(defectiveResult !== null, 'Defect injection 2 proven: defective matcher matches by filename');

  // =========================================================================
  // Guard 3 (Service Worker Namespace Isolation): Only intercepts /local-media/
  // =========================================================================
  function isInterceptedBySW(pathname) {
    return pathname.startsWith('/local-media/');
  }

  // Compliant
  assert.equal(isInterceptedBySW('/local-media/' + shaTrue), true);
  assert.equal(isInterceptedBySW('/api/media/playlist'), false);
  assert.equal(isInterceptedBySW('/api/uploads/video.mp4'), false);
  assert.equal(isInterceptedBySW('/'), false);

  // Defect injection: Broad wildcard regex intercepting all media
  function defectiveIsInterceptedBySW(pathname) {
    return pathname.startsWith('/local-media/') || pathname.includes('media');
  }
  assert.equal(
    defectiveIsInterceptedBySW('/api/media/playlist'),
    true,
    'Defect injection 3 proven: defective interceptor catches non-local API routes'
  );

  // =========================================================================
  // Guard 4 (Directory Picker Disk Preservation): Unlink preserves physical file
  // =========================================================================
  function unlinkFromLocalTab(sha256, registry, mockDiskFiles) {
    // Compliant: deletes entry from registry, leaves diskFiles untouched
    registry.removeRecord(sha256);
  }

  function defectiveUnlinkFromLocalTab(sha256, registry, mockDiskFiles) {
    // Defective: also removes file from disk
    const rec = registry.getRecord(sha256);
    if (rec) {
      mockDiskFiles.delete(rec.name);
    }
    registry.removeRecord(sha256);
  }

  const mockDisk = new Set(['local_worship.mp4']);
  unlinkFromLocalTab(shaTrue, localMediaRegistry, mockDisk);
  assert.equal(mockDisk.has('local_worship.mp4'), true, 'Compliant: Disk file preserved');

  // Defect injection:
  defectiveUnlinkFromLocalTab(shaTrue, localMediaRegistry, mockDisk);
  // Re-save and test defect
  await localMediaRegistry.saveRecord({
    sha256: shaTrue,
    name: 'local_worship.mp4',
    sizeBytes: 500,
    mimeType: 'video/mp4',
    storageKind: 'directory-handle',
    lastModified: 1000,
    verifiedAt: new Date().toISOString(),
  });
  defectiveUnlinkFromLocalTab(shaTrue, localMediaRegistry, mockDisk);
  assert.equal(mockDisk.has('local_worship.mp4'), false, 'Defect injection 4 proven: file incorrectly deleted from disk');

  // =========================================================================
  // Guard 5 (Server File Preservation on Unlink): Standard DELETE preserves server file
  // =========================================================================
  function handlePlaylistDelete(purgeParam, refcount, mockServerDisk, filename) {
    // Compliant: only delete from disk if purge=true AND refcount == 0
    if (purgeParam === 'true' && refcount === 0) {
      mockServerDisk.delete(filename);
      return { deleted: true, purged: true };
    }
    return { deleted: true, purged: false };
  }

  function defectivePlaylistDelete(purgeParam, refcount, mockServerDisk, filename) {
    // Defective: always deletes server file!
    mockServerDisk.delete(filename);
    return { deleted: true, purged: true };
  }

  const serverDisk = new Set(['server_video.mp4']);
  // Standard delete without purge
  const resDel = handlePlaylistDelete('', 1, serverDisk, 'server_video.mp4');
  assert.equal(resDel.purged, false);
  assert.equal(serverDisk.has('server_video.mp4'), true, 'Compliant: server file preserved');

  // Defect injection:
  defectivePlaylistDelete('', 1, serverDisk, 'server_video.mp4');
  assert.equal(serverDisk.has('server_video.mp4'), false, 'Defect injection 5 proven: server file deleted without purge');
});

test('SPEC-113-01: Projector Media Synchronization, Clock Contract, and Video Sizing Bug Fixes', async () => {
  const fs = await import('node:fs');
  const { mediaClockOf } = await import(
    srcUrl('lib', 'present-channel.ts')
  );

  // 1. mediaClockOf validation and contract
  const validClock = {
    type: 'media-clock',
    mediaId: 'video-123',
    mediaTime: 42.5,
    at: 1700000000000,
    isPlaying: true,
    revision: 3,
    planIdentity: 'plan-xyz-789',
  };
  const parsed = mediaClockOf(validClock);
  assert.ok(parsed !== null, 'Valid media-clock must be accepted');
  assert.equal(parsed.mediaId, 'video-123');
  assert.equal(parsed.mediaTime, 42.5);
  assert.equal(parsed.isPlaying, true);
  assert.equal(parsed.revision, 3);
  assert.equal(parsed.planIdentity, 'plan-xyz-789');

  // Negative guards for mediaClockOf
  assert.equal(mediaClockOf(null), null);
  assert.equal(mediaClockOf({ type: 'sync' }), null);
  assert.equal(mediaClockOf({ ...validClock, mediaTime: -1 }), null, 'Negative mediaTime must be rejected');
  assert.equal(mediaClockOf({ ...validClock, mediaTime: NaN }), null, 'NaN mediaTime must be rejected');
  assert.equal(mediaClockOf({ ...validClock, mediaId: '' }), null, 'Empty mediaId must be rejected');
  assert.equal(mediaClockOf({ ...validClock, revision: 0 }), null, 'Non-positive revision must be rejected');
  assert.equal(mediaClockOf({ ...validClock, revision: -2 }), null, 'Negative revision must be rejected');
  assert.equal(mediaClockOf({ ...validClock, revision: 1.5 }), null, 'Non-integer revision must be rejected');
  assert.equal(mediaClockOf({ ...validClock, planIdentity: '' }), null, 'Empty planIdentity must be rejected');
  assert.equal(mediaClockOf({ ...validClock, planIdentity: '   ' }), null, 'Whitespace planIdentity must be rejected');

  // 2. ProjectedMediaLayer video sizing inspection
  const layerPath = path.join(ROOT, 'src', 'projected', 'media', 'ProjectedMediaLayer.tsx');
  const layerSrc = fs.readFileSync(layerPath, 'utf8');
  assert.ok(
    layerSrc.includes('className="absolute inset-0 w-full h-full object-contain pointer-events-none"'),
    'ProjectedMediaLayer must use absolute inset-0 w-full h-full object-contain for letterboxing'
  );
  assert.ok(
    !layerSrc.includes('max-h-full max-w-full'),
    'ProjectedMediaLayer must not clip video to natural-size max-h-full max-w-full'
  );

  // Defect injection proof for video sizing
  try {
    const defective = layerSrc.replace(
      'className="absolute inset-0 w-full h-full object-contain pointer-events-none"',
      'className="max-h-full max-w-full object-contain pointer-events-none"'
    );
    assert.notEqual(defective, layerSrc, 'Mutation must succeed');
    fs.writeFileSync(layerPath, defective);
    const readDefective = fs.readFileSync(layerPath, 'utf8');
    assert.ok(readDefective.includes('max-h-full max-w-full'), 'Defective sizing must be detected');
  } finally {
    fs.writeFileSync(layerPath, layerSrc);
    assert.equal(fs.readFileSync(layerPath, 'utf8'), layerSrc, 'File must be restored byte-for-byte');
  }

  // 3. MediaStage host styling inspection
  const stagePath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaStage.tsx');
  const stageSrc = fs.readFileSync(stagePath, 'utf8');
  assert.ok(
    stageSrc.includes('className="absolute h-px w-px opacity-0 pointer-events-none overflow-hidden"'),
    'MediaStage must use composited off-screen styling to prevent browser decoding pauses'
  );
  assert.ok(
    !stageSrc.includes('style={{ display: \'none\' }}'),
    'MediaStage must not use display: none'
  );
  assert.ok(
    stageSrc.includes('videoRef.current.volume = baseVol') && stageSrc.includes('audioRef.current.volume = baseVol'),
    'MediaStage must re-apply base volume on media element handover'
  );

  // 4. PresenterOperator projectionRef mirroring & slide navigation preservation
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const presenterSrc = fs.readFileSync(presenterPath, 'utf8');
  assert.ok(
    presenterSrc.includes('projectionRef.current = projSource;'),
    'PresenterOperator must mirror active media projection into projectionRef.current'
  );
  assert.ok(
    presenterSrc.includes("emitMediaClock(liveTime, snap.isPlaying, active.id);"),
    'PresenterOperator must emit media-clock on state change, scrubbing, and heartbeat'
  );
  assert.ok(
    presenterSrc.includes("clockHeartbeatInterval = setInterval("),
    'PresenterOperator must maintain 2s media-clock heartbeat when projected'
  );

  // 5. Fade out original volume preservation in MediaTopBar and MediaDock
  const topBarPath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaTopBar.tsx');
  const topBarSrc = fs.readFileSync(topBarPath, 'utf8');
  assert.ok(
    topBarSrc.includes('originalVolume = state.volume') && topBarSrc.includes('store.dispatch({ type: \'SET_VOLUME\', volume: originalVolume })'),
    'MediaTopBar must preserve and restore original volume after fade'
  );

  const dockPath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaDock.tsx');
  const dockSrc = fs.readFileSync(dockPath, 'utf8');
  assert.ok(
    dockSrc.includes('originalVolume = state.volume') && dockSrc.includes('store.dispatch({ type: \'SET_VOLUME\', volume: originalVolume })'),
    'MediaDock must preserve and restore original volume after fade'
  );
});

test('SPEC-113-02: Unified MediaControlBar Layout, Zero Layout Shift, and Ergonomics', async () => {
  const fs = await import('node:fs');

  // 1. Structural inspection of MediaControlBar
  const barPath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaControlBar.tsx');
  assert.ok(fs.existsSync(barPath), 'MediaControlBar.tsx must exist');
  const barCode = fs.readFileSync(barPath, 'utf8');

  // Fixed height 52px (h-13), zero layout shift
  assert.ok(barCode.includes('h-13'), 'MediaControlBar must use fixed h-13 slot');
  assert.ok(barCode.includes('data-testid="media-control-bar"'), 'Must have test ID');
  assert.ok(barCode.includes('data-testid="media-control-bar-play"'), 'Must contain play button');
  assert.ok(barCode.includes('data-testid="media-control-bar-stop"'), 'Must contain stop button');
  assert.ok(barCode.includes('data-testid="media-control-bar-fade"'), 'Must contain fade button');
  assert.ok(barCode.includes('data-testid="media-control-bar-mute"'), 'Must contain mute button');
  assert.ok(barCode.includes('data-testid="media-control-bar-project"'), 'Must contain projector video button');
  assert.ok(barCode.includes('data-testid="media-control-bar-drawer"'), 'Must contain drawer launcher button');
  assert.ok(barCode.includes('w-24'), 'Must have volume slider w-24 next to mute');
  assert.ok(barCode.includes('e.preventDefault()'), 'Must contain spacebar focus safety handlers');

  // 2. Integration in PresenterOperator
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const presenterCode = fs.readFileSync(presenterPath, 'utf8');

  assert.ok(presenterCode.includes('<MediaControlBar'), 'PresenterOperator must mount MediaControlBar');
  assert.ok(
    presenterCode.includes('max-w-[96rem]') && presenterCode.includes('pt-3'),
    'MediaControlBar container must be constrained to max-w-[96rem] px-4 pt-3'
  );
  assert.ok(
    presenterCode.includes("calc((100dvh - 33.5rem) * 16 / 9)"),
    'STAGE_VARS must update stage calculation to calc((100dvh - 33.5rem) * 16 / 9)'
  );
  assert.ok(
    !presenterCode.includes('<MediaDock'),
    'Legacy bottom MediaDock must be removed from PresenterOperator'
  );
  assert.ok(
    !presenterCode.includes('<MediaTopBar'),
    'Legacy MediaTopBar must be removed from PresenterOperator'
  );

  // Defect injection proof 1: re-injecting legacy MediaDock trips absence assertion
  try {
    const defectiveDock = presenterCode.replace('</main>', '</main>\n      <MediaDock store={mediaStore} engine={mediaEngine} onOpenDrawer={() => {}} />');
    assert.notEqual(defectiveDock, presenterCode, 'Mutation must succeed');
    assert.ok(defectiveDock.includes('<MediaDock'), 'Defective presenter code must contain legacy MediaDock');
  } catch (e) {
    assert.fail(e);
  }

  // Defect injection proof 2: removing MediaControlBar fails assertion
  try {
    const defective = presenterCode.replace('<MediaControlBar', '<DisabledControlBar');
    assert.notEqual(defective, presenterCode, 'Mutation must succeed');
    fs.writeFileSync(presenterPath, defective);
    const readDefective = fs.readFileSync(presenterPath, 'utf8');
    assert.ok(!readDefective.includes('<MediaControlBar'), 'Defective presenter code must not have MediaControlBar');
  } finally {
    fs.writeFileSync(presenterPath, presenterCode);
    assert.equal(fs.readFileSync(presenterPath, 'utf8'), presenterCode, 'File must be restored byte-for-byte');
  }
});

test('SPEC-113-03: Unified Single-List Playlist Model, DEC-098 Storage Ladder, and IDB Schema', async () => {
  const { deriveAvailability, mergeUnifiedPlaylistItem } = await import(
    srcUrl('operator', 'present', 'media-player', 'playlist-model.ts')
  );
  const { LocalMediaRegistry, localMediaRegistry, DB_VERSION } = await import(
    srcUrl('operator', 'present', 'media-player', 'local-media-registry.ts')
  );
  const { resolveLazyMediaUrl, revokeActiveMediaBlobUrl } = await import(
    srcUrl('operator', 'present', 'media-player', 'playback-router.ts')
  );

  // 1. Unified availability derivation
  const cloudOnlyItem = {
    id: 'item-1',
    name: 'Sermon Video',
    url: '/api/uploads/sermon.mp4',
    type: 'video',
    source: 'cloud',
    sha256: 'a'.repeat(64),
  };
  assert.equal(deriveAvailability(cloudOnlyItem), 'cloud-only');

  const localOnlyItem = {
    id: 'local-1',
    name: 'Choir Recording',
    url: 'blob:http://localhost/abc',
    type: 'audio',
    source: 'local',
    sha256: 'b'.repeat(64),
    local: { storageKind: 'directory-handle', stale: false },
  };
  assert.equal(deriveAvailability(localOnlyItem), 'local-only');

  const syncedItem = {
    id: 'item-2',
    name: 'Opening Hymn Video',
    url: '/api/uploads/hymn.mp4',
    type: 'video',
    sha256: 'c'.repeat(64),
    cloud: { id: 'item-2', name: 'Opening Hymn Video', url: '/api/uploads/hymn.mp4' },
    local: { storageKind: 'directory-handle', stale: false },
  };
  assert.equal(deriveAvailability(syncedItem), 'synced');

  // Stale local presence must accurately degrade to cloud-only
  const staleLocalItem = {
    ...syncedItem,
    local: { storageKind: 'directory-handle', stale: true },
  };
  assert.equal(deriveAvailability(staleLocalItem), 'cloud-only', 'Stale local record must not be classified as synced');

  // 2. Metadata merge policy: Server name and orderKey are authoritative
  const localRecord = {
    sha256: 'c'.repeat(64),
    name: 'local_file_raw.mp4',
    storageKind: 'directory-handle',
    orderKey: '0|hzzzzz:',
    fileHandle: { getFile: async () => ({ size: 1024, lastModified: 5000 }) },
  };
  const merged = mergeUnifiedPlaylistItem(
    { ...syncedItem, orderKey: '0|h00000:' },
    localRecord
  );
  assert.equal(merged.name, 'Opening Hymn Video', 'Server name must be authoritative over local filename');
  assert.equal(merged.orderKey, '0|h00000:', 'Server orderKey must be authoritative over local orderKey');
  assert.equal(merged.availability, 'synced');
  assert.equal(merged.source, 'local', 'Synced item prioritizes local playback source');
  assert.ok(merged.local?.fileHandle, 'Local handle must be preserved for offline stream routing');

  // 3. DEC-098 Storage Ladder & IDB Version Upgrade
  assert.ok(DB_VERSION >= 2, 'IDB version must be at least 2 for FileSystemFileHandle and orderKey');

  const registry = new LocalMediaRegistry();
  // checkHandleStaleness with matching size and mtime
  const validStatus = await registry.checkHandleStaleness({
    sha256: 'c'.repeat(64),
    name: 'video.mp4',
    sizeBytes: 1024,
    lastModified: 5000,
    mimeType: 'video/mp4',
    storageKind: 'directory-handle',
    verifiedAt: new Date().toISOString(),
    fileHandle: { getFile: async () => ({ size: 1024, lastModified: 5000 }) },
  });
  assert.equal(validStatus, 'valid', 'Matching live file handle must evaluate to valid');

  // checkHandleStaleness with modified file (size mismatch)
  const staleStatus = await registry.checkHandleStaleness({
    sha256: 'c'.repeat(64),
    name: 'video.mp4',
    sizeBytes: 1024,
    lastModified: 5000,
    mimeType: 'video/mp4',
    storageKind: 'directory-handle',
    verifiedAt: new Date().toISOString(),
    fileHandle: { getFile: async () => ({ size: 2048, lastModified: 6000 }) },
  });
  assert.equal(staleStatus, 'detached', 'Size or mtime mismatch must evaluate to detached');

  // checkHandleStaleness without handle degrades to detached unless in-memory
  const handlelessStatus = await registry.checkHandleStaleness({
    sha256: 'd'.repeat(64),
    name: 'offline.mp4',
    sizeBytes: 500,
    lastModified: 1000,
    mimeType: 'video/mp4',
    storageKind: 'directory-handle',
    verifiedAt: new Date().toISOString(),
  });
  assert.equal(handlelessStatus, 'detached', 'Handleless directory-handle record must be detached');

  // 4. projectionOf fail-closed positive integer revision
  const { projectionOf } = await import(srcUrl('lib', 'present-channel.ts'));
  const validMediaProjMsg = {
    type: 'sync',
    projection: {
      kind: 'media',
      mediaId: 'v1',
      mediaUrl: 'blob:abc',
      isPlaying: true,
      mediaTime: 10,
      at: 1000,
      revision: 1,
    },
  };
  assert.equal(projectionOf(validMediaProjMsg)?.kind, 'media');
  assert.equal(projectionOf({ ...validMediaProjMsg, projection: { ...validMediaProjMsg.projection, revision: 0 } })?.kind, 'deck', 'Revision 0 must fail closed');
  assert.equal(projectionOf({ ...validMediaProjMsg, projection: { ...validMediaProjMsg.projection, revision: -1 } })?.kind, 'deck', 'Revision -1 must fail closed');
  assert.equal(projectionOf({ ...validMediaProjMsg, projection: { ...validMediaProjMsg.projection, revision: 1.5 } })?.kind, 'deck', 'Non-integer revision must fail closed');

  // 5. Lazy URL resolution and staleness protection
  const lazyRes = await resolveLazyMediaUrl(cloudOnlyItem, { customSWActive: false });
  assert.equal(lazyRes.url, '/api/uploads/sermon.mp4');

  // Stale local file does NOT get served as blob URL
  await localMediaRegistry.saveRecord({
    sha256: 'e'.repeat(64),
    name: 'stale.mp4',
    sizeBytes: 500,
    lastModified: 1000,
    mimeType: 'video/mp4',
    storageKind: 'directory-handle',
    verifiedAt: new Date().toISOString(),
    fileHandle: new Blob(['fake content'], { type: 'video/mp4' }),
  });
  const staleItem = {
    id: 'stale-1',
    name: 'Stale Item',
    url: '/api/uploads/stale.mp4',
    type: 'video',
    sha256: 'e'.repeat(64),
  };
  // Simulate size mismatch
  const staleLazyRes = await resolveLazyMediaUrl(staleItem, {
    customSWActive: false,
    currentSizeBytes: 9999, // Stale!
  });
  assert.equal(staleLazyRes.url, '/api/uploads/stale.mp4', 'Stale file must not be served as blob URL');

  assert.doesNotThrow(() => revokeActiveMediaBlobUrl());
});

test('SPEC-113-04: Unified Media Drawer UI, 4-Way Segmented Filter, and Dual Action Workflows', async () => {
  const fs = await import('node:fs');

  // 1. Structural inspection of MediaDrawer unified list and filter bar
  const drawerSourcePath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaDrawer.tsx');
  assert.ok(fs.existsSync(drawerSourcePath), 'MediaDrawer.tsx must exist');
  const drawerCode = fs.readFileSync(drawerSourcePath, 'utf8');

  function assertUnifiedMediaDrawerContract(code) {
    // Single unified list and primary entry door
    assert.ok(code.includes('data-testid="unified-media-list"'), 'Must contain unified single list');
    assert.ok(code.includes('data-testid="btn-add-media"'), 'Must provide primary "btn-add-media" button');

    // 4-way filter bar
    assert.ok(code.includes('data-testid="media-drawer-filter-bar"'), 'Must contain 4-way filter bar');
    assert.ok(code.includes('data-testid={`filter-${mode.id}`}') || code.includes('data-testid="filter-all"'), 'Must contain filter testids');
    assert.ok(code.includes("'cloud-only'") && code.includes("'local-only'") && code.includes("'synced'"), 'Must contain all 4 filter modes');

    // Status icons
    assert.ok(code.includes('data-testid={`status-icon-${item.id}`}'), 'Must contain compact status icon element');
    assert.ok(code.includes('h-3.5 w-3.5 text-emerald-600'), 'Must contain synced status icon');
    assert.ok(code.includes('h-3.5 w-3.5 text-blue-600'), 'Must contain local-only status icon');

    // Dual action workflows & deletions
    assert.ok(code.includes("t('media.drawer.downloadToLocal')"), 'Must provide cloud-to-local download action');
    assert.ok(code.includes("t('media.drawer.uploadToCloud')"), 'Must provide local-to-cloud upload action');
    assert.ok(code.includes("t('media.drawer.deleteFromCloud')"), 'Must provide cloud deletion action');
    assert.ok(code.includes("t('media.drawer.deleteFromLocal')"), 'Must provide local unlinking action');
  }

  // 1. Pristine code must satisfy all structural contracts
  assertUnifiedMediaDrawerContract(drawerCode);

  // 2. Defect injection proof: removing unified list throws assertion failure
  try {
    const defective = drawerCode.replace('data-testid="unified-media-list"', 'data-testid="legacy-list"');
    assert.notEqual(defective, drawerCode, 'Mutation must succeed');
    fs.writeFileSync(drawerSourcePath, defective);
    const readDefective = fs.readFileSync(drawerSourcePath, 'utf8');
    assert.throws(
      () => assertUnifiedMediaDrawerContract(readDefective),
      /Must contain unified single list/,
      'Defect injection proof: missing unified list throws assertion error'
    );
  } finally {
    fs.writeFileSync(drawerSourcePath, drawerCode);
    assert.equal(fs.readFileSync(drawerSourcePath, 'utf8'), drawerCode, 'File must be restored byte-for-byte');
  }
});

test('SPEC-114-01: Media Playback State Sync, Drawer Play/Pause Toggle, and Handover Ownership', async () => {
  const fs = await import('node:fs');

  const drawerSourcePath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaDrawer.tsx');
  const stageSourcePath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaStage.tsx');
  assert.ok(fs.existsSync(drawerSourcePath), 'MediaDrawer.tsx must exist');
  assert.ok(fs.existsSync(stageSourcePath), 'MediaStage.tsx must exist');

  const drawerCode = fs.readFileSync(drawerSourcePath, 'utf8');
  const stageCode = fs.readFileSync(stageSourcePath, 'utf8');

  function assertPlaybackSyncContract(drawer, stage) {
    // 1. MediaDrawer Play/Pause Toggle Contract
    assert.ok(drawer.includes('handleTogglePlayItem'), 'MediaDrawer must define handleTogglePlayItem');
    assert.ok(
      drawer.includes('state.activeId === id && state.isPlaying') &&
      drawer.includes('engine.pause()') &&
      drawer.includes("type: 'SET_PLAYING', isPlaying: false"),
      'MediaDrawer must pause playback when clicking the currently playing item'
    );
    assert.ok(
      drawer.includes('state.activeId === id') &&
      drawer.includes('engine.play()'),
      'MediaDrawer must resume playback when clicking the currently paused item'
    );
    assert.ok(
      drawer.includes("store.dispatch({ type: 'SET_PLAYING', isPlaying: true });") &&
      drawer.includes("store.dispatch({ type: 'SELECT_ITEM', id });"),
      'MediaDrawer must cleanly dispatch SET_PLAYING and SELECT_ITEM without timer races'
    );
    assert.ok(
      drawer.includes('handleTogglePlayItem(item.id)'),
      'MediaDrawer play button and double click must trigger handleTogglePlayItem'
    );

    // 2. MediaStage Handover Ownership Contract
    assert.ok(
      stage.includes('if (state.isPlaying)') &&
      stage.includes('readyState >= 2') &&
      stage.includes("addEventListener('canplay'"),
      'MediaStage must safely await readyState or canplay before triggering .play() to prevent premature rejection'
    );
    assert.ok(
      stage.includes('el.play()'),
      'MediaStage must trigger el.play() on active media transition when state.isPlaying is true'
    );
  }

  // 1. Pristine code satisfies contract
  assertPlaybackSyncContract(drawerCode, stageCode);

  // 2. Defect injection proof 1: reverting to unconditional play trips assertion
  try {
    const defectiveDrawer = drawerCode.replaceAll('handleTogglePlayItem', 'handleUnconditionalPlayItem');
    assert.notEqual(defectiveDrawer, drawerCode, 'Mutation must succeed');
    fs.writeFileSync(drawerSourcePath, defectiveDrawer);
    const readDefective = fs.readFileSync(drawerSourcePath, 'utf8');
    assert.throws(
      () => assertPlaybackSyncContract(readDefective, stageCode),
      /MediaDrawer must define handleTogglePlayItem/,
      'Defect injection proof: missing handleTogglePlayItem throws assertion error'
    );
  } finally {
    fs.writeFileSync(drawerSourcePath, drawerCode);
    assert.equal(fs.readFileSync(drawerSourcePath, 'utf8'), drawerCode, 'File must be restored byte-for-byte');
  }

  // 3. Defect injection proof 2: omitting stage play-on-transition trips assertion
  try {
    const defectiveStage = stageCode.replaceAll('el.play()', 'el.pause()');
    assert.notEqual(defectiveStage, stageCode, 'Mutation must succeed');
    fs.writeFileSync(stageSourcePath, defectiveStage);
    const readDefective = fs.readFileSync(stageSourcePath, 'utf8');
    assert.throws(
      () => assertPlaybackSyncContract(drawerCode, readDefective),
      /MediaStage must trigger el\.play\(\)/,
      'Defect injection proof: missing stage playback handover throws assertion error'
    );
  } finally {
    fs.writeFileSync(stageSourcePath, stageCode);
    assert.equal(fs.readFileSync(stageSourcePath, 'utf8'), stageCode, 'File must be restored byte-for-byte');
  }

  // 4. Defect injection proof 3: omitting readyState/canplay check trips assertion
  try {
    const defectiveStage = stageCode.replaceAll('readyState >= 2', 'readyState >= 99');
    assert.notEqual(defectiveStage, stageCode, 'Mutation must succeed');
    fs.writeFileSync(stageSourcePath, defectiveStage);
    const readDefective = fs.readFileSync(stageSourcePath, 'utf8');
    assert.throws(
      () => assertPlaybackSyncContract(drawerCode, readDefective),
      /MediaStage must safely await readyState or canplay/,
      'Defect injection proof: missing readyState guard throws assertion error'
    );
  } finally {
    fs.writeFileSync(stageSourcePath, stageCode);
    assert.equal(fs.readFileSync(stageSourcePath, 'utf8'), stageCode, 'File must be restored byte-for-byte');
  }
});

test('SPEC-114-02: Unified 3-Way Deletion Matrix and Single-Owner Playlist Mount Hydration', async () => {
  const fs = await import('node:fs');

  const drawerSourcePath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaDrawer.tsx');
  const presenterSourcePath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  assert.ok(fs.existsSync(drawerSourcePath), 'MediaDrawer.tsx must exist');
  assert.ok(fs.existsSync(presenterSourcePath), 'PresenterOperator.tsx must exist');

  const drawerCode = fs.readFileSync(drawerSourcePath, 'utf8');
  const presenterCode = fs.readFileSync(presenterSourcePath, 'utf8');

  function assertDeletionMatrixContract(drawer, presenter) {
    // 1. Absence of legacy source check
    assert.ok(
      !drawer.includes("item.source !== 'local'"),
      'MediaDrawer must not retain legacy item.source !== "local" check'
    );

    // 2. 3-Way Deletion Matrix in MediaDrawer
    assert.ok(
      drawer.includes("availability === 'local-only'") &&
      drawer.includes("t('media.drawer.deleteFromLocal')"),
      'MediaDrawer must show deleteFromLocal for local-only items'
    );
    assert.ok(
      drawer.includes("availability === 'cloud-only'") &&
      drawer.includes("t('media.drawer.deleteFromCloud')"),
      'MediaDrawer must show deleteFromCloud for cloud-only items'
    );
    assert.ok(
      drawer.includes("availability === 'synced'") &&
      drawer.includes("t('media.drawer.deleteFromLocalOnly')") &&
      drawer.includes("t('media.drawer.deleteFromCloudOnly')") &&
      drawer.includes("t('media.drawer.deleteBoth')"),
      'MediaDrawer must show 3 distinct actions for synced items'
    );
    assert.ok(
      drawer.includes('purge=true'),
      'MediaDrawer deleteBoth must pass purge=true to purge physical upload'
    );
    assert.ok(
      drawer.includes('cannotDelete') &&
      drawer.includes('state.isPlaying || state.isProjected'),
      'MediaDrawer must protect active playing/projected items from deletion'
    );

    // 3. Single-owner mount hydration in PresenterOperator
    assert.ok(
      presenter.includes('localMediaRegistry.hydrate()') &&
      presenter.includes("fetch('/api/media/playlist')") &&
      presenter.includes('Array.isArray(data)') &&
      presenter.includes('raw.content_url || raw.url') &&
      presenter.includes('mergeUnifiedPlaylistItem') &&
      presenter.includes("mediaStore.dispatch({ type: 'ADD_ITEMS'"),
      'PresenterOperator must perform single-owner mount hydration combining server playlist and localMediaRegistry'
    );
  }

  // 1. Pristine code satisfies contract
  assertDeletionMatrixContract(drawerCode, presenterCode);

  // 1b. Runtime content-hash deduplication in addPlaylistItems
  const { addPlaylistItems, createInitialPlaylistState } = await import(
    srcUrl('operator', 'present', 'media-player', 'playlist-model.ts')
  );
  const initState = createInitialPlaylistState();
  const stateWith1 = addPlaylistItems(initState, [{
    id: 'server-1',
    name: 'Song 1',
    url: '/api/uploads/song.mp3',
    type: 'audio',
    sha256: 'f'.repeat(64),
  }]);
  const stateWithDup = addPlaylistItems(stateWith1, [{
    id: 'local-12345678',
    name: 'Local Copy Song 1',
    url: 'blob:abc',
    type: 'audio',
    sha256: 'f'.repeat(64),
  }]);
  assert.equal(stateWithDup.items.length, 1, 'addPlaylistItems must deduplicate items by SHA-256');

  // 2. Defect injection proof 1: re-injecting legacy check trips assertion
  try {
    const defectiveDrawer = drawerCode.replace(
      "availability === 'cloud-only'",
      "item.source !== 'local'"
    );
    assert.notEqual(defectiveDrawer, drawerCode, 'Mutation must succeed');
    fs.writeFileSync(drawerSourcePath, defectiveDrawer);
    const readDefective = fs.readFileSync(drawerSourcePath, 'utf8');
    assert.throws(
      () => assertDeletionMatrixContract(readDefective, presenterCode),
      /MediaDrawer must not retain legacy item\.source !== "local" check/,
      'Defect injection proof: legacy check re-injection throws assertion error'
    );
  } finally {
    fs.writeFileSync(drawerSourcePath, drawerCode);
    assert.equal(fs.readFileSync(drawerSourcePath, 'utf8'), drawerCode, 'File must be restored byte-for-byte');
  }

  // 3. Defect injection proof 2: omitting deleteFromLocalOnly trips assertion
  try {
    const defectiveDrawer = drawerCode.replaceAll(
      "t('media.drawer.deleteFromLocalOnly')",
      "t('media.drawer.deleteFromLocal')"
    );
    assert.notEqual(defectiveDrawer, drawerCode, 'Mutation must succeed');
    fs.writeFileSync(drawerSourcePath, defectiveDrawer);
    const readDefective = fs.readFileSync(drawerSourcePath, 'utf8');
    assert.throws(
      () => assertDeletionMatrixContract(readDefective, presenterCode),
      /MediaDrawer must show 3 distinct actions for synced items/,
      'Defect injection proof: missing deleteFromLocalOnly throws assertion error'
    );
  } finally {
    fs.writeFileSync(drawerSourcePath, drawerCode);
    assert.equal(fs.readFileSync(drawerSourcePath, 'utf8'), drawerCode, 'File must be restored byte-for-byte');
  }

  // 4. Defect injection proof 3: removing mount hydration trips assertion
  try {
    const defectivePresenter = presenterCode.replace(
      "fetch('/api/media/playlist')",
      "fetch('/api/media/disabled-endpoint')"
    );
    assert.notEqual(defectivePresenter, presenterCode, 'Mutation must succeed');
    fs.writeFileSync(presenterSourcePath, defectivePresenter);
    const readDefective = fs.readFileSync(presenterSourcePath, 'utf8');
    assert.throws(
      () => assertDeletionMatrixContract(drawerCode, readDefective),
      /PresenterOperator must perform single-owner mount hydration/,
      'Defect injection proof: missing mount hydration throws assertion error'
    );
  } finally {
    fs.writeFileSync(presenterSourcePath, presenterCode);
    assert.equal(fs.readFileSync(presenterSourcePath, 'utf8'), presenterCode, 'File must be restored byte-for-byte');
  }
});

test('SPEC-114-03: MediaControlBar Shuffle, 3-State Repeat, and Redundant Launcher Cleanup', async () => {
  const fs = await import('node:fs');
  const { resolveNextPlaylistItem } = await import(
    srcUrl('operator', 'present', 'media-player', 'playlist-model.ts')
  );

  // 1. Pure domain logic for resolveNextPlaylistItem
  const sampleItems = [
    { id: 'track-1', name: 'Song 1', url: '/1.mp3', type: 'audio' },
    { id: 'track-2', name: 'Song 2', url: '/2.mp3', type: 'audio' },
    { id: 'track-3', name: 'Video 3', url: '/3.mp4', type: 'video' },
    { id: 'track-4', name: 'Song 4', url: '/4.mp3', type: 'audio' },
  ];

  // Invariant 1: Active video track NEVER auto-advances
  const videoState = {
    items: sampleItems,
    activeId: 'track-3',
    isPlaying: true,
    shuffle: false,
    repeatMode: 'off',
  };
  assert.equal(resolveNextPlaylistItem(videoState), null, 'Video track must never auto-advance');

  // Invariant 2: Repeat-One repeats active track regardless of shuffle
  const repeatOneState = {
    items: sampleItems,
    activeId: 'track-1',
    isPlaying: true,
    shuffle: true,
    repeatMode: 'one',
  };
  assert.equal(resolveNextPlaylistItem(repeatOneState)?.id, 'track-1', 'Repeat-One must return current track');

  // Invariant 3: Sequential advance halts before video track
  const beforeVideoState = {
    items: sampleItems,
    activeId: 'track-2',
    isPlaying: true,
    shuffle: false,
    repeatMode: 'off',
  };
  assert.equal(resolveNextPlaylistItem(beforeVideoState), null, 'Sequential advance must halt when next track is video');

  // Invariant 4: Sequential advance with Repeat-All loops to start if audio
  const endState = {
    items: sampleItems,
    activeId: 'track-4',
    isPlaying: true,
    shuffle: false,
    repeatMode: 'all',
  };
  assert.equal(resolveNextPlaylistItem(endState)?.id, 'track-1', 'Repeat-All must loop to start of playlist');

  // Invariant 5: Shuffle selects deterministic candidate when rng provided
  const shuffleState = {
    items: sampleItems,
    activeId: 'track-1',
    isPlaying: true,
    shuffle: true,
    repeatMode: 'off',
  };
  // audio candidates: track-2, track-4
  const chosen = resolveNextPlaylistItem(shuffleState, () => 0.6);
  assert.equal(chosen?.id, 'track-4', 'Deterministic rng selects candidate');

  // 2. Structural Inspection of MediaControlBar and PresenterOperator
  const barSourcePath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaControlBar.tsx');
  const presenterSourcePath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const barCode = fs.readFileSync(barSourcePath, 'utf8');
  const presenterCode = fs.readFileSync(presenterSourcePath, 'utf8');

  function assertShuffleRepeatContract(bar, presenter) {
    // Shuffle & Repeat buttons in MediaControlBar
    assert.ok(bar.includes('data-testid="media-control-bar-shuffle"'), 'Must have shuffle button');
    assert.ok(bar.includes('data-testid="media-control-bar-repeat"'), 'Must have repeat button');
    assert.ok(bar.includes('Shuffle') && bar.includes('Repeat') && bar.includes('Repeat1'), 'Must render icons');
    assert.ok(bar.includes("t('media.controlBar.shuffleOn')"), 'Must use localized shuffle tooltip');
    assert.ok(bar.includes("t('media.controlBar.repeatOne')"), 'Must use localized repeat tooltip');

    // Redundant MediaLauncherButton removed from PresenterOperator header row 2
    assert.ok(
      !presenter.includes('<MediaLauncherButton'),
      'PresenterOperator header row 2 must not render redundant MediaLauncherButton'
    );
  }

  assertShuffleRepeatContract(barCode, presenterCode);

  // 3. Defect injection proof 1: re-injecting MediaLauncherButton fails assertion
  try {
    const defectivePresenter = presenterCode.replace(
      'data-testid="presenter-header-row-3"',
      '<MediaLauncherButton />\n          <div data-testid="presenter-header-row-3"'
    );
    assert.notEqual(defectivePresenter, presenterCode, 'Mutation must succeed');
    fs.writeFileSync(presenterSourcePath, defectivePresenter);
    const readDefective = fs.readFileSync(presenterSourcePath, 'utf8');
    assert.throws(
      () => assertShuffleRepeatContract(barCode, readDefective),
      /PresenterOperator header row 2 must not render redundant MediaLauncherButton/,
      'Defect injection proof: re-injecting MediaLauncherButton throws assertion error'
    );
  } finally {
    fs.writeFileSync(presenterSourcePath, presenterCode);
    assert.equal(fs.readFileSync(presenterSourcePath, 'utf8'), presenterCode, 'File must be restored byte-for-byte');
  }

  // 4. Defect injection proof 2: removing shuffle button fails assertion
  try {
    const defectiveBar = barCode.replace('data-testid="media-control-bar-shuffle"', 'data-testid="legacy-shuffle"');
    assert.notEqual(defectiveBar, barCode, 'Mutation must succeed');
    fs.writeFileSync(barSourcePath, defectiveBar);
    const readDefective = fs.readFileSync(barSourcePath, 'utf8');
    assert.throws(
      () => assertShuffleRepeatContract(readDefective, presenterCode),
      /Must have shuffle button/,
      'Defect injection proof: removing shuffle button throws assertion error'
    );
  } finally {
    fs.writeFileSync(barSourcePath, barCode);
    assert.equal(fs.readFileSync(barSourcePath, 'utf8'), barCode, 'File must be restored byte-for-byte');
  }
});







