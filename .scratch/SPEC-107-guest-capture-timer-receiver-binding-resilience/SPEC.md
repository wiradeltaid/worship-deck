# SPEC-107 — Guest Video Capture Native Timer Receiver Binding, Header Row 3 Tiering, and Projector Transition Parity

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-23` (Single Shared Transition Definition Across PPTX and Browser Surfaces)
  - `AD-24` (Room-Facing Screens Never Show Operator Controls; Operator Console Ergonomics)
  - `AD-29` (Presenter-Projector Cross-Window Liveness Handshake and Sync — Wire Protocol Preserved via DEC-088)
- **Decisions**:
  - `DEC-088` (Guest Speaker Video Capture HDMI Input & Presenter Resilience)
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser)
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
- **Components**: `presenter`
- **Touches**: `present-channel` (Wire protocol preserved; native browser timer receiver binding, presenter console tiering, and projector transition parity hardened)

---

## Problem Statement

During live hardware verification of WorshipDeck dev (`https://presenter-dev.bic.my.id/present`) following SPEC-106 deployment, operators tested with physical HDMI capture cards (e.g. `ezcap Game Link RAW`) and webcams (`UGREEN Camera 4K`). The session surfaced three critical usability, lifecycle, and presentation presentation defects:

1. **Web API Receiver Loss During Capture (`TypeError: Illegal invocation`)**:
   - Clicking **Arm** for capture card devices triggered `TypeError: Failed to execute 'setTimeout' on 'Window': Illegal invocation`.
   - Root cause: Pluggable environment seams (`CaptureBrokerEnv`, `ControllerEnv`, `ProjectorMediaBridgeEnv`) assigned default timer functions directly to object properties (`this.env.setTimeout = setTimeout` or `this.envSetTimeout = setTimeout`). Invoking `this.env.setTimeout(...)` sets receiver `this` to `this.env` (a plain `{}` object) or `this` (the controller instance), violating V8's native C++ receiver check which requires `this instanceof Window`.
   - Affected call sites:
     - `CaptureBroker.waitForPreviewReadiness`: `this.env.setTimeout` / `clearTimeout` (5s preview deadline).
     - `PresenterGuestFeedController`: `this.envSetTimeout` / `envClearTimeout` (`startAttachDeadline` 5s and `startFrameWatchdog` 1s).
     - `ProjectorGuestMediaBridge`: `this.env.setTimeout` / `clearTimeout` (3s playback deadline) and `this.env.setInterval` / `clearInterval` (1s status re-emission timer).

2. **Presenter Console Header Crowding & Ergonometric Tiering (Row 1 Saturation)**:
   - Operators reported that placing the Guest Speaker HDMI Video controls inside Row 1 (`presenter-header-row-1`) crowded existing essential controls (`All Slides` grid opener, `PresenterDisplayControl` unified display manager, and `Remote Code` pairing button).
   - The device picker dropdown, status badges (Ready, Waiting Projector, Live), and operational actions (Arm, Disarm, Switch to Guest, Revert to Deck) require dedicated breathing room to prevent accidental clicks or cramped wraps on standard 1080p/1366x768 operator laptop screens.
   - Operators requested moving the Guest Speaker HDMI Video controls into a dedicated third tier (`presenter-header-row-3`).

3. **Abrupt Projector Guest Feed Transitions (Jarring Snap vs. AD-23 Slide Transition Parity)**:
   - When switching to guest (`isGuestIntent` becomes true) or reverting to deck (`isGuestIntent` becomes false), the projector currently mounts and unmounts the video container instantly (`{isGuestIntent && guestStream ? <div ... /> : null}`).
   - This creates an abrupt, jarring visual cut on the sanctuary screen, violating the visual expectations of services where slide transitions (`fade`, `dissolve`, `push`) or smooth overlays (blank screen layer `z-50`, scripture overlay layer `z-20`) are configured.
   - Per AD-23, browser presentation surfaces MUST consume the canonical transition definition (`SLIDE_TRANSITION_SPECS` from `src/lib/transitions.ts`) rather than hardcoding bespoke opacity-only animations. Guest feed transitions on both entrance (switch to guest) and exit (revert to deck) must conform to the active `transition` configuration (`none`, `cut`, `fade`, `dissolve`, `push`).
   - Furthermore, the exit lifecycle cannot conditionally mount directly on `isGuestIntent && guestStream`, because reverting to deck would drop the element before the exit transition animation runs. The mount lifecycle must be governed by a phase state machine that retains a reference to the active stream until the exit animation fully completes.

---

## Solution Architecture & Invariants

### 1. Robust Timer & Interval Receiver Binding
- Across all three modules (`CaptureBroker`, `PresenterGuestFeedController`, `ProjectorGuestMediaBridge`), normalize default timer and interval initializers using closures bound to the target window/global environment:
  ```ts
  const rawSetTimeout = env.setTimeout;
  const rawClearTimeout = env.clearTimeout;
  const timerTarget = typeof window !== 'undefined' ? window : globalThis;

  this.env = {
    ...
    setTimeout: rawSetTimeout
      ? (fn: () => void, ms: number) => rawSetTimeout.call(timerTarget, fn, ms)
      : (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: rawClearTimeout
      ? (id: any) => rawClearTimeout.call(timerTarget, id)
      : (id: any) => clearTimeout(id),
  };
  ```
- Guarantees `this` is never bound to intermediate configuration objects or controller class instances, permanently eliminating `Illegal invocation` in Chromium/V8.
- Validated on live hardware with `ezcap Game Link RAW` (HDMI capture card) and `UGREEN Camera 4K` (UVC webcam) on `https://presenter-dev.bic.my.id/present`.
- Complete verification must assert both scheduling (`setTimeout`/`setInterval`) and cancellation (`clearTimeout`/`clearInterval`) paths.

### 2. Presenter Header Row 3 Tiering
- In `src/operator/present/PresenterOperator.tsx`:
  - Relocate `<PresenterGuestFeedControl>` from `presenter-header-row-1` into a dedicated container: `data-testid="presenter-header-row-3"`.
  - Maintain clean visual hierarchy:
    - **Row 1**: All Slides, Congregation Display Manager, Mobile Remote Pairing.
    - **Row 2**: Offline Readiness Status, Presentation Lock, Emergency Slide Canvas Edit, Blackout Blank Toggle.
    - **Row 3**: Guest Video Camera Icon, Device Dropdown, Permission CTA, Badges, Arm/Disarm, Switch to Guest, Revert to Deck.

### 3. Canonical AD-23 Projector Guest Video Media Transition Parity
- In `src/projected/ProjectorClient.tsx`:
  - Introduce an entrance/exit transition phase state machine and retained media reference:
    - State: `guestPhase: 'hidden' | 'entering-start' | 'active' | 'exiting'`.
    - Retained Stream: `retainedGuestStream` holds the active media stream during exit animations so the element remains mounted and visible until the exit phase completes.
  - Mount Predicate: Render `<div data-testid="projector-guest-video-container">` whenever `guestPhase !== 'hidden'` and `retainedGuestStream !== null`.
  - Conformance to `SLIDE_TRANSITION_SPECS` (AD-23):
    - For `none` or `cut`: `durationMs === 0`, instantaneous swap (mount directly as `'active'`, unmount immediately as `'hidden'`).
    - For `fade` or `dissolve`: CSS `transition: opacity 300ms ease-in-out`.
      - Entrance: `opacity-0` -> `opacity-100`.
      - Exit: `opacity-100` -> `opacity-0` over 300ms, then clear `retainedGuestStream` and transition to `'hidden'`.
    - For `push`: CSS `transition: transform 300ms cubic-bezier(...)`.
      - Entrance: `transform: translateX(100%)` -> `transform: translateX(0)`.
      - Exit: `transform: translateX(0)` -> `transform: translateX(-100%)` (or push off-screen), then clear `retainedGuestStream` and transition to `'hidden'`.
  - Interruption and Teardown Invariants:
    - If operator triggers Switch to Guest while an Exit transition is in flight, cleanly cancel the exit timer, restore `guestPhase` to `'active'`, and retain the active media.
    - On component unmount, stream loss (e.g. HDMI unplugged), or plan change, cancel running transition timers and cleanly teardown the retained stream.
  - Stacking and containment invariants strictly preserved:
    - Slide view: `z-0..10`
    - Scripture overlay: `z-20` (animated over 300ms)
    - Contained guest video layer: `z-30` (animated per canonical AD-23 transition spec)
    - Ephemeral F11 hint: `z-40`
    - Blackout blank screen: `z-50` (animated over 300ms)

---

## Tickets in Scope

1. **`SPEC-107-01`**: Capture Broker and Controller Native Timer Receiver Binding.
2. **`SPEC-107-02`**: Projector Media Bridge Native Timer and Interval Receiver Binding.
3. **`SPEC-107-03`**: Presenter Header Row 3 Relocation for Guest Video Controls.
4. **`SPEC-107-04`**: Projector Guest Video Media Canonical AD-23 Transition Parity.
