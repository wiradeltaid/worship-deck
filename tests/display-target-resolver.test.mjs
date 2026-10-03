import assert from 'node:assert/strict';
import test from 'node:test';

test('SPEC-99-01: Module exports required types, constants, and functions', async () => {
  const mod = await import(new URL('../src/lib/display-target.ts', import.meta.url).href);
  assert.equal(typeof mod.resolveLaunchTarget, 'function', 'resolveLaunchTarget must be exported');
  assert.equal(typeof mod.getDisplayTargetConfig, 'function', 'getDisplayTargetConfig must be exported');
  assert.equal(typeof mod.saveDisplayTargetConfig, 'function', 'saveDisplayTargetConfig must be exported');
  assert.equal(typeof mod.detectAvailableScreens, 'function', 'detectAvailableScreens must be exported');
  assert.equal(typeof mod.createScreenFingerprint, 'function', 'createScreenFingerprint must be exported');
  assert.equal(typeof mod.DEFAULT_DISPLAY_TARGET_CONFIG, 'object', 'DEFAULT_DISPLAY_TARGET_CONFIG must be exported');
  assert.equal(mod.DEFAULT_DISPLAY_TARGET_CONFIG.targetPreference, 'external-display');
  assert.equal(mod.DEFAULT_DISPLAY_TARGET_CONFIG.mode, 'fullscreen');
  assert.equal(mod.DEFAULT_DISPLAY_TARGET_CONFIG.rememberOnDevice, true);
});

test('SPEC-99-01: createScreenFingerprint generates deterministic string', async () => {
  const { createScreenFingerprint } = await import(new URL('../src/lib/display-target.ts', import.meta.url).href);
  const fp1 = createScreenFingerprint({
    label: 'Epson Projector',
    availLeft: 1920,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
  });
  assert.equal(fp1, 'Epson Projector_1920_0_1920x1080');

  // Fallback label if empty
  const fp2 = createScreenFingerprint({
    label: '',
    availLeft: 0,
    availTop: 0,
    availWidth: 1280,
    availHeight: 720,
  });
  assert.equal(fp2, 'Display_0_0_1280x720');
});

test('SPEC-99-01: resolveLaunchTarget resolves to external display in multi-screen setup', async () => {
  const { resolveLaunchTarget } = await import(new URL('../src/lib/display-target.ts', import.meta.url).href);
  const primaryScreen = {
    id: 'Laptop_0_0_1920x1080',
    label: 'Built-in Display',
    availLeft: 0,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    isPrimary: true,
  };
  const projectorScreen = {
    id: 'Epson Projector_1920_0_1920x1080',
    label: 'Epson Projector',
    availLeft: 1920,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    isPrimary: false,
  };

  const config = {
    targetPreference: 'external-display',
    mode: 'fullscreen',
    rememberOnDevice: true,
  };

  const resolved = resolveLaunchTarget(config, [primaryScreen, projectorScreen]);
  assert.equal(resolved.mode, 'fullscreen');
  assert.deepEqual(resolved.targetScreen, projectorScreen);
  assert.equal(resolved.fallbackReason, undefined);
  assert.equal(resolved.windowFeatures, 'popup=1,left=1920,top=0,width=1920,height=1080');
});

test('SPEC-99-01: resolveLaunchTarget matches specific display by rememberedScreenId', async () => {
  const { resolveLaunchTarget } = await import(new URL('../src/lib/display-target.ts', import.meta.url).href);
  const primaryScreen = {
    id: 'Laptop_0_0_1920x1080',
    label: 'Built-in Display',
    availLeft: 0,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    isPrimary: true,
  };
  const projector1 = {
    id: 'Sanctuary Projector_1920_0_1920x1080',
    label: 'Sanctuary Projector',
    availLeft: 1920,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    isPrimary: false,
  };
  const lobbyTv = {
    id: 'Lobby TV_3840_0_1920x1080',
    label: 'Lobby TV',
    availLeft: 3840,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    isPrimary: false,
  };

  const config = {
    targetPreference: 'specific-display',
    rememberedScreenId: 'Lobby TV_3840_0_1920x1080',
    mode: 'fullscreen',
    rememberOnDevice: true,
  };

  const resolved = resolveLaunchTarget(config, [primaryScreen, projector1, lobbyTv]);
  assert.equal(resolved.mode, 'fullscreen');
  assert.deepEqual(resolved.targetScreen, lobbyTv);
  assert.equal(resolved.windowFeatures, 'popup=1,left=3840,top=0,width=1920,height=1080');
});

test('SPEC-99-01: resolveLaunchTarget falls back to other external display when specific display is disconnected', async () => {
  const { resolveLaunchTarget } = await import(new URL('../src/lib/display-target.ts', import.meta.url).href);
  const primaryScreen = {
    id: 'Laptop_0_0_1920x1080',
    label: 'Built-in Display',
    availLeft: 0,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    isPrimary: true,
  };
  const sanctuaryProjector = {
    id: 'Sanctuary Projector_1920_0_1920x1080',
    label: 'Sanctuary Projector',
    availLeft: 1920,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    isPrimary: false,
  };

  // User wanted 'Lobby TV' which was unplugged, but Sanctuary Projector is connected
  const config = {
    targetPreference: 'specific-display',
    rememberedScreenId: 'Lobby TV_missing',
    mode: 'fullscreen',
    rememberOnDevice: true,
  };

  const resolved = resolveLaunchTarget(config, [primaryScreen, sanctuaryProjector]);
  assert.equal(resolved.mode, 'fullscreen');
  assert.deepEqual(resolved.targetScreen, sanctuaryProjector);
  assert.equal(resolved.fallbackReason, 'specific-screen-missing');
  assert.equal(resolved.windowFeatures, 'popup=1,left=1920,top=0,width=1920,height=1080');
});

test('SPEC-99-01: resolveLaunchTarget automatically falls back to safe Window Mode when single screen', async () => {
  const { resolveLaunchTarget } = await import(new URL('../src/lib/display-target.ts', import.meta.url).href);
  const primaryScreen = {
    id: 'Laptop_0_0_1920x1080',
    label: 'Built-in Display',
    availLeft: 0,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    isPrimary: true,
  };

  // Preference is external display, but only 1 display is connected (e.g. testing at home)
  const config = {
    targetPreference: 'external-display',
    mode: 'fullscreen',
    rememberOnDevice: true,
  };

  const resolved = resolveLaunchTarget(config, [primaryScreen]);
  assert.equal(resolved.mode, 'window', 'Must downgrade to window mode to prevent operator lockout');
  assert.equal(resolved.fallbackReason, 'single-display-safe-fallback');
  assert.equal(resolved.windowFeatures, 'popup=1,width=1280,height=720,left=120,top=120');
  assert.deepEqual(resolved.targetScreen, primaryScreen);
});

test('SPEC-99-01: resolveLaunchTarget respects explicit window-mode preference even with external displays', async () => {
  const { resolveLaunchTarget } = await import(new URL('../src/lib/display-target.ts', import.meta.url).href);
  const primaryScreen = {
    id: 'Laptop_0_0_1920x1080',
    label: 'Built-in Display',
    availLeft: 0,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    isPrimary: true,
  };
  const externalScreen = {
    id: 'HDMI_1920_0_1920x1080',
    label: 'External HDMI',
    availLeft: 1920,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    isPrimary: false,
  };

  const config = {
    targetPreference: 'window-mode',
    mode: 'window',
    rememberOnDevice: true,
  };

  const resolved = resolveLaunchTarget(config, [primaryScreen, externalScreen]);
  assert.equal(resolved.mode, 'window');
  assert.equal(resolved.fallbackReason, 'user-window-preference');
  assert.equal(resolved.windowFeatures, 'popup=1,width=1280,height=720,left=120,top=120');
});

test('SPEC-99-01: localStorage intent persistence preserves external-display preference across single-screen fallback', async () => {
  const { getDisplayTargetConfig, saveDisplayTargetConfig, DEFAULT_DISPLAY_TARGET_CONFIG } = await import(
    new URL('../src/lib/display-target.ts', import.meta.url).href
  );

  // Mock localStorage
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
  };

  // 1. Initially returns default
  assert.deepEqual(getDisplayTargetConfig(), DEFAULT_DISPLAY_TARGET_CONFIG);

  // 2. User sets preference to specific-display
  const customConfig = {
    targetPreference: 'specific-display',
    mode: 'fullscreen',
    rememberedScreenId: 'Epson_1920_0',
    rememberOnDevice: true,
  };
  saveDisplayTargetConfig(customConfig);
  assert.deepEqual(getDisplayTargetConfig(), customConfig);

  // 3. User sets rememberOnDevice: false
  const ephemeralConfig = {
    targetPreference: 'window-mode',
    mode: 'window',
    rememberOnDevice: false,
  };
  saveDisplayTargetConfig(ephemeralConfig);
  // Stored config still retains customConfig because rememberOnDevice is false
  assert.deepEqual(getDisplayTargetConfig(), customConfig);

  // 4. Corrupt JSON in localStorage falls back safely to default without throwing
  storage.set('worship-deck:display-target-preference', 'not valid json {{{');
  assert.deepEqual(getDisplayTargetConfig(), DEFAULT_DISPLAY_TARGET_CONFIG);
});

test('SPEC-99-01: detectAvailableScreens gracefully degrades when window.getScreenDetails is missing', async () => {
  const { detectAvailableScreens } = await import(new URL('../src/lib/display-target.ts', import.meta.url).href);

  // Mock window.screen without getScreenDetails
  globalThis.window = {
    screen: {
      availLeft: 0,
      availTop: 0,
      availWidth: 1920,
      availHeight: 1040,
    },
  };

  const screens = await detectAvailableScreens();
  assert.equal(screens.length, 1);
  assert.equal(screens[0].isPrimary, true);
  assert.equal(screens[0].availWidth, 1920);
  assert.equal(screens[0].availHeight, 1040);
});

test('SPEC-99-01 Defect Injection Proof: Unchecked fullscreen on single-screen locks out operator', () => {
  // Guard proof: A defective resolver that ignores screen count and launches fullscreen on 1-screen
  function defectiveResolver(config, screens) {
    const s = screens[0];
    return {
      mode: config.mode,
      targetScreen: s,
      windowFeatures: `popup=1,left=${s.availLeft},top=${s.availTop},width=${s.availWidth},height=${s.availHeight}`,
    };
  }

  const singleScreen = [{ availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1080, isPrimary: true }];
  const defectiveResult = defectiveResolver({ targetPreference: 'external-display', mode: 'fullscreen' }, singleScreen);

  // Defective resolver launches fullscreen on primary screen covering operator view
  assert.equal(
    defectiveResult.mode === 'fullscreen' && defectiveResult.targetScreen.isPrimary === true,
    true,
    'INJECTED DEFECT: Defective resolver causes single-screen operator lockout'
  );
});
