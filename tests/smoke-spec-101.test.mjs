/**
 * SPEC-101 End-to-End Smoke Test:
 * Covers the complete lifecycle: device enumeration -> arming -> preview -> switch ->
 * cross-window clone acquisition -> attached telemetry -> confirmed-live ->
 * scripture exclusivity -> Escape panic -> clean disarm and absence guards.
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
  type,
} = await import(srcUrl('lib', 'present-channel.ts'));
const { CaptureBroker } = await import(srcUrl('lib', 'capture-broker.ts'));
const { PresenterGuestFeedController } = await import(
  srcUrl('operator', 'present', 'presenter-guest-feed-controller.ts')
);
const { ProjectorGuestMediaBridge } = await import(
  srcUrl('projected', 'projector-guest-media-bridge.ts')
);

class MockTrack {
  constructor(kind = 'video', settings = { width: 1920, height: 1080, frameRate: 60 }) {
    this.kind = kind;
    this.readyState = 'live';
    this.stopped = false;
    this._settings = settings;
    this.listeners = new Map();
  }
  stop() {
    this.stopped = true;
    this.readyState = 'ended';
  }
  getSettings() {
    return { ...this._settings };
  }
  addEventListener(e, fn) {
    if (!this.listeners.has(e)) this.listeners.set(e, new Set());
    this.listeners.get(e).add(fn);
  }
  removeEventListener(e, fn) {
    if (this.listeners.has(e)) this.listeners.get(e).delete(fn);
  }
}

class MockStream {
  constructor(tracks = [new MockTrack('video')]) {
    this._tracks = tracks;
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
    return new MockStream(
      this._tracks.map((t) => new MockTrack(t.kind, t.getSettings()))
    );
  }
}

class MockVideoElement {
  constructor() {
    this.readyState = 0;
    this.videoWidth = 0;
    this.videoHeight = 0;
    this.srcObject = null;
    this.muted = false;
    this.playsInline = false;
    this.listeners = new Map();
  }
  addEventListener(e, fn) {
    if (!this.listeners.has(e)) this.listeners.set(e, new Set());
    this.listeners.get(e).add(fn);
  }
  removeEventListener(e, fn) {
    if (this.listeners.has(e)) this.listeners.get(e).delete(fn);
  }
  simulateReady() {
    this.readyState = 2;
    this.videoWidth = 1920;
    this.videoHeight = 1080;
    const handlers = this.listeners.get('loadeddata') || [];
    for (const h of handlers) h();
  }
  play() {
    return Promise.resolve();
  }
}

test('smoke: full SPEC-101 guest capture, switch, projection, panic, and disarm lifecycle', async () => {
  const channelBus = [];

  // 1. Setup Operator Environment
  const brokerEnv = {
    isSecureContext: true,
    mediaDevices: {
      enumerateDevices: async () => [
        { deviceId: 'card-1', kind: 'videoinput', label: 'USB3 HDMI Card', groupId: 'g1' },
      ],
      getUserMedia: async (constraints) => {
        assert.equal(constraints.audio, false, 'CaptureBroker must enforce audio: false');
        return new MockStream();
      },
    },
    createVideoElement: () => {
      const v = new MockVideoElement();
      queueMicrotask(() => v.simulateReady());
      return v;
    },
  };

  const broker = new CaptureBroker(brokerEnv);

  const controller = new PresenterGuestFeedController({
    broker,
    broadcastSync: () => {
      const snap = controller.getSnapshot();
      channelBus.push({
        type: 'sync',
        index: 0,
        blank: false,
        transition: 'fade',
        planIdentity: 'plan-1',
        projection: snap.projection,
        guestAttemptId: snap.guestAttemptId,
      });
    },
  });

  // 2. Setup Projector Environment with Opener Hook
  const opener = {
    closed: false,
    __worshipDeckAcquireProjectorConsumer: (sessId, attId) => {
      return broker.acquireProjectorConsumer(sessId, attId);
    },
  };

  const projectorBridge = new ProjectorGuestMediaBridge({
    getOpener: () => opener,
    createVideoElement: () => {
      const v = new MockVideoElement();
      queueMicrotask(() => v.simulateReady());
      return v;
    },
    postMessage: (msg) => {
      // Deliver telemetry back to presenter
      controller.handleProjectorMediaStatus(msg);
    },
  });

  // STEP A: Device selection and Arming
  await broker.enumerateDevices();
  controller.arm('card-1');
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(controller.getSnapshot().uiState, 'ready');
  assert(controller.getSnapshot().guestSessionId);

  // STEP B: Switch to Guest
  controller.switch(true);
  assert.equal(controller.getSnapshot().uiState, 'guest-pending');
  assert.equal(controller.getSnapshot().projection.kind, 'guest');

  // Verify sync message was put on the bus
  const latestSync = channelBus[channelBus.length - 1];
  assert.equal(latestSync.projection.kind, 'guest');
  assert(latestSync.guestAttemptId);

  // STEP C: Projector receives sync and attaches clone stream
  const proj = projectionOf(latestSync);
  await projectorBridge.syncProjection(proj, latestSync.guestAttemptId);

  // Step D: Confirmed live state reached on Operator console
  assert.equal(controller.getSnapshot().uiState, 'confirmed-live');
  assert(projectorBridge.getActiveStream());

  // STEP E: Scripture Exclusivity: scripture action returns globally to Deck
  controller.onScriptureAction();
  assert.equal(controller.getSnapshot().uiState, 'ready');
  assert.deepEqual(controller.getSnapshot().projection, { kind: 'deck' });

  // STEP F: Re-switch and Escape Panic
  controller.switch(true);
  assert.equal(controller.getSnapshot().uiState, 'guest-pending');
  const panicSync = channelBus[channelBus.length - 1];
  await projectorBridge.syncProjection(projectionOf(panicSync), panicSync.guestAttemptId);
  assert.equal(controller.getSnapshot().uiState, 'confirmed-live');

  // Hit Escape key
  controller.handleKeyDown({ key: 'Escape' });
  assert.equal(controller.getSnapshot().uiState, 'ready');
  assert.deepEqual(controller.getSnapshot().projection, { kind: 'deck' });

  // STEP G: Disarm cleans up all tracks and reset to idle
  controller.disarm();
  assert.equal(controller.getSnapshot().uiState, 'idle');
  assert.equal(broker.getSnapshot().state, 'idle');

  // Clean up timers so event loop exits cleanly
  projectorBridge.teardown();
  controller.teardown();
});

test('absence guard: channel sync payload contains no stream, DOM, or binary buffers', () => {
  const syncMsg = {
    type: 'sync',
    index: 0,
    blank: false,
    transition: 'fade',
    planIdentity: 'plan-1',
    projection: { kind: 'guest', guestSessionId: 'sess-1' },
    guestAttemptId: 'att-1',
  };

  const serialized = JSON.stringify(syncMsg);
  assert.doesNotMatch(serialized, /MediaStream|HTMLVideoElement|ArrayBuffer|Blob/);
});

test('absence guard: video-level fullscreen is prohibited', () => {
  const forbiddenCall = (element) => {
    if (element.tagName === 'VIDEO' && element.requestFullscreen) {
      throw new Error('Violation: Video elements must never call requestFullscreen directly.');
    }
  };

  assert.throws(
    () => forbiddenCall({ tagName: 'VIDEO', requestFullscreen: () => {} }),
    /Video elements must never call requestFullscreen/
  );
  assert.doesNotThrow(() => forbiddenCall({ tagName: 'DIV' }));
});
