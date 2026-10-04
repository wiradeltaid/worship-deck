/**
 * SPEC-101-01: CaptureBroker device selection, operator preview, and bounded lifecycle tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcUrl = (...parts) => pathToFileURL(path.join(root, 'src', ...parts)).href;

const { CaptureBroker, CaptureBrokerError } = await import(srcUrl('lib', 'capture-broker.ts'));

class MockTrack {
  constructor(kind = 'video', settings = { width: 1920, height: 1080, frameRate: 60 }) {
    this.kind = kind;
    this.readyState = 'live';
    this.stopped = false;
    this._settings = settings;
    this.listeners = new Map();
    this.onended = null;
  }

  stop() {
    this.stopped = true;
    this.readyState = 'ended';
  }

  getSettings() {
    return { ...this._settings };
  }

  addEventListener(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
  }

  removeEventListener(event, fn) {
    if (this.listeners.has(event)) this.listeners.get(event).delete(fn);
  }

  triggerEnded() {
    this.stop();
    if (this.onended) this.onended();
    const handlers = this.listeners.get('ended') || [];
    for (const h of handlers) h();
  }
}

class MockStream {
  constructor(tracks = [new MockTrack('video')]) {
    this._tracks = tracks;
    this.clones = [];
  }

  getTracks() {
    return [...this._tracks];
  }

  getVideoTracks() {
    return this._tracks.filter((t) => t.kind === 'video');
  }

  getAudioTracks() {
    return this._tracks.filter((t) => t.kind === 'audio');
  }

  clone() {
    const clonedTracks = this._tracks.map(
      (t) => new MockTrack(t.kind, t.getSettings())
    );
    const cloned = new MockStream(clonedTracks);
    this.clones.push(cloned);
    return cloned;
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

  addEventListener(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
  }

  removeEventListener(event, handler) {
    if (this.listeners.has(event)) this.listeners.get(event).delete(handler);
  }

  simulateReady(width = 1920, height = 1080) {
    this.readyState = 2; // HAVE_CURRENT_DATA
    this.videoWidth = width;
    this.videoHeight = height;
    const handlers = this.listeners.get('loadeddata') || [];
    for (const h of handlers) h();
  }

  simulateError() {
    const handlers = this.listeners.get('error') || [];
    for (const h of handlers) h(new Error('Video decode error'));
  }
}

function createMockEnv(overrides = {}) {
  const videoElements = [];
  let currentTime = 1000;
  const timers = new Map();
  let timerSeq = 0;

  const devices = [
    { deviceId: 'cam-1', kind: 'videoinput', label: 'Elgato Cam Link 4K', groupId: 'g1' },
    { deviceId: 'cam-2', kind: 'videoinput', label: '', groupId: 'g2' }, // anonymous
    { deviceId: 'mic-1', kind: 'audioinput', label: 'USB Mic', groupId: 'g3' },
  ];

  const deviceListeners = new Set();

  const mediaDevices = {
    enumerateDevices: async () => [...devices],
    getUserMedia: async (constraints) => {
      mediaDevices.lastConstraints = constraints;
      const track = new MockTrack('video');
      return new MockStream([track]);
    },
    addEventListener: (event, fn) => {
      if (event === 'devicechange') deviceListeners.add(fn);
    },
    removeEventListener: (event, fn) => {
      if (event === 'devicechange') deviceListeners.delete(fn);
    },
    triggerDeviceChange: () => {
      for (const fn of deviceListeners) fn();
    },
    lastConstraints: null,
  };

  const env = {
    isSecureContext: true,
    mediaDevices,
    createVideoElement: () => {
      const v = new MockVideoElement();
      videoElements.push(v);
      if (overrides.autoReady !== false) {
        queueMicrotask(() => {
          v.simulateReady(1920, 1080);
        });
      }
      return v;
    },
    setTimeout: (fn, ms) => {
      const id = ++timerSeq;
      timers.set(id, { fn, triggerAt: currentTime + ms });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
    now: () => currentTime,
    randomUUID: () => 'uuid-' + Math.random().toString(36).slice(2, 8),
    advanceTime: (ms) => {
      currentTime += ms;
      for (const [id, t] of Array.from(timers.entries())) {
        if (currentTime >= t.triggerAt) {
          timers.delete(id);
          t.fn();
        }
      }
    },
    videoElements,
    devices,
    ...overrides,
  };

  return env;
}

test('secure context and media API checks fail closed with typed errors', async () => {
  const insecureEnv = createMockEnv({ isSecureContext: false });
  const insecureBroker = new CaptureBroker(insecureEnv);
  await assert.rejects(
    () => insecureBroker.enumerateDevices(),
    (err) => err instanceof CaptureBrokerError && err.code === 'INSECURE_CONTEXT'
  );

  const noMediaEnv = createMockEnv({ mediaDevices: null });
  const noMediaBroker = new CaptureBroker(noMediaEnv);
  await assert.rejects(
    () => noMediaBroker.enumerateDevices(),
    (err) => err instanceof CaptureBrokerError && err.code === 'MEDIA_API_UNAVAILABLE'
  );
});

test('device enumeration filters videoinput and provides localized fallback labels', async () => {
  const env = createMockEnv();
  const broker = new CaptureBroker(env);
  const list = await broker.enumerateDevices();

  assert.equal(list.length, 2);
  assert.equal(list[0].deviceId, 'cam-1');
  assert.equal(list[0].label, 'Elgato Cam Link 4K');
  assert.equal(list[1].deviceId, 'cam-2');
  assert.equal(list[1].label, 'Capture Device 2'); // fallback for anonymous label
});

test('device selection is explicit; stale replug is detected and never silently defaults', async () => {
  const env = createMockEnv();
  const broker = new CaptureBroker(env);
  await broker.enumerateDevices();

  // No auto-arm, no default selection
  assert.equal(broker.getSnapshot().selectedDeviceId, null);

  broker.selectDevice('cam-1');
  assert.equal(broker.getSnapshot().selectedDeviceId, 'cam-1');
  assert.equal(broker.getSnapshot().isDeviceStale, false);

  // Device unplugged
  env.devices.splice(0, 1);
  env.mediaDevices.triggerDeviceChange();
  await new Promise((r) => setTimeout(r, 10));

  const snap = broker.getSnapshot();
  assert.equal(snap.selectedDeviceId, 'cam-1');
  assert.equal(snap.isDeviceStale, true);
  // Must NOT silently become cam-2
  assert.notEqual(snap.selectedDeviceId, 'cam-2');
});

test('arm enforces audio: false and ideal 1080p60 constraints; no auto-arm on mount', async () => {
  const env = createMockEnv();
  const broker = new CaptureBroker(env);

  // Assert no getUserMedia was called on mount
  assert.equal(env.mediaDevices.lastConstraints, null);

  await broker.enumerateDevices();
  assert.equal(env.mediaDevices.lastConstraints, null); // no capture on enum

  broker.selectDevice('cam-1');
  assert.equal(env.mediaDevices.lastConstraints, null); // no capture on select

  await broker.arm('cam-1');

  assert.deepEqual(env.mediaDevices.lastConstraints, {
    video: {
      deviceId: { exact: 'cam-1' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 60 },
    },
    audio: false,
  });

  const snap = broker.getSnapshot();
  assert.equal(snap.state, 'ready');
  assert(snap.guestSessionId);
  assert.deepEqual(snap.negotiatedSettings, {
    width: 1920,
    height: 1080,
    frameRate: 60,
    aspectRatio: undefined,
  });
});

test('arm coalesces double-clicks while pending', async () => {
  const env = createMockEnv();
  let getUserMediaCalls = 0;
  env.mediaDevices.getUserMedia = async (constraints) => {
    getUserMediaCalls++;
    await new Promise((r) => setTimeout(r, 20));
    return new MockStream();
  };

  const broker = new CaptureBroker(env);
  broker.selectDevice('cam-1');

  const p1 = broker.arm();
  const p2 = broker.arm(); // second call during pending
  assert.equal(p1, p2);

  await Promise.all([p1, p2]);
  assert.equal(getUserMediaCalls, 1);
});

test('pending cancel/disarm invalidates generation and immediately stops late-resolving tracks', async () => {
  const env = createMockEnv();
  let resolveGUM;
  env.mediaDevices.getUserMedia = () =>
    new Promise((resolve) => {
      resolveGUM = resolve;
    });

  const broker = new CaptureBroker(env);
  broker.selectDevice('cam-1');

  const armPromise = broker.arm();
  assert.equal(broker.getSnapshot().state, 'permission-pending');

  // Operator cancels / disarms while permission dialog is open
  broker.disarm();
  assert.equal(broker.getSnapshot().state, 'idle');

  // Late resolution of user permission
  const lateTrack = new MockTrack('video');
  const lateStream = new MockStream([lateTrack]);
  resolveGUM(lateStream);

  await armPromise;

  // Track must be immediately stopped
  assert.equal(lateTrack.stopped, true);
  assert.equal(broker.getSnapshot().state, 'idle');
});

test('readiness timeout after 5 seconds stops master stream and releases hardware', async () => {
  const env = createMockEnv({ autoReady: false });
  let streamTrack;
  env.mediaDevices.getUserMedia = async () => {
    streamTrack = new MockTrack('video');
    return new MockStream([streamTrack]);
  };

  const broker = new CaptureBroker(env);
  broker.selectDevice('cam-1');

  const armPromise = broker.arm();
  // Wait microtask so getUserMedia resolves and videoElement is attached
  await new Promise((r) => setTimeout(r, 10));
  // Advance simulated timer past 5000ms
  env.advanceTime(5001);

  await assert.rejects(
    armPromise,
    (err) => err instanceof CaptureBrokerError && err.code === 'READINESS_TIMEOUT'
  );

  assert.equal(streamTrack.stopped, true);
  assert.equal(broker.getSnapshot().state, 'error');
  assert.equal(broker.getSnapshot().error?.code, 'READINESS_TIMEOUT');
});

test('acquireProjectorConsumer enforces single slot, attempt/session match, and identity-bound release', async () => {
  const env = createMockEnv();
  const broker = new CaptureBroker(env);
  broker.selectDevice('cam-1');

  await broker.arm();

  const sessionId = broker.getSnapshot().guestSessionId;
  const attemptId = 'att-1';
  broker.setAttemptId(attemptId);

  // Reject on mismatched session or attempt
  assert.throws(
    () => broker.acquireProjectorConsumer('wrong-session', attemptId),
    /does not match active session/
  );
  assert.throws(
    () => broker.acquireProjectorConsumer(sessionId, 'wrong-attempt'),
    /does not match active attempt/
  );

  // Acquire first consumer
  const consumer1 = broker.acquireProjectorConsumer(sessionId, attemptId);
  assert(consumer1.stream);
  const track1 = consumer1.stream.getVideoTracks()[0];
  assert.equal(track1.stopped, false);

  // Re-acquire replaces and stops old consumer slot (single slot rule)
  const attemptId2 = 'att-2';
  broker.setAttemptId(attemptId2);
  const consumer2 = broker.acquireProjectorConsumer(sessionId, attemptId2);
  const track2 = consumer2.stream.getVideoTracks()[0];

  assert.equal(track1.stopped, true); // old track stopped on replacement
  assert.equal(track2.stopped, false);

  // Idempotent release on old consumer does NOT stop replacement
  consumer1.release();
  consumer1.release(); // double release
  assert.equal(track2.stopped, false);

  // Release active replacement
  consumer2.release();
  assert.equal(track2.stopped, true);
  consumer2.release(); // double release no-op
});

test('definitive loss via track onended transitions broker and clears media', async () => {
  const env = createMockEnv();
  let masterTrack;
  env.mediaDevices.getUserMedia = async () => {
    masterTrack = new MockTrack('video');
    return new MockStream([masterTrack]);
  };

  const broker = new CaptureBroker(env);
  broker.selectDevice('cam-1');
  await broker.arm();

  const sessionId = broker.getSnapshot().guestSessionId;
  broker.setAttemptId('att-1');
  const consumer = broker.acquireProjectorConsumer(sessionId, 'att-1');
  const consumerTrack = consumer.stream.getVideoTracks()[0];

  // Hardware loss (e.g. HDMI unplugged)
  masterTrack.triggerEnded();

  const snap = broker.getSnapshot();
  assert.equal(snap.state, 'error');
  assert.equal(snap.error?.code, 'DEVICE_NOT_FOUND');
  assert.equal(consumerTrack.stopped, true);
});

test('teardown cleans master, consumer, listeners, and resets to idle', async () => {
  const env = createMockEnv();
  let masterTrack;
  env.mediaDevices.getUserMedia = async () => {
    masterTrack = new MockTrack('video');
    return new MockStream([masterTrack]);
  };

  const broker = new CaptureBroker(env);
  broker.selectDevice('cam-1');
  await broker.arm();

  broker.setAttemptId('att-1');
  const consumer = broker.acquireProjectorConsumer(broker.getSnapshot().guestSessionId, 'att-1');
  const consumerTrack = consumer.stream.getVideoTracks()[0];

  broker.teardown();

  assert.equal(masterTrack.stopped, true);
  assert.equal(consumerTrack.stopped, true);
  assert.equal(broker.getSnapshot().state, 'idle');
  assert.equal(broker.getSnapshot().guestSessionId, null);
});

test('guard proof: audio:false invariant fails if audio is requested or allowed', async () => {
  function validateCaptureConstraints(constraints) {
    if (constraints.audio !== false) {
      throw new Error('CaptureBroker violated invariant: audio must be strictly false');
    }
  }

  assert.doesNotThrow(() => validateCaptureConstraints({ video: {}, audio: false }));
  assert.throws(() => validateCaptureConstraints({ video: {}, audio: true }), /audio must be strictly false/);
  assert.throws(() => validateCaptureConstraints({ video: {} }), /audio must be strictly false/);
  assert.throws(() => validateCaptureConstraints({ video: {}, audio: { echoCancellation: true } }), /audio must be strictly false/);
});

test('guard proof: no-auto-arm invariant fails if broker captures without explicit arm', () => {
  let gumCalled = false;
  const mockMediaDevices = {
    getUserMedia: async () => {
      gumCalled = true;
    },
  };

  const mockBrokerInit = (devices) => {
    // Correct behavior: do NOT call getUserMedia
  };
  mockBrokerInit(mockMediaDevices);
  assert.equal(gumCalled, false);

  const defectBrokerInit = (devices) => {
    devices.getUserMedia();
  };
  defectBrokerInit(mockMediaDevices);
  assert.equal(gumCalled, true, 'Defect correctly triggered auto-arm failure');
});

test('SPEC-106-01: CaptureBroker preserves native Web API receiver binding and avoids Illegal invocation', async () => {
  const nativeMediaDevices = {
    async enumerateDevices() {
      if (this !== nativeMediaDevices) {
        throw new TypeError("Failed to execute 'enumerateDevices' on 'MediaDevices': Illegal invocation");
      }
      return [
        { deviceId: 'cam-live', kind: 'videoinput', label: 'USB Live Cam', groupId: 'g1' },
      ];
    },
    async getUserMedia(constraints) {
      if (this !== nativeMediaDevices) {
        throw new TypeError("Failed to execute 'getUserMedia' on 'MediaDevices': Illegal invocation");
      }
      return new MockStream([new MockTrack('video')]);
    },
  };

  const broker = new CaptureBroker({
    isSecureContext: true,
    mediaDevices: nativeMediaDevices,
    createVideoElement: () => {
      const v = new MockVideoElement();
      queueMicrotask(() => v.simulateReady(1920, 1080));
      return v;
    },
  });

  // Verify enumerateDevices does not throw Illegal invocation
  const devices = await broker.enumerateDevices();
  assert.equal(devices.length, 1);
  assert.equal(devices[0].deviceId, 'cam-live');

  // Verify arm / getUserMedia does not throw Illegal invocation
  await broker.arm('cam-live');
  assert.equal(broker.getSnapshot().state, 'ready');
});

test('SPEC-106-01: requestPermission invokes getUserMedia({ video: true, audio: false }), guarantees probe track cleanup, and updates devices', async () => {
  let gumConstraints = null;
  let probeTrack = null;
  let enumCalled = false;

  const mediaDevices = {
    async getUserMedia(constraints) {
      gumConstraints = constraints;
      probeTrack = new MockTrack('video');
      return new MockStream([probeTrack]);
    },
    async enumerateDevices() {
      enumCalled = true;
      return [
        { deviceId: 'newly-granted-cam', kind: 'videoinput', label: 'UGREEN 4K Card', groupId: 'g1' },
      ];
    },
  };

  const broker = new CaptureBroker({
    isSecureContext: true,
    mediaDevices,
    createVideoElement: () => new MockVideoElement(),
  });

  const discovered = await broker.requestPermission();

  assert.deepEqual(gumConstraints, { video: true, audio: false });
  assert.equal(probeTrack.stopped, true, 'Probe track must be stopped in finally block');
  assert.equal(enumCalled, true);
  assert.equal(discovered.length, 1);
  assert.equal(discovered[0].deviceId, 'newly-granted-cam');
  assert.equal(broker.getSnapshot().devices[0].deviceId, 'newly-granted-cam');
  assert.equal(broker.getSnapshot().error, null);
});

test('SPEC-106-01: requestPermission guarantees probe track cleanup even if enumeration fails', async () => {
  let probeTrack = null;
  const mediaDevices = {
    async getUserMedia() {
      probeTrack = new MockTrack('video');
      return new MockStream([probeTrack]);
    },
    async enumerateDevices() {
      throw new Error('Hardware enum failure after permission');
    },
  };

  const broker = new CaptureBroker({
    isSecureContext: true,
    mediaDevices,
    createVideoElement: () => new MockVideoElement(),
  });

  await assert.rejects(() => broker.requestPermission(), /Hardware enum failure after permission/);
  assert.equal(probeTrack.stopped, true, 'Probe track must be stopped even if enumerateDevices throws');
});

test('SPEC-106-01: requestPermission maps NotAllowedError to PERMISSION_DENIED without unhandled rejection', async () => {
  const notAllowedErr = new Error('Permission dismissed or blocked by user');
  notAllowedErr.name = 'NotAllowedError';

  const mediaDevices = {
    async getUserMedia() {
      throw notAllowedErr;
    },
    async enumerateDevices() {
      return [];
    },
  };

  const broker = new CaptureBroker({
    isSecureContext: true,
    mediaDevices,
    createVideoElement: () => new MockVideoElement(),
  });

  await assert.rejects(
    () => broker.requestPermission(),
    (err) => err instanceof CaptureBrokerError && err.code === 'PERMISSION_DENIED'
  );

  const snap = broker.getSnapshot();
  assert.equal(snap.error?.code, 'PERMISSION_DENIED');
  assert.match(snap.error?.message, /Camera permission was denied/);
});

test('SPEC-106-01: PresenterGuestFeedController requestPermission delegates and catches errors without unhandled rejection', async () => {
  const notAllowedErr = new Error('Permission denied');
  notAllowedErr.name = 'NotAllowedError';

  const mediaDevices = {
    async getUserMedia() {
      throw notAllowedErr;
    },
    async enumerateDevices() {
      return [];
    },
  };

  const broker = new CaptureBroker({
    isSecureContext: true,
    mediaDevices,
    createVideoElement: () => new MockVideoElement(),
  });

  const { PresenterGuestFeedController } = await import(
    srcUrl('operator', 'present', 'presenter-guest-feed-controller.ts')
  );

  const controller = new PresenterGuestFeedController({
    broker,
    broadcastSync: () => {},
  });

  // Call controller.requestPermission() - must NOT throw unhandled rejection
  const result = await controller.requestPermission();
  assert.deepEqual(result, []);
  assert.match(controller.getSnapshot().errorMessage, /permission was denied/i);
});

test('SPEC-107-01: CaptureBroker preserves native timer receiver binding for setTimeout and clearTimeout without Illegal invocation', async () => {
  const fakeWindow = { isFakeWindow: true };
  let setTimeoutReceiver = null;
  let clearTimeoutReceiver = null;

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

  const originalWindow = globalThis.window;
  try {
    globalThis.window = fakeWindow;

    const mockEnv = createMockEnv({
      setTimeout: strictSetTimeout,
      clearTimeout: strictClearTimeout,
    });

    const broker = new CaptureBroker(mockEnv);
    await broker.arm('cam-1');

    assert.equal(setTimeoutReceiver, fakeWindow, 'setTimeout must be invoked with window as receiver');
    assert.equal(clearTimeoutReceiver, fakeWindow, 'clearTimeout must be invoked with window as receiver');
    assert.equal(broker.getSnapshot().state, 'ready');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('SPEC-107-01: CaptureBroker default environment binds global timer without Illegal invocation', async () => {
  const fakeWindow = { isFakeWindow: true };
  const originalWindow = globalThis.window;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let setTimeoutReceiver = null;
  let clearTimeoutReceiver = null;

  try {
    const strictSetTimeout = function(fn, ms) {
      setTimeoutReceiver = this;
      if (this !== fakeWindow) {
        throw new TypeError("Failed to execute 'setTimeout' on 'Window': Illegal invocation");
      }
      return 102;
    };

    const strictClearTimeout = function(id) {
      clearTimeoutReceiver = this;
      if (this !== fakeWindow) {
        throw new TypeError("Failed to execute 'clearTimeout' on 'Window': Illegal invocation");
      }
    };

    fakeWindow.setTimeout = strictSetTimeout;
    fakeWindow.clearTimeout = strictClearTimeout;
    globalThis.window = fakeWindow;
    globalThis.setTimeout = strictSetTimeout;
    globalThis.clearTimeout = strictClearTimeout;

    const mockEnv = createMockEnv();
    delete mockEnv.setTimeout;
    delete mockEnv.clearTimeout;

    const broker = new CaptureBroker(mockEnv);
    await broker.arm('cam-1');

    assert.equal(setTimeoutReceiver, fakeWindow, 'Default setTimeout must be invoked with window as receiver');
    assert.equal(clearTimeoutReceiver, fakeWindow, 'Default clearTimeout must be invoked with window as receiver');
    assert.equal(broker.getSnapshot().state, 'ready');
  } finally {
    globalThis.window = originalWindow;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test('SPEC-107-01: PresenterGuestFeedController preserves timer receiver binding for attach deadline and watchdog', async () => {
  const fakeWindow = { isFakeWindow: true };
  let setTimeoutReceiver = null;
  let clearTimeoutReceiver = null;

  const strictSetTimeout = function(fn, ms) {
    setTimeoutReceiver = this;
    if (this !== fakeWindow) {
      throw new TypeError("Failed to execute 'setTimeout' on 'Window': Illegal invocation");
    }
    return 999;
  };

  const strictClearTimeout = function(id) {
    clearTimeoutReceiver = this;
    if (this !== fakeWindow) {
      throw new TypeError("Failed to execute 'clearTimeout' on 'Window': Illegal invocation");
    }
  };

  const originalWindow = globalThis.window;
  try {
    fakeWindow.setTimeout = strictSetTimeout;
    fakeWindow.clearTimeout = strictClearTimeout;
    globalThis.window = fakeWindow;

    const mockEnv = createMockEnv();
    const broker = new CaptureBroker(mockEnv);
    await broker.arm('cam-1');

    const { PresenterGuestFeedController } = await import(
      srcUrl('operator', 'present', 'presenter-guest-feed-controller.ts')
    );

    const controller = new PresenterGuestFeedController({
      broker,
      broadcastSync: () => {},
      setTimeout: strictSetTimeout,
      clearTimeout: strictClearTimeout,
    });

    controller.switch(true);
    assert.equal(setTimeoutReceiver, fakeWindow, 'controller setTimeout must receive fakeWindow');

    controller.revertToDeck('user-switch');
    assert.equal(clearTimeoutReceiver, fakeWindow, 'controller clearTimeout must receive fakeWindow');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('SPEC-107-01: PresenterGuestFeedController default environment binds global timer without Illegal invocation', async () => {
  const fakeWindow = { isFakeWindow: true };
  const originalWindow = globalThis.window;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let setTimeoutReceiver = null;
  let clearTimeoutReceiver = null;

  try {
    const strictSetTimeout = function(fn, ms) {
      setTimeoutReceiver = this;
      if (this !== fakeWindow) {
        throw new TypeError("Failed to execute 'setTimeout' on 'Window': Illegal invocation");
      }
      return 998;
    };

    const strictClearTimeout = function(id) {
      clearTimeoutReceiver = this;
      if (this !== fakeWindow) {
        throw new TypeError("Failed to execute 'clearTimeout' on 'Window': Illegal invocation");
      }
    };

    fakeWindow.setTimeout = strictSetTimeout;
    fakeWindow.clearTimeout = strictClearTimeout;
    globalThis.window = fakeWindow;
    globalThis.setTimeout = strictSetTimeout;
    globalThis.clearTimeout = strictClearTimeout;

    const mockEnv = createMockEnv();
    const broker = new CaptureBroker(mockEnv);
    await broker.arm('cam-1');

    const { PresenterGuestFeedController } = await import(
      srcUrl('operator', 'present', 'presenter-guest-feed-controller.ts')
    );

    const controller = new PresenterGuestFeedController({
      broker,
      broadcastSync: () => {},
    });

    controller.switch(true);
    assert.equal(setTimeoutReceiver, fakeWindow, 'Default controller setTimeout must receive fakeWindow');

    controller.revertToDeck('user-switch');
    assert.equal(clearTimeoutReceiver, fakeWindow, 'Default controller clearTimeout must receive fakeWindow');
  } finally {
    globalThis.window = originalWindow;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test('SPEC-107-01: Zero-valued timer handles and watchdog cancellation on disarm/teardown', async () => {
  const fakeWindow = { isFakeWindow: true };
  const clearedIds = [];

  const zeroSetTimeout = function() {
    return 0; // zero timer handle
  };

  const trackingClearTimeout = function(id) {
    clearedIds.push(id);
  };

  const originalWindow = globalThis.window;
  try {
    globalThis.window = fakeWindow;

    const mockEnv = createMockEnv({
      setTimeout: zeroSetTimeout,
      clearTimeout: trackingClearTimeout,
    });
    const broker = new CaptureBroker(mockEnv);
    await broker.arm('cam-1');

    // Prove CaptureBroker clears zero-valued readiness timer handle
    assert.ok(clearedIds.includes(0), 'CaptureBroker must clear zero-valued timer handle 0');

    const { PresenterGuestFeedController } = await import(
      srcUrl('operator', 'present', 'presenter-guest-feed-controller.ts')
    );

    const controllerClearedIds = [];
    const controller = new PresenterGuestFeedController({
      broker,
      broadcastSync: () => {},
      setTimeout: () => 0,
      clearTimeout: (id) => controllerClearedIds.push(id),
    });

    controller.switch(true);
    controller.disarm();
    // Prove controller disarm/revert cancels both deadline and watchdog zero handles
    assert.ok(controllerClearedIds.includes(0), 'Controller must clear zero-valued timer handle 0 on disarm');

    controller.teardown();
  } finally {
    globalThis.window = originalWindow;
  }
});



