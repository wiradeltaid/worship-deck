/**
 * Multi-Screen Display Target Resolver & Intent Persistence (SPEC-99).
 *
 * Implements intelligent display selection, Web Platform Window Management
 * integration, and adaptive window mode fallback to eliminate single-screen
 * operator lockout and ensure reliable projector window placement.
 *
 * Architectural Boundary (AD-29):
 * Display target selection and screenschange topology events affect window
 * placement metrics only. They MUST NOT mutate or synthesize AD-29 projector
 * heartbeat liveness verdicts (active/lost/never-opened).
 */

export type DisplayMode = 'fullscreen' | 'window';
export type TargetPreference =
  | 'specific-display'
  | 'external-display'
  | 'primary-display'
  | 'window-mode';

export interface ScreenInfo {
  id: string; // Deterministic fingerprint: `${label}_${availLeft}_${availTop}_${availWidth}x${availHeight}`
  label: string; // e.g. "Epson Projector", "HDMI Monitor", or "Display (1920x1080)"
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  isPrimary: boolean;
  isInternal?: boolean;
}

export interface DisplayTargetConfig {
  targetPreference: TargetPreference;
  mode: DisplayMode;
  rememberedScreenId?: string;
  rememberOnDevice: boolean;
}

export interface ResolvedLaunchTarget {
  mode: DisplayMode;
  targetScreen?: ScreenInfo;
  fallbackReason?:
    | 'single-display-safe-fallback'
    | 'unsupported-api'
    | 'user-window-preference'
    | 'specific-screen-missing';
  windowFeatures: string;
}

export const DISPLAY_TARGET_STORAGE_KEY = 'worship-deck:display-target-preference';

export const DEFAULT_DISPLAY_TARGET_CONFIG: DisplayTargetConfig = {
  targetPreference: 'external-display',
  mode: 'fullscreen',
  rememberOnDevice: true,
};

export const DEFAULT_WINDOW_FEATURES = 'popup=1,width=1280,height=720,left=120,top=120';

/**
 * Creates a stable, deterministic fingerprint identifier for a display.
 */
export function createScreenFingerprint(screen: Partial<ScreenInfo>): string {
  const label = screen.label && screen.label.trim() ? screen.label.trim() : 'Display';
  const left = typeof screen.availLeft === 'number' ? screen.availLeft : 0;
  const top = typeof screen.availTop === 'number' ? screen.availTop : 0;
  const width = typeof screen.availWidth === 'number' ? screen.availWidth : 1920;
  const height = typeof screen.availHeight === 'number' ? screen.availHeight : 1080;
  return `${label}_${left}_${top}_${width}x${height}`;
}

/**
 * Resolves the concrete display target, mode, and window features from user intent
 * and currently connected display topology.
 */
export function resolveLaunchTarget(
  config: DisplayTargetConfig,
  screens: ScreenInfo[]
): ResolvedLaunchTarget {
  const effectiveScreens = Array.isArray(screens) && screens.length > 0 ? screens : [];

  // Fallback if no screens detectable at all
  if (effectiveScreens.length === 0) {
    return {
      mode: 'window',
      fallbackReason: 'unsupported-api',
      windowFeatures: DEFAULT_WINDOW_FEATURES,
    };
  }

  const primaryScreen = effectiveScreens.find((s) => s.isPrimary) || effectiveScreens[0];
  const externalScreens = effectiveScreens.filter((s) => !s.isPrimary);
  const hasExternalDisplay = externalScreens.length > 0;

  // 1. Explicit window mode
  if (config.targetPreference === 'window-mode' || config.mode === 'window') {
    return {
      mode: 'window',
      targetScreen: primaryScreen,
      fallbackReason: 'user-window-preference',
      windowFeatures: DEFAULT_WINDOW_FEATURES,
    };
  }

  // 2. Explicit primary display
  if (config.targetPreference === 'primary-display') {
    if (config.mode === 'fullscreen') {
      return {
        mode: 'fullscreen',
        targetScreen: primaryScreen,
        windowFeatures: `popup=1,left=${primaryScreen.availLeft},top=${primaryScreen.availTop},width=${primaryScreen.availWidth},height=${primaryScreen.availHeight}`,
      };
    }
    return {
      mode: 'window',
      targetScreen: primaryScreen,
      windowFeatures: DEFAULT_WINDOW_FEATURES,
    };
  }

  // 3. Specific display preference
  if (config.targetPreference === 'specific-display') {
    if (config.rememberedScreenId) {
      const matched = effectiveScreens.find((s) => s.id === config.rememberedScreenId);
      if (matched) {
        if (matched.isPrimary && config.mode === 'fullscreen' && !hasExternalDisplay) {
          // If only 1 screen exists, never fullscreen on primary
          return {
            mode: 'window',
            targetScreen: matched,
            fallbackReason: 'single-display-safe-fallback',
            windowFeatures: DEFAULT_WINDOW_FEATURES,
          };
        }
        return {
          mode: config.mode,
          targetScreen: matched,
          windowFeatures:
            config.mode === 'fullscreen'
              ? `popup=1,left=${matched.availLeft},top=${matched.availTop},width=${matched.availWidth},height=${matched.availHeight}`
              : DEFAULT_WINDOW_FEATURES,
        };
      }
    }

    // Specific screen not connected: try other external display
    if (hasExternalDisplay) {
      const fallbackExternal = externalScreens[0];
      return {
        mode: config.mode,
        targetScreen: fallbackExternal,
        fallbackReason: 'specific-screen-missing',
        windowFeatures:
          config.mode === 'fullscreen'
            ? `popup=1,left=${fallbackExternal.availLeft},top=${fallbackExternal.availTop},width=${fallbackExternal.availWidth},height=${fallbackExternal.availHeight}`
            : DEFAULT_WINDOW_FEATURES,
      };
    }

    // No external display at all: safe window fallback to prevent lockout
    return {
      mode: 'window',
      targetScreen: primaryScreen,
      fallbackReason: 'single-display-safe-fallback',
      windowFeatures: DEFAULT_WINDOW_FEATURES,
    };
  }

  // 4. Default / 'external-display' preference
  if (hasExternalDisplay) {
    const targetExternal = externalScreens[0];
    return {
      mode: 'fullscreen',
      targetScreen: targetExternal,
      windowFeatures: `popup=1,left=${targetExternal.availLeft},top=${targetExternal.availTop},width=${targetExternal.availWidth},height=${targetExternal.availHeight}`,
    };
  }

  // Single display detected: automatically fall back to window mode
  return {
    mode: 'window',
    targetScreen: primaryScreen,
    fallbackReason: 'single-display-safe-fallback',
    windowFeatures: DEFAULT_WINDOW_FEATURES,
  };
}

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage;
  }
  return null;
}

/**
 * Loads stored display target preference from localStorage.
 */
export function getDisplayTargetConfig(): DisplayTargetConfig {
  const storage = getStorage();
  if (!storage) {
    return { ...DEFAULT_DISPLAY_TARGET_CONFIG };
  }
  try {
    const raw = storage.getItem(DISPLAY_TARGET_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DISPLAY_TARGET_CONFIG };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_DISPLAY_TARGET_CONFIG };
    }
    return {
      targetPreference: parsed.targetPreference || DEFAULT_DISPLAY_TARGET_CONFIG.targetPreference,
      mode: parsed.mode || DEFAULT_DISPLAY_TARGET_CONFIG.mode,
      rememberedScreenId: parsed.rememberedScreenId,
      rememberOnDevice:
        typeof parsed.rememberOnDevice === 'boolean'
          ? parsed.rememberOnDevice
          : DEFAULT_DISPLAY_TARGET_CONFIG.rememberOnDevice,
    };
  } catch {
    return { ...DEFAULT_DISPLAY_TARGET_CONFIG };
  }
}

/**
 * Persists display target configuration if rememberOnDevice is true.
 */
export function saveDisplayTargetConfig(config: DisplayTargetConfig): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  if (!config.rememberOnDevice) {
    return;
  }
  try {
    storage.setItem(DISPLAY_TARGET_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Queries the browser Window Management API or falls back to standard window.screen.
 */
export async function detectAvailableScreens(): Promise<ScreenInfo[]> {
  if (typeof window === 'undefined') {
    return [];
  }

  // Chromium Window Management API
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const win = window as any;

  if (typeof win.getScreenDetails === 'function') {
    try {
      // Check permission state if available
      if (nav && (nav as any).permissions && typeof (nav as any).permissions.query === 'function') {
        const status = await (nav as any).permissions.query({ name: 'window-management' as any }).catch(() => null);
        if (status && status.state === 'denied') {
          // Fallback to standard screen
          return fallbackToSingleScreen();
        }
      }

      const screenDetails = await win.getScreenDetails();
      if (screenDetails && Array.isArray(screenDetails.screens) && screenDetails.screens.length > 0) {
        return screenDetails.screens.map((s: any, idx: number) => {
          const availLeft = typeof s.availLeft === 'number' ? s.availLeft : (typeof s.left === 'number' ? s.left : 0);
          const availTop = typeof s.availTop === 'number' ? s.availTop : (typeof s.top === 'number' ? s.top : 0);
          const availWidth = typeof s.availWidth === 'number' ? s.availWidth : (typeof s.width === 'number' ? s.width : 1920);
          const availHeight = typeof s.availHeight === 'number' ? s.availHeight : (typeof s.height === 'number' ? s.height : 1080);
          const label = s.label && s.label.trim() ? s.label.trim() : `Display ${idx + 1} (${availWidth}x${availHeight})`;

          return {
            id: createScreenFingerprint({ label, availLeft, availTop, availWidth, availHeight }),
            label,
            availLeft,
            availTop,
            availWidth,
            availHeight,
            isPrimary: Boolean(s.isPrimary),
            isInternal: Boolean(s.isInternal),
          };
        });
      }
    } catch {
      // Permission denied or API threw: gracefully fallback
    }
  }

  return fallbackToSingleScreen();
}

function fallbackToSingleScreen(): ScreenInfo[] {
  if (typeof window === 'undefined' || !window.screen) {
    return [
      {
        id: 'primary',
        label: 'Current Display',
        availLeft: 0,
        availTop: 0,
        availWidth: 1920,
        availHeight: 1080,
        isPrimary: true,
      },
    ];
  }

  const s = window.screen as any;
  const availLeft = typeof s.availLeft === 'number' ? s.availLeft : 0;
  const availTop = typeof s.availTop === 'number' ? s.availTop : 0;
  const availWidth = typeof s.availWidth === 'number' ? s.availWidth : 1920;
  const availHeight = typeof s.availHeight === 'number' ? s.availHeight : 1080;

  return [
    {
      id: createScreenFingerprint({ label: 'Current Display', availLeft, availTop, availWidth, availHeight }),
      label: 'Current Display',
      availLeft,
      availTop,
      availWidth,
      availHeight,
      isPrimary: true,
    },
  ];
}

/**
 * Subscribes to topology changes (screens connected / disconnected).
 */
export function subscribeScreenTopology(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const win = window as any;

  let activeCleanup = () => {};

  if (typeof win.getScreenDetails === 'function') {
    win.getScreenDetails().then((details: any) => {
      if (details && typeof details.addEventListener === 'function') {
        const handler = () => callback();
        details.addEventListener('screenschange', handler);
        activeCleanup = () => {
          try {
            details.removeEventListener('screenschange', handler);
          } catch {}
        };
      }
    }).catch(() => {});
  }

  return () => {
    activeCleanup();
  };
}
