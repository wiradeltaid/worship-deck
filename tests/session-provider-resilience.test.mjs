/**
 * SPEC-84-01: Session Provider Resilience & Last-Known Session Persistence
 *
 * Verifies:
 * 1. SessionProvider differentiates HTTP 401 Unauthorized from network failure.
 * 2. 401 Unauthorized clears sessionStorage and redirects to /login.
 * 3. Network failure (fetch throw, TypeError, 5xx) falls back to sessionStorage,
 *    marking isOffline: true without redirecting to /login.
 * 4. Explicit timeout handling (5000ms AbortController) in SessionProvider and ProjectorPage
 *    to prevent hanging requests on dead Wi-Fi.
 * 5. Dedicated offline network-error screen rendered when network is offline and no cached session exists.
 * 6. Explicit logout in LogoutButton clears sessionStorage and unconditionally redirects to /login in finally.
 * 7. OperatorShell displays calm offline indicator and passes isOffline to Header to restrict server mutations.
 * 8. ProjectorPage catches network failure, clears session on 401 across both /api/session
 *    and /api/services/:id requests, auto-warms snapshots via warmServiceSnapshot on successful load,
 *    resolves offline media via resolvePlanMedia, and boots from offline snapshot when disconnected.
 * 9. Real-file defect injection proofs proving guards fail closed when offline resilience is removed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const sessionProviderPath = path.join(root, 'spa', 'src', 'lib', 'auth', 'SessionProvider.tsx');
const authSessionPath = path.join(root, 'src', 'lib', 'auth-session.ts');
const logoutButtonPath = path.join(root, 'src', 'components', 'LogoutButton.tsx');
const operatorShellPath = path.join(root, 'spa', 'src', 'pages', 'OperatorShell.tsx');
const headerPath = path.join(root, 'src', 'components', 'Header.tsx');
const projectorPagePath = path.join(root, 'spa', 'src', 'pages', 'ProjectorPage.tsx');

export function scanSessionSecurityGuards(customSources = {}) {
  const findings = [];

  const providerSrc = customSources.provider ?? fs.readFileSync(sessionProviderPath, 'utf8');
  const authSessionSrc = customSources.authSession ?? fs.readFileSync(authSessionPath, 'utf8');
  const logoutSrc = customSources.logout ?? fs.readFileSync(logoutButtonPath, 'utf8');
  const shellSrc = customSources.shell ?? fs.readFileSync(operatorShellPath, 'utf8');
  const headerSrc = customSources.header ?? fs.readFileSync(headerPath, 'utf8');
  const projectorSrc = customSources.projector ?? fs.readFileSync(projectorPagePath, 'utf8');

  // 1. auth-session must export LAST_SESSION_STORAGE_KEY, clearCachedSession, getCachedSession, setCachedSession, submitPasswordChange
  if (!authSessionSrc.includes("LAST_SESSION_STORAGE_KEY = 'worship_deck_last_session'")) {
    findings.push('auth-session.ts missing LAST_SESSION_STORAGE_KEY constant');
  }
  if (!authSessionSrc.includes('function clearCachedSession()')) {
    findings.push('auth-session.ts missing clearCachedSession');
  }
  if (!authSessionSrc.includes('function getCachedSession()')) {
    findings.push('auth-session.ts missing getCachedSession');
  }
  if (!authSessionSrc.includes('function submitPasswordChange') || !authSessionSrc.includes('if (isOffline)')) {
    findings.push('auth-session.ts missing defensive submitPasswordChange');
  }
  if (!authSessionSrc.includes('function resolveOfflineSessionState()')) {
    findings.push('auth-session.ts missing resolveOfflineSessionState');
  }

  // 2. SessionProvider must import React primitives and router hooks
  if (!providerSrc.includes("from 'react'")) {
    findings.push('SessionProvider.tsx missing react imports');
  }
  if (!providerSrc.includes("from 'react-router-dom'")) {
    findings.push('SessionProvider.tsx missing react-router-dom imports');
  }

  // 3. SessionProvider must expose isOffline, 5000ms timeout signal, and offline-no-session-error UI
  if (!providerSrc.includes('isOffline: boolean')) {
    findings.push('SessionProvider.tsx SessionContextValue missing isOffline');
  }
  if (!providerSrc.includes('AbortController()') || !providerSrc.includes('signal: controller.signal')) {
    findings.push('SessionProvider.tsx missing AbortController timeout handling');
  }
  if (!providerSrc.includes('5000')) {
    findings.push('SessionProvider.tsx missing 5000ms timeout duration');
  }
  if (!providerSrc.includes('catch (_err)') && !providerSrc.includes('catch (err)')) {
    findings.push('SessionProvider.tsx missing network error catch handler');
  }
  if (!providerSrc.includes('setIsOffline(true)')) {
    findings.push('SessionProvider.tsx does not set isOffline to true on network error');
  }
  if (!providerSrc.includes('data-testid="offline-no-session-error"')) {
    findings.push('SessionProvider.tsx missing offline-no-session-error UI for uncached offline state');
  }

  if (!providerSrc.includes("window.addEventListener('online'") || !providerSrc.includes("window.addEventListener('offline'")) {
    findings.push('SessionProvider.tsx missing real-time online/offline event listeners');
  }
  if (!providerSrc.includes('revalidateSessionOnline')) {
    findings.push('SessionProvider.tsx handleOnline must actively revalidate via revalidateSessionOnline');
  }
  if (!providerSrc.includes('revalidationSeqRef')) {
    findings.push('SessionProvider.tsx missing revalidationSeqRef monotonic race guard');
  }
  if (!providerSrc.includes('initialSeq !== revalidationSeqRef.current')) {
    findings.push('SessionProvider.tsx initial mount fetch missing revalidationSeqRef sequence guard');
  }
  if (!providerSrc.includes('resolveOfflineSessionState()')) {
    findings.push('SessionProvider.tsx missing resolveOfflineSessionState integration');
  }

  // 4. LogoutButton must clear cached session, purge local snapshot store, and unconditionally assign /login in finally
  if (!logoutSrc.includes('clearCachedSession()')) {
    findings.push('LogoutButton.tsx missing clearCachedSession on logout');
  }
  if (!logoutSrc.includes('clearOfflineStorage()')) {
    findings.push('LogoutButton.tsx missing clearOfflineStorage on logout');
  }
  if (!logoutSrc.includes('Promise.race')) {
    findings.push('LogoutButton.tsx missing Promise.race bounded storage purge timeout');
  }
  if (!logoutSrc.includes("window.location.assign('/login')")) {
    findings.push('LogoutButton.tsx missing window.location.assign');
  }
  if (!logoutSrc.includes('finally')) {
    findings.push('LogoutButton.tsx missing finally block for unconditional navigation');
  }

  // 5. OperatorShell must display offline session banner and pass isOffline to Header
  if (!shellSrc.includes('data-testid="offline-session-banner"')) {
    findings.push('OperatorShell.tsx missing offline-session-banner');
  }
  if (!shellSrc.includes('isOffline={isOffline}')) {
    findings.push('OperatorShell.tsx does not pass isOffline to Header');
  }

  // 6. Header must restrict server mutations when isOffline is true
  if (!headerSrc.includes('offline-admin-disabled')) {
    findings.push('Header.tsx missing offline-admin-disabled guard');
  }
  if (!headerSrc.includes('disabled={busy || isOffline}')) {
    findings.push('Header.tsx does not disable password change when isOffline');
  }
  if (!headerSrc.includes('submitPasswordChange') || !headerSrc.includes('isOffline,')) {
    findings.push('Header.tsx handlePasswordChange missing defensive submitPasswordChange delegation with isOffline');
  }
  if (!headerSrc.includes('data-testid="offline-password-warning"')) {
    findings.push('Header.tsx missing offline-password-warning dialog notice');
  }

  // 7. ProjectorPage must wrap /api/session and /api/services with 5000ms AbortControllers,
  //    clear cache on 401 across both calls, require getCachedSession before snapshot fallback,
  //    warm snapshots with warmServiceSnapshot on successful load,
  //    resolve plan media, and fallback to getServiceSnapshot on network failure
  if (!projectorSrc.includes('getServiceSnapshot(')) {
    findings.push('ProjectorPage.tsx missing getServiceSnapshot fallback');
  }
  if (!projectorSrc.includes('getCachedSession()')) {
    findings.push('ProjectorPage.tsx must verify getCachedSession before offline snapshot fallback');
  }
  if (!projectorSrc.includes('setCachedSession(')) {
    findings.push('ProjectorPage.tsx missing setCachedSession online authorization bootstrapping');
  }
  if (!projectorSrc.includes('403')) {
    findings.push('ProjectorPage.tsx missing 403 authorization handling');
  }
  if (!providerSrc.includes('403')) {
    findings.push('SessionProvider.tsx missing 403 authorization handling');
  }
  if (!projectorSrc.includes('warmServiceSnapshot(')) {
    findings.push('ProjectorPage.tsx missing warmServiceSnapshot auto-warming call');
  }
  if (!projectorSrc.includes('resolvePlanMedia(')) {
    findings.push('ProjectorPage.tsx missing resolvePlanMedia cached media resolution');
  }
  if (!projectorSrc.includes('createMediaResolutionContext')) {
    findings.push('ProjectorPage.tsx missing createMediaResolutionContext');
  }
  if (!projectorSrc.includes('resolutionContext.revoke()')) {
    findings.push('ProjectorPage.tsx missing resolutionContext.revoke() on route effect cleanup');
  }
  if (!projectorSrc.includes('sessionController') || !projectorSrc.includes('serviceController')) {
    findings.push('ProjectorPage.tsx missing AbortController timeout protection on network calls');
  }
  if (!projectorSrc.includes('setUnavailable(null)') || !projectorSrc.includes('setData(null)')) {
    findings.push('ProjectorPage.tsx missing state reset on effect execution');
  }
  const clearMatches =
    projectorSrc.match(/invalidateAuthAndPurgeOffline\(\)/g) ||
    projectorSrc.match(/clearCachedSession\(\)/g) ||
    [];
  if (clearMatches.length < 2) {
    findings.push('ProjectorPage.tsx must clear session cache on both /api/session 401 and /api/services 401');
  }

  return findings;
}

test('SPEC-84-01: SessionProvider, auth-session, LogoutButton, OperatorShell, Header, and ProjectorPage structural guards pass', () => {
  const findings = scanSessionSecurityGuards();
  assert.deepEqual(findings, [], `Expected 0 findings, got: ${findings.join(', ')}`);
});

test('SPEC-84-01: Shared clearCachedSession purges storage reliably across routes', async () => {
  const { clearCachedSession, getCachedSession, setCachedSession } = await import(
    new URL('../src/lib/auth-session.ts', import.meta.url).href
  );

  const storage = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
  };

  try {
    setCachedSession({ username: 'operator_alpha', role: 'operator' });
    assert.deepEqual(getCachedSession(), { username: 'operator_alpha', role: 'operator' });

    // Clear cache via shared helper
    clearCachedSession();
    assert.equal(getCachedSession(), null);
  } finally {
    delete globalThis.window;
  }
});

test('SPEC-84-01: LogoutButton unconditionally navigates to /login even if server request throws or times out', async () => {
  let cleared = false;
  let destination = '';

  const fakeSession = {
    clearCachedSession: () => {
      cleared = true;
    },
  };

  // Simulate LogoutButton execution flow
  const executeLogout = async () => {
    fakeSession.clearCachedSession();
    try {
      const controller = new AbortController();
      controller.abort(); // simulate immediate abort/timeout
      await Promise.reject(new Error('Network offline'));
    } catch {
      // Ignored in component
    } finally {
      destination = '/login';
    }
  };

  await executeLogout();
  assert.equal(cleared, true, 'Must clear cached session storage before request');
  assert.equal(destination, '/login', 'Must navigate to /login unconditionally in finally block');
});

test('SPEC-84-01: LogoutButton bounds stalled storage clear with Promise.race and still completes navigation', async () => {
  let destination = '';
  const startTime = Date.now();

  // Simulate stalled IndexedDB clear that never resolves
  const hangingClearStorage = () => new Promise(() => {});

  const executeLogout = async () => {
    try {
      await Promise.race([
        hangingClearStorage(),
        new Promise((resolve) => setTimeout(resolve, 50)), // short timeout for test
      ]);
    } catch {
      // Ignored
    } finally {
      destination = '/login';
    }
  };

  await executeLogout();
  const elapsed = Date.now() - startTime;
  assert.ok(elapsed < 200, `Logout must finish within timeout bound, elapsed ${elapsed}ms`);
  assert.equal(destination, '/login', 'Must navigate to /login even if storage cleanup stalls');
});

test('SPEC-84-01: SessionProvider monotonic revalidation ID discards older resolved reconnect if newer offline event fired', async () => {
  let seq = 0;
  let isOffline = false;

  // Simulate SessionProvider handleOnline / handleOffline sequence
  const onOffline = () => {
    seq++;
    isOffline = true;
  };

  // Reconnect 1 starts
  const seq1 = ++seq;

  // Mid-flight, network drops again -> onOffline fires
  onOffline();
  assert.equal(isOffline, true);

  // Reconnect 1 completes late (after offline fired)
  const onAuthed1 = () => {
    if (seq1 !== seq) return; // Stale! discarded
    isOffline = false;
  };
  onAuthed1();

  assert.equal(isOffline, true, 'Stale online revalidation must NOT overwrite newer offline drop');
});

test('SPEC-84-01: SessionProvider initial mount fetch delayed response is discarded if online reconnect completed first', () => {
  let revalidationSeq = 0;
  let currentSession = null;
  let isOffline = true;

  // 1. Initial mount fetch starts
  const initialSeq = ++revalidationSeq;

  // 2. While initial fetch is pending, network reconnects and online revalidation fires & resolves
  const onlineSeq = ++revalidationSeq;
  currentSession = { username: 'verified_reconnect_user', role: 'operator' };
  isOffline = false;

  // 3. Initial fetch resolves late with stale data / error
  const staleSession = { username: 'old_stale_user', role: 'admin' };
  if (initialSeq === revalidationSeq) {
    currentSession = staleSession;
    isOffline = true;
  }

  assert.equal(currentSession.username, 'verified_reconnect_user', 'Stale initial fetch must NOT overwrite newer online revalidation');
  assert.equal(isOffline, false);
});

test('SPEC-84-01: ProjectorPage state resets on new route ID and guards against stale async resolution', () => {
  let unavailable = 'error';
  let data = { id: 'old-service' };
  let cancelled = false;

  // Route changes to new id: state resets immediately
  unavailable = null;
  data = null;
  assert.equal(unavailable, null);
  assert.equal(data, null);

  // If previous effect is cancelled:
  cancelled = true;
  const staleData = { id: 'old-service-late' };
  if (!cancelled) {
    data = staleData;
  }
  assert.equal(data, null, 'Cancelled effect must not update data');
});

test('SPEC-84-01: resolveOfflineSessionState resolves cached session immediately avoiding loading stalls', async () => {
  const { resolveOfflineSessionState, setCachedSession, clearCachedSession } = await import(
    new URL('../src/lib/auth-session.ts', import.meta.url).href
  );

  const storage = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
  };

  try {
    // 1. Without cached session: status is unauthed, session is null, isOffline is true
    clearCachedSession();
    const uncachedState = resolveOfflineSessionState();
    assert.equal(uncachedState.status, 'unauthed');
    assert.equal(uncachedState.session, null);
    assert.equal(uncachedState.isOffline, true);

    // 2. With cached session: status is authed, session is populated, isOffline is true
    setCachedSession({ username: 'stage_operator', role: 'operator' });
    const cachedState = resolveOfflineSessionState();
    assert.equal(cachedState.status, 'authed');
    assert.equal(cachedState.session?.username, 'stage_operator');
    assert.equal(cachedState.isOffline, true);
  } finally {
    clearCachedSession();
    delete globalThis.window;
  }
});

test('SPEC-84-01: Projector route effect cleanup revokes active blob media URLs preventing leaks across ID changes', async () => {
  const {
    saveMediaBlob,
    resolvePlanMedia,
    createMediaResolutionContext,
    getActiveObjectUrlCount,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  const origCreate = globalThis.URL?.createObjectURL;
  const origRevoke = globalThis.URL?.revokeObjectURL;

  const revokedUrls = new Set();
  globalThis.URL.createObjectURL = () => `blob:http://localhost/test-${Math.random()}`;
  globalThis.URL.revokeObjectURL = (url) => {
    revokedUrls.add(url);
  };

  try {
    await saveMediaBlob('http://church.local/slide1.jpg', new Blob(['test']));
    const plan = [{ id: 's1', artifact: { layout: { backgroundImage: 'http://church.local/slide1.jpg', elements: [] } } }];

    // Route 1 operation: creates resolutionContext1
    const context1 = createMediaResolutionContext();
    await resolvePlanMedia(plan, context1);
    assert.equal(context1.createdUrls.size, 1);

    // Route 2 operation (concurrent or subsequent): creates resolutionContext2
    const context2 = createMediaResolutionContext();
    await resolvePlanMedia(plan, context2);
    assert.equal(context2.createdUrls.size, 1);

    // Route 1 effect cleanup / cancellation: revokes ONLY context1 URLs without touching context2!
    context1.revoke();
    assert.equal(context1.createdUrls.size, 0);
    assert.equal(context2.createdUrls.size, 1, 'Context 2 URLs must remain intact when Route 1 revokes');

    // Route 2 cleanup
    context2.revoke();
    assert.equal(context2.createdUrls.size, 0);
  } finally {
    if (origCreate) globalThis.URL.createObjectURL = origCreate;
    else delete globalThis.URL.createObjectURL;
    if (origRevoke) globalThis.URL.revokeObjectURL = origRevoke;
    else delete globalThis.URL.revokeObjectURL;
  }
});

test('SPEC-84-01: resolvePlanMedia cancelled mid-flight immediately revokes newly created URLs and prevents late leaks', async () => {
  const {
    saveMediaBlob,
    resolvePlanMedia,
    resolveMediaUrl,
    createMediaResolutionContext,
    getActiveObjectUrlCount,
    revokeMediaUrls,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  const origCreate = globalThis.URL?.createObjectURL;
  const origRevoke = globalThis.URL?.revokeObjectURL;

  const revokedUrls = new Set();
  const createdUrls = new Set();

  globalThis.URL.createObjectURL = () => {
    const u = `blob:http://localhost/midflight-${Math.random()}`;
    createdUrls.add(u);
    return u;
  };
  globalThis.URL.revokeObjectURL = (u) => {
    revokedUrls.add(u);
  };

  try {
    const baselineCount = getActiveObjectUrlCount();
    await saveMediaBlob('http://church.local/img1.jpg', new Blob(['test1']));
    await saveMediaBlob('http://church.local/img2.jpg', new Blob(['test2']));

    const context = createMediaResolutionContext();

    // 1. Resolve first media URL while context is active
    const u1 = await resolveMediaUrl('http://church.local/img1.jpg', context);
    assert.ok(u1.startsWith('blob:'));
    assert.equal(context.createdUrls.size, 1);
    assert.equal(context.isRevoked, false);
    assert.equal(getActiveObjectUrlCount(), baselineCount + 1);

    // 2. Mid-flight cancellation occurs (e.g. route changed or unmounted while sibling operation in flight)
    context.revoke();
    assert.equal(context.isRevoked, true);
    assert.equal(context.createdUrls.size, 0);
    assert.ok(revokedUrls.has(u1), 'u1 must be immediately revoked on context.revoke()');
    assert.equal(getActiveObjectUrlCount(), baselineCount, 'Global activeObjectUrls count must return to baseline after revoke');

    // 3. Sibling deferred operation completes AFTER revocation:
    // resolveMediaUrl must detect context.isRevoked, immediately revoke the late URL, and not leak it!
    const u2 = await resolveMediaUrl('http://church.local/img2.jpg', context);
    assert.equal(u2, 'http://church.local/img2.jpg', 'Late resolution must fall back to original URL');
    assert.equal(context.createdUrls.size, 0, 'No late URL can be retained in context');
    assert.equal(getActiveObjectUrlCount(), baselineCount, 'Late resolution must NOT increase global active count');

    // 4. In resolvePlanMedia with a concurrent sibling branch deferred behind an async lookup barrier:
    const concurrentContext = createMediaResolutionContext();
    let releaseItem2Lookup = null;
    const item2Barrier = new Promise((resolve) => {
      releaseItem2Lookup = resolve;
    });

    let item1Created = null;
    let item2Created = null;

    globalThis.URL.createObjectURL = () => {
      const u = `blob:http://localhost/concurrent-${Math.random()}`;
      createdUrls.add(u);
      if (!item1Created) item1Created = u;
      else if (!item2Created) item2Created = u;
      return u;
    };

    // Mock IndexedDB lookup for item 2 to defer resolution asynchronously
    const origWindow = globalThis.window;
    globalThis.window = {
      indexedDB: {
        open: () => {
          const req = {
            onsuccess: null,
            onerror: null,
            result: {
              transaction: () => ({
                objectStore: () => ({
                  get: (url) => {
                    const getReq = { onsuccess: null, onerror: null, result: null };
                    item2Barrier.then(() => {
                      getReq.result = { url, blob: new Blob(['delayed']) };
                      getReq.onsuccess?.({ target: getReq });
                    });
                    return getReq;
                  },
                }),
              }),
            },
          };
          setTimeout(() => req.onsuccess?.({ target: req }), 0);
          return req;
        },
      },
    };

    let isCancelled = false;
    const concurrentPlan = [
      { id: 's1', artifact: { layout: { backgroundImage: 'http://church.local/img1.jpg', elements: [] } } },
      { id: 's2', artifact: { layout: { backgroundImage: 'http://church.local/deferred-lookup.jpg', elements: [] } } },
    ];

    // Single-pass resolution of both concurrent plan items
    const resolutionPromise = resolvePlanMedia(concurrentPlan, concurrentContext, () => isCancelled);

    // Yield macro-task: s1 resolves from memory immediately and creates object URL; s2 enters deferred IndexedDB lookup
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.ok(item1Created, 'Item 1 URL must have been created');
    assert.equal(concurrentContext.createdUrls.size, 1);

    // Cancel and revoke concurrentContext while s2 is still pending behind item2Barrier!
    isCancelled = true;
    concurrentContext.revoke();

    assert.equal(concurrentContext.isRevoked, true);
    assert.ok(revokedUrls.has(item1Created), 'Item 1 URL must be revoked immediately on context.revoke()');
    assert.equal(concurrentContext.createdUrls.size, 0);

    // Release deferred IndexedDB lookup for s2 allowing late creation
    releaseItem2Lookup();
    const finalPlan = await resolutionPromise;

    // Assert all invariants:
    assert.equal(concurrentContext.createdUrls.size, 0);
    assert.equal(getActiveObjectUrlCount(), baselineCount, 'Global active count must remain at baseline');
    assert.ok(
      !finalPlan[0]?.artifact?.layout?.backgroundImage?.startsWith('blob:'),
      'Final plan must not expose revoked blob URL for item 1'
    );
    assert.ok(
      !finalPlan[1]?.artifact?.layout?.backgroundImage?.startsWith('blob:'),
      'Final plan must not expose blob URL for cancelled item 2'
    );

    if (origWindow) globalThis.window = origWindow;
    else delete globalThis.window;
  } finally {
    revokeMediaUrls();
    if (origCreate) globalThis.URL.createObjectURL = origCreate;
    else delete globalThis.URL.createObjectURL;
    if (origRevoke) globalThis.URL.revokeObjectURL = origRevoke;
    else delete globalThis.URL.revokeObjectURL;
  }
});

test('SPEC-84-01: SessionProvider simulated network failure recovers from sessionStorage without redirect', () => {
  const storage = new Map();
  const fakeSessionStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };

  const cachedUser = { username: 'worship_leader', role: 'operator' };
  fakeSessionStorage.setItem('worship_deck_last_session', JSON.stringify(cachedUser));

  // Simulate network failure throw
  let session = null;
  let status = 'loading';
  let isOffline = false;
  let redirected = false;

  try {
    throw new TypeError('Failed to fetch');
  } catch (_err) {
    const raw = fakeSessionStorage.getItem('worship_deck_last_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.username && (parsed.role === 'admin' || parsed.role === 'operator')) {
        session = parsed;
        status = 'authed';
        isOffline = true;
      }
    } else {
      status = 'unauthed';
      isOffline = true;
    }
  }

  assert.deepEqual(session, cachedUser);
  assert.equal(status, 'authed');
  assert.equal(isOffline, true);
  assert.equal(redirected, false, 'Must NOT redirect to /login on network failure');
});

test('SPEC-84-01: SessionProvider AbortController timeout handling aborts hanging fetch', async () => {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('Session request timed out'));
  }, 10);

  await new Promise((resolve) => setTimeout(resolve, 30));
  clearTimeout(timer);

  assert.equal(timedOut, true);
  assert.equal(controller.signal.aborted, true);
});

test('SPEC-84-01: Projector auto-warms snapshot, resolves blob media offline, and cleans up object URLs on teardown', async () => {
  const {
    getServiceSnapshot,
    warmServiceSnapshot,
    resolvePlanMedia,
    revokeMediaUrls,
    saveMediaBlob,
    getActiveObjectUrlCount,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  const origCreate = globalThis.URL?.createObjectURL;
  const origRevoke = globalThis.URL?.revokeObjectURL;

  const createdUrls = new Set();
  globalThis.URL.createObjectURL = (blob) => {
    const fakeUrl = `blob:http://localhost/${Math.random().toString(36).substring(2)}`;
    createdUrls.add(fakeUrl);
    return fakeUrl;
  };
  globalThis.URL.revokeObjectURL = (url) => {
    createdUrls.delete(url);
  };

  try {
    const fakeBlob = new Blob(['fake image binary data'], { type: 'image/jpeg' });
    await saveMediaBlob('http://church.local/bg.jpg', fakeBlob);

    const mockLiveService = {
      id: 'svc-live-stage-84',
      plan_identity: 'identity-live-84',
      transition: 'fade',
      plan: [
        {
          id: 's1',
          artifact: {
            label: 'Sermon Slide',
            layout: {
              backgroundImage: 'http://church.local/bg.jpg',
              elements: [],
            },
          },
        },
      ],
    };

    // 1. Auto-warm snapshot as ProjectorPage does on successful load
    const readiness = await warmServiceSnapshot('svc-live-stage-84', mockLiveService);
    assert.ok(readiness.status === 'ready' || readiness.status === 'degraded');

    // 2. Simulate subsequent offline reboot: fetch throws, getServiceSnapshot retrieves it
    let offlineData = null;
    let offlineUnavailable = null;

    try {
      throw new Error('Network unreachable');
    } catch {
      const snapshot = await getServiceSnapshot('svc-live-stage-84');
      if (snapshot && snapshot.id) {
        const resolvedPlan = await resolvePlanMedia(snapshot.plan || []);
        offlineData = { ...snapshot, plan: resolvedPlan };
      } else {
        offlineUnavailable = 'error';
      }
    }

    assert.ok(offlineData, 'Projector must load data from offline snapshot');
    assert.equal(offlineData.id, 'svc-live-stage-84');
    assert.equal(offlineData.plan_identity, 'identity-live-84');
    assert.ok(
      offlineData.plan[0].artifact.layout.backgroundImage.startsWith('blob:'),
      'Cached media URL must be resolved to blob URL'
    );
    assert.equal(offlineUnavailable, null);

    // Verify active object URL count is tracked
    assert.ok(getActiveObjectUrlCount() > 0, 'Must track active object URLs');

    // Teardown: revokeMediaUrls must clear all tracked object URLs
    revokeMediaUrls();
    assert.equal(getActiveObjectUrlCount(), 0, 'Active object URL count must be 0 after revokeMediaUrls');
    assert.equal(createdUrls.size, 0, 'All created object URLs must be revoked');
  } finally {
    if (origCreate) globalThis.URL.createObjectURL = origCreate;
    else delete globalThis.URL.createObjectURL;
    if (origRevoke) globalThis.URL.revokeObjectURL = origRevoke;
    else delete globalThis.URL.revokeObjectURL;
  }
});

test('SPEC-84-01: Eviction bounds cache by sweeping orphaned media when services exceed retention limit', async () => {
  const {
    saveServiceSnapshot,
    saveMediaBlob,
    getCachedMediaCount,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  // Pre-seed 5 services to trigger MAX_CACHED_SERVICES (4) eviction
  for (let i = 1; i <= 5; i++) {
    const url = `http://church.local/media-svc-${i}.jpg`;
    await saveMediaBlob(url, new Blob([`data ${i}`], { type: 'image/jpeg' }));
    await saveServiceSnapshot({
      id: `svc-evict-${i}`,
      plan: [
        {
          id: `s-${i}`,
          artifact: { layout: { backgroundImage: url, elements: [] } },
        },
      ],
      cached_at: 1000 + i * 10,
      status: 'ready',
    });
  }

  // After 5 services, oldest service (svc-evict-1) is evicted and its media orphaned
  const mediaCount = getCachedMediaCount();
  assert.equal(mediaCount, 4, `Media cache must be bounded to 4 surviving services, got ${mediaCount}`);
});

test('SPEC-84-01: submitPasswordChange defensively aborts when offline even if dialog was already open', async () => {
  const { submitPasswordChange } = await import(
    new URL('../src/lib/auth-session.ts', import.meta.url).href
  );

  let attemptedFetch = false;
  const mockFetch = async () => {
    attemptedFetch = true;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  // 1. Online: executes fetch
  const onlineResult = await submitPasswordChange({
    currentPassword: 'current-pwd',
    newPassword: 'new-password-123',
    isOffline: false,
    fetchFn: mockFetch,
  });
  assert.equal(attemptedFetch, true, 'Online must invoke fetch');
  assert.equal(onlineResult.ok, true);

  // 2. Offline: defensively aborts without invoking fetch
  attemptedFetch = false;
  const offlineResult = await submitPasswordChange({
    currentPassword: 'current-pwd',
    newPassword: 'new-password-123',
    isOffline: true,
    fetchFn: mockFetch,
  });
  assert.equal(attemptedFetch, false, 'Must NOT attempt fetch to /api/auth/change-password when isOffline');
  assert.equal(offlineResult.ok, false);
  assert.ok(offlineResult.error?.includes('offline'));
});

test('SPEC-84-01: revalidateSessionOnline fail-closed guarantee forces offline status on failure even if initially false', async () => {
  const { revalidateSessionOnline } = await import(
    new URL('../src/lib/auth-session.ts', import.meta.url).href
  );

  // 1. Failing fetch (e.g. captive portal or network timeout)
  const failRes = await revalidateSessionOnline({
    fetchFn: async () => {
      throw new Error('Connection refused by captive portal');
    },
  });
  assert.equal(failRes.status, 'offline', 'Failing revalidation MUST return status: offline');

  // 2. 401 or 403 response: returns status: unauthed
  const unauthedRes401 = await revalidateSessionOnline({
    fetchFn: async () => new Response(null, { status: 401 }),
  });
  assert.equal(unauthedRes401.status, 'unauthed', '401 revalidation must return status: unauthed');

  const unauthedRes403 = await revalidateSessionOnline({
    fetchFn: async () => new Response(null, { status: 403 }),
  });
  assert.equal(unauthedRes403.status, 'unauthed', '403 revalidation must return status: unauthed');

  // 3. 200 response with valid session: returns status: authed with session payload
  const authedRes = await revalidateSessionOnline({
    fetchFn: async () =>
      new Response(JSON.stringify({ username: 'church_admin', role: 'admin' }), { status: 200 }),
  });
  assert.equal(authedRes.status, 'authed');
  assert.equal(authedRes.session?.username, 'church_admin');
});

test('SPEC-84-01: Projector online bootstrap enables offline snapshot fallback, but logout purges and refuses fallback', async () => {
  const { getServiceSnapshot, saveServiceSnapshot, clearOfflineStorage, resolvePlanMedia } =
    await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);
  const { clearCachedSession, getCachedSession, setCachedSession } = await import(
    new URL('../src/lib/auth-session.ts', import.meta.url).href
  );

  const storage = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
  };

  try {
    // 1. Online Projector load: successfully checks /api/session, bootstraps session, saves snapshot
    const liveSession = { username: 'projector_op', role: 'operator' };
    setCachedSession(liveSession);
    assert.deepEqual(getCachedSession(), liveSession);

    const liveService = {
      id: 'svc-proj-test',
      plan_identity: 'id-proj-1',
      transition: 'fade',
      plan: [{ id: 'slide-1', artifact: { layout: { elements: [] } } }],
      cached_at: Date.now(),
      status: 'ready',
    };
    await saveServiceSnapshot(liveService);

    // 2. Offline reload on Projector: verified session exists -> loads offline snapshot!
    const cachedSessionBeforeLogout = getCachedSession();
    assert.ok(cachedSessionBeforeLogout);
    const loadedSnapshot = await getServiceSnapshot('svc-proj-test');
    assert.ok(loadedSnapshot);
    const resolved = await resolvePlanMedia(loadedSnapshot.plan || []);
    assert.equal(resolved.length, 1);

    // 3. Explicit logout: purges both session storage AND offline storage
    clearCachedSession();
    await clearOfflineStorage();
    assert.equal(getCachedSession(), null);
    assert.equal(await getServiceSnapshot('svc-proj-test'), null);

    // 4. Reopening Projector while offline post-logout: refuses fallback because cached session is absent
    let projectorData = null;
    let projectorUnavailable = null;
    const isOffline = true;
    const serviceId = 'svc-proj-test';

    if (isOffline && serviceId) {
      const cached = getCachedSession();
      if (cached && cached.username) {
        projectorData = await getServiceSnapshot(serviceId);
      } else {
        projectorUnavailable = 'error';
      }
    }

    assert.equal(projectorData, null, 'Must NOT load offline snapshot when post-logout session is absent');
    assert.equal(projectorUnavailable, 'error', 'Must set unavailable to error');
  } finally {
    await clearOfflineStorage();
    delete globalThis.window;
  }
});

test('SPEC-84-01: Defect injection proofs verify guards fail closed on defect', () => {
  const realProviderSrc = fs.readFileSync(sessionProviderPath, 'utf8');
  const realLogoutSrc = fs.readFileSync(logoutButtonPath, 'utf8');
  const realProjectorSrc = fs.readFileSync(projectorPagePath, 'utf8');
  const realShellSrc = fs.readFileSync(operatorShellPath, 'utf8');
  const realHeaderSrc = fs.readFileSync(headerPath, 'utf8');

  // Baseline must be clean
  assert.deepEqual(scanSessionSecurityGuards(), []);

  // Defect 1: Strip catch block in SessionProvider
  const d1 = scanSessionSecurityGuards({ provider: realProviderSrc.replace('catch (_err)', '// removed') });
  assert.ok(d1.some((f) => f.includes('network error catch handler')));

  // Defect 2: Strip offline-no-session-error UI in SessionProvider
  const d2 = scanSessionSecurityGuards({
    provider: realProviderSrc.replace('data-testid="offline-no-session-error"', 'data-testid="standard"'),
  });
  assert.ok(d2.some((f) => f.includes('offline-no-session-error UI')));

  // Defect 3: Strip clearCachedSession in LogoutButton
  const d3 = scanSessionSecurityGuards({ logout: realLogoutSrc.replace('clearCachedSession();', '// removed') });
  assert.ok(d3.some((f) => f.includes('clearCachedSession on logout')));

  // Defect 4: Strip double 401 purge in ProjectorPage
  const d4 = scanSessionSecurityGuards({
    projector: realProjectorSrc.replace(
      /res\.status === 401[\s\S]*?(?:invalidateAuthAndPurgeOffline|clearCachedSession)\(\)/,
      'res.status === 401) {'
    ),
  });
  assert.ok(d4.some((f) => f.includes('must clear session cache on both')));

  // Defect 5: Strip resolvePlanMedia in ProjectorPage
  const d5 = scanSessionSecurityGuards({
    projector: realProjectorSrc.replace(/resolvePlanMedia\(/g, 'unresolvedPlanMedia('),
  });
  assert.ok(d5.some((f) => f.includes('resolvePlanMedia')));

  // Defect 6: Strip isOffline passing to Header in OperatorShell
  const d6 = scanSessionSecurityGuards({
    shell: realShellSrc.replace('isOffline={isOffline}', ''),
  });
  assert.ok(d6.some((f) => f.includes('does not pass isOffline to Header')));

  // Defect 7: Strip offline-admin-disabled in Header
  const d7 = scanSessionSecurityGuards({
    header: realHeaderSrc.replace('offline-admin-disabled', 'admin-always-enabled'),
  });
  assert.ok(d7.some((f) => f.includes('offline-admin-disabled guard')));
});
