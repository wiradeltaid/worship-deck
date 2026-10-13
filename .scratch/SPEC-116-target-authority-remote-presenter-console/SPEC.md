# SPEC-116 — Target-Authority Remote Presenter Architecture: Scripture Remote Intent Dispatching, Media Playlist Hydration, Remote Drawer Selection, Volume Control, and Hardware Telemetry Mirroring

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-10` (presenter-authority BroadcastChannel, state-not-instruction, idempotent-on-the-wire) — The presenting host workstation remains the sole authority executing physical hardware and publishing to BroadcastChannel; remote client acts strictly as an intent transmitter and telemetry receiver with idempotent state intents.
  - `AD-24` (Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It) — Remote console isolates chrome state; zero room-facing projector output on remote client.
  - `AD-29` (The Projector Reports Its Own Liveness and Nothing Else, and One Predicate Decides It) — The projector liveness predicate is strictly between presenting host and physical screen; remote client observes host status and never alters the liveness evaluator.
  - `AD-37` (Remote Control Pairing, Single Controller, and Intent Relay) — Strict authenticated single-use pairing and remote intent routing.
  - `DEC-101` (Persistent Video Projection, Slide Fallback, and Local Storage Transport Preferences) — Host workstation executes persistent projection and audio fallback while remote controls and observes state.
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser) — Presenter console controls and projector synchronization.
  - `FR-25` (Display the Operator interface in the Operator's language) — Full bilingual localization via `useT()`.
  - `FR-35` (Remote Presenter Control) — Robust, authenticated remote controlling via SSE stream and intent dispatching.
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
  - `UC-29` (Remote Presenter Control: Mobile/Secondary Controller Pairing, Slide Advance, and State Mirroring)
- **Components**: `presenter`
- **Touches**: `remote-control`, `present-channel`

---

## 1. Problem Statement & Motivation

Following the initial delivery of `SPEC-115` (Dual-Mode Console Shell and QR Pairing), field testing on mobile controllers revealed five critical functional gaps and two architectural extension opportunities where remote controls were over-isolated or failed to route intents to the authoritative host:

1. **Scripture Push Ineffectiveness on Remote Client**:
   - In `PresenterOperator.tsx`, `pushScripture()`, `clearScripture()`, and scripture page changing (`handlePageChange()`) solely invoke the local `broadcast()` callback. On remote mode, `channelRef.current` (BroadcastChannel) is nullified by surface isolation.
   - Pushing scripture from a mobile device renders only on the local phone preview and never reaches the host AV workstation or sanctuary projector screen.
   - Furthermore, scripture pagination on remote cannot convey page selections without explicit page index metadata and bidirectional SSE mirroring.

2. **Media Transport Inactivity Due to Playlist Mount Suppression**:
   - In `PresenterOperator.tsx`, playlist hydration is completely aborted on mount when `mode === 'remote'`.
   - As a result, `mediaStore.items` is permanently empty on remote clients, `activeItem` resolves to `undefined`, and `isCued = Boolean(activeItem)` evaluates to `false`.
   - In `MediaControlBar.tsx`, all transport controls (`Play`, `Prev`, `Next`, `Stop`, `Project Video`, `Fade`, `Volume`, `Mute`) are disabled, the seekbar is inert, and the track display reads *"No media loaded"*.

3. **Media Drawer Button Missing on Remote Console**:
   - In `PresenterOperator.tsx`, `onOpenDrawer` is passed as `undefined` in remote mode, and `<MediaDrawer>` is excluded from mounting.
   - Operators holding a mobile device cannot open the media drawer to view loaded service songs or select specific background tracks to cue on the host workstation.

4. **Software Volume Slider, Mute, and Audio Fade Out Inactive on Remote**:
   - In `MediaControlBar.tsx`, Fade Out, Mute Toggle, and the Volume Slider are explicitly disabled with `disabled={... || isRemote}`.
   - While physical soundboard faders cannot be moved from web sandbox, software playback volume (`HTMLMediaElement.volume`) on the host machine should be remotely controllable from the mobile console via dedicated intents (`media-set-volume`, `media-set-mute`, `media-fade`).

5. **Rundown Sheet Text Omission on Remote Route**:
   - In `spa/src/pages/RemotePage.tsx` and `src/operator/present/RemoteOperator.tsx`, `data.raw_payload` (rundown text) is omitted from component props, leaving the sidebar permanently displaying *"No rundown text provided"*.

6. **Guest HDMI Capture & Screen Control Extension**:
   - Header Row 3 controls (Guest Speaker HDMI video capture) are currently omitted on remote clients to prevent local camera access.
   - When a guest speaker plugs in a laptop HDMI capture card at the pulpit, remote operators need to trigger capture arming, disarming, and projection on the host machine.
   - In accordance with `AD-10` ("state not instruction"), projection commands must be idempotent (`projected: boolean`) rather than toggle commands.

7. **Projector Reopen / Refocus Protocol & Browser Popup Constraints**:
   - If the sanctuary projector window on the host PC is closed or loses focus, remote operators need a way to request refocus or reopening.
   - Browsers forbid `window.open()` without direct user activation (popup blocker). The design must provide zero-popup refocus when already open, and a 1-click prominent host console banner when window reopening is required.

---

## 2. Technical Architecture & Boundary Invariants

```
┌────────────────────────────────────────┐           ┌────────────────────────────────────────┐
│     REMOTE DEVICE (Phone/Tablet)       │           │        TARGET PC (AV Booth Host)       │
│  - Zero hardware execution             │  Intents  │  - Connected to Physical Projector     │
│  - Audio element muted (volume 0)      │ ────────> │  - Connected to Sanctuary Sound Board  │
│  - No local camera/capture prompts     │    SSE    │  - Connected to USB HDMI Capture Card  │
│  - Real-time host telemetry reflection │ <──────── │  - Executes all physical hardware      │
└────────────────────────────────────────┘ Telemetry └────────────────────────────────────────┘
```

### 2.1 Target Authority Principle (`AD-10`, `AD-37`)
- **Single Hardware Executor**: The Host PC is the sole executor of audio decoders, physical display surfaces, and capture cards.
- **Idempotent Intent-Driven Actions**: All remote commands carry desired target state (e.g., `guest-project` with `projected: boolean`, `media-set-volume` with `volume: number`, `media-set-mute` with `muted: boolean`), preserving idempotency over the wire.
- **Telemetry Reflection**: Host PC mirrors full presentation state, media playback state (including `volume` and `isMuted`), scripture overlay, and guest capture status over SSE `POST /api/present/:id/remote/state`.

### 2.2 Scripture Intent Plumbing & Bidirectional State
- `PresenterRemoteIntent` carries:
  - `{ type: 'scripture'; reference: string; text: string; verses?: Array<{ verse: number; text: string }>; mode?: 'per-verse' | 'inline'; is_whole_chapter?: boolean; pageIndex?: number; planIdentity: string }`
  - `{ type: 'clear-scripture'; planIdentity: string }`
- Remote client dispatches `scripture` intents on push and chunk page changes. Host applies the intent, recalculates `scriptureOverlay`, updates session cache, broadcasts to physical screen, and mirrors active `scripture` state back to remote clients via SSE.

### 2.3 Read-Only Media Playlist Hydration, Remote Selection & Software Volume Control
- Remote clients execute read-only fetch to `GET /api/media/playlist` on mount to populate `mediaStore.items`, strictly bypassing `localMediaRegistry.hydrate()`.
- Populating playlist items sets `isCued = true`, enabling track seekbars, durations, and transport buttons.
- The `MediaDrawer` button is restored on remote mode (`onOpenDrawer={() => setMediaDrawerOpen(true)}`).
  - Inside `MediaDrawer.tsx`, destructive/local mutations (`Upload file`, `Delete`, `Import`) are hidden when `isRemote`.
  - Clicking a track dispatches `onRemoteMediaIntent({ type: 'media-select-item', id, planIdentity })`.
- In `MediaControlBar.tsx`, the `|| isRemote` condition on `media-control-bar-fade`, `media-control-bar-mute`, and `media-control-bar-volume` is lifted:
  - Adjusting the volume slider dispatches `onRemoteMediaIntent({ type: 'media-set-volume', volume: newVolume, planIdentity })`.
  - Clicking Mute dispatches `onRemoteMediaIntent({ type: 'media-set-mute', muted: !state.isMuted, planIdentity })`.
  - Host PC applies volume and mute to `mediaEngine` and mirrors updated `volume` and `isMuted` back over SSE.

### 2.4 Guest HDMI Capture Telemetry & Idempotent Projection
- Extend `allowedIntentTypes` in `internal/httpapi/remote.go` and `PresenterRemoteIntent` with:
  - `guest-arm`: Instructs Host PC to arm USB capture card.
  - `guest-disarm`: Instructs Host PC to disarm USB capture card and return to deck.
  - `guest-project`: Idempotent projection command carrying `{ projected: boolean; planIdentity: string }`.
- Extend `RemoteControlSessionState` with `guestFeed?: { uiState: GuestFeedUiState; projection: ProjectedSource; frameHealth: FrameHealthStatus; errorMessage: string | null }`.
- In remote mode, `PresenterGuestFeedControl` renders status and controls based on mirrored telemetry without invoking local `navigator.mediaDevices.getUserMedia()`.

### 2.5 Projector Reopen / Refocus Protocol
- Extend `allowedIntentTypes` with `request-reopen-projector`.
- Extend `RemoteControlSessionState` with `projector?: { hasOpen: boolean; isAlive: boolean }`.
- When remote detects closed projector, it displays a "Minta Buka Proyektor / Request Projector Reopen" button.
- When Host PC receives `request-reopen-projector`:
  - If projector window is still open: calls `projectorRef.current.focus()` immediately (no popup blocker).
  - If projector window is closed: displays a prominent flashing action banner on the host console with a 1-click `[Buka Proyektor]` button and keyboard shortcut, allowing the AV operator to satisfy the browser user-gesture requirement cleanly.

---

## 3. Work Breakdown & Ticket Sequencing

- **SPEC-116-01**: Push Scripture Remote Intent Dispatching, Chunk Pagination Sync, Clear Scripture, and Rundown Text Plumbing
- **SPEC-116-02**: Remote Read-Only Media Playlist Hydration, Media Drawer Track Selection, Remote Volume Control, and Audio Fade-Out
- **SPEC-116-03**: Guest HDMI Capture Remote Telemetry, Idempotent Projection, and Projector Reopen/Refocus Protocol
- **SPEC-116-04**: Comprehensive Verification Suite, Regression Guards, and Bilingual Localization Parity
