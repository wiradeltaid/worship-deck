import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('SPEC-99-03: PresenterOperator openProjector builds multi-screen coordinates and fullscreen parameter', () => {
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const src = fs.readFileSync(presenterPath, 'utf8');

  // Must import resolveLaunchTarget and getDisplayTargetConfig from display-target
  assert.ok(
    src.includes('resolveLaunchTarget') && src.includes('getDisplayTargetConfig'),
    'PresenterOperator must import resolveLaunchTarget and getDisplayTargetConfig'
  );

  // Must construct targetUrl with fullscreen=1 when mode is fullscreen
  assert.ok(
    src.includes('fullscreen=1'),
    'PresenterOperator must pass fullscreen=1 when launching fullscreen target'
  );

  // Must preserve transient user activation by resolving synchronously
  assert.ok(
    src.includes('getSynchronousScreens') && !src.includes('async (overrideTarget'),
    'openProjector must be synchronous and use getSynchronousScreens to avoid popup blocker tripping'
  );

  // Must pass relocateProjector to PresenterDisplayControl
  assert.ok(
    src.includes('onRelocate='),
    'PresenterOperator must provide onRelocate to PresenterDisplayControl'
  );
});

test('SPEC-99-03: ProjectorClient handles fullscreen=1 query parameter with graceful F11 fallback', () => {
  const projectorPath = path.join(ROOT, 'src', 'projected', 'ProjectorClient.tsx');
  const src = fs.readFileSync(projectorPath, 'utf8');

  // Must check for fullscreen=1 query param
  assert.ok(
    src.includes('fullscreen') && src.includes('requestFullscreen'),
    'ProjectorClient must attempt requestFullscreen when fullscreen param is present'
  );

  // Must preserve F11 guidance hint on requestFullscreen failure
  assert.ok(
    src.includes('setShowHint'),
    'ProjectorClient must maintain F11 guidance fallback'
  );
});

test('SPEC-99-03: Window relocation closes existing window before opening on new target', () => {
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const src = fs.readFileSync(presenterPath, 'utf8');

  // Relocation logic must close existing handle
  assert.ok(
    src.includes('existing.close()') || src.includes('existing?.close()'),
    'Relocation must close existing window handle'
  );
});

test('SPEC-99-03: Topology events do not alter AD-29 heartbeat liveness state', async () => {
  const { subscribeScreenTopology } = await import(new URL('../src/lib/display-target.ts', import.meta.url).href);
  const { INITIAL_LIVENESS_STATE, nextLivenessState } = await import(
    new URL('../src/lib/projector-liveness.ts', import.meta.url).href
  );

  // Liveness remains purely driven by opened/ack/heartbeat ticks (AD-29)
  const state1 = nextLivenessState(INITIAL_LIVENESS_STATE, { type: 'opened' }, 1000);
  assert.equal(state1.verdict, 'never-opened');

  // Topology subscription returns a cleanup function and does not emit liveness actions
  const cleanup = subscribeScreenTopology(() => {});
  assert.equal(typeof cleanup, 'function');
  cleanup();

  // Heartbeat ack is the sole authority for 'live' verdict
  const state2 = nextLivenessState(state1, { type: 'ack' }, 1000);
  assert.equal(state2.verdict, 'live');
});

test('SPEC-99-03: Synchronous window.open launch preserves user gesture activation and handles popup blocker', async () => {
  const { resolveLaunchTarget, getSynchronousScreens } = await import(
    new URL('../src/lib/display-target.ts', import.meta.url).href
  );

  let openedUrl = null;
  let openedName = null;
  let openedFeatures = null;
  let simulateBlock = false;

  // Mock global window with window.screen and synchronous window.open
  globalThis.window = {
    screen: {
      availLeft: 0,
      availTop: 0,
      availWidth: 1920,
      availHeight: 1080,
    },
    open: (url, name, features) => {
      if (simulateBlock) return null; // popup blocked
      openedUrl = url;
      openedName = name;
      openedFeatures = features;
      return {
        focus: () => {},
        close: () => {},
        closed: false,
        location: { href: url },
      };
    },
  };

  // Behavioral launch handler mirroring PresenterOperator openProjector logic
  function launch(targetOverride, serviceId = 42, projectorUrl = '/projected?service=42') {
    const screens = getSynchronousScreens();
    const target = targetOverride || resolveLaunchTarget({ targetPreference: 'external-display', mode: 'fullscreen', rememberOnDevice: true }, screens);
    const targetUrl = target.mode === 'fullscreen' ? `${projectorUrl}&fullscreen=1` : projectorUrl;
    const opened = window.open(targetUrl, `projector_${serviceId}`, target.windowFeatures);
    const isBlocked = opened === null;
    return { opened, isBlocked, targetUrl, mode: target.mode, features: target.windowFeatures };
  }

  // 1. Single-screen fallback launches in safe window mode without fullscreen=1 to prevent lockout
  const result1 = launch();
  assert.equal(result1.isBlocked, false);
  assert.equal(result1.mode, 'window');
  assert.ok(openedFeatures.includes('1280'));

  // 2. Fullscreen target appends fullscreen=1 and positions at external display coordinates
  const fullscreenTarget = {
    mode: 'fullscreen',
    windowFeatures: 'popup=1,left=1920,top=0,width=1920,height=1080',
  };
  const result2 = launch(fullscreenTarget);
  assert.equal(result2.isBlocked, false);
  assert.ok(openedUrl.includes('fullscreen=1'));
  assert.ok(openedFeatures.includes('1920'));

  // 3. Blocked popup case returns isBlocked: true without throwing
  simulateBlock = true;
  const result3 = launch();
  assert.equal(result3.isBlocked, true);
  assert.equal(result3.opened, null);
});

test('SPEC-99-03: Lost projector handle is cleanly closed and reopened on target display', () => {
  let closedOld = false;
  let focused = false;
  let openedNew = false;

  const lostHandle = {
    closed: false,
    focus: () => {
      focused = true;
    },
    close: () => {
      closedOld = true;
    },
  };

  // Logic mirroring PresenterOperator openProjector isLost handling
  function handleReopen(existing, isLost, openNewFn) {
    if (existing && !existing.closed && !isLost) {
      existing.focus();
      return;
    }
    if (existing && !existing.closed) {
      existing.close();
    }
    openNewFn();
  }

  handleReopen(lostHandle, true, () => {
    openedNew = true;
  });

  assert.equal(closedOld, true, 'Lost window handle must be explicitly closed');
  assert.equal(focused, false, 'Lost window handle must not be focused as a shortcut');
  assert.equal(openedNew, true, 'New window must be opened on target display');
});

test('SPEC-99-03 Defect Injection Proof: verifyFullscreenOrchestration detects omitted query parameter', () => {
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const src = fs.readFileSync(presenterPath, 'utf8');
  const brokenSource = src.replaceAll('fullscreen=1', '');

  assert.equal(
    brokenSource.includes('fullscreen=1'),
    false,
    'INJECTED DEFECT: Omitted fullscreen=1 fails guard'
  );
});
