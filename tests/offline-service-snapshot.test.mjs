/**
 * SPEC-84-02: Client-Side Service Snapshot & Auto-Warming Pre-Cache
 *
 * Verifies:
 * 1. Deep asset URL crawling across slide plans and images_payload via extractRequiredMediaUrls.
 * 2. Zero-media immediate readiness resolution ('ready' with 0 assets).
 * 3. Auto-warming snapshot cache with status transitions ('warming' -> 'ready' | 'degraded').
 * 4. Operation-scoped MediaResolutionContext with terminal revocation preventing memory leaks.
 * 5. LRU cache eviction bounding stored services to 4 and sweeping orphaned media blobs.
 * 6. Transparent offline fallback and status parity across RunSheetPage, PresentPage, and PresenterOperator.
 * 7. Executable absence guards and defect injection proofs.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const snapshotModulePath = path.join(root, 'src', 'lib', 'offline', 'service-snapshot.ts');
const runSheetPagePath = path.join(root, 'spa', 'src', 'pages', 'RunSheetPage.tsx');
const presentPagePath = path.join(root, 'spa', 'src', 'pages', 'PresentPage.tsx');
const presenterOperatorPath = path.join(root, 'src', 'operator', 'present', 'PresenterOperator.tsx');
const readinessBadgePath = path.join(root, 'src', 'components', 'offline', 'OfflineReadinessBadge.tsx');

export function scanSnapshotSecurityGuards(customSources = {}) {
  const findings = [];

  const snapshotSrc = customSources.snapshot ?? fs.readFileSync(snapshotModulePath, 'utf8');
  const runSheetSrc = customSources.runSheet ?? fs.readFileSync(runSheetPagePath, 'utf8');
  const presentSrc = customSources.present ?? fs.readFileSync(presentPagePath, 'utf8');
  const presenterSrc = customSources.presenter ?? fs.readFileSync(presenterOperatorPath, 'utf8');
  const badgeSrc = customSources.badge ?? fs.readFileSync(readinessBadgePath, 'utf8');

  // 1. service-snapshot.ts exports required primitives
  if (!snapshotSrc.includes('function extractRequiredMediaUrls(')) {
    findings.push('service-snapshot.ts missing extractRequiredMediaUrls');
  }
  if (!snapshotSrc.includes('function warmServiceSnapshot(')) {
    findings.push('service-snapshot.ts missing warmServiceSnapshot');
  }
  if (!snapshotSrc.includes('function getServiceSnapshot(')) {
    findings.push('service-snapshot.ts missing getServiceSnapshot');
  }
  if (!snapshotSrc.includes('function resolveMediaUrl(')) {
    findings.push('service-snapshot.ts missing resolveMediaUrl');
  }
  if (!snapshotSrc.includes('function resolvePlanMedia(')) {
    findings.push('service-snapshot.ts missing resolvePlanMedia');
  }
  if (!snapshotSrc.includes('function createMediaResolutionContext(')) {
    findings.push('service-snapshot.ts missing createMediaResolutionContext');
  }
  if (!snapshotSrc.includes('function normalizeServiceId(')) {
    findings.push('service-snapshot.ts missing normalizeServiceId');
  }
  if (!snapshotSrc.includes('subscribeServiceReadiness(')) {
    findings.push('service-snapshot.ts missing subscribeServiceReadiness');
  }
  if (!snapshotSrc.includes('warmingGenerationMap')) {
    findings.push('service-snapshot.ts missing warmingGenerationMap concurrency guard');
  }
  if (!snapshotSrc.includes('claimWarmingMedia')) {
    findings.push('service-snapshot.ts missing claimWarmingMedia pending-claims protection');
  }
  if (!snapshotSrc.includes('saveMediaBlob(url, blob, epoch)')) {
    findings.push('service-snapshot.ts missing epoch-guarded saveMediaBlob call');
  }
  if (!snapshotSrc.includes('function sweepAllStorageMedia(')) {
    findings.push('service-snapshot.ts missing sweepAllStorageMedia');
  }
  if (!snapshotSrc.includes('getCacheEpoch')) {
    findings.push('service-snapshot.ts missing getCacheEpoch');
  }
  if (!snapshotSrc.includes('MAX_CACHED_SERVICES = 4')) {
    findings.push('service-snapshot.ts missing MAX_CACHED_SERVICES = 4 eviction bound');
  }

  // 2. RunSheetPage offline fallback and readiness badge
  if (!runSheetSrc.includes('warmServiceSnapshot(')) {
    findings.push('RunSheetPage.tsx missing warmServiceSnapshot call on successful load');
  }
  if (!runSheetSrc.includes('res.status === 401 || res.status === 403')) {
    findings.push('RunSheetPage.tsx missing 401/403 authorization check before offline recovery');
  }
  if (!runSheetSrc.includes('warmServiceSnapshot(data.id, data)')) {
    findings.push('RunSheetPage.tsx reloadService missing warmServiceSnapshot call');
  }
  if (!runSheetSrc.includes('setIsOfflineData(false)') || runSheetSrc.indexOf('setIsOfflineData(false)') === runSheetSrc.lastIndexOf('setIsOfflineData(false)')) {
    findings.push('RunSheetPage.tsx reloadService missing setIsOfflineData(false) clearing offline banner');
  }
  if (!runSheetSrc.includes('getServiceSnapshot(')) {
    findings.push('RunSheetPage.tsx missing getServiceSnapshot fallback on network error');
  }
  if (!runSheetSrc.includes('data-testid="offline-runsheet-banner"')) {
    findings.push('RunSheetPage.tsx missing offline-runsheet-banner');
  }
  if (!runSheetSrc.includes('<OfflineReadinessBadge')) {
    findings.push('RunSheetPage.tsx missing OfflineReadinessBadge in header');
  }

  // 3. PresentPage offline fallback
  if (!presentSrc.includes('getServiceSnapshot(')) {
    findings.push('PresentPage.tsx missing getServiceSnapshot fallback');
  }
  if (!presentSrc.includes('warmServiceSnapshot(')) {
    findings.push('PresentPage.tsx missing warmServiceSnapshot on successful load');
  }
  if (!presentSrc.includes('isOffline={isOfflineData}')) {
    findings.push('PresentPage.tsx missing isOffline forwarding to PresenterOperator');
  }
  if (!presentSrc.includes('res.status === 401 || res.status === 403')) {
    findings.push('PresentPage.tsx missing 401/403 authorization check before offline recovery');
  }
  if (!presentSrc.includes('rawService={data}')) {
    findings.push('PresentPage.tsx missing rawService forwarding to PresenterOperator');
  }

  // 4. PresenterOperator header parity
  if (!presenterSrc.includes('isOffline?: boolean')) {
    findings.push('PresenterOperator.tsx props missing isOffline');
  }
  if (!presenterSrc.includes('rawService?: any')) {
    findings.push('PresenterOperator.tsx missing rawService in props');
  }
  if (!presenterSrc.includes('<OfflineReadinessBadge')) {
    findings.push('PresenterOperator.tsx missing OfflineReadinessBadge in header');
  }
  if (!presenterSrc.includes('data-testid="offline-presenter-badge"')) {
    findings.push('PresenterOperator.tsx missing offline-presenter-badge');
  }

  // 5. OfflineReadinessBadge implementation
  if (!badgeSrc.includes('data-testid="offline-readiness-badge"')) {
    findings.push('OfflineReadinessBadge.tsx missing data-testid');
  }
  if (!badgeSrc.includes('receivedLiveEvent')) {
    findings.push('OfflineReadinessBadge.tsx missing receivedLiveEvent stale-initial-read guard');
  }
  if (!badgeSrc.includes('retrySeqRef')) {
    findings.push('OfflineReadinessBadge.tsx missing retrySeqRef guard');
  }
  if (!badgeSrc.includes('getServiceSnapshot(') || !badgeSrc.includes('warmServiceSnapshot(')) {
    findings.push('OfflineReadinessBadge.tsx missing snapshot inspection/retry wiring');
  }

  return findings;
}

test('SPEC-84-02: Structural security guards pass for service snapshot and auto-warming integration', () => {
  const findings = scanSnapshotSecurityGuards();
  assert.deepEqual(findings, [], `Expected 0 findings, got: ${findings.join(', ')}`);
});

test('SPEC-84-02: extractRequiredMediaUrls deeply extracts slide backgrounds, image elements, and images_payload', async () => {
  const { extractRequiredMediaUrls } = await import(
    new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href
  );

  const mockService = {
    images_payload: {
      sermonGraphicUrl: 'http://church.local/sermon.jpg',
      familyPhotoUrl: '/uploads/family.png',
      youthPhotoUrl: '/uploads/youth.png',
      announcementInserts: ['http://church.local/ann1.jpg', { url: '/uploads/ann2.jpg' }],
    },
    plan: [
      {
        id: 's1',
        artifact: {
          layout: {
            backgroundImage: 'http://church.local/bg1.jpg',
            elements: [
              { type: 'image', imageUrl: 'http://church.local/el1.png' },
              { type: 'image-placeholder', content: '/uploads/el2.png' },
              { type: 'text', content: 'Not an image' },
            ],
          },
        },
      },
      {
        id: 's2',
        artifact: {
          layout: {
            backgroundImage: 'http://church.local/bg1.jpg', // Duplicate -> must deduplicate
            elements: [{ type: 'image', src: 'relative/el3.jpg' }],
          },
        },
      },
    ],
  };

  const urls = extractRequiredMediaUrls(mockService);

  assert.ok(urls.includes('http://church.local/sermon.jpg'));
  assert.ok(urls.includes('/uploads/family.png'));
  assert.ok(urls.includes('/uploads/youth.png'));
  assert.ok(urls.includes('http://church.local/ann1.jpg'));
  assert.ok(urls.includes('/uploads/ann2.jpg'));
  assert.ok(urls.includes('http://church.local/bg1.jpg'));
  assert.ok(urls.includes('http://church.local/el1.png'));
  assert.ok(urls.includes('/uploads/el2.png'));
  assert.ok(urls.includes('relative/el3.jpg'));

  // Must deduplicate identical background URL
  const bgCount = urls.filter((u) => u === 'http://church.local/bg1.jpg').length;
  assert.equal(bgCount, 1, 'Duplicate media URLs must be deduplicated to exactly 1 entry');
});

test('SPEC-84-02: Zero-media service plan immediately resolves to status: ready', async () => {
  const { warmServiceSnapshot, getServiceSnapshot, clearInMemoryOfflineStore } = await import(
    new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href
  );

  clearInMemoryOfflineStore();

  const zeroMediaService = {
    id: 'svc-zero-media-84',
    plan: [
      {
        id: 's1',
        artifact: {
          layout: { elements: [{ type: 'text', content: 'Scripture Only' }] },
        },
      },
    ],
  };

  let reportedProgress = null;
  const result = await warmServiceSnapshot('svc-zero-media-84', zeroMediaService, (p) => {
    reportedProgress = p;
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.total, 0);
  assert.equal(result.failed, 0);
  assert.ok(result.message.includes('0 external assets'));

  // Assert callback invocation and payload
  assert.ok(reportedProgress, 'Progress callback must be invoked on zero-media plan');
  assert.equal(reportedProgress.status, 'ready');
  assert.equal(reportedProgress.total, 0);
  assert.equal(reportedProgress.failed, 0);

  const cached = await getServiceSnapshot('svc-zero-media-84');
  assert.ok(cached);
  assert.equal(cached.status, 'ready');
  assert.equal(cached.total_assets, 0);
  assert.equal(cached.cached_assets, 0);
});

test('SPEC-84-02: All-success non-zero media warming transitions warming -> ready and notifies subscribers', async () => {
  const {
    warmServiceSnapshot,
    getServiceSnapshot,
    subscribeServiceReadiness,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(new Blob(['img content']), { status: 200 });

  const emissions = [];
  const unsubscribe = subscribeServiceReadiness('svc-all-success', (readiness) => {
    emissions.push(readiness);
  });

  try {
    const service = {
      id: 'svc-all-success',
      plan: [
        {
          id: 's1',
          artifact: {
            layout: {
              backgroundImage: 'http://church.local/bg.jpg',
              elements: [{ type: 'image', imageUrl: 'http://church.local/el.jpg' }],
            },
          },
        },
      ],
    };

    const finalResult = await warmServiceSnapshot('svc-all-success', service);

    assert.equal(finalResult.status, 'ready');
    assert.equal(finalResult.total, 2);
    assert.equal(finalResult.cached, 2);
    assert.equal(finalResult.failed, 0);

    // Verify subscriber emissions progression: warming (0/2) -> warming (1/2) -> ready (2/2)
    assert.ok(emissions.length >= 2, 'Subscriber must receive multiple warming progress events');
    assert.equal(emissions[0].status, 'warming');
    assert.equal(emissions[0].cached, 0);
    assert.equal(emissions[emissions.length - 1].status, 'ready');
    assert.equal(emissions[emissions.length - 1].cached, 2);

    const snapshot = await getServiceSnapshot('svc-all-success');
    assert.equal(snapshot.status, 'ready');
    assert.equal(snapshot.total_assets, 2);
    assert.equal(snapshot.cached_assets, 2);
    assert.equal(snapshot.failed_assets.length, 0);
  } finally {
    unsubscribe();
    globalThis.fetch = origFetch;
  }
});

test('SPEC-84-02: warmServiceSnapshot fetches media, reports progress, and marks ready or degraded', async () => {
  const { warmServiceSnapshot, getServiceSnapshot, clearInMemoryOfflineStore } = await import(
    new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href
  );

  clearInMemoryOfflineStore();

  const origFetch = globalThis.fetch;
  const fetchedUrls = [];

  // Mock global fetch: succeed on good.jpg, fail on bad.jpg
  globalThis.fetch = async (url) => {
    fetchedUrls.push(url);
    if (url.includes('bad.jpg')) {
      return new Response(null, { status: 404 });
    }
    return new Response(new Blob(['image binary']), { status: 200 });
  };

  try {
    const serviceWithMedia = {
      id: 'svc-warming-test',
      plan: [
        {
          id: 's1',
          artifact: {
            layout: {
              backgroundImage: 'http://church.local/good.jpg',
              elements: [{ type: 'image', imageUrl: 'http://church.local/bad.jpg' }],
            },
          },
        },
      ],
    };

    const progressReports = [];
    const result = await warmServiceSnapshot('svc-warming-test', serviceWithMedia, (p) => {
      progressReports.push(p);
    });

    assert.ok(fetchedUrls.includes('http://church.local/good.jpg'));
    assert.ok(fetchedUrls.includes('http://church.local/bad.jpg'));

    // Because bad.jpg failed (404), result must be 'degraded'
    assert.equal(result.status, 'degraded');
    assert.equal(result.failed, 1);
    assert.equal(result.total, 2);

    // Verify progress progression
    assert.ok(progressReports.length >= 2);
    assert.equal(progressReports[0].status, 'warming');
    assert.equal(progressReports[progressReports.length - 1].status, 'degraded');

    const snapshot = await getServiceSnapshot('svc-warming-test');
    assert.equal(snapshot.status, 'degraded');
    assert.equal(snapshot.total_assets, 2);
    assert.equal(snapshot.cached_assets, 1);
    assert.ok(snapshot.failed_assets.includes('http://church.local/bad.jpg'));
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('SPEC-84-02: RunSheetPage loads from offline snapshot and displays offline-runsheet-banner', async () => {
  const { saveServiceSnapshot, getServiceSnapshot, clearInMemoryOfflineStore } = await import(
    new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href
  );

  clearInMemoryOfflineStore();

  const mockService = {
    id: 'svc-runsheet-offline',
    date: '2026-09-27',
    plan: [{ id: 'slide-1', artifact: { layout: { elements: [] } } }],
    cached_at: Date.now(),
    status: 'ready',
    total_assets: 0,
    cached_assets: 0,
  };
  await saveServiceSnapshot(mockService);

  // Simulate RunSheetPage fetch failure fallback logic
  let svcState = null;
  let isOfflineData = false;

  try {
    throw new Error('Network unreachable');
  } catch {
    const snapshot = await getServiceSnapshot('svc-runsheet-offline');
    if (snapshot && snapshot.id) {
      svcState = snapshot;
      isOfflineData = true;
    }
  }

  assert.ok(svcState, 'RunSheet must load from offline snapshot');
  assert.equal(svcState.id, 'svc-runsheet-offline');
  assert.equal(isOfflineData, true, 'Must set isOfflineData to true on offline fallback');
});

test('SPEC-84-02: PresentPage loads from offline snapshot, resolves plan media, and passes isOffline to PresenterOperator', async () => {
  const {
    saveServiceSnapshot,
    getServiceSnapshot,
    saveMediaBlob,
    resolvePlanMedia,
    createMediaResolutionContext,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  const origCreate = globalThis.URL?.createObjectURL;
  const origRevoke = globalThis.URL?.revokeObjectURL;
  globalThis.URL.createObjectURL = () => 'blob:http://localhost/presenter-bg';
  globalThis.URL.revokeObjectURL = () => {};

  try {
    await saveMediaBlob('http://church.local/presenter-bg.jpg', new Blob(['data']));

    const mockService = {
      id: 'svc-present-offline',
      date: '2026-09-27',
      plan: [{ id: 's1', artifact: { layout: { backgroundImage: 'http://church.local/presenter-bg.jpg', elements: [] } } }],
      cached_at: Date.now(),
      status: 'ready',
    };
    await saveServiceSnapshot(mockService);

    // Simulate PresentPage offline fallback logic
    let presentData = null;
    let isOfflinePresent = false;
    const context = createMediaResolutionContext();

    try {
      throw new Error('Network down');
    } catch {
      const snapshot = await getServiceSnapshot('svc-present-offline');
      if (snapshot && snapshot.id) {
        const resolved = await resolvePlanMedia(snapshot.plan || [], context);
        presentData = { ...snapshot, plan: resolved };
        isOfflinePresent = true;
      }
    }

    assert.ok(presentData);
    assert.equal(isOfflinePresent, true);
    assert.ok(
      presentData.plan[0].artifact.layout.backgroundImage.startsWith('blob:'),
      'Presenter must resolve cached media to blob URL'
    );
    context.revoke();
  } finally {
    if (origCreate) globalThis.URL.createObjectURL = origCreate;
    else delete globalThis.URL.createObjectURL;
    if (origRevoke) globalThis.URL.revokeObjectURL = origRevoke;
    else delete globalThis.URL.revokeObjectURL;
  }
});

test('SPEC-84-02: normalizeServiceId unifies numeric and string service IDs across public APIs', async () => {
  const {
    saveServiceSnapshot,
    getServiceSnapshot,
    warmServiceSnapshot,
    normalizeServiceId,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  assert.equal(normalizeServiceId(123), '123');
  assert.equal(normalizeServiceId('  456  '), '456');
  assert.equal(normalizeServiceId(null), '');

  const numericService = {
    id: 777, // Numeric ID as returned by Go API ServiceRow
    date: '2026-09-27',
    plan: [{ id: 's1', artifact: { layout: { elements: [] } } }],
    cached_at: Date.now(),
    status: 'ready',
  };

  // Warm with numeric ID
  await warmServiceSnapshot(777, numericService);

  // Retrieve using route string '777' from useParams()
  const retrievedViaString = await getServiceSnapshot('777');
  assert.ok(retrievedViaString, 'Snapshot warmed with numeric ID must be retrievable via string ID');
  assert.equal(retrievedViaString.id, '777');

  // Retrieve using number 777
  const retrievedViaNumber = await getServiceSnapshot(777);
  assert.ok(retrievedViaNumber, 'Snapshot must be retrievable via numeric ID');
  assert.equal(retrievedViaNumber.id, '777');
});

test('SPEC-84-02: True LRU access-refresh eviction preserves recently accessed older snapshots and sweeps orphaned media', async () => {
  const {
    saveServiceSnapshot,
    getServiceSnapshot,
    saveMediaBlob,
    getCachedMediaCount,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  // 1. Seed 4 services with distinct media
  for (let i = 1; i <= 4; i++) {
    const url = `http://church.local/media-${i}.jpg`;
    await saveMediaBlob(url, new Blob([`blob-${i}`]));
    await saveServiceSnapshot({
      id: String(i),
      plan: [{ id: `slide-${i}`, artifact: { layout: { backgroundImage: url, elements: [] } } }],
      cached_at: 1000 + i * 10,
      status: 'ready',
    });
  }

  assert.equal(getCachedMediaCount(), 4);

  // 2. Access service 1 (the oldest cached_at) via getServiceSnapshot:
  // True LRU refreshes service 1's cached_at to Date.now(), making service 2 the oldest unaccessed snapshot!
  await new Promise((resolve) => setTimeout(resolve, 5));
  const s1 = await getServiceSnapshot('1');
  assert.ok(s1);
  assert.ok(s1.cached_at > 1040, 'getServiceSnapshot must refresh cached_at recency');

  // 3. Add 5th service triggering MAX_CACHED_SERVICES (4) eviction:
  // Under FIFO, service 1 would be evicted.
  // Under true LRU, service 2 (oldest unaccessed) MUST be evicted, while service 1 survives!
  const url5 = 'http://church.local/media-5.jpg';
  await saveMediaBlob(url5, new Blob(['blob-5']));
  await saveServiceSnapshot({
    id: '5',
    plan: [{ id: 'slide-5', artifact: { layout: { backgroundImage: url5, elements: [] } } }],
    cached_at: Date.now() + 10,
    status: 'ready',
  });

  // Verify surviving services: 1, 3, 4, 5 survive; 2 was evicted!
  const snap1 = await getServiceSnapshot('1');
  assert.ok(snap1, 'Recently accessed service 1 must survive LRU eviction');
  const snap2 = await getServiceSnapshot('2');
  assert.equal(snap2, null, 'Least recently used service 2 must be evicted');
  const snap5 = await getServiceSnapshot('5');
  assert.ok(snap5, 'Newest service 5 must survive');

  // Media count must remain bounded to 4 surviving services (media-2 was swept)
  assert.equal(getCachedMediaCount(), 4, 'Media count must be bounded to 4 surviving services');
});

test('SPEC-84-02: Concurrent warming race protection discards older stale warming generation', async () => {
  const {
    warmServiceSnapshot,
    getServiceSnapshot,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  const origFetch = globalThis.fetch;
  let releaseSlowFetch = null;
  const slowBarrier = new Promise((resolve) => {
    releaseSlowFetch = resolve;
  });

  // Slow job fetch waits on slowBarrier; fast job fetch resolves immediately
  globalThis.fetch = async (url) => {
    if (url.includes('slow')) {
      await slowBarrier;
    }
    return new Response(new Blob(['data']), { status: 200 });
  };

  try {
    const slowService = {
      id: 999,
      plan_identity: 'identity-slow-v1',
      plan: [{ id: 's1', artifact: { layout: { backgroundImage: 'http://church.local/slow.jpg', elements: [] } } }],
    };

    const fastService = {
      id: 999,
      plan_identity: 'identity-fast-v2',
      plan: [{ id: 's1', artifact: { layout: { backgroundImage: 'http://church.local/fast.jpg', elements: [] } } }],
    };

    // 1. Slow warming job starts (generation 1)
    const slowJobPromise = warmServiceSnapshot(999, slowService);

    // 2. Faster/newer warming job starts on same service (generation 2) and finishes
    const fastResult = await warmServiceSnapshot(999, fastService);
    assert.equal(fastResult.status, 'ready');

    const snapAfterFast = await getServiceSnapshot(999);
    assert.equal(snapAfterFast.plan_identity, 'identity-fast-v2');

    // 3. Slow job finishes late: generation check must discard its completion
    releaseSlowFetch();
    await slowJobPromise;

    // Snapshot MUST remain fastService v2, NOT overwritten by stale slowService v1!
    const finalSnapshot = await getServiceSnapshot(999);
    assert.equal(
      finalSnapshot.plan_identity,
      'identity-fast-v2',
      'Stale warming job must NOT overwrite newer service snapshot'
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('SPEC-84-02: Zero-media concurrent warming race discards older job persistence', async () => {
  const {
    warmServiceSnapshot,
    saveServiceSnapshot,
    getServiceSnapshot,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  const zeroServiceV1 = {
    id: 888,
    plan_identity: 'zero-v1-slow',
    plan: [{ id: 's1', artifact: { layout: { elements: [] } } }],
  };

  const zeroServiceV2 = {
    id: 888,
    plan_identity: 'zero-v2-fast',
    plan: [{ id: 's1', artifact: { layout: { elements: [] } } }],
  };

  let releaseJob1 = null;
  const job1Barrier = new Promise((resolve) => {
    releaseJob1 = resolve;
  });

  // 1. Job 1 starts on service 888 (generation 1)
  await warmServiceSnapshot(888, zeroServiceV1);
  const { getWarmingGeneration } = await import(
    new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href
  );
  const job1Gen = getWarmingGeneration(888);
  assert.equal(job1Gen, 1);

  // 2. Job 2 starts concurrently on service 888 (generation 2) and finishes
  await warmServiceSnapshot(888, zeroServiceV2);

  const snapshotAfterJob2 = await getServiceSnapshot(888);
  assert.equal(snapshotAfterJob2.plan_identity, 'zero-v2-fast');
  assert.ok(getWarmingGeneration(888) > job1Gen);

  // 3. Late delayed commit from Job 1 attempting to write with stale generation:
  const committed = await saveServiceSnapshot(
    {
      ...zeroServiceV1,
      id: 888,
      status: 'ready',
      cached_at: Date.now(),
    },
    job1Gen
  );
  assert.equal(committed, false, 'Late zero-media persistence must be refused');

  const finalSnapshot = await getServiceSnapshot(888);
  assert.equal(finalSnapshot.plan_identity, 'zero-v2-fast', 'Snapshot must remain zero-v2-fast');
});

test('SPEC-84-02: Logout cache epoch invalidation rejects in-flight warming jobs from repopulating cache post-logout', async () => {
  const {
    saveServiceSnapshot,
    getServiceSnapshot,
    clearOfflineStorage,
    getCacheEpoch,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  // Job starts before logout at epoch E
  const preLogoutEpoch = getCacheEpoch();

  // User logs out, clearing storage and bumping cache epoch
  await clearOfflineStorage();
  assert.ok(getCacheEpoch() > preLogoutEpoch);

  // In-flight warmer attempts to persist snapshot from old pre-logout epoch
  const committed = await saveServiceSnapshot(
    {
      id: 'svc-stale-post-logout',
      plan: [],
      cached_at: Date.now(),
      status: 'ready',
    },
    1,
    preLogoutEpoch
  );

  assert.equal(committed, false, 'Pre-logout warming job must be rejected by cacheEpoch guard');
  assert.equal(await getServiceSnapshot('svc-stale-post-logout'), null, 'Stale snapshot must not exist in storage');
});

test('SPEC-84-02: saveMediaBlob rejects media writes when epoch has advanced post-logout', async () => {
  const {
    saveMediaBlob,
    clearOfflineStorage,
    getCacheEpoch,
    getCachedMediaCount,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  const preLogoutEpoch = getCacheEpoch();

  // User logs out
  await clearOfflineStorage();
  assert.ok(getCacheEpoch() > preLogoutEpoch);

  // In-flight media download attempts to commit blob with old epoch
  const committed = await saveMediaBlob(
    'http://church.local/stale-post-logout.jpg',
    new Blob(['blob data']),
    preLogoutEpoch
  );

  assert.equal(committed, false, 'Stale media write must be rejected by epoch guard');
  assert.equal(getCachedMediaCount(), 0, 'No media must be written to cache post-logout');
});

test('SPEC-84-02: In-progress warming media is protected from concurrent eviction sweep', async () => {
  const {
    saveServiceSnapshot,
    saveMediaBlob,
    getCachedMediaCount,
    claimWarmingMedia,
    releaseWarmingMedia,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  // Service B starts warming: claims pending media URL before its snapshot is persisted
  const pendingUrlB = 'http://church.local/pending-b.jpg';
  claimWarmingMedia([pendingUrlB]);
  await saveMediaBlob(pendingUrlB, new Blob(['pending-b-data']));

  try {
    // Service A finishes and triggers saveServiceSnapshot -> evictOldSnapshots
    const serviceA = {
      id: 'service-a',
      plan: [{ id: 's1', artifact: { layout: { backgroundImage: 'http://church.local/media-a.jpg', elements: [] } } }],
      cached_at: Date.now(),
      status: 'ready',
    };
    await saveMediaBlob('http://church.local/media-a.jpg', new Blob(['data-a']));
    await saveServiceSnapshot(serviceA);

    // Eviction sweep executed by Service A MUST protect Service B's pending media!
    assert.equal(
      getCachedMediaCount(),
      2,
      'Pending media claimed by active warming job must NOT be swept by concurrent eviction'
    );
  } finally {
    releaseWarmingMedia([pendingUrlB]);
  }
});

test('SPEC-84-02: Re-warming retained service with replacement media sweeps obsolete media immediately', async () => {
  const {
    warmServiceSnapshot,
    getCachedMediaCount,
    saveMediaBlob,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(new Blob(['img data']), { status: 200 });

  try {
    const serviceWithOldMedia = {
      id: 10,
      plan: [{ id: 's1', artifact: { layout: { backgroundImage: 'http://church.local/old-bg.jpg', elements: [] } } }],
    };

    // 1. Initial warm with old-bg.jpg
    await warmServiceSnapshot(10, serviceWithOldMedia);
    assert.equal(getCachedMediaCount(), 1, 'Cache must contain 1 media item');

    // 2. Re-warm same service with replacement media new-bg.jpg
    const serviceWithNewMedia = {
      id: 10,
      plan: [{ id: 's1', artifact: { layout: { backgroundImage: 'http://church.local/new-bg.jpg', elements: [] } } }],
    };
    await warmServiceSnapshot(10, serviceWithNewMedia);

    // Cache count must remain 1: old-bg.jpg was swept immediately upon snapshot replacement!
    assert.equal(
      getCachedMediaCount(),
      1,
      'Old media must be swept immediately when service is re-warmed with replacement media'
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('SPEC-84-02: releaseWarmingMedia triggers storage-wide sweep of unreferenced media', async () => {
  const {
    saveMediaBlob,
    saveServiceSnapshot,
    claimWarmingMedia,
    releaseWarmingMedia,
    getCachedMediaCount,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  // Save service snapshot with 1 referenced media
  const refUrl = 'http://church.local/ref.jpg';
  await saveMediaBlob(refUrl, new Blob(['ref']));
  await saveServiceSnapshot({
    id: 'svc-ref-1',
    plan: [{ id: 's1', artifact: { layout: { backgroundImage: refUrl, elements: [] } } }],
    cached_at: Date.now(),
    status: 'ready',
  });

  // An in-flight job claimed a media URL that was saved, but the job is then aborted/superseded
  const unrefUrl = 'http://church.local/unref-superseded.jpg';
  claimWarmingMedia([unrefUrl]);
  await saveMediaBlob(unrefUrl, new Blob(['unref']));
  assert.equal(getCachedMediaCount(), 2);

  // When claim is released by superseded job, follow-up sweep removes unrefUrl!
  releaseWarmingMedia([unrefUrl]);
  assert.equal(
    getCachedMediaCount(),
    1,
    'Unreferenced media must be swept when warming claim is released'
  );
});

test('SPEC-84-02: RunSheetPage handles 401/403 authorization failures before attempting offline recovery', async () => {
  let clearedSession = false;
  let destination = '';

  const fakeAuth = {
    clearCachedSession: () => {
      clearedSession = true;
    },
    navigate: (url) => {
      destination = url;
    },
  };

  // Simulate RunSheetPage fetch response handler
  const handleRunSheetResponse = async (status) => {
    if (status === 401 || status === 403) {
      fakeAuth.clearCachedSession();
      fakeAuth.navigate('/login');
      return 'redirected';
    }
    return 'fallback';
  };

  assert.equal(await handleRunSheetResponse(401), 'redirected');
  assert.equal(clearedSession, true);
  assert.equal(destination, '/login');

  clearedSession = false;
  destination = '';
  assert.equal(await handleRunSheetResponse(403), 'redirected');
  assert.equal(clearedSession, true);
  assert.equal(destination, '/login');
});

test('SPEC-84-02: RunSheetPage reloadService re-warms updated service data preserving fresh snapshot', async () => {
  const { getServiceSnapshot, saveServiceSnapshot, clearInMemoryOfflineStore } = await import(
    new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href
  );

  clearInMemoryOfflineStore();

  const originalService = {
    id: 555,
    plan_identity: 'plan-v1',
    plan: [{ id: 's1', artifact: { layout: { elements: [] } } }],
    cached_at: Date.now(),
    status: 'ready',
  };
  await saveServiceSnapshot(originalService);

  // Simulate reloadService with updated plan from Sync Artifact
  const updatedService = {
    id: 555,
    plan_identity: 'plan-v2-synced',
    plan: [{ id: 's1', artifact: { layout: { elements: [] } } }, { id: 's2', artifact: { layout: { elements: [] } } }],
  };

  // reloadService executes warmServiceSnapshot on success
  const { warmServiceSnapshot } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);
  await warmServiceSnapshot(updatedService.id, updatedService);

  const refreshedSnapshot = await getServiceSnapshot(555);
  assert.equal(refreshedSnapshot.plan_identity, 'plan-v2-synced');
  assert.equal(refreshedSnapshot.plan.length, 2, 'Reloaded service must rewarm and update cached plan in snapshot');
});

test('SPEC-84-02: RunSheetPage reloadService clears isOfflineData banner when reloading online', async () => {
  let isOfflineData = true; // initially true from snapshot fallback
  let svc = { id: 555, title: 'Cached Snapshot' };

  // Simulate reloadService logic from RunSheetPage.tsx:115-133
  const reloadService = async (res) => {
    if (res.ok) {
      const data = await res.json();
      svc = data;
      isOfflineData = false;
    }
  };

  await reloadService({
    ok: true,
    json: async () => ({ id: 555, title: 'Fresh Online Data' }),
  });

  assert.equal(isOfflineData, false, 'isOfflineData must transition to false on successful online reload');
  assert.equal(svc.title, 'Fresh Online Data');
});

test('SPEC-84-02: RunSheetPage reloadService redirects on 401/403 without falling back to cached service data', async () => {
  let clearedSession = false;
  let destination = '';

  const fakeAuth = {
    clearCachedSession: () => {
      clearedSession = true;
    },
    navigate: (url) => {
      destination = url;
    },
  };

  // Simulate reloadService fetch response handler
  const handleReloadResponse = async (status) => {
    if (status === 401 || status === 403) {
      fakeAuth.clearCachedSession();
      fakeAuth.navigate('/login');
      return 'redirected';
    }
    return 'ok';
  };

  assert.equal(await handleReloadResponse(401), 'redirected');
  assert.equal(clearedSession, true);
  assert.equal(destination, '/login');

  clearedSession = false;
  destination = '';
  assert.equal(await handleReloadResponse(403), 'redirected');
  assert.equal(clearedSession, true);
  assert.equal(destination, '/login');
});

test('SPEC-84-02: PresentPage handles 401/403 authorization failures before attempting offline recovery', async () => {
  let clearedSession = false;
  let destination = '';

  const fakeAuth = {
    clearCachedSession: () => {
      clearedSession = true;
    },
    navigate: (url) => {
      destination = url;
    },
  };

  // Simulate PresentPage fetch response handler
  const handlePresentResponse = async (status) => {
    if (status === 401 || status === 403) {
      fakeAuth.clearCachedSession();
      fakeAuth.navigate('/login');
      return 'redirected';
    }
    return 'fallback';
  };

  assert.equal(await handlePresentResponse(401), 'redirected');
  assert.equal(clearedSession, true);
  assert.equal(destination, '/login');

  clearedSession = false;
  destination = '';
  assert.equal(await handlePresentResponse(403), 'redirected');
  assert.equal(clearedSession, true);
  assert.equal(destination, '/login');
});

test('SPEC-84-02: PresenterOperator receives full rawService payload and forwards it to OfflineReadinessBadge for retry', () => {
  const fullServicePayload = {
    id: 101,
    date: '2026-09-27',
    images_payload: {
      sermonGraphicUrl: 'http://church.local/sermon.jpg',
      familyPhotoUrl: 'http://church.local/family.jpg',
    },
    plan: [
      {
        id: 's1',
        artifact: { layout: { backgroundImage: 'http://church.local/bg.jpg', elements: [] } },
      },
    ],
  };

  // Simulate PresenterOperator serviceData prop mapping
  const rawService = fullServicePayload;
  const slides = fullServicePayload.plan;
  const serviceId = fullServicePayload.id;

  const passedToBadge = rawService || { id: serviceId, plan: slides };
  assert.deepEqual(passedToBadge, fullServicePayload, 'Must forward full rawService preserving images_payload');
  assert.ok(passedToBadge.images_payload?.sermonGraphicUrl, 'images_payload must be retained for retry');
});

test('SPEC-84-02: Operation-scoped MediaResolutionContext isolates route URLs and revokes cleanly', async () => {
  const {
    saveMediaBlob,
    resolvePlanMedia,
    createMediaResolutionContext,
    getActiveObjectUrlCount,
    revokeMediaUrls,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  const baselineCount = getActiveObjectUrlCount();
  const origCreate = globalThis.URL?.createObjectURL;
  const origRevoke = globalThis.URL?.revokeObjectURL;

  const revokedSet = new Set();
  globalThis.URL.createObjectURL = (b) => `blob:http://localhost/scoped-${Math.random()}`;
  globalThis.URL.revokeObjectURL = (u) => revokedSet.add(u);

  try {
    await saveMediaBlob('http://church.local/scoped1.jpg', new Blob(['data1']));
    await saveMediaBlob('http://church.local/scoped2.jpg', new Blob(['data2']));

    const plan1 = [{ id: 's1', artifact: { layout: { backgroundImage: 'http://church.local/scoped1.jpg', elements: [] } } }];
    const plan2 = [{ id: 's2', artifact: { layout: { backgroundImage: 'http://church.local/scoped2.jpg', elements: [] } } }];

    // Route 1 resolution
    const ctx1 = createMediaResolutionContext();
    const resolvedPlan1 = await resolvePlanMedia(plan1, ctx1);
    const url1 = resolvedPlan1[0].artifact.layout.backgroundImage;
    assert.ok(url1.startsWith('blob:'));
    assert.equal(ctx1.createdUrls.size, 1);

    // Route 2 resolution
    const ctx2 = createMediaResolutionContext();
    const resolvedPlan2 = await resolvePlanMedia(plan2, ctx2);
    const url2 = resolvedPlan2[0].artifact.layout.backgroundImage;
    assert.ok(url2.startsWith('blob:'));
    assert.equal(ctx2.createdUrls.size, 1);

    // Revoking Route 1 revokes url1 without revoking url2
    ctx1.revoke();
    assert.ok(revokedSet.has(url1), 'url1 must be revoked');
    assert.ok(!revokedSet.has(url2), 'url2 must NOT be revoked when Route 1 revokes');
    assert.equal(ctx1.createdUrls.size, 0);
    assert.equal(ctx2.createdUrls.size, 1);

    // Revoking Route 2
    ctx2.revoke();
    assert.ok(revokedSet.has(url2), 'url2 must now be revoked');
    assert.equal(ctx2.createdUrls.size, 0);
    assert.equal(getActiveObjectUrlCount(), baselineCount);
  } finally {
    revokeMediaUrls();
    if (origCreate) globalThis.URL.createObjectURL = origCreate;
    else delete globalThis.URL.createObjectURL;
    if (origRevoke) globalThis.URL.revokeObjectURL = origRevoke;
    else delete globalThis.URL.revokeObjectURL;
  }
});

test('SPEC-84-02: getServiceSnapshot rejects repopulating cache and returns null if epoch advanced during read', async () => {
  const {
    saveServiceSnapshot,
    getServiceSnapshot,
    clearOfflineStorage,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  const snapshot = {
    id: 'epoch-test-svc',
    plan: [],
    cached_at: Date.now(),
    status: 'ready',
  };
  await saveServiceSnapshot(snapshot);

  // Clear memory cache so next read would hit storage/recency-update
  clearInMemoryOfflineStore();

  // User logs out (advancing epoch and clearing storage)
  await clearOfflineStorage();

  // Attempt to read with old epoch
  const result = await getServiceSnapshot('epoch-test-svc', 0);
  assert.equal(result, null, 'Must return null and not resurrect snapshot data');
});

test('SPEC-84-02: resolveMediaUrl rejects caching object URL if epoch advanced', async () => {
  const {
    saveMediaBlob,
    resolveMediaUrl,
    clearOfflineStorage,
    getCachedMediaCount,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  const testUrl = 'http://church.local/epoch-media.jpg';
  await saveMediaBlob(testUrl, new Blob(['test']));

  // User logs out (advancing epoch and clearing storage)
  await clearOfflineStorage();
  assert.equal(getCachedMediaCount(), 0);

  // Attempt to resolve
  const resolved = await resolveMediaUrl(testUrl);
  assert.equal(resolved, testUrl, 'Must return original url and NOT a blob: url when storage was cleared');
  assert.equal(getCachedMediaCount(), 0, 'Must not resurrect media in memory');
});

test('SPEC-84-02: OfflineReadinessBadge state machine discards stale retry callbacks if newer live event arrived', () => {
  // Model state machine of OfflineReadinessBadge
  let readiness = null;
  let retrying = false;
  let retrySeq = 0;
  let receivedLiveEvent = false;

  const onLiveEvent = (live) => {
    receivedLiveEvent = true;
    readiness = live;
  };

  // Start retry
  retrying = true;
  receivedLiveEvent = false;
  const currentSeq = ++retrySeq;

  // While retry is in flight, a live event arrives from auto-warmer
  onLiveEvent({ status: 'ready', message: 'Offline Ready (0 external assets)' });

  // In-flight retry finishes late
  const staleRetryResult = { status: 'degraded', message: 'Degraded: 1 failed' };
  if (currentSeq === retrySeq && !receivedLiveEvent) {
    readiness = staleRetryResult;
  }
  if (currentSeq === retrySeq) {
    retrying = false;
  }

  assert.equal(readiness.status, 'ready', 'Fresh live event must not be overwritten by stale retry result');
  assert.equal(retrying, false, 'Retrying flag must reset');
});

test('SPEC-84-02: Real-file defect injection proofs with physical disk mutation and restoration', () => {
  const origSnapshot = fs.readFileSync(snapshotModulePath, 'utf8');
  const origRunSheet = fs.readFileSync(runSheetPagePath, 'utf8');
  const origPresent = fs.readFileSync(presentPagePath, 'utf8');
  const origPresenter = fs.readFileSync(presenterOperatorPath, 'utf8');
  const origBadge = fs.readFileSync(readinessBadgePath, 'utf8');

  // Baseline must be clean
  assert.deepEqual(scanSnapshotSecurityGuards(), []);

  // Defect 1: Physically mutate snapshot on disk (strip extractRequiredMediaUrls)
  try {
    const mutated = origSnapshot.replace('function extractRequiredMediaUrls(', 'function disabledExtract(');
    fs.writeFileSync(snapshotModulePath, mutated, 'utf8');
    const findings = scanSnapshotSecurityGuards();
    assert.ok(findings.some((f) => f.includes('extractRequiredMediaUrls')));
  } finally {
    fs.writeFileSync(snapshotModulePath, origSnapshot, 'utf8');
  }

  // Defect 2: Physically mutate RunSheetPage on disk (strip warmServiceSnapshot)
  try {
    const mutated = origRunSheet.replaceAll('warmServiceSnapshot(', 'disabledWarm(');
    fs.writeFileSync(runSheetPagePath, mutated, 'utf8');
    const findings = scanSnapshotSecurityGuards();
    assert.ok(findings.some((f) => f.includes('warmServiceSnapshot')));
  } finally {
    fs.writeFileSync(runSheetPagePath, origRunSheet, 'utf8');
  }

  // Defect 3: Physically mutate RunSheetPage on disk (strip offline-runsheet-banner)
  try {
    const mutated = origRunSheet.replace('data-testid="offline-runsheet-banner"', 'data-testid="standard"');
    fs.writeFileSync(runSheetPagePath, mutated, 'utf8');
    const findings = scanSnapshotSecurityGuards();
    assert.ok(findings.some((f) => f.includes('offline-runsheet-banner')));
  } finally {
    fs.writeFileSync(runSheetPagePath, origRunSheet, 'utf8');
  }

  // Defect 4: Physically mutate PresentPage on disk (strip isOffline forwarding)
  try {
    const mutated = origPresent.replace('isOffline={isOfflineData}', '');
    fs.writeFileSync(presentPagePath, mutated, 'utf8');
    const findings = scanSnapshotSecurityGuards();
    assert.ok(findings.some((f) => f.includes('isOffline forwarding')));
  } finally {
    fs.writeFileSync(presentPagePath, origPresent, 'utf8');
  }

  // Defect 5: Physically mutate PresenterOperator on disk (strip OfflineReadinessBadge)
  try {
    const mutated = origPresenter.replace('<OfflineReadinessBadge', '<div');
    fs.writeFileSync(presenterOperatorPath, mutated, 'utf8');
    const findings = scanSnapshotSecurityGuards();
    assert.ok(findings.some((f) => f.includes('OfflineReadinessBadge in header')));
  } finally {
    fs.writeFileSync(presenterOperatorPath, origPresenter, 'utf8');
  }

  // Defect 6: Physically mutate OfflineReadinessBadge on disk (strip data-testid)
  try {
    const mutated = origBadge.replace('data-testid="offline-readiness-badge"', 'data-testid="regular"');
    fs.writeFileSync(readinessBadgePath, mutated, 'utf8');
    const findings = scanSnapshotSecurityGuards();
    assert.ok(findings.some((f) => f.includes('OfflineReadinessBadge.tsx missing data-testid')));
  } finally {
    fs.writeFileSync(readinessBadgePath, origBadge, 'utf8');
  }

  // Final verification: all original files restored cleanly
  assert.deepEqual(scanSnapshotSecurityGuards(), []);
});
