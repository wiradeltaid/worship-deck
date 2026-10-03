# 01: Multi-Screen Display Target Resolver & Intent Persistence

**What to build:** In `<src/lib/display-target.ts>` and `tests/display-target-resolver.test.mjs`:

1. **Concrete Display Target Model & Type Definitions**:
   - Define canonical types for display target options and configuration:
     ```ts
     export type DisplayMode = 'fullscreen' | 'window';
     export type TargetPreference = 'specific-display' | 'external-display' | 'primary-display' | 'window-mode';

     export interface ScreenInfo {
       id: string; // Deterministic fingerprint: `${label}_${availLeft}_${availTop}_${availWidth}x${availHeight}`
       label: string; // e.g. "Epson Projector", "HDMI Monitor", or "Display 2 (1920x1080)"
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
       fallbackReason?: 'single-display-safe-fallback' | 'unsupported-api' | 'user-window-preference' | 'specific-screen-missing';
       windowFeatures: string;
     }
     ```

2. **Web Platform Screen Details Detection & Topology Awareness**:
   - Implement `detectAvailableScreens()`:
     - Check for `window.getScreenDetails()` in `window` (Chromium Window Management API).
     - Query `navigator.permissions.query({ name: 'window-management' as PermissionName })` safely.
     - When available and permitted, map `ScreenDetails.screens` into `ScreenInfo[]` using available geometry (`availLeft`, `availTop`, `availWidth`, `availHeight`).
     - When unavailable, denied, or throwing `NotAllowedError`, fallback to single screen representation using `window.screen`:
       ```ts
       [{
         id: 'primary',
         label: 'Current Display',
         availLeft: 0,
         availTop: 0,
         availWidth: window.screen.availWidth || 1920,
         availHeight: window.screen.availHeight || 1080,
         isPrimary: true,
       }]
       ```
   - Support subscribing to `screenschange` event on `ScreenDetails` to emit display topology updates.
   - **Architectural Boundary (AD-29)**: Topology events affect display target selection only. They MUST NOT mutate, feed, or conflict with AD-29 heartbeat-driven liveness verdicts.

3. **Smart Resolution Logic with Multi-Screen & Safe Window Fallback**:
   - Implement `resolveLaunchTarget(config: DisplayTargetConfig, screens: ScreenInfo[]): ResolvedLaunchTarget`:
     - **Specific Display Priority**: If `config.targetPreference === 'specific-display'`:
       - Match display by `config.rememberedScreenId`.
       - If found: resolve to that display with `config.mode`.
       - If not found but another external display exists: fall back to the first available external display with `fallbackReason: 'specific-screen-missing'`.
       - If no external display exists: **automatically fall back to `mode: 'window'`** with features `popup=1,width=1280,height=720,left=120,top=120` and `fallbackReason: 'single-display-safe-fallback'`.
     - **External Display Priority**: If `config.targetPreference === 'external-display'`:
       - If an external display exists (`screens.find(s => !s.isPrimary)`), resolve to that display with `mode: 'fullscreen'` and features `popup=1,left=${s.availLeft},top=${s.availTop},width=${s.availWidth},height=${s.availHeight}`.
       - If ONLY primary display exists: **automatically fall back to `mode: 'window'`** (`popup=1,width=1280,height=720`).
     - **Primary Display Preference**: If `config.targetPreference === 'primary-display'`:
       - Resolve to primary display.
     - **Explicit Window Mode Preference**: If `config.targetPreference === 'window-mode'` or `config.mode === 'window'`:
       - Resolve to window mode with standard popup dimensions.

4. **Persistent Intent Storage (`localStorage`)**:
   - Save and load `DisplayTargetConfig` using key `worship-deck:display-target-preference`.
   - Default configuration:
     ```ts
     {
       targetPreference: 'external-display',
       mode: 'fullscreen',
       rememberOnDevice: true,
     }
     ```
   - Respect `rememberOnDevice`: if false, in-memory selection applies for current session without writing to `localStorage`.
   - Fallback protection: Corrupt or unparseable JSON in `localStorage` safely resets to default configuration without throwing.
   - Invariant: When preference is `external-display`, single-screen testing uses the safe window fallback without wiping or mutating the stored `external-display` preference. Once HDMI is reconnected, it seamlessly resolves back to the external display.

5. **Test Suite (`tests/display-target-resolver.test.mjs`)**:
   - Assert `resolveLaunchTarget` resolves to external screen when $\ge 2$ screens are present.
   - Assert `resolveLaunchTarget` matches specific screen by ID when multiple external screens are present.
   - Assert `resolveLaunchTarget` falls back to window mode without fullscreen lockout when only 1 screen is present.
   - Assert user intent persistence retains `external-display` preference through single-screen fallback cycles.
   - Assert corrupt `localStorage` handling and coordinate mapping.

**Blocked by:** none

**Status:** closed

- [x] Create `<src/lib/display-target.ts>` with display types, screen detection, and resolution logic.
- [x] Implement multi-screen identification and smart fallback to window mode when external displays are absent.
- [x] Implement `localStorage` intent persistence with `rememberOnDevice` support.
- [x] Add unit test suite in `tests/display-target-resolver.test.mjs`.
