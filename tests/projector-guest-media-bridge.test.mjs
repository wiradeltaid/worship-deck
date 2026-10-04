/**
 * SPEC-101-03: Projector Guest Media Bridge, Fullscreen Rendering, and Fallback Telemetry tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcUrl = (...parts) => pathToFileURL(path.join(root, 'src', ...parts)).href;

const { ProjectorGuestMediaBridge } = await import(
  srcUrl('projected', 'projector-guest-media-bridge.ts')
);

class MockTrack {
  constructor(kind = 'video') {
    this.kind = kind;
    this.readyState = 'live';
    this.stopped = false;
  }
  stop() {
    this.stopped = true;
    this.readyState = 'ended';
  }
}

class MockStream {
  constructor(tracks = [new MockTrack()]) {
    this._tracks = tracks;
  }
  getTracks() {
    return [...this._tracks];
  }
  getVideoTracks() {
    return this._tracks.filter((t) => t.kind === 'video');
  }
}

class MockVideoElement {
  constructor() {
    this.muted = false;
    this.playsInline = false;
    this.srcObject = null;
    this.readyState = 0;
    this.videoWidth = 0;
    this.videoHeight = 0;
    this.listeners = new Map();
  }
  addEventListener(e, fn) {
    if (!this.listeners.has(e)) this.listeners.set(e, new Set());
    this.listeners.get(e).add(fn);
  }
  removeEventListener(e, fn) {
    if (this.listeners.has(e)) this.listeners.delete(e);
  }
  simulateReady(w = 1920, h = 1080) {
    this.readyState = 2;
    this.videoWidth = w;
    this.videoHeight = h;
    const handlers = this.listeners.get('loadeddata') || [];
    for (const h of handlers) h();
  }
  simulateError() {
    const handlers = this.listeners.get('error') || [];
    for (const h of handlers) h();
  }
  play() {
    return Promise.resolve();
  }
}

function createHarness(overrides = {}) {
  let currentTime = 1000;
  const timers = new Map();
  const intervals = new Map();
  let timerSeq = 0;
  const postedMessages = [];
  const videoElements = [];

  const defaultOpener = {
    closed: false,
    __worshipDeckAcquireProjectorConsumer: (sessId, attId) => {
      let released = false;
      const track = new MockTrack();
      const stream = new MockStream([track]);
      return {
        stream,
        release: () => {
          released = true;
          track.stop();
        },
      };
    },
  };

  const env = {
    getOpener: overrides.getOpener || (() => defaultOpener),
    postMessage: (msg) => {
      postedMessages.push(msg);
    },
    createVideoElement: () => {
      const v = new MockVideoElement();
      videoElements.push(v);
      if (overrides.autoReady !== false) {
        queueMicrotask(() => v.simulateReady());
      }
      return v;
    },
    setTimeout: (fn, ms) => {
      const id = ++timerSeq;
      timers.set(id, { fn, triggerAt: currentTime + ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    setInterval: (fn, ms) => {
      const id = ++timerSeq;
      intervals.set(id, { fn, interval: ms, lastRun: currentTime });
      return id;
    },
    clearInterval: (id) => intervals.delete(id),
    now: () => currentTime,
    ...overrides,
  };

  const bridge = new ProjectorGuestMediaBridge(env);

  return {
    bridge,
    env,
    postedMessages,
    videoElements,
    defaultOpener,
    advanceTime: (ms) => {
      currentTime += ms;
      for (const [id, t] of Array.from(timers.entries())) {
        if (currentTime >= t.triggerAt) {
          timers.delete(id);
          t.fn();
        }
      }
      for (const [id, intv] of Array.from(intervals.entries())) {
        if (currentTime >= intv.lastRun + intv.interval) {
          intv.lastRun = currentTime;
          intv.fn();
        }
      }
    },
  };
}

test('opener unavailable: reports opener-unavailable on missing, closed, or cross-origin opener', async () => {
  // 1. Missing opener
  const h1 = createHarness({ getOpener: () => null });
  await h1.bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');
  assert.equal(h1.postedMessages.length, 1);
  assert.deepEqual(h1.postedMessages[0], {
    type: 'projector-media-status',
    guestSessionId: 's1',
    guestAttemptId: 'a1',
    state: 'unavailable',
    reason: 'opener-unavailable',
  });

  // 2. Closed opener
  const h2 = createHarness({ getOpener: () => ({ closed: true }) });
  await h2.bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');
  assert.equal(h2.postedMessages[0].reason, 'opener-unavailable');

  // 3. Cross-origin throws
  const h3 = createHarness({
    getOpener: () => {
      throw new Error('Blocked a frame with origin "http://localhost" from accessing a cross-origin frame.');
    },
  });
  await h3.bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');
  assert.equal(h3.postedMessages[0].reason, 'opener-unavailable');
});

test('successful acquisition emits attached with current session and attempt', async () => {
  const h = createHarness();
  await h.bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');

  assert.equal(h.postedMessages.length, 1);
  assert.deepEqual(h.postedMessages[0], {
    type: 'projector-media-status',
    guestSessionId: 's1',
    guestAttemptId: 'a1',
    state: 'attached',
    reason: undefined,
  });
  assert(h.bridge.getActiveStream());
});

test('identical sync is idempotent: re-emits status without re-acquiring clone', async () => {
  const h = createHarness();
  let acquireCalls = 0;
  h.defaultOpener.__worshipDeckAcquireProjectorConsumer = (s, a) => {
    acquireCalls++;
    return { stream: new MockStream(), release: () => {} };
  };

  await h.bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');
  assert.equal(acquireCalls, 1);
  assert.equal(h.postedMessages.length, 1);

  // Send identical sync
  await h.bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');
  assert.equal(acquireCalls, 1); // did NOT call acquire again!
  assert.equal(h.postedMessages.length, 2);
  assert.equal(h.postedMessages[1].state, 'attached');
});

test('session or attempt change releases old media and acquires replacement', async () => {
  const h = createHarness();
  let releaseCalls = 0;
  h.defaultOpener.__worshipDeckAcquireProjectorConsumer = (s, a) => {
    return {
      stream: new MockStream(),
      release: () => {
        releaseCalls++;
      },
    };
  };

  await h.bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');
  assert.equal(releaseCalls, 0);

  // Switch attempt
  await h.bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a2');
  assert.equal(releaseCalls, 1); // previous release called!
  assert.equal(h.postedMessages[1].guestAttemptId, 'a2');
});

test('playback readiness timeout (3s) releases media and emits consumer-attach-failed', async () => {
  const h = createHarness({ autoReady: false });
  let releaseCalled = false;
  h.defaultOpener.__worshipDeckAcquireProjectorConsumer = (s, a) => {
    return {
      stream: new MockStream(),
      release: () => {
        releaseCalled = true;
      },
    };
  };

  const syncPromise = h.bridge.syncProjection(
    { kind: 'guest', guestSessionId: 's1' },
    'a1'
  );
  await new Promise((r) => setTimeout(r, 10));
  h.advanceTime(3001);

  await syncPromise;

  assert.equal(releaseCalled, true);
  assert.equal(h.bridge.getActiveStream(), null);
  assert.deepEqual(h.postedMessages[0], {
    type: 'projector-media-status',
    guestSessionId: 's1',
    guestAttemptId: 'a1',
    state: 'unavailable',
    reason: 'consumer-attach-failed',
  });
});

test('video playback error emits unavailable with video-error', async () => {
  const h = createHarness({ autoReady: false });
  const syncPromise = h.bridge.syncProjection(
    { kind: 'guest', guestSessionId: 's1' },
    'a1'
  );
  await new Promise((r) => setTimeout(r, 10));

  h.videoElements[0].simulateError();
  await syncPromise;

  assert.deepEqual(h.postedMessages[0], {
    type: 'projector-media-status',
    guestSessionId: 's1',
    guestAttemptId: 'a1',
    state: 'unavailable',
    reason: 'video-error',
  });
});

test('status re-emission timer periodically re-broadcasts status once per second', async () => {
  const h = createHarness();
  await h.bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');
  assert.equal(h.postedMessages.length, 1);

  // Advance 3 seconds
  h.advanceTime(1000);
  assert.equal(h.postedMessages.length, 2);
  h.advanceTime(1000);
  assert.equal(h.postedMessages.length, 3);
  h.advanceTime(1000);
  assert.equal(h.postedMessages.length, 4);

  for (const msg of h.postedMessages) {
    assert.equal(msg.state, 'attached');
    assert.equal(msg.guestAttemptId, 'a1');
  }
  h.bridge.teardown();
});

test('deck projection releases media and clears attempt', async () => {
  const h = createHarness();
  let releaseCalled = false;
  h.defaultOpener.__worshipDeckAcquireProjectorConsumer = () => ({
    stream: new MockStream(),
    release: () => {
      releaseCalled = true;
    },
  });

  await h.bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');
  assert(h.bridge.getActiveStream());

  // Return to Deck
  await h.bridge.syncProjection({ kind: 'deck' }, null);
  assert.equal(releaseCalled, true);
  assert.equal(h.bridge.getActiveStream(), null);
  assert.equal(h.bridge.getActiveSession().attemptId, null);
});

test('stalePlan releases media and reports consumer-attach-failed', async () => {
  const h = createHarness();
  let releaseCalled = false;
  h.defaultOpener.__worshipDeckAcquireProjectorConsumer = () => ({
    stream: new MockStream(),
    release: () => {
      releaseCalled = true;
    },
  });

  await h.bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');
  assert.equal(h.postedMessages[0].state, 'attached');

  h.bridge.handleStalePlan();

  assert.equal(releaseCalled, true);
  assert.equal(h.bridge.getActiveStream(), null);
  const lastMsg = h.postedMessages[h.postedMessages.length - 1];
  assert.deepEqual(lastMsg, {
    type: 'projector-media-status',
    guestSessionId: 's1',
    guestAttemptId: 'a1',
    state: 'unavailable',
    reason: 'consumer-attach-failed',
  });
});
