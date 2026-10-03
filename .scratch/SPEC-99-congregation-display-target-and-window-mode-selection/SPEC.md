# SPEC-99 — Congregation Screen Display Target Selection, Multi-Screen Window Placement, and Adaptive Window Mode Fallback

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-10` (One Presenter Sync Channel, Client-Side Only)
  - `AD-24` (Room-Facing Screens Never Show Operator Controls)
  - `AD-29` (Presenter-Projector Cross-Window Liveness Handshake and Sync)
  - `AD-30` (Process Roles: Go API, React SPA, On-Demand PPTX Worker)
- **Functional Requirements**:
  - `FR-15` (Browser-Fullscreen Presentation Mode & Fallback)
  - `FR-16` (Two-Screen Presenter View in the Browser — Congregation Screen Controls)
- **Use Cases**:
  - `UC-12` (I Run the Two-Screen Presenter)
- **Components**: `presenter`
- **Touches**: `present-channel`

---

## Problem Statement

In the current Worship Deck Presenter console (`src/operator/present/PresenterOperator.tsx`), the button to open the congregation screen (`Open Congregation Screen`) executes a hardcoded popup launch:
```ts
const PROJECTOR_FEATURES = 'popup=1,width=1280,height=720,left=120,top=120';
const opened = window.open(projectorUrl, projectorWindowName(serviceId), PROJECTOR_FEATURES);
```

During church rehearsals and Sunday services, operators face four major UX friction points and operational failure modes:

1. **Lack of Concrete Display Target Selection**:
   - The popup opens at fixed virtual coordinates (`left=120, top=120`), which almost always places the congregation window on the operator's primary laptop screen instead of the connected sanctuary projector or external HDMI display.
   - When multiple external displays are present (e.g. sanctuary projector + lobby TV), operators cannot choose which physical display receives the congregation view.
   - Deriving target merely by `!isPrimary` is insufficient because OS topologies vary (e.g. external monitor set as primary display while laptop screen is secondary, or clamshell mode).

2. **The "Single Screen vs. Dual Screen" Dilemma & Operator Lockout**:
   - When preparing slides at home or testing on a single laptop screen (no external monitor attached), entering fullscreen on Monitor 1 completely covers the Presenter Operator UI. The operator is effectively locked out of slide controls and forced to exit fullscreen or switch windows.
   - Conversely, asking via a blocking modal dialog on every single launch creates unacceptable cognitive friction in rush minutes before service.

3. **Display Topology Changes & Cable Disconnects (Failure Modes)**:
   - In live church environments, HDMI cables to projectors are often plugged in late (just minutes before service), unplugged during rehearsals, or routed through USB-C adapters/docks where OS display indexes change unpredictably.
   - Merely remembering a raw display index (`index: 2`) leads to silent misplacement or off-screen rendering when the external display is disconnected.
   - When the projector cable is not yet connected, the system must remember the user's intent to use an external display, but intelligently fall back to safe Window Mode on the laptop, and seamlessly re-arm external display projection the moment HDMI is connected.

4. **Live Target Re-routing & Browser Fullscreen Constraints**:
   - If an operator changes the display target while a congregation window is already open, the current implementation only calls `.focus()` on the existing window handle, failing to relocate the window.
   - Programmatic fullscreen on newly opened popup windows is strictly guarded by browser user-activation policies. The design must establish a concrete, observable contract between window placement at screen bounds and confirmed fullscreen state with tactile F11 guidance fallback.

---

## Solution & Architecture

Worship Deck adopts the **Split Button with Smart Priority & User Intent Persistence** pattern:

### 1. Concrete Display Target Model & Intent Persistence (`<src/lib/display-target.ts>`)
- Model display targets with concrete physical identities and semantic roles:
  ```ts
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

  export type TargetPreference = 'specific-display' | 'external-display' | 'primary-display' | 'window-mode';

  export interface DisplayTargetConfig {
    targetPreference: TargetPreference;
    mode: 'fullscreen' | 'window';
    rememberedScreenId?: string; // Fingerprint of last explicitly chosen display
    rememberOnDevice: boolean;   // Controls whether manual changes persist to localStorage (default true)
  }
  ```
- **Web Platform Window Management Integration**:
  - Wrap `window.getScreenDetails()` within user gestures (e.g. on primary button click or dropdown open).
  - Permission lifecycle:
    - `prompt`: Request permission on user interaction.
    - `granted`: Enumerate physical displays into `ScreenInfo[]` and populate menu.
    - `denied` / unsupported: Gracefully fall back to single-display model using `window.screen` without crashing.
  - Topology event listener: Listen to `screenschange` on `ScreenDetails`.
    - **Invariant (AD-29 separation)**: `screenschange` events update operator-side target resolution only. They MUST NOT mutate or synthesize AD-29 projector heartbeat liveness verdicts (`active`/`lost`/`never-opened`).
- **Resolution Hierarchy**:
  1. If `targetPreference === 'specific-display'`:
     - If the display matching `rememberedScreenId` is connected: resolve to that screen.
     - If the specific display is missing but another external display exists: fall back to the first available external display with an informative badge.
     - If no external display exists: **automatically fall back to safe Window Mode** on the primary screen.
  2. If `targetPreference === 'external-display'`:
     - If $\ge 1$ external display exists: resolve to the external display.
     - If only 1 display exists: **automatically fall back to safe Window Mode** on the primary screen.
  3. If `targetPreference === 'primary-display'`: resolve to primary display (with operator confirmation if fullscreen).
  4. If `targetPreference === 'window-mode'`: resolve to floating window (`1280x720`).
- **Persistence Contract**:
  - Saved in `localStorage` (`worship-deck:display-target-preference`).
  - Default: `{ targetPreference: 'external-display', mode: 'fullscreen', rememberOnDevice: true }`.
  - Fallback to window mode during single-screen testing does NOT overwrite the stored `external-display` preference. When HDMI is re-connected, external display projection is immediately restored.

### 2. Presenter Header Split-Button UI (`<src/operator/present/PresenterDisplayControl.tsx>`)
- Replace the monolithic button in Presenter header row 1 with an accessible **Split Button**:
  - **Primary Action Button (1-Click Launch)**:
    - Reflects the resolved launch target and current liveness state:
      - Closed & External display available: `[ 📺 Buka di Layar Eksternal ]` / `[ 📺 Open on External Screen ]`
      - Closed & Single screen (safe fallback): `[ 📺 Buka sebagai Jendela ]` / `[ 📺 Open as Window ]`
      - Opened & Live: `[ 🟢 Layar Jemaat Aktif ]` / `[ 🟢 Congregation Screen Active ]` (focuses window)
      - Opened & Lost: `[ ⚠ Buka Ulang Layar ]` / `[ ⚠ Reopen Screen ]`
  - **Dropdown Trigger Button (`▾`)**:
    - Opens target selection menu displaying all connected displays:
      - Section: `TAMPILKAN KE` / `PROJECT TO`
      - Explicit entries for each detected display (e.g. `● Epson Projector (1920x1080) — Layar Penuh`).
      - Entry: `○ Layar Laptop — Layar Penuh (Akan menutupi kontrol)`.
      - Entry: `○ Mode Jendela (Aman untuk latihan/1 layar)`.
      - Divider.
      - Action: `Deteksi Ulang Layar` (re-queries screen permissions/topology).
      - Action (when open): `Fokuskan Layar Jemaat`, `Buka Ulang Jendela`, `Tutup Layar Jemaat`.
      - Toggle: `☑ Ingat pilihan untuk perangkat ini`.
  - **Live Retargeting Contract**:
    - If the congregation window is already open and the operator selects a different display from the dropdown, the system prompts confirmation: `"Pindahkan tampilan jemaat ke layar baru?"` and upon confirmation cleanly closes the old window handle and opens on the new target, immediately sending sync state.

### 3. Multi-Screen Window Placement & Fullscreen Orchestration (`PresenterOperator.tsx`, `ProjectorClient.tsx`)
- Coordinates for `window.open`:
  - `popup=1,left=${screen.availLeft},top=${screen.availTop},width=${screen.availWidth},height=${screen.availHeight}`
- Fullscreen contract:
  - If target is fullscreen: append `?fullscreen=1` to the projector URL.
  - In `ProjectorClient.tsx`, on mount with `fullscreen=1`:
    - Attempt `document.documentElement.requestFullscreen()`.
    - If browser policy blocks programmatic fullscreen without an in-window gesture: the floating bilingual F11 guidance badge (SPEC-94-02) is shown with an active highlight, providing immediate 1-click or 1-key entry.
- Disconnection recovery:
  - If HDMI cable is detached during presentation, Presenter shows an inline status notice:
    `"Layar eksternal terputus. [ Buka sebagai Jendela ] [ Pilih Layar ]"`.

---

## Acceptance Criteria
1. When $\ge 2$ displays are connected and target is external display, clicking the primary action opens the congregation window positioned at the external display's available coordinates (`availLeft`, `availTop`, `availWidth`, `availHeight`).
2. When only 1 display is connected (or external display is unplugged), clicking the primary action opens safely in Window Mode (`width=1280, height=720`) without covering the Presenter Operator UI.
3. User intent is persisted in `localStorage`: if external display preference was saved, testing in single-screen mode uses the window fallback but leaves `external-display` intact in `localStorage`, so plugging in HDMI immediately restores external display routing.
4. When multiple external displays exist, the dropdown menu lists each display with its label and resolution, allowing explicit selection.
5. In unsupported browsers or when Window Management permission is denied, the system gracefully falls back to standard windowed popup and F11 fullscreen guidance without unhandled exceptions.
6. When the congregation window is already open and live, clicking the primary action brings the existing window to the foreground (`.focus()`). Changing display target in dropdown triggers a clean relocate flow.
7. Topology events (`screenschange`) update target display resolution only and do not alter or corrupt AD-29 heartbeat liveness verdicts.
