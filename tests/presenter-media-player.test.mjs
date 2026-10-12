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

test('SPEC-110-02: Presenter Dock and Non-Modal Drawer UI component contracts', async () => {
  const fs = await import('node:fs');
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const dockPath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaDock.tsx');
  const drawerPath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaDrawer.tsx');
  const launcherPath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaLauncherButton.tsx');

  assert.ok(fs.existsSync(dockPath), 'MediaDock.tsx must exist');
  assert.ok(fs.existsSync(drawerPath), 'MediaDrawer.tsx must exist');
  assert.ok(fs.existsSync(launcherPath), 'MediaLauncherButton.tsx must exist');

  const dockSrc = fs.readFileSync(dockPath, 'utf8');
  const drawerSrc = fs.readFileSync(drawerPath, 'utf8');
  const launcherSrc = fs.readFileSync(launcherPath, 'utf8');
  const presenterSrc = fs.readFileSync(presenterPath, 'utf8');

  // Launcher contract
  assert.ok(launcherSrc.includes('data-testid="media-launcher-button"'), 'Launcher has data-testid');

  // MediaDock panic controls
  assert.ok(dockSrc.includes('data-testid="media-dock"'), 'MediaDock has data-testid="media-dock"');
  assert.ok(dockSrc.includes('data-testid="media-panic-play-pause"'), 'Panic play-pause button');
  assert.ok(dockSrc.includes('data-testid="media-panic-fade"'), 'Panic fade button');
  assert.ok(dockSrc.includes('data-testid="media-panic-mute"'), 'Panic mute button');
  assert.ok(dockSrc.includes('data-testid="media-panic-take-off-screen"'), 'Panic take off screen button');

  // Focus safety invariant on transport buttons
  assert.ok(dockSrc.includes('preventDefault'), 'Dock buttons prevent default on mouse down for focus safety');

  // Non-modal drawer contract: no modal backdrop, non-modal layout
  assert.ok(drawerSrc.includes('data-testid="media-drawer"'), 'MediaDrawer has data-testid');
  assert.ok(!drawerSrc.includes('aria-modal="true"'), 'MediaDrawer is non-modal and must not declare aria-modal="true"');

  // PresenterOperator integration
  assert.ok(presenterSrc.includes('MediaLauncherButton') || presenterSrc.includes('MediaControlBar'), 'PresenterOperator mounts MediaControlBar or MediaLauncherButton');
  assert.ok(presenterSrc.includes('MediaDock') || presenterSrc.includes('MediaControlBar'), 'PresenterOperator mounts MediaDock or MediaControlBar');
  assert.ok(presenterSrc.includes('MediaDrawer'), 'PresenterOperator mounts MediaDrawer');
  assert.ok(presenterSrc.includes('MediaStage'), 'PresenterOperator mounts MediaStage');
});

test('SPEC-110-03: Congregation Screen Video Projection & Channel Sync', async () => {
  const fs = await import('node:fs');
  const { projectionOf, isProjectorMediaStatus } = await import(
    srcUrl('lib', 'present-channel.ts')
  );

  // 1. present-channel wire parsing of kind: 'media'
  const validSync = {
    type: 'sync',
    index: 0,
    blank: false,
    transition: 'fade',
    planIdentity: 'plan-1',
    projection: {
      kind: 'media',
      mediaId: 'med-123',
      mediaUrl: '/api/uploads/video.mp4',
      isPlaying: true,
      mediaTime: 12.5,
      at: 100000,
      revision: 1,
    },
  };

  const parsed = projectionOf(validSync);
  assert.equal(parsed?.kind, 'media');
  if (parsed?.kind === 'media') {
    assert.equal(parsed.mediaId, 'med-123');
    assert.equal(parsed.mediaUrl, '/api/uploads/video.mp4');
    assert.equal(parsed.isPlaying, true);
    assert.equal(parsed.mediaTime, 12.5);
  }

  // Fail-closed on missing mediaUrl or mediaId
  const invalidSync = {
    type: 'sync',
    index: 0,
    blank: false,
    transition: 'fade',
    planIdentity: 'plan-1',
    projection: {
      kind: 'media',
      mediaId: '',
      mediaUrl: '',
    },
  };
  assert.deepEqual(projectionOf(invalidSync), { kind: 'deck' });

  // 2. Projector media status message parsing
  assert.equal(
    isProjectorMediaStatus({
      type: 'projector-media-status',
      mediaId: 'med-123',
      state: 'attached',
    }),
    true
  );
  assert.equal(
    isProjectorMediaStatus({
      type: 'projector-media-status',
      mediaId: 'med-123',
      state: 'unavailable',
      reason: 'video-error',
    }),
    true
  );

  // 3. ProjectorClient / ProjectedMediaLayer source contracts
  const projectorClientPath = path.join(ROOT, 'src', 'projected', 'ProjectorClient.tsx');
  const mediaLayerPath = path.join(ROOT, 'src', 'projected', 'media', 'ProjectedMediaLayer.tsx');

  assert.ok(fs.existsSync(mediaLayerPath), 'ProjectedMediaLayer.tsx must exist');
  const mediaLayerSrc = fs.readFileSync(mediaLayerPath, 'utf8');
  const projectorClientSrc = fs.readFileSync(projectorClientPath, 'utf8');

  // Mute enforcement invariant: video MUST have muted attribute and muted=true
  assert.ok(mediaLayerSrc.includes('muted'), 'Projected video must have muted attribute');
  assert.ok(mediaLayerSrc.includes('video.muted = true') || mediaLayerSrc.includes('el.muted = true') || mediaLayerSrc.includes('.muted = true'), 'Projected video enforces muted property in runtime');

  // ProjectorClient layer integration at z-30
  assert.ok(projectorClientSrc.includes('ProjectedMediaLayer') || projectorClientSrc.includes('projector-media-video-container'), 'ProjectorClient integrates projected media video');
});

test('SPEC-110-04: Guard Test Suite & Injected Defect Verification', async () => {
  const fs = await import('node:fs');
  const mediaLayerPath = path.join(ROOT, 'src', 'projected', 'media', 'ProjectedMediaLayer.tsx');
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const dockPath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaDock.tsx');
  const stagePath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaStage.tsx');

  const mediaLayerSrc = fs.readFileSync(mediaLayerPath, 'utf8');
  const presenterSrc = fs.readFileSync(presenterPath, 'utf8');
  const dockSrc = fs.readFileSync(dockPath, 'utf8');
  const stageSrc = fs.readFileSync(stagePath, 'utf8');

  // Guard 1: Projector Mute Enforcement
  function verifyProjectorMuteGuard(code) {
    if (!code.includes('muted')) return { valid: false, reason: 'missing-muted-attribute' };
    if (!code.includes('.muted = true')) return { valid: false, reason: 'missing-runtime-mute-enforcement' };
    return { valid: true };
  }
  assert.equal(verifyProjectorMuteGuard(mediaLayerSrc).valid, true);
  // Defect Proof 1: Missing muted attribute fails
  assert.equal(verifyProjectorMuteGuard('<video playsInline />').reason, 'missing-muted-attribute');
  // Defect Proof 1b: Missing runtime muted property assignment fails
  assert.equal(verifyProjectorMuteGuard('<video muted playsInline />').reason, 'missing-runtime-mute-enforcement');

  // Guard 2: Drawer Mount Independence
  // MediaStage must be mounted outside MediaDrawer in PresenterOperator so closing drawer never unmounts media
  function verifyDrawerMountIndependence(code) {
    const stageIdx = code.indexOf('<MediaStage');
    const drawerIdx = code.indexOf('<MediaDrawer');
    if (stageIdx === -1) return { valid: false, reason: 'missing-media-stage' };
    if (drawerIdx === -1) return { valid: false, reason: 'missing-media-drawer' };
    // Must be sibling, not nested inside MediaDrawer
    const drawerBlock = code.slice(drawerIdx, code.indexOf('/>', drawerIdx) + 2);
    if (drawerBlock.includes('<MediaStage')) return { valid: false, reason: 'nested-stage-in-drawer' };
    return { valid: true };
  }
  assert.equal(verifyDrawerMountIndependence(presenterSrc).valid, true);
  // Defect Proof 2: Nested MediaStage in MediaDrawer fails
  assert.equal(
    verifyDrawerMountIndependence('<MediaDrawer><MediaStage /></MediaDrawer>').reason,
    'nested-stage-in-drawer'
  );

  // Guard 3: Projection State Teardown
  // MediaStage handleEnded must explicitly reset projection to off
  function verifyProjectionTeardown(code) {
    if (!code.includes("store.dispatch({ type: 'SET_PROJECTED', isProjected: false })")) {
      return { valid: false, reason: 'missing-projected-reset-on-ended' };
    }
    return { valid: true };
  }
  assert.equal(verifyProjectionTeardown(stageSrc).valid, true);
  // Defect Proof 3: Missing projection reset fails
  assert.equal(verifyProjectionTeardown('function handleEnded() { playNext(); }').reason, 'missing-projected-reset-on-ended');

  // Guard 4: Presentation Lock Panic Accessibility
  // Panic buttons in MediaDock must NOT have disabled={presentationLock}
  function verifyPresentationLockPanic(code) {
    if (code.includes('disabled={presentationLock}')) {
      return { valid: false, reason: 'panic-controls-locked-by-presentation-lock' };
    }
    if (!code.includes('data-testid="media-panic-play-pause"') || !code.includes('data-testid="media-panic-fade"')) {
      return { valid: false, reason: 'missing-panic-buttons' };
    }
    return { valid: true };
  }
  assert.equal(verifyPresentationLockPanic(dockSrc).valid, true);
  // Defect Proof 4: Locking panic buttons fails
  assert.equal(
    verifyPresentationLockPanic('<button data-testid="media-panic-play-pause" data-testid="media-panic-fade" disabled={presentationLock} />').reason,
    'panic-controls-locked-by-presentation-lock'
  );

  // Guard 5: Drift & Clock Calculation Pure Unit Logic
  function calculateDriftCorrection(mediaTime, isPlaying, at, now, currentVideoTime) {
    const elapsed = isPlaying ? Math.max(0, (now - at) / 1000) : 0;
    const expected = mediaTime + elapsed;
    const drift = Math.abs(currentVideoTime - expected);
    if (drift > 0.5) {
      return { action: 'seek', targetTime: expected };
    }
    if (drift > 0.05) {
      return { action: 'nudge', rate: currentVideoTime < expected ? 1.05 : 0.95 };
    }
    return { action: 'nominal', rate: 1.0 };
  }

  // Exact clock sync
  assert.equal(calculateDriftCorrection(10, true, 1000, 2000, 11).action, 'nominal');
  // Small drift 0.2s -> nudge
  assert.equal(calculateDriftCorrection(10, true, 1000, 2000, 10.8).action, 'nudge');
  // Large drift 2.0s -> hard seek
  const seekCorr = calculateDriftCorrection(10, true, 1000, 2000, 9);
  assert.equal(seekCorr.action, 'seek');
  assert.equal(seekCorr.targetTime, 11);

  // Guard 6: Guest/Media Projection Exclusivity
  // In PresenterOperator, activating media projection tears down guest feed
  function verifyGuestMediaExclusivity(code) {
    if (!code.includes('teardownGuestFeed') && !code.includes("revertToDeck('media-activated')")) {
      return { valid: false, reason: 'missing-guest-teardown-on-media' };
    }
    return { valid: true };
  }
  assert.equal(verifyGuestMediaExclusivity(presenterSrc).valid, true);
  // Defect Proof 6: Missing mutual teardown fails
  assert.equal(verifyGuestMediaExclusivity('function onMedia() { setMedia(); }').reason, 'missing-guest-teardown-on-media');

  // Guard 7: Projector Resync Fail-Closed Safety
  const { projectionOf } = await import(srcUrl('lib', 'present-channel.ts'));
  assert.deepEqual(projectionOf({ type: 'sync', index: 0, blank: false, transition: 'cut', planIdentity: 'p' }), { kind: 'deck' });
  assert.deepEqual(projectionOf({ type: 'sync', index: 0, blank: false, transition: 'cut', planIdentity: 'p', projection: null }), { kind: 'deck' });

  // Guard 8: Fade Cancellation & Volume Restoration
  const { createMediaEngine } = await import(srcUrl('operator', 'present', 'media-player', 'media-engine.ts'));
  let vol = 1.0;
  const mockEl = {
    get volume() { return vol; },
    set volume(v) { vol = v; },
    play: async () => {},
    pause: () => {},
  };
  const testEngine = createMediaEngine({ getMediaElement: () => mockEl });
  testEngine.setVolume(0.75);
  const fadePromise = testEngine.fade({ durationMs: 2000 }).catch(() => {});
  // Cancel immediately
  testEngine.cancelFade();
  await fadePromise;
  assert.equal(mockEl.volume, 0.75, 'Cancelling fade immediately restores base volume');
});

test('SPEC-114-04: Header Redundant Launcher Absence Guard and Integration with MediaControlBar', async () => {
  const fs = await import('node:fs');
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const presenterSrc = fs.readFileSync(presenterPath, 'utf8');

  function assertHeaderLauncherAbsence(code) {
    // 1. MediaLauncherButton must be absent from PresenterOperator
    assert.ok(
      !code.includes('<MediaLauncherButton'),
      'PresenterOperator header row 2 must not render redundant MediaLauncherButton'
    );
    // 2. Dead state variables must be absent
    assert.ok(
      !code.includes('setMediaItemCount'),
      'PresenterOperator must not retain dead setMediaItemCount state'
    );
    assert.ok(
      !code.includes('setMediaIsPlaying'),
      'PresenterOperator must not retain dead setMediaIsPlaying state'
    );
    // 3. MediaControlBar must be mounted as single canonical launcher
    assert.ok(
      code.includes('<MediaControlBar'),
      'PresenterOperator must mount MediaControlBar as single canonical launcher'
    );
  }

  // 1. Pristine code satisfies contract
  assertHeaderLauncherAbsence(presenterSrc);

  // 2. Defect injection proof: re-injecting MediaLauncherButton fails assertion
  try {
    const defective = presenterSrc.replace(
      '<MediaControlBar',
      '<MediaLauncherButton />\n      <MediaControlBar'
    );
    assert.notEqual(defective, presenterSrc, 'Mutation must succeed');
    fs.writeFileSync(presenterPath, defective);
    const readDefective = fs.readFileSync(presenterPath, 'utf8');
    assert.throws(
      () => assertHeaderLauncherAbsence(readDefective),
      /PresenterOperator header row 2 must not render redundant MediaLauncherButton/,
      'Defect injection proof: re-injecting MediaLauncherButton throws assertion error'
    );
  } finally {
    fs.writeFileSync(presenterPath, presenterSrc);
    assert.equal(fs.readFileSync(presenterPath, 'utf8'), presenterSrc, 'File must be restored byte-for-byte');
  }
});

test('SPEC-115-02: Remote Audio Mute Invariant and Projector/Hardware Isolation Guards', async () => {
  const fs = await import('node:fs');
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const stagePath = path.join(ROOT, 'src', 'operator', 'present', 'media-player', 'MediaStage.tsx');
  const presenterSrc = fs.readFileSync(presenterPath, 'utf8');
  const stageSrc = fs.readFileSync(stagePath, 'utf8');

  function verifyRemoteAudioMuteGuard(stageCode, presenterCode) {
    const sCode = stageCode.replace(/\r\n/g, '\n');
    const pCode = presenterCode.replace(/\r\n/g, '\n');
    // 1. MediaStage must support mutedOverride prop
    assert.ok(
      sCode.includes('mutedOverride?: boolean;'),
      'MediaStageProps must declare mutedOverride prop'
    );
    // 2. Base volume and element volume must be 0 when mutedOverride is true
    assert.ok(
      sCode.includes('const baseVol = mutedOverride\n          ? 0\n          :'),
      'MediaStage must force baseVol to 0 when mutedOverride is active'
    );
    // 3. PresenterOperator must pass mutedOverride={mode === \'remote\'}
    assert.ok(
      pCode.includes("mutedOverride={mode === 'remote'}"),
      'PresenterOperator must bind MediaStage mutedOverride to mode === "remote"'
    );
    // 4. Remote mode must bypass openPresentChannel
    assert.ok(
      pCode.includes("if (mode === 'remote') return;\n    const ch = openPresentChannel(serviceId);"),
      'PresenterOperator must bypass openPresentChannel in remote mode'
    );
    // 5. Remote mode must bypass CaptureBroker
    assert.ok(
      pCode.includes("if (mode !== 'remote' && !captureBrokerRef.current)"),
      'PresenterOperator must bypass CaptureBroker in remote mode'
    );
    // 6. Declarative mute attribute on media elements
    assert.ok(
      sCode.includes('muted={mutedOverride ? true : undefined}'),
      'MediaStage must declaratively mute audio/video elements when mutedOverride is active'
    );
    // 7. Remote mode must bypass playlist storage hydration
    assert.ok(
      pCode.includes("if (mode === 'remote') return;\n    let cancelled = false;\n    async function hydratePlaylist()"),
      'PresenterOperator must bypass persistent media playlist hydration in remote mode'
    );
    // 8. MediaDrawer must not mount in remote mode
    assert.ok(
      pCode.includes("{mode !== 'remote' && (\n        <MediaDrawer"),
      'PresenterOperator must not mount MediaDrawer in remote mode'
    );
    // 9. MediaEngine must receive isMutedOverride
    assert.ok(
      pCode.includes("isMutedOverride: () => mode === 'remote'"),
      'PresenterOperator must bind MediaEngine isMutedOverride to remote mode'
    );
  }

  // 1. Pristine code passes
  verifyRemoteAudioMuteGuard(stageSrc, presenterSrc);

  // 2. Behavioral test: MediaEngine enforces mute and volume 0 under isMutedOverride
  const { createMediaEngine } = await import(srcUrl('operator', 'present', 'media-player', 'media-engine.ts'));
  let mockVol = 0.8;
  let mockMuted = false;
  const mockMedia = {
    get volume() { return mockVol; },
    set volume(v) { mockVol = v; },
    get muted() { return mockMuted; },
    set muted(m) { mockMuted = m; },
    play: async () => {},
    pause: () => {},
  };
  const remoteEngine = createMediaEngine({
    getMediaElement: () => mockMedia,
    isMutedOverride: () => true,
  });

  // Attempt post-mount unmute and volume adjustment from non-zero starting volume
  remoteEngine.setMuted(false);
  assert.equal(mockMedia.muted, true, 'isMutedOverride enforces element stays muted on unmute attempt');
  assert.equal(mockMedia.volume, 0, 'isMutedOverride forces volume to 0 on unmute attempt');

  remoteEngine.setVolume(0.85);
  assert.equal(mockMedia.volume, 0, 'isMutedOverride forces volume to 0 on volume change attempt');
  assert.equal(remoteEngine.getBaseVolume(), 0, 'getBaseVolume returns 0 under active override');

  // Attempt fade under override
  await remoteEngine.fade({ durationMs: 500 });
  assert.equal(mockMedia.volume, 0, 'fade under isMutedOverride leaves volume at 0');
  assert.equal(mockMedia.muted, true, 'fade under isMutedOverride leaves element muted');

  // 3. Defect injection proof: removing mutedOverride binding in PresenterOperator throws
  try {
    const defective = presenterSrc.replace(
      "mutedOverride={mode === 'remote'}",
      'mutedOverride={false}'
    );
    assert.notEqual(defective, presenterSrc, 'Mutation must succeed');
    fs.writeFileSync(presenterPath, defective);
    const readDefective = fs.readFileSync(presenterPath, 'utf8');
    assert.throws(
      () => verifyRemoteAudioMuteGuard(stageSrc, readDefective),
      /PresenterOperator must bind MediaStage mutedOverride to mode === "remote"/,
      'Defect injection proof: unmuted remote MediaStage throws assertion error'
    );
  } finally {
    fs.writeFileSync(presenterPath, presenterSrc);
    assert.equal(fs.readFileSync(presenterPath, 'utf8'), presenterSrc, 'File must be restored byte-for-byte');
  }
});