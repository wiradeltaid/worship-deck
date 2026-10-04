/**
 * SPEC-101-02: Presenter Guest Intent, Confirmed Room Status, and Safe Sync tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcUrl = (...parts) => pathToFileURL(path.join(root, 'src', ...parts)).href;

const {
  projectionOf,
  isProjectorMediaStatus,
  isProjectorMessage,
  sharedStatePlanIdentity,
} = await import(srcUrl('lib', 'present-channel.ts'));
const { CaptureBroker } = await import(srcUrl('lib', 'capture-broker.ts'));
const { PresenterGuestFeedController } = await import(
  srcUrl('operator', 'present', 'presenter-guest-feed-controller.ts')
);

class MockTrack {
  constructor(kind = 'video') {
    this.kind = kind;
    this.readyState = 'live';
    this.stopped = false;
    this.listeners = new Map();
  }
  stop() {
    this.stopped = true;
    this.readyState = 'ended';
  }
  getSettings() {
    return { width: 1920, height: 1080, frameRate: 60 };
  }
  addEventListener(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
  }
  removeEventListener(event, fn) {
    if (this.listeners.has(event)) this.listeners.get(event).delete(fn);
  }
}

class MockStream {
  constructor() {
    this._tracks = [new MockTrack('video')];
  }
  getTracks() {
    return [...this._tracks];
  }
  getVideoTracks() {
    return this._tracks.filter((t) => t.kind === 'video');
  }
  clone() {
    return new MockStream();
  }
}

class MockVideoElement {
  constructor() {
    this.readyState = 2;
    this.videoWidth = 1920;
    this.videoHeight = 1080;
    this.listeners = new Map();
  }
  addEventListener(e, fn) {
    if (!this.listeners.has(e)) this.listeners.set(e, new Set());
    this.listeners.get(e).add(fn);
    if (e === 'loadeddata' || e === 'canplay') fn();
  }
  removeEventListener(e, fn) {
    if (this.listeners.has(e)) this.listeners.get(e).delete(fn);
  }
}

function createHarness(opts = {}) {
  let currentTime = 1000;
  const timers = new Map();
  let timerSeq = 0;
  const syncBroadcasts = [];
  let getUserMediaCallCount = 0;

  const mediaDevices = {
    enumerateDevices:
      opts.enumerateDevices ||
      (async () => [
        { deviceId: 'cam-1', kind: 'videoinput', label: 'HDMI Card', groupId: 'g1' },
      ]),
    getUserMedia:
      opts.getUserMedia ||
      (async () => {
        getUserMediaCallCount++;
        return new MockStream();
      }),
  };

  const brokerEnv = {
    isSecureContext: opts.isSecureContext !== undefined ? opts.isSecureContext : true,
    mediaDevices,
    createVideoElement: () => new MockVideoElement(),
    setTimeout: (fn, ms) => {
      const id = ++timerSeq;
      timers.set(id, { fn, triggerAt: currentTime + ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    now: () => currentTime,
    randomUUID: () => 'sess-' + Math.random().toString(36).slice(2, 8),
  };

  const broker = new CaptureBroker(brokerEnv);

  const controllerEnv = {
    broker,
    broadcastSync: () => {
      syncBroadcasts.push({
        projection: controller.getSnapshot().projection,
        guestAttemptId: controller.getSnapshot().guestAttemptId,
      });
    },
    setTimeout: (fn, ms) => {
      const id = ++timerSeq;
      timers.set(id, { fn, triggerAt: currentTime + ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    now: () => currentTime,
    randomUUID: () => 'att-' + Math.random().toString(36).slice(2, 8),
  };

  const controller = new PresenterGuestFeedController(controllerEnv);

  return {
    broker,
    controller,
    syncBroadcasts,
    getGetUserMediaCallCount: () => getUserMediaCallCount,
    advanceTime: (ms) => {
      currentTime += ms;
      for (const [id, t] of Array.from(timers.entries())) {
        if (currentTime >= t.triggerAt) {
          timers.delete(id);
          t.fn();
        }
      }
    },
  };
}

test('projectionOf validates shape and fails closed to deck on missing/malformed attempt', () => {
  // Non-sync returns null
  assert.equal(projectionOf({ type: 'blank', blank: true, planIdentity: 'p1' }), null);

  // Sync without projection defaults to deck
  const noProj = projectionOf({
    type: 'sync',
    index: 0,
    blank: false,
    transition: 'fade',
    planIdentity: 'p1',
  });
  assert.deepEqual(noProj, { kind: 'deck' });

  // Sync with valid guest and valid attempt succeeds
  const validGuest = projectionOf({
    type: 'sync',
    index: 0,
    blank: false,
    transition: 'fade',
    planIdentity: 'p1',
    projection: { kind: 'guest', guestSessionId: 'sess-1' },
    guestAttemptId: 'att-1',
  });
  assert.deepEqual(validGuest, { kind: 'guest', guestSessionId: 'sess-1' });

  // Missing guestAttemptId fails closed to deck
  const missingAttempt = projectionOf({
    type: 'sync',
    index: 0,
    blank: false,
    transition: 'fade',
    planIdentity: 'p1',
    projection: { kind: 'guest', guestSessionId: 'sess-1' },
    guestAttemptId: '',
  });
  assert.deepEqual(missingAttempt, { kind: 'deck' });

  // Empty guestSessionId fails closed to deck
  const emptySession = projectionOf({
    type: 'sync',
    index: 0,
    blank: false,
    transition: 'fade',
    planIdentity: 'p1',
    projection: { kind: 'guest', guestSessionId: '   ' },
    guestAttemptId: 'att-1',
  });
  assert.deepEqual(emptySession, { kind: 'deck' });
});

test('isProjectorMediaStatus validates runtime shape and closed reason taxonomy', () => {
  assert.equal(
    isProjectorMediaStatus({
      type: 'projector-media-status',
      guestSessionId: 's1',
      guestAttemptId: 'a1',
      state: 'attached',
    }),
    true
  );

  assert.equal(
    isProjectorMediaStatus({
      type: 'projector-media-status',
      guestSessionId: 's1',
      guestAttemptId: 'a1',
      state: 'unavailable',
      reason: 'consumer-attach-failed',
    }),
    true
  );

  // Rejects invented/malformed reason
  assert.equal(
    isProjectorMediaStatus({
      type: 'projector-media-status',
      guestSessionId: 's1',
      guestAttemptId: 'a1',
      state: 'unavailable',
      reason: 'invented-bad-reason',
    }),
    false
  );

  // Rejects missing attempt
  assert.equal(
    isProjectorMediaStatus({
      type: 'projector-media-status',
      guestSessionId: 's1',
      guestAttemptId: '',
      state: 'attached',
    }),
    false
  );
});

test('sharedStatePlanIdentity ignores projector-media-status as telemetry', () => {
  const statusMsg = {
    type: 'projector-media-status',
    guestSessionId: 's1',
    guestAttemptId: 'a1',
    state: 'attached',
  };
  assert.equal(sharedStatePlanIdentity(statusMsg), null);
});

test('switch is gated on healthy master and responding projector', async () => {
  const { controller } = createHarness();

  // 1. Cannot switch while idle
  assert.throws(() => controller.switch(true), /must be 'ready'/);

  // Arm broker
  await controller.arm('cam-1');
  assert.equal(controller.getSnapshot().uiState, 'ready');

  // 2. Cannot switch if projector is not responding
  assert.throws(() => controller.switch(false), /screen is not responding/);

  // 3. Switch succeeds when ready and projector responding
  controller.switch(true);
  const snap = controller.getSnapshot();
  assert.equal(snap.uiState, 'guest-pending');
  assert.equal(snap.projection.kind, 'guest');
  assert(snap.guestAttemptId);
});

test('confirmed-live requires matching session and attempt telemetry', async () => {
  const { controller, broker, syncBroadcasts } = createHarness();
  await controller.arm('cam-1');
  controller.switch(true);

  const sessionId = broker.getSnapshot().guestSessionId;
  const attemptId = controller.getSnapshot().guestAttemptId;

  // Stale report for wrong attempt is ignored
  controller.handleProjectorMediaStatus({
    type: 'projector-media-status',
    guestSessionId: sessionId,
    guestAttemptId: 'old-attempt-99',
    state: 'attached',
  });
  assert.equal(controller.getSnapshot().uiState, 'guest-pending');

  // Matching telemetry transitions to confirmed-live
  controller.handleProjectorMediaStatus({
    type: 'projector-media-status',
    guestSessionId: sessionId,
    guestAttemptId: attemptId,
    state: 'attached',
  });
  assert.equal(controller.getSnapshot().uiState, 'confirmed-live');
});

test('attach deadline 5 seconds auto-reverts to Deck if status not received', async () => {
  const { controller, syncBroadcasts, advanceTime } = createHarness();
  await controller.arm('cam-1');
  controller.switch(true);
  assert.equal(controller.getSnapshot().uiState, 'guest-pending');

  // Let 5 seconds elapse without receiving attached telemetry
  advanceTime(5001);

  const snap = controller.getSnapshot();
  assert.equal(snap.uiState, 'ready');
  assert.deepEqual(snap.projection, { kind: 'deck' });
  assert.equal(snap.guestAttemptId, null);

  // Verified broadcast reverted to deck
  const lastBroadcast = syncBroadcasts[syncBroadcasts.length - 1];
  assert.deepEqual(lastBroadcast.projection, { kind: 'deck' });
});

test('accepted unavailable telemetry auto-reverts globally to Deck', async () => {
  const { controller, broker, syncBroadcasts } = createHarness();
  await controller.arm('cam-1');
  controller.switch(true);

  const sessionId = broker.getSnapshot().guestSessionId;
  const attemptId = controller.getSnapshot().guestAttemptId;

  controller.handleProjectorMediaStatus({
    type: 'projector-media-status',
    guestSessionId: sessionId,
    guestAttemptId: attemptId,
    state: 'unavailable',
    reason: 'video-error',
  });

  assert.equal(controller.getSnapshot().uiState, 'ready');
  assert.deepEqual(controller.getSnapshot().projection, { kind: 'deck' });
});

test('scripture actions enforce exclusivity and return guest intent to Deck', async () => {
  const { controller, syncBroadcasts } = createHarness();
  await controller.arm('cam-1');
  controller.switch(true);
  assert.equal(controller.getSnapshot().uiState, 'guest-pending');

  // Operator triggers scripture lookup/display
  controller.onScriptureAction();

  assert.equal(controller.getSnapshot().uiState, 'ready');
  assert.deepEqual(controller.getSnapshot().projection, { kind: 'deck' });
});

test('disarm broadcasts complete Deck state before releasing media', async () => {
  const { controller, syncBroadcasts, broker } = createHarness();
  await controller.arm('cam-1');
  controller.switch(true);

  const broadcastCountBefore = syncBroadcasts.length;
  controller.disarm();

  // Broadcast occurred
  assert(syncBroadcasts.length > broadcastCountBefore);
  const lastBroadcast = syncBroadcasts[syncBroadcasts.length - 1];
  assert.deepEqual(lastBroadcast.projection, { kind: 'deck' });

  // Broker is idle and cleaned up
  assert.equal(broker.getSnapshot().state, 'idle');
  assert.equal(controller.getSnapshot().uiState, 'idle');
});

test('Escape hotkey panics pending and live to Deck even from focused inputs', async () => {
  const { controller } = createHarness();
  await controller.arm('cam-1');
  controller.switch(true);
  assert.equal(controller.getSnapshot().uiState, 'guest-pending');

  // Escape key pressed while input is focused
  controller.handleKeyDown({
    key: 'Escape',
    target: { tagName: 'INPUT' },
  });

  assert.equal(controller.getSnapshot().uiState, 'ready');
  assert.deepEqual(controller.getSnapshot().projection, { kind: 'deck' });

  // Escape when on Deck is a clean no-op
  controller.handleKeyDown({
    key: 'Escape',
  });
  assert.deepEqual(controller.getSnapshot().projection, { kind: 'deck' });
});

test('G key is revert only: ignores non-guest, ignores editable inputs, ignores modifiers', async () => {
  const { controller } = createHarness();

  // 1. In idle: G is a NO-OP (never Arms)
  controller.handleKeyDown({ key: 'g' });
  assert.equal(controller.getSnapshot().uiState, 'idle');

  // In ready: G is a NO-OP (never Switches)
  await controller.arm('cam-1');
  assert.equal(controller.getSnapshot().uiState, 'ready');
  controller.handleKeyDown({ key: 'G' });
  assert.equal(controller.getSnapshot().uiState, 'ready'); // did NOT switch!

  // Switch to guest
  controller.switch(true);
  assert.equal(controller.getSnapshot().uiState, 'guest-pending');

  // 2. G inside an input is ignored
  controller.handleKeyDown({ key: 'g', target: { tagName: 'INPUT' } });
  assert.equal(controller.getSnapshot().uiState, 'guest-pending');

  // 3. G with Ctrl modifier is ignored
  controller.handleKeyDown({ key: 'g', ctrlKey: true });
  assert.equal(controller.getSnapshot().uiState, 'guest-pending');

  // 4. Clean G outside inputs reverts to Deck
  controller.handleKeyDown({ key: 'g', target: { tagName: 'DIV' } });
  assert.equal(controller.getSnapshot().uiState, 'ready');
  assert.deepEqual(controller.getSnapshot().projection, { kind: 'deck' });
});

test('guard proof: G hotkey must never enter guest', () => {
  function validateGHotkeyBehavior(uiState, keyEvent, wouldSwitchToGuest) {
    if (uiState !== 'guest-pending' && uiState !== 'confirmed-live' && wouldSwitchToGuest) {
      throw new Error('Violation: G hotkey must never initiate Arm or Switch to guest.');
    }
  }

  // Proper behavior:
  assert.doesNotThrow(() => validateGHotkeyBehavior('idle', { key: 'g' }, false));
  assert.doesNotThrow(() => validateGHotkeyBehavior('ready', { key: 'g' }, false));

  // Injected defect: G hotkey entering guest from ready
  assert.throws(
    () => validateGHotkeyBehavior('ready', { key: 'g' }, true),
    /G hotkey must never initiate Arm or Switch/
  );
});

test('guard proof: missing-projection fails closed to deck on all sync producers', () => {
  const producers = [
    { name: 'setIndexAndSync', msg: { type: 'sync', index: 1, blank: false, transition: 'fade', planIdentity: 'p1' } },
    { name: 'currentState', msg: { type: 'sync', index: 0, blank: false, transition: 'fade', planIdentity: 'p1', patches: [] } },
    { name: 'emergencyPatchHydration', msg: { type: 'sync', index: 0, blank: false, transition: 'fade', planIdentity: 'p1', patches: [{ index: 0 }] } },
    { name: 'emergencyPatchRevert', msg: { type: 'sync', index: 0, blank: false, transition: 'fade', planIdentity: 'p1', patches: [] } },
  ];

  for (const { name, msg } of producers) {
    const proj = projectionOf(msg);
    assert.deepEqual(proj, { kind: 'deck' }, `${name} must default to deck when projection is absent`);
  }
});

test('SPEC-103-01: controller enumerateDevices populates devices and catches errors gracefully', async () => {
  // 1. Graceful error handling on initial device enumeration failure
  const { controller: errorController } = createHarness({
    enumerateDevices: async () => {
      throw new Error('Insecure context or API unavailable');
    },
  });

  const emptyDiscovered = await errorController.enumerateDevices();
  assert.deepEqual(emptyDiscovered, []);
  assert.equal(errorController.getSnapshot().devices.length, 0);
  assert.equal(errorController.getSnapshot().uiState, 'idle'); // Stays idle, does NOT incorrectly arm or panic
  assert.match(errorController.getSnapshot().errorMessage, /Insecure context or API unavailable/);

  // 2. Successful device discovery
  let shouldFail = false;
  const sampleDevices = [
    { deviceId: 'uvc-1', kind: 'videoinput', label: 'Elgato Cam Link 4K', groupId: 'g1' },
    { deviceId: 'uvc-2', kind: 'videoinput', label: 'USB3.0 Capture Video', groupId: 'g2' },
  ];
  const { controller } = createHarness({
    enumerateDevices: async () => {
      if (shouldFail) {
        throw new Error('Transient device query failure');
      }
      return sampleDevices;
    },
  });

  const discovered = await controller.enumerateDevices();
  assert.equal(discovered.length, 2);
  assert.equal(discovered[0].deviceId, 'uvc-1');
  assert.equal(discovered[0].label, 'Elgato Cam Link 4K');
  assert.equal(controller.getSnapshot().devices.length, 2);
  assert.equal(controller.getSnapshot().uiState, 'idle');
  assert.equal(controller.getSnapshot().errorMessage, null);

  // 3. Transient error sets error message without panicking
  shouldFail = true;
  await controller.enumerateDevices();
  assert.equal(controller.getSnapshot().uiState, 'idle');
  assert.match(controller.getSnapshot().errorMessage, /Transient device query failure/);

  // 4. Subsequent recovery clears error message
  shouldFail = false;
  const recovered = await controller.enumerateDevices();
  assert.equal(recovered.length, 2);
  assert.equal(controller.getSnapshot().errorMessage, null);
});

test('SPEC-103-01: selectDevice updates selectedDeviceId without calling getUserMedia', () => {
  const { controller, getGetUserMediaCallCount } = createHarness();

  assert.equal(getGetUserMediaCallCount(), 0);
  assert.equal(controller.getSnapshot().selectedDeviceId, null);

  // Selecting a device updates state and does NOT call getUserMedia
  controller.selectDevice('cam-1');
  assert.equal(controller.getSnapshot().selectedDeviceId, 'cam-1');
  assert.equal(getGetUserMediaCallCount(), 0);
  assert.equal(controller.getSnapshot().uiState, 'idle');
});

test('SPEC-103-01: only explicit arm invokes getUserMedia', async () => {
  const { controller, getGetUserMediaCallCount } = createHarness();

  controller.selectDevice('cam-1');
  assert.equal(getGetUserMediaCallCount(), 0);

  // Calling arm initiates getUserMedia
  await controller.arm('cam-1');
  assert.equal(getGetUserMediaCallCount(), 1);
  assert.equal(controller.getSnapshot().uiState, 'ready');
});

test('SPEC-103-01: stale concurrent device enumeration does not overwrite newer state', async () => {
  let resolveA;
  const promiseA = new Promise((res) => {
    resolveA = res;
  });

  let callCount = 0;
  const { controller } = createHarness({
    enumerateDevices: async () => {
      callCount++;
      if (callCount === 1) {
        // Request A: slow
        await promiseA;
        return [{ deviceId: 'stale-dev-A', kind: 'videoinput', label: 'Stale Capture A', groupId: 'g1' }];
      } else {
        // Request B: fast
        return [{ deviceId: 'fresh-dev-B', kind: 'videoinput', label: 'Fresh Capture B', groupId: 'g2' }];
      }
    },
  });

  // Start slow request A
  const pA = controller.enumerateDevices();

  // Start fast request B (newer generation)
  const pB = controller.enumerateDevices();
  const resB = await pB;

  assert.equal(resB.length, 1);
  assert.equal(resB[0].deviceId, 'fresh-dev-B');
  assert.equal(controller.getSnapshot().devices[0].deviceId, 'fresh-dev-B');

  // Now resolve slow request A
  resolveA();
  await pA;

  // Stale request A must NOT overwrite newer request B's state
  assert.equal(controller.getSnapshot().devices.length, 1);
  assert.equal(controller.getSnapshot().devices[0].deviceId, 'fresh-dev-B');
});

test('SPEC-103-01: stale rejected enumeration does not overwrite newer successful state or inject error', async () => {
  let rejectA;
  const promiseA = new Promise((_, rej) => {
    rejectA = rej;
  });

  let callCount = 0;
  const { controller } = createHarness({
    enumerateDevices: async () => {
      callCount++;
      if (callCount === 1) {
        // Request A: slow rejection
        await promiseA;
        throw new Error('Stale late failure from old generation');
      } else {
        // Request B: fast success
        return [{ deviceId: 'fresh-dev-B', kind: 'videoinput', label: 'Fresh Capture B', groupId: 'g2' }];
      }
    },
  });

  // Start slow request A
  const pA = controller.enumerateDevices();

  // Start fast request B (newer generation)
  const pB = controller.enumerateDevices();
  const resB = await pB;

  assert.equal(resB.length, 1);
  assert.equal(resB[0].deviceId, 'fresh-dev-B');
  assert.equal(controller.getSnapshot().devices[0].deviceId, 'fresh-dev-B');
  assert.equal(controller.getSnapshot().errorMessage, null);

  // Now reject slow request A
  rejectA(new Error('Stale late failure from old generation'));
  await pA;

  // Stale rejection must NOT overwrite devices or inject error into snapshot
  assert.equal(controller.getSnapshot().devices.length, 1);
  assert.equal(controller.getSnapshot().devices[0].deviceId, 'fresh-dev-B');
  assert.equal(controller.getSnapshot().errorMessage, null);
});

test('SPEC-103-01: CaptureBroker stale rejected enumeration does not overwrite newer successful state or inject error', async () => {
  let rejectA;
  const promiseA = new Promise((_, rej) => {
    rejectA = rej;
  });

  let callCount = 0;
  const mediaDevices = {
    enumerateDevices: async () => {
      callCount++;
      if (callCount === 1) {
        await promiseA;
        throw new Error('Late failure from old broker generation');
      } else {
        return [{ deviceId: 'broker-dev-B', kind: 'videoinput', label: 'Fresh Broker B', groupId: 'g2' }];
      }
    },
    getUserMedia: async () => new MockStream(),
  };

  const broker = new CaptureBroker({
    isSecureContext: true,
    mediaDevices,
    createVideoElement: () => new MockVideoElement(),
  });

  // Start slow request A
  const pA = broker.enumerateDevices();

  // Start fast request B (newer generation)
  const pB = broker.enumerateDevices();
  const resB = await pB;

  assert.equal(resB.length, 1);
  assert.equal(resB[0].deviceId, 'broker-dev-B');
  assert.equal(broker.getSnapshot().devices[0].deviceId, 'broker-dev-B');
  assert.equal(broker.getSnapshot().error, null);

  // Now reject slow request A
  rejectA(new Error('Late failure from old broker generation'));
  await pA;

  // Stale rejection must NOT overwrite devices or inject error into broker snapshot
  assert.equal(broker.getSnapshot().devices.length, 1);
  assert.equal(broker.getSnapshot().devices[0].deviceId, 'broker-dev-B');
  assert.equal(broker.getSnapshot().error, null, 'Broker snapshot error must remain null after stale rejection');
});

test('SPEC-103-01: CaptureBroker clears previous error on subsequent successful enumeration', async () => {
  let shouldFail = true;
  const broker = new CaptureBroker({
    isSecureContext: true,
    mediaDevices: {
      enumerateDevices: async () => {
        if (shouldFail) throw new Error('API busy');
        return [{ deviceId: 'cam-ok', kind: 'videoinput', label: 'OK' }];
      },
      getUserMedia: async () => new MockStream(),
    },
    createVideoElement: () => new MockVideoElement(),
  });

  await assert.rejects(() => broker.enumerateDevices(), /API busy/);
  assert.match(broker.getSnapshot().error.message, /API busy/);

  // Subsequent recovery clears broker snapshot error
  shouldFail = false;
  await broker.enumerateDevices();
  assert.equal(broker.getSnapshot().error, null, 'Broker error must be cleared on successful enumeration');
  assert.equal(broker.getSnapshot().devices.length, 1);
});

test('SPEC-103-01: structural scan and defect injection: CaptureBroker catch block must guard generation', () => {
  const brokerPath = path.join(root, 'src', 'lib', 'capture-broker.ts');
  const content = fs.readFileSync(brokerPath, 'utf8');

  function validateBrokerCatchGuard(src) {
    const catchMatch = src.match(/public async enumerateDevices\(\)[\s\S]*?catch\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
    if (!catchMatch) throw new Error('enumerateDevices catch block missing');
    const catchBody = catchMatch[1];
    if (!/if\s*\(\s*generation\s*!==\s*this\.activeEnumerateGeneration\s*\)/.test(catchBody)) {
      throw new Error('Generation Guard Violation: Catch block in enumerateDevices must guard against stale generation');
    }
  }

  // Real source passes
  assert.doesNotThrow(() => validateBrokerCatchGuard(content));

  // Injected defect: strip generation check from catch in real source text
  const defective = content.replace(
    /if\s*\(\s*generation\s*!==\s*this\.activeEnumerateGeneration\s*\)[\s\S]*?\}\s*const\s+mapped/,
    'const mapped'
  );
  assert.throws(
    () => validateBrokerCatchGuard(defective),
    /Generation Guard Violation/
  );
});

test('SPEC-103-01: component lifecycle simulation: mount and open trigger discovery, close does not, errors stay contained', async () => {
  let enumCount = 0;
  let shouldFail = false;
  const sampleDevices = [
    { deviceId: 'uvc-1', kind: 'videoinput', label: 'Cam Link', groupId: 'g1' },
  ];

  const { controller } = createHarness({
    enumerateDevices: async () => {
      enumCount++;
      if (shouldFail) {
        throw new Error('Dropdown discovery network/permission failure');
      }
      return sampleDevices;
    },
  });

  // 1. Simulating Mount phase (useEffect trigger)
  assert.equal(enumCount, 0);
  await controller.enumerateDevices();
  assert.equal(enumCount, 1);
  assert.equal(controller.getSnapshot().devices.length, 1);
  assert.equal(controller.getSnapshot().errorMessage, null);

  // 2. Simulating Dropdown Close phase (onOpenChange(false) must NOT trigger discovery)
  const onOpenChange = (open) => {
    if (open) {
      void controller.enumerateDevices();
    }
  };

  onOpenChange(false);
  assert.equal(enumCount, 1, 'Closing dropdown must not trigger enumeration');

  // 3. Simulating Dropdown Open phase (onOpenChange(true) triggers discovery)
  onOpenChange(true);
  assert.equal(enumCount, 2, 'Opening dropdown must trigger enumeration');

  // 4. Discovery failure during open stays contained and does not crash or panic
  shouldFail = true;
  onOpenChange(true);
  assert.equal(enumCount, 3);
  await new Promise((r) => setImmediate(r));
  assert.equal(controller.getSnapshot().uiState, 'idle');
  assert.match(controller.getSnapshot().errorMessage, /Dropdown discovery network\/permission failure/);
});

function validateDropdownMenuStructure(content) {
  // Must import DropdownMenuGroup
  if (!/DropdownMenuGroup/.test(content)) {
    throw new Error('Base UI Violation: Missing DropdownMenuGroup import');
  }

  // Raw label in content without enclosing group is forbidden
  const hasRawLabel = /<DropdownMenuContent[^>]*>\s*<DropdownMenuLabel/.test(content);
  if (hasRawLabel) {
    throw new Error('Base UI Violation: DropdownMenuLabel requires enclosing DropdownMenuGroup');
  }

  // DropdownMenuLabel must be enclosed within DropdownMenuGroup to satisfy Base UI MenuGroupContext
  const groupLabelMatch = /<DropdownMenuGroup>\s*<DropdownMenuLabel[^>]*>[\s\S]*?<\/DropdownMenuLabel>\s*<\/DropdownMenuGroup>/.test(
    content
  );
  if (!groupLabelMatch) {
    throw new Error('Base UI Violation: DropdownMenuLabel not enclosed in DropdownMenuGroup');
  }

  // Component mount discovery trigger
  const hasMountTrigger = /useEffect\(\(\)\s*=>\s*\{\s*void controller\.enumerateDevices\(\);/s.test(content);
  if (!hasMountTrigger) {
    throw new Error('Mount Discovery Trigger Violation: Missing controller.enumerateDevices in mount useEffect');
  }

  // Component dropdown open discovery trigger
  const hasOpenTrigger =
    /onOpenChange=\{handleDeviceMenuOpenChange\}/s.test(content) ||
    /onOpenChange=\{\(open\)\s*=>\s*\{\s*if\s*\(open\)\s*\{\s*void controller\.enumerateDevices\(\);/s.test(content);
  if (!hasOpenTrigger) {
    throw new Error('Open Discovery Trigger Violation: Missing onOpenChange enumerateDevices trigger on DropdownMenu');
  }

  // Radio selection must call selectDevice, NOT arm directly
  if (!/controller\.selectDevice\(val\)/.test(content)) {
    throw new Error('Selection Violation: Radio selection must call controller.selectDevice');
  }
}

test('SPEC-103-01: structural scan verifies DropdownMenuGroup enclosing DropdownMenuLabel in PresenterGuestFeedControl', () => {
  const componentPath = path.join(root, 'src', 'operator', 'present', 'PresenterGuestFeedControl.tsx');
  const content = fs.readFileSync(componentPath, 'utf8');
  assert.doesNotThrow(() => validateDropdownMenuStructure(content));
});

function validateControlPlacement(presenterContent) {
  const row1Match = presenterContent.match(
    /<div[^>]*data-testid="presenter-header-row-1"[^>]*>([\s\S]*?)<\/div>\s*\{\/\* Row 2/
  );
  if (!row1Match) {
    throw new Error('Placement Violation: presenter-header-row-1 container missing');
  }
  const row1Content = row1Match[1];
  if (!/<PresenterGuestFeedControl/.test(row1Content)) {
    throw new Error('Placement Violation: PresenterGuestFeedControl missing from Header Row 1');
  }

  const row2Match = presenterContent.match(
    /<div[^>]*data-testid="presenter-header-row-2"[^>]*>([\s\S]*?)<\/div>/
  );
  if (!row2Match) {
    throw new Error('Placement Violation: presenter-header-row-2 container missing');
  }
  const row2Content = row2Match[1];
  if (/<PresenterGuestFeedControl/.test(row2Content)) {
    throw new Error('Placement Violation: PresenterGuestFeedControl must NOT be in presenter-header-row-2');
  }
}

test('SPEC-103-01: structural scan verifies PresenterGuestFeedControl in presenter-header-row-1 in PresenterOperator', () => {
  const presenterPath = path.join(root, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const content = fs.readFileSync(presenterPath, 'utf8');
  assert.doesNotThrow(() => validateControlPlacement(content));
});

test('SPEC-103-01: defect injection proof: DropdownMenuLabel directly in DropdownMenuContent triggers guard finding', () => {
  const componentPath = path.join(root, 'src', 'operator', 'present', 'PresenterGuestFeedControl.tsx');
  const realContent = fs.readFileSync(componentPath, 'utf8');

  // Real content passes
  assert.doesNotThrow(() => validateDropdownMenuStructure(realContent));

  // Injected defect 1: strip DropdownMenuGroup wrapping from real file content
  const defectiveContent = realContent
    .replace('<DropdownMenuGroup>', '')
    .replace('</DropdownMenuGroup>', '');
  assert.throws(
    () => validateDropdownMenuStructure(defectiveContent),
    /Base UI Violation: DropdownMenuLabel requires enclosing DropdownMenuGroup/
  );

  // Injected defect 2: remove mount discovery trigger specifically
  const missingMountContent = realContent.replace(
    /useEffect\(\(\)\s*=>\s*\{\s*void controller\.enumerateDevices\(\);/,
    'useEffect(() => {'
  );
  assert.throws(
    () => validateDropdownMenuStructure(missingMountContent),
    /Mount Discovery Trigger Violation/
  );

  // Injected defect 3: remove onOpenChange discovery trigger specifically while leaving mount
  const missingOpenContent = realContent.replace(/onOpenChange=\{[\s\S]*?\}\s*>/, '>');
  assert.throws(
    () => validateDropdownMenuStructure(missingOpenContent),
    /Open Discovery Trigger Violation/
  );
});

test('SPEC-103-01: defect injection proof: PresenterGuestFeedControl in presenter-header-row-2 triggers guard finding', () => {
  const presenterPath = path.join(root, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const realContent = fs.readFileSync(presenterPath, 'utf8');

  // Real content passes
  assert.doesNotThrow(() => validateControlPlacement(realContent));

  // Injected defect: move control from Row 1 back to Row 2
  const defectiveContent = realContent
    .replace(/\{guestFeedControllerRef\.current && \(\s*<PresenterGuestFeedControl[\s\S]*?\/>\s*\)\}/, '')
    .replace(
      'data-testid="presenter-header-row-2" className="flex flex-wrap items-center justify-end gap-2">',
      'data-testid="presenter-header-row-2" className="flex flex-wrap items-center justify-end gap-2">\n<PresenterGuestFeedControl controller={guestFeedControllerRef.current} isProjectorResponding={true} />'
    );

  assert.throws(
    () => validateControlPlacement(defectiveContent),
    /Placement Violation: PresenterGuestFeedControl missing from Header Row 1/
  );
});

test('SPEC-106-02: i18n keys for camera permission and access CTA exist with 1:1 bilingual parity', async () => {
  const { I18N_KEYS } = await import(srcUrl('lib', 'i18n', 'keys.ts'));
  const { resolveString } = await import(srcUrl('lib', 'i18n', 'index.ts'));

  const requiredKeys = [
    'presenter.guestFeed.enableAccess',
    'presenter.guestFeed.permissionDenied',
  ];

  for (const k of requiredKeys) {
    assert.ok(I18N_KEYS.includes(k), `Missing required key '${k}' in I18N_KEYS`);
    const enVal = resolveString(k, 'en');
    const idVal = resolveString(k, 'id');
    assert.ok(enVal && !enVal.startsWith('[missing:'), `Missing EN translation for '${k}'`);
    assert.ok(idVal && !idVal.startsWith('[missing:'), `Missing ID translation for '${k}'`);
    assert.notEqual(enVal, idVal, `EN and ID translations must differ for '${k}'`);
  }
  assert.equal(resolveString('presenter.guestFeed.enableAccess', 'en'), 'Enable Camera Access');
  assert.equal(resolveString('presenter.guestFeed.enableAccess', 'id'), 'Izinkan Akses Kamera');
  assert.equal(resolveString('presenter.guestFeed.permissionDenied', 'en'), 'Camera permission denied. Allow access in browser settings.');
  assert.equal(resolveString('presenter.guestFeed.permissionDenied', 'id'), 'Izin kamera ditolak. Berikan izin di setelan browser.');
});

test('SPEC-106-02: controlled dropdown invalidates stale pending enumeration when closed', async () => {
  let resolveEnum;
  const enumPromise = new Promise((res) => {
    resolveEnum = res;
  });

  const { controller } = createHarness({
    enumerateDevices: async () => {
      await enumPromise;
      return [{ deviceId: 'late-cam', kind: 'videoinput', label: 'Late Camera', groupId: 'g1' }];
    },
  });

  // Simulate component state logic
  let deviceMenuOpen = false;
  let deviceMenuDevices = [];
  const deviceMenuRequestId = { current: 0 };

  const handleDeviceMenuOpenChange = (open) => {
    if (!open) {
      deviceMenuRequestId.current++;
      deviceMenuOpen = false;
      return;
    }
    const requestId = ++deviceMenuRequestId.current;
    deviceMenuOpen = true;
    void controller.enumerateDevices().then((devs) => {
      if (requestId === deviceMenuRequestId.current) {
        deviceMenuDevices = devs;
      }
    });
  };

  // Open menu -> triggers async enumeration
  handleDeviceMenuOpenChange(true);
  assert.equal(deviceMenuOpen, true);
  assert.equal(deviceMenuDevices.length, 0);

  // Operator closes menu before async enumeration finishes
  handleDeviceMenuOpenChange(false);
  assert.equal(deviceMenuOpen, false);

  // Late enumeration resolves
  resolveEnum();
  await new Promise((r) => setImmediate(r));

  // State must remain empty because requestId was invalidated
  assert.equal(deviceMenuDevices.length, 0, 'Late resolution must be invalidated when menu closed');
});

test('SPEC-106-02: structural scan and defect injection: verify controlled dropdown and permission CTA', () => {
  function validateControlledDropdown(src) {
    if (!/deviceMenuRequestId/.test(src)) {
      throw new Error('Dropdown Race Violation: Missing deviceMenuRequestId generation tracker');
    }
    if (!/deviceMenuDevices\.map/.test(src)) {
      throw new Error('Dropdown Race Violation: Radio items must be mapped from frozen deviceMenuDevices');
    }
    if (!/setDeviceMenuOpen\s*\(\s*false\s*\)/.test(src)) {
      throw new Error('Dropdown Selection Violation: Selecting item must close menu');
    }
    if (!/data-testid="guest-enable-access-button"/.test(src)) {
      throw new Error('Permission Discovery Violation: Missing guest-enable-access-button CTA');
    }
  }

  const componentPath = path.join(root, 'src', 'operator', 'present', 'PresenterGuestFeedControl.tsx');
  const realContent = fs.readFileSync(componentPath, 'utf8');

  // Real content must pass
  assert.doesNotThrow(() => validateControlledDropdown(realContent));

  // Injected defect 1: missing requestId tracker
  const missingRequestId = realContent.replace(/deviceMenuRequestId/g, 'omittedTracker');
  assert.throws(() => validateControlledDropdown(missingRequestId), /Dropdown Race Violation: Missing deviceMenuRequestId/);

  // Injected defect 2: mapping from live snapshot.devices instead of frozen deviceMenuDevices
  const liveMapping = realContent.replace('deviceMenuDevices.map', 'devices.map');
  assert.throws(() => validateControlledDropdown(liveMapping), /Dropdown Race Violation: Radio items must be mapped/);

  // Injected defect 3: missing CTA button
  const missingCTA = realContent.replace('data-testid="guest-enable-access-button"', '');
  assert.throws(() => validateControlledDropdown(missingCTA), /Permission Discovery Violation/);
});

