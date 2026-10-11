import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcUrl = (...parts) => pathToFileURL(path.join(ROOT, 'src', ...parts)).href;

test('SPEC-110-01: playlist-model pure domain functions', async () => {
  const {
    createInitialPlaylistState,
    addPlaylistItems,
    removePlaylistItem,
    movePlaylistItem,
    getNextPlaylistItem,
    getPrevPlaylistItem,
    selectPlaylistItem,
    canProjectMediaItem,
  } = await import(srcUrl('operator', 'present', 'media-player', 'playlist-model.ts'));

  const initialState = createInitialPlaylistState();
  assert.equal(initialState.items.length, 0);
  assert.equal(initialState.activeId, null);
  assert.equal(initialState.isPlaying, false);

  const audio1 = { id: 'm-1', name: 'Song 1', url: '/api/uploads/song1.mp3', type: 'audio', duration: 180 };
  const audio2 = { id: 'm-2', name: 'Song 2', url: '/api/uploads/song2.mp3', type: 'audio', duration: 200 };
  const video1 = { id: 'm-3', name: 'Testimony', url: '/api/uploads/testimony.mp4', type: 'video', duration: 300 };
  const audio3 = { id: 'm-4', name: 'Song 3', url: '/api/uploads/song3.mp3', type: 'audio', duration: 150 };

  // Add items
  const stateWithItems = addPlaylistItems(initialState, [audio1, audio2, video1, audio3]);
  assert.equal(stateWithItems.items.length, 4);
  assert.equal(stateWithItems.activeId, 'm-1', 'Adding first items sets initial activeId if none selected');

  // Move item
  const moved = movePlaylistItem(stateWithItems, 0, 1);
  assert.equal(moved.items[0].id, 'm-2');
  assert.equal(moved.items[1].id, 'm-1');

  // Selection
  const selected = selectPlaylistItem(stateWithItems, 'm-3');
  assert.equal(selected.activeId, 'm-3');

  // Deletion Invariant: Currently loaded/playing item cannot be removed
  const playingState = { ...stateWithItems, isPlaying: true, activeId: 'm-1' };
  const attemptedRemoval = removePlaylistItem(playingState, 'm-1');
  assert.equal(
    attemptedRemoval.items.some(i => i.id === 'm-1'),
    true,
    'Invariant: Active playing item cannot be removed from playlist'
  );

  // Unselected/idle item can be removed
  const removedIdle = removePlaylistItem(stateWithItems, 'm-4');
  assert.equal(removedIdle.items.length, 3);
  assert.equal(removedIdle.items.some(i => i.id === 'm-4'), false);

  // Auto-advance rule: Audio -> Audio advances; Audio -> Video halts; Video halts
  // Order: [audio1, audio2, video1, audio3]
  assert.equal(
    getNextPlaylistItem('m-1', stateWithItems.items)?.id,
    'm-2',
    'Audio followed by Audio auto-advances'
  );
  assert.equal(
    getNextPlaylistItem('m-2', stateWithItems.items),
    null,
    'Audio followed by Video halts (returns null)'
  );
  assert.equal(
    getNextPlaylistItem('m-3', stateWithItems.items),
    null,
    'Video item always halts (returns null)'
  );

  // Previous item
  assert.equal(getPrevPlaylistItem('m-2', stateWithItems.items)?.id, 'm-1');
  assert.equal(getPrevPlaylistItem('m-1', stateWithItems.items), null);

  // canProjectMediaItem
  assert.equal(canProjectMediaItem(audio1), false);
  assert.equal(canProjectMediaItem(video1), true);
});

test('SPEC-110-01: media-store provides subscription and external state access', async () => {
  const { createMediaStore } = await import(
    srcUrl('operator', 'present', 'media-player', 'media-store.ts')
  );

  const store = createMediaStore();
  const snapshot1 = store.getSnapshot();
  assert.equal(snapshot1.isPlaying, false);

  let notified = false;
  const unsubscribe = store.subscribe(() => {
    notified = true;
  });

  store.dispatch({ type: 'SET_PLAYING', isPlaying: true });
  assert.equal(notified, true);
  assert.equal(store.getSnapshot().isPlaying, true);

  unsubscribe();
  notified = false;
  store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
  assert.equal(notified, false, 'Unsubscribed listener does not fire');
});

test('SPEC-110-01: media-engine handles fade attenuation, cancellation, and error safety', async () => {
  const { createMediaEngine } = await import(
    srcUrl('operator', 'present', 'media-player', 'media-engine.ts')
  );

  // Mock HTMLMediaElement
  let volume = 1.0;
  let isMuted = false;
  let isPlaying = false;
  let playReject = false;

  const mockMediaElement = {
    get volume() { return volume; },
    set volume(v) { volume = Math.max(0, Math.min(1, v)); },
    get muted() { return isMuted; },
    set muted(m) { isMuted = m; },
    currentTime: 0,
    duration: 180,
    play: async () => {
      if (playReject) {
        throw new Error('NotAllowedError: play() failed because the user didn\'t interact');
      }
      isPlaying = true;
    },
    pause: () => {
      isPlaying = false;
    },
  };

  const engine = createMediaEngine({ getMediaElement: () => mockMediaElement });

  // Play and Volume
  await engine.play();
  assert.equal(isPlaying, true);

  engine.setVolume(0.8);
  assert.equal(mockMediaElement.volume, 0.8);

  // Fade: linear reduction over duration, pauses at end, restores target volume
  let tickCount = 0;
  let lastVol = 0.8;
  const fadePromise = engine.fade({
    durationMs: 300,
    stepIntervalMs: 50,
    onStep: (v) => {
      tickCount++;
      assert.ok(v <= lastVol, 'Volume strictly decreases during fade');
      lastVol = v;
    },
  });

  await fadePromise;
  assert.equal(isPlaying, false, 'Fade automatically pauses playback at zero volume');
  assert.equal(engine.getBaseVolume(), 0.8, 'Base volume setting is preserved');

  // Fade Cancellation: pausing or track switch mid-fade cancels attenuation and restores base volume
  await engine.play();
  assert.equal(isPlaying, true);
  mockMediaElement.volume = 0.8;

  let cancelled = false;
  engine.fade({
    durationMs: 1000,
    stepIntervalMs: 50,
    onStep: () => {},
  }).catch(() => {
    cancelled = true;
  });

  // Cancel immediately
  engine.cancelFade();
  assert.equal(mockMediaElement.volume, 0.8, 'Base volume restored upon fade cancellation');

  // Play rejection safety: should catch error and return safe result without throwing
  playReject = true;
  const playResult = await engine.play();
  assert.equal(playResult.success, false, 'play() rejection surfaces failure cleanly');
  assert.ok(playResult.error?.includes('NotAllowedError'), 'Surfaces error reason');
});
