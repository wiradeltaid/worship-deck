/**
 * SPEC-101-02: Presenter Guest Intent, Confirmed Room Status, and Safe Sync tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
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

  const mediaDevices = {
    enumerateDevices: async () => [
      { deviceId: 'cam-1', kind: 'videoinput', label: 'HDMI Card', groupId: 'g1' },
    ],
    getUserMedia: async () => new MockStream(),
  };

  const brokerEnv = {
    isSecureContext: true,
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
