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

<<<<<<< Updated upstream
test('SPEC-107-02: ProjectorGuestMediaBridge preserves native receiver binding for setTimeout, clearTimeout, setInterval, and clearInterval without Illegal invocation', async () => {
  const fakeWindow = { isFakeWindow: true };
  let setTimeoutReceiver = null;
  let clearTimeoutReceiver = null;
  let setIntervalReceiver = null;
  let clearIntervalReceiver = null;

  const strictSetTimeout = function(fn, ms) {
    setTimeoutReceiver = this;
    if (this !== fakeWindow) {
      throw new TypeError("Failed to execute 'setTimeout' on 'Window': Illegal invocation");
    }
    return 101;
  };

  const strictClearTimeout = function(id) {
    clearTimeoutReceiver = this;
    if (this !== fakeWindow) {
      throw new TypeError("Failed to execute 'clearTimeout' on 'Window': Illegal invocation");
    }
  };

  const strictSetInterval = function(fn, ms) {
    setIntervalReceiver = this;
    if (this !== fakeWindow) {
      throw new TypeError("Failed to execute 'setInterval' on 'Window': Illegal invocation");
    }
    return 202;
  };

  const strictClearInterval = function(id) {
    clearIntervalReceiver = this;
    if (this !== fakeWindow) {
      throw new TypeError("Failed to execute 'clearInterval' on 'Window': Illegal invocation");
    }
  };

  const originalWindow = globalThis.window;
  try {
    fakeWindow.setTimeout = strictSetTimeout;
    fakeWindow.clearTimeout = strictClearTimeout;
    fakeWindow.setInterval = strictSetInterval;
    fakeWindow.clearInterval = strictClearInterval;
    globalThis.window = fakeWindow;

    const defaultOpener = {
      closed: false,
      __worshipDeckAcquireProjectorConsumer: () => ({
        stream: new MockStream(),
        release: () => {},
      }),
    };

    const bridge = new ProjectorGuestMediaBridge({
      getOpener: () => defaultOpener,
      postMessage: () => {},
      createVideoElement: () => {
        const v = new MockVideoElement();
        queueMicrotask(() => v.simulateReady());
        return v;
      },
      setTimeout: strictSetTimeout,
      clearTimeout: strictClearTimeout,
      setInterval: strictSetInterval,
      clearInterval: strictClearInterval,
    });

    await bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');

    assert.equal(setTimeoutReceiver, fakeWindow, 'setTimeout must receive fakeWindow');
    assert.equal(clearTimeoutReceiver, fakeWindow, 'clearTimeout must receive fakeWindow');
    assert.equal(setIntervalReceiver, fakeWindow, 'setInterval must receive fakeWindow');

    bridge.teardown();
    assert.equal(clearIntervalReceiver, fakeWindow, 'clearInterval must receive fakeWindow');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('SPEC-107-02: ProjectorGuestMediaBridge default environment binds global timers and intervals without Illegal invocation', async () => {
  const fakeWindow = { isFakeWindow: true };
  const originalWindow = globalThis.window;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;

  let setTimeoutReceiver = null;
  let clearTimeoutReceiver = null;
  let setIntervalReceiver = null;
  let clearIntervalReceiver = null;

  try {
    const strictSetTimeout = function(fn, ms) {
      setTimeoutReceiver = this;
      if (this !== fakeWindow) {
        throw new TypeError("Failed to execute 'setTimeout' on 'Window': Illegal invocation");
      }
      return 101;
    };

    const strictClearTimeout = function(id) {
      clearTimeoutReceiver = this;
      if (this !== fakeWindow) {
        throw new TypeError("Failed to execute 'clearTimeout' on 'Window': Illegal invocation");
      }
    };

    const strictSetInterval = function(fn, ms) {
      setIntervalReceiver = this;
      if (this !== fakeWindow) {
        throw new TypeError("Failed to execute 'setInterval' on 'Window': Illegal invocation");
      }
      return 202;
    };

    const strictClearInterval = function(id) {
      clearIntervalReceiver = this;
      if (this !== fakeWindow) {
        throw new TypeError("Failed to execute 'clearInterval' on 'Window': Illegal invocation");
      }
    };

    fakeWindow.setTimeout = strictSetTimeout;
    fakeWindow.clearTimeout = strictClearTimeout;
    fakeWindow.setInterval = strictSetInterval;
    fakeWindow.clearInterval = strictClearInterval;
    globalThis.window = fakeWindow;
    globalThis.setTimeout = strictSetTimeout;
    globalThis.clearTimeout = strictClearTimeout;
    globalThis.setInterval = strictSetInterval;
    globalThis.clearInterval = strictClearInterval;

    const defaultOpener = {
      closed: false,
      __worshipDeckAcquireProjectorConsumer: () => ({
        stream: new MockStream(),
        release: () => {},
      }),
    };

    const bridge = new ProjectorGuestMediaBridge({
      getOpener: () => defaultOpener,
      postMessage: () => {},
      createVideoElement: () => {
        const v = new MockVideoElement();
        queueMicrotask(() => v.simulateReady());
        return v;
      },
    });

    await bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');

    assert.equal(setTimeoutReceiver, fakeWindow, 'Default setTimeout must receive fakeWindow');
    assert.equal(clearTimeoutReceiver, fakeWindow, 'Default clearTimeout must receive fakeWindow');
    assert.equal(setIntervalReceiver, fakeWindow, 'Default setInterval must receive fakeWindow');

    bridge.teardown();
    assert.equal(clearIntervalReceiver, fakeWindow, 'Default clearInterval must receive fakeWindow');
  } finally {
    globalThis.window = originalWindow;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

test('SPEC-107-02: Zero-valued timer and interval handles are cleared properly in ProjectorGuestMediaBridge', async () => {
  const fakeWindow = { isFakeWindow: true };
  const clearedTimeoutIds = [];
  const clearedIntervalIds = [];

  const originalWindow = globalThis.window;
  try {
    globalThis.window = fakeWindow;

    const defaultOpener = {
      closed: false,
      __worshipDeckAcquireProjectorConsumer: () => ({
        stream: new MockStream(),
        release: () => {},
      }),
    };

    const bridge = new ProjectorGuestMediaBridge({
      getOpener: () => defaultOpener,
      postMessage: () => {},
      createVideoElement: () => {
        const v = new MockVideoElement();
        queueMicrotask(() => v.simulateReady());
        return v;
      },
      setTimeout: () => 0,
      clearTimeout: (id) => clearedTimeoutIds.push(id),
      setInterval: () => 0,
      clearInterval: (id) => clearedIntervalIds.push(id),
    });

    await bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');

    // On simulateReady, playback deadline timer is cleared
    assert.ok(clearedTimeoutIds.includes(0), 'clearTimeout must clear zero-valued timer handle 0');

    bridge.teardown();
    // On teardown, status re-emission interval is cleared
    assert.ok(clearedIntervalIds.includes(0), 'clearInterval must clear zero-valued interval handle 0');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('SPEC-107-02: Mixed timer fallback pairs each timer with its true owning target', async () => {
  const fakeWindow = { isFakeWindow: true };
  const originalWindow = globalThis.window;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;

  let setTimeoutReceiver = null;
  let setIntervalReceiver = null;

  try {
    // fakeWindow has setTimeout and clearTimeout only
    fakeWindow.setTimeout = function(fn, ms) {
      setTimeoutReceiver = this;
      if (this !== fakeWindow) {
        throw new TypeError("Failed to execute 'setTimeout' on 'Window': Illegal invocation");
      }
      return 101;
    };
    fakeWindow.clearTimeout = function() {};

    // globalThis has setInterval and clearInterval which require globalThis as receiver
    globalThis.setInterval = function(fn, ms) {
      setIntervalReceiver = this;
      if (this !== globalThis) {
        throw new TypeError("Failed to execute 'setInterval' on 'globalThis': Illegal invocation");
      }
      return 202;
    };
    globalThis.clearInterval = function() {};

    globalThis.window = fakeWindow;

    const defaultOpener = {
      closed: false,
      __worshipDeckAcquireProjectorConsumer: () => ({
        stream: new MockStream(),
        release: () => {},
      }),
    };

    const bridge = new ProjectorGuestMediaBridge({
      getOpener: () => defaultOpener,
      postMessage: () => {},
      createVideoElement: () => {
        const v = new MockVideoElement();
        queueMicrotask(() => v.simulateReady());
        return v;
      },
    });

    await bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');

    assert.equal(setTimeoutReceiver, fakeWindow, 'setTimeout must receive fakeWindow');
    assert.equal(setIntervalReceiver, globalThis, 'setInterval missing on window must receive globalThis');

    bridge.teardown();
  } finally {
    globalThis.window = originalWindow;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

test('SPEC-107-02: Synchronously ready video clears playbackDeadlineTimer immediately', async () => {
  let clearedDeadlineId = null;

  const defaultOpener = {
    closed: false,
    __worshipDeckAcquireProjectorConsumer: () => ({
      stream: new MockStream(),
      release: () => {},
    }),
  };

  const syncReadyVideo = new MockVideoElement();
  syncReadyVideo.readyState = 2; // Synchronously ready
  syncReadyVideo.videoWidth = 1920;
  syncReadyVideo.videoHeight = 1080;

  const bridge = new ProjectorGuestMediaBridge({
    getOpener: () => defaultOpener,
    postMessage: () => {},
    createVideoElement: () => syncReadyVideo,
    setTimeout: () => 777,
    clearTimeout: (id) => {
      clearedDeadlineId = id;
    },
    setInterval: () => 888,
    clearInterval: () => {},
  });

  await bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');

  // Must have cleared the 777 handle immediately on synchronous ready
  assert.equal(clearedDeadlineId, 777, 'Synchronously ready video must clear playbackDeadlineTimer immediately');

=======
test('hotfix guard: ProjectorGuestMediaBridge passes strict timer receiver checks without Illegal invocation', async () => {
  const windowObj = globalThis;
  function strictTimeout(fn, ms) {
    if (this !== windowObj && this !== undefined) {
      throw new TypeError("Failed to execute 'setTimeout' on 'Window': Illegal invocation");
    }
    return setTimeout(fn, ms);
  }
  function strictClearTimeout(id) {
    if (this !== windowObj && this !== undefined) {
      throw new TypeError("Failed to execute 'clearTimeout' on 'Window': Illegal invocation");
    }
    return clearTimeout(id);
  }
  function strictInterval(fn, ms) {
    if (this !== windowObj && this !== undefined) {
      throw new TypeError("Failed to execute 'setInterval' on 'Window': Illegal invocation");
    }
    return setInterval(fn, ms);
  }
  function strictClearInterval(id) {
    if (this !== windowObj && this !== undefined) {
      throw new TypeError("Failed to execute 'clearInterval' on 'Window': Illegal invocation");
    }
    return clearInterval(id);
  }

  const posted = [];
  const bridge = new ProjectorGuestMediaBridge({
    getOpener: () => ({
      __worshipDeckAcquireProjectorConsumer: () => ({
        stream: new MockStream(),
        release: () => {},
      }),
    }),
    postMessage: (m) => posted.push(m),
    createVideoElement: () => {
      const v = new MockVideoElement();
      queueMicrotask(() => v.simulateReady(1920, 1080));
      return v;
    },
    setTimeout: strictTimeout,
    clearTimeout: strictClearTimeout,
    setInterval: strictInterval,
    clearInterval: strictClearInterval,
  });

  await bridge.syncProjection({ kind: 'guest', guestSessionId: 's1' }, 'a1');
  assert.equal(posted[0]?.state, 'attached');
>>>>>>> Stashed changes
  bridge.teardown();
});

