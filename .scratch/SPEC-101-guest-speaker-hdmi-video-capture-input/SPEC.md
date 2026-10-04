# SPEC-101 — Guest Speaker HDMI Video Capture Input, Single Broker Streaming, and Safe Congregation Projection

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-1` (`.how/_platform/ARCHITECTURE-SPINE.md:62`): Sabbath Guarantee — PPTX export is the authoritative offline guarantee; in-browser presentation is an operator staging convenience. Live media capture is an ephemeral runtime feature with instant failover to slide deck.
  - `AD-10` (`.how/_platform/ARCHITECTURE-SPINE.md:108`): One Presenter Sync Channel, Client-Side Only — BroadcastChannel carries strictly serializable semantic presentation intent, NEVER media streams or binary buffers. Ephemeral channel state is authoritative from the operator; `localStorage` is NOT used for live stream control. `PresentMessage['sync']` explicitly carries `projection: ProjectedSource`.
  - `AD-24` (`.how/_platform/ARCHITECTURE-SPINE.md:205`): Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It — The congregation display renders live video with `object-fit: contain; background: #000;`, with zero operator controls, device selectors, or error traces. Blank screen (`B`) universally occludes both slides and live video at `z-50`.
  - `AD-29` (`.how/_platform/ARCHITECTURE-SPINE.md:255`): Projector liveness protocol & BroadcastChannel isolation — Narrow extension via DEC-088 allows projector to emit typed telemetry `projector-media-status` (`attached` | `unavailable`) without becoming a secondary controller. Liveness ping-pong heartbeats remain strictly decoupled from media lifecycle and hardware frame states.
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter — Operator Console Controls & Congregation Projector)
  - `FR-19` (Auditorium Projector Output and Live Synchronization)
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
- **Bounded Feature Scope**:
  - This feature adds an operator-controlled external live video source (e.g. guest preacher laptop via UVC HDMI capture card) alongside pre-rendered slide deck and scripture overlay.
  - It does NOT replace or reconfigure the existing sanctuary projector display output (UGREEN Pair 1 / HDMI Out to projector remains the secondary monitor managed by SPEC-99).
  - Physical audio routing remains the responsibility of the sanctuary sound technician; browser audio capture is disabled at the API level (`audio: false`).
- **Components**: `presenter`
- **Touches**: `present-channel`

---

## Problem Statement

During worship services, guest speakers (pastors, evangelists, or seminar presenters) frequently bring their own laptops to project sermon slides, PDFs, or software demonstrations. Churches equipped with wireless HDMI transceivers (such as the UGREEN 50633A 5GHz point-to-point system) and USB HDMI capture cards face significant operational and architectural challenges when attempting to route the guest video feed into the sanctuary display:

1. **Windows UVC Exclusive Device Lockout**:
   - In Windows OS (DirectShow / Media Foundation), USB Video Class (UVC) capture devices are almost universally locked exclusively by the first client or window that opens them.
   - If both the Operator Console window (`PresenterOperator.tsx`) and the Congregation Projector popup (`ProjectorPage.tsx`) attempt to call `navigator.mediaDevices.getUserMedia()`, the second call fails with `NotReadableError` ("Device in use / busy"), resulting in a blank screen or broken stream.

2. **Acoustic Feedback & Audio Loop Hazards**:
   - HDMI carries interleaved digital audio alongside video. If the browser captures the HDMI audio track and routes it through the operator's laptop sound device or HDMI output, it can cause severe acoustic howling, echo loops, or unexpected volume blasts through the sanctuary sound system.

3. **Hardware Reality of HDMI Signal Loss vs Browser API**:
   - When a guest laptop sleeps, unplugs HDMI, or drops wireless link, the USB capture card remains plugged into the host laptop; the OS driver does NOT terminate the track (`track.onended` does not fire). Instead, UVC continues streaming a frozen frame, black screen, or UVC vendor "No Signal" screen.
   - Automatic failover must be strictly bounded to definitive capture pipeline errors (USB unplug, driver crash); manual operator panic button and hotkeys serve as the primary line of defense against upstream content degradation.

4. **Secure Context & Origin Constraints**:
   - `navigator.mediaDevices.getUserMedia()` is strictly gated by the Web platform to Secure Contexts (`window.isSecureContext`: `https://` or `localhost`).
   - When running on a local church server accessed across an unencrypted LAN IP (`http://192.168.x.x:5173`), media capture is blocked by the browser. The architecture must gracefully detect, communicate, and handle execution environment constraints.

---

## Solution Architecture & Core Invariants

Worship Deck implements the **Single CaptureBroker, Cloned Track Fan-Out, and Same-Origin Opener Bridge** pattern:

```text
[Guest Laptop] ──(HDMI)──► [UGREEN TX2] ~~~5GHz~~~► [UGREEN RX2] ──(HDMI)──► [USB HDMI Capture]
                                                                                     │ (USB 3.0 UVC)
                                                                                     ▼
                                                                        [Operator Console Window]
                                                                          │  (CaptureBroker Singleton)
                                                                          │  - getUserMedia({ video, audio: false })
                                                                          │  - Track cloned via videoTrack.clone()
                                                                          ├──► [Operator Preview Thumbnail]
                                                                          │    (<video muted playsInline autoPlay />)
                                                                          ▼
                                                                (Same-Origin Opener Bridge)
                                                                          │
                                                                          ▼
                                                               [Congregation Projector Window]
                                                                       [ProjectorMediaBridge]
                                                                       - Attaches cloned track to <video>
                                                                       - CSS object-fit: contain; background: #000;
                                                                       - Definite pipeline failure fallback (USB unplug); manual panic for upstream freeze
```

### 1. Single CaptureBroker Singleton (`<src/lib/capture-broker.ts>`)
- **Authority**: The operator window is the sole owner of the UVC hardware capture lifecycle. The projector window NEVER calls `getUserMedia()`.
- **Browser-Level Audio Exclusion**:
  ```ts
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: selectedDeviceId } },
    audio: false, // Mandatory: audio capture is excluded at browser API level
  });
  ```
  Both operator preview and congregation video elements remain explicitly `muted`.
- **Observable Signal Readiness**:
  - The broker does not treat `getUserMedia()` resolution as proof of active video.
  - Evaluates `onloadeddata` / `oncanplay` within a 5-second timeout window. Only when a valid frame has rendered does the broker transition to `ready`.
- **Cloned Track Fan-Out & Consumer Registry**:
  - The broker exposes `acquireProjectorConsumer(guestSessionId): { stream: MediaStream, release: () => void }`.
  - The broker maintains an internal `Set<MediaStream>` of active consumer streams.
  - When the projector popup navigates, unmounts, or closes, `release()` stops consumer tracks and cleanly removes them from the registry.
  - When `.disarm()` is invoked on the broker, it stops the master track AND iterates over all registered consumer tracks to ensure clean, non-leaking OS teardown.
- **Track Health & Real Settings**:
  The broker inspects actual `track.getSettings()` (width, height, frameRate) rather than hardcoded assumptions, reporting true signal capabilities (e.g. 1080p30 vs 1080p60) to the operator.
- **Lightweight Compositor Stalled Watchdog**:
  Uses `requestVideoFrameCallback` to track delta time between compositor frames. If frames stop arriving for >3 seconds while in `live` state, updates operator indicator to "Signal Stalled", without expensive pixel inspection.

### 2. Presenter Header Control UI & Semantic Channel State (`<src/operator/present/PresenterGuestFeedControl.tsx>`)
- **Deterministic State Machine & Transitions**:
  - `idle`: No active capture. Operator selects video input device from dropdown.
  - `arming`: Operator clicks **"Arm Guest Feed"**. `getUserMedia` executes.
  - `ready`: Signal verified via `canplay`. Operator preview thumbnail shows incoming live feed. Status badge shows verified resolution/fps (e.g. `1080p 60fps - Ready`). Switch button enabled.
  - `live`: Operator clicks **"Switch to Guest Screen"**. Operator broadcasts `{ type: 'sync', projection: { kind: 'guest', guestSessionId } }`. Projector switches to live video.
  - `revert`: Operator clicks **"Revert to Deck"** (or presses hotkey `G` / `Escape`). Operator broadcasts `{ type: 'sync', projection: { kind: 'deck' } }`. State moves back to `ready` (capture stays pre-warmed so speaker can be re-projected instantly).
  - `disarm`: Operator clicks **"Disarm"**. Broker stops all tracks and releases UVC hardware. State returns to `idle`.
  - `lost` / `error`: Triggered on `masterTrack.onended` (USB unplugged), permission rejection, or device error. The Operator Console **authoritatively transitions channel state to `{ kind: 'deck' }`**, ensuring the projector and presenter never diverge.
- **Capture-Phase Hotkey Handling**:
  - `Escape` hotkey handler is attached during the window *capture* phase so it triggers even when a `<select>` or button currently holds focus.
  - `G` hotkey acts with explicit target intent (arms/switches when in `ready`, reverts when in `live`).
- **Mutual Exclusivity with Scripture Overlay**:
  - Switching to Guest automatically clears any active scripture overlay from the broadcast state.
  - Pushing a new scripture overlay while Guest is live automatically reverts projection to `deck` and displays the scripture passage.
- **Authoritative Presenter Sync Channel Contract (`AD-10`)**:
  - `PresentMessage['sync']` and `currentState()` in `PresenterOperator.tsx` explicitly include:
    ```ts
    export type ProjectedSource =
      | { kind: 'deck' }
      | { kind: 'guest'; guestSessionId: string };
    ```
  - Reloading or relocating the projector requests sync and deterministically receives the active `projection` state.
  - `localStorage` is NOT used for live video control.

### 3. Projector Media Bridge & Contained Fullscreen Projection (`src/projected/ProjectorClient.tsx`)
- **Same-Origin Opener Bridge**:
  - When `projection.kind === 'guest'`, `ProjectorClient` acquires a consumer stream via `window.opener.__worshipDeckCaptureBroker.acquireProjectorConsumer(guestSessionId)`.
  - Operational boundary: If the projector is opened independently without an opener or across origins, the bridge fails closed, sends `projector-media-status: unavailable`, and cleanly retains slide deck projection.
  - Fallback button in operator console replaces `target="_blank" rel="noreferrer"` with a programmatic `window.open` trigger to preserve `window.opener`.
- **Visual Presentation Invariant (`AD-24`)**:
  Rendered in a contained viewport layer with CSS:
  ```css
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  z-index: 30;
  ```
  Zero operator UI, zero device selectors, zero technical error messages shown to congregation.
- **Blank Screen Overlay (`B`)**:
  The existing blackout overlay stays at `z-50`, cleanly covering the live video surface (`z-30`) just as it covers slide canvases.
- **Narrow AD-29 Telemetry Contract**:
  Projector communicates status back to operator via narrow typed telemetry:
  ```ts
  type ProjectorMediaStatus =
    | { type: 'projector-media-status'; guestSessionId: string; state: 'attached' }
    | { type: 'projector-media-status'; guestSessionId: string; state: 'unavailable'; reason: 'opener-unavailable' | 'consumer-attach-failed' | 'video-error' };
  ```
  Projector does not control state; upon receiving `unavailable`, Operator Console authoritatively updates global state back to `deck`.

### 4. Physical Audio Routing Standard Operating Procedure (SOP)
- **Zero Browser Audio Guarantee**: Browser audio capture is strictly disabled at API request time (`audio: false`) and video elements are permanently muted. No audio path passes through WorshipDeck or the presenter laptop.
- **Dedicated Sanctuary Audio Path**:
  - Guest speakers wishing to play video clips with sound MUST connect an analog 3.5mm stereo cable from their laptop headphone jack to a stage DI Box or mixer channel.
  - Windows on the guest laptop often defaults playback to the newly attached HDMI device (UGREEN TX2). The speaker or sound technician must verify that Windows audio playback is explicitly assigned to "Realtek Audio / Headphones", not HDMI.
  - Operators MUST NOT enable Windows "Listen to this device" on the USB Capture Card audio endpoint.
- **Latency & Lip-Sync Bounds**: Video passing through the double 5GHz wireless hop and Chromium compositor incurs ~150–300ms latency. For sermon slides and presentation decks, this latency is imperceptible; for musical/vocal video clips, sound technicians must be aware that direct analog audio will lead the projected video slightly.

### 5. Hardware-in-the-Loop (HIL) Acceptance Protocol
1. **Device Enumeration & Labeling**: Verify UGREEN / USB capture card detects cleanly and appears in the dropdown.
2. **Pre-Warm & Observable Readiness**: Arming must display active feed in operator preview thumbnail within 5 seconds.
3. **HDMI Upstream Disconnect vs USB Unplug**:
   - Disconnecting guest laptop HDMI / sleep: verify operator console displays stalled/frozen warning; verify pressing `Escape` or "Revert to Deck" instantly restores slide presentation.
   - Unplugging USB capture card: verify `masterTrack.onended` fires, operator console transitions to deck automatically, and projector reverts cleanly.
4. **Relocate & Reload Resilience**:
   - Reload projector popup while in live guest mode: verify projector reconnects, requests sync, and re-attaches video stream without operator re-arming.
   - Move projector between displays via SPEC-99 split button: verify old consumer clone is released and new window acquires fresh stream.
5. **Two-Hour Soak & Memory Health**: Run 1080p live stream for 120 minutes while navigating slides in background. Assert zero memory leaks in consumer registry and no browser crashes.
