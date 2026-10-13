# SPEC-119 — Presenter Remote Media Seekbar Telemetry Resilience, Inert Remote Audio Isolation, and Touch Scrubbing

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-10` (presenter-authority BroadcastChannel, state-not-instruction, idempotent-on-the-wire) — Workstation host is the sole authority for physical output; remote controller is strictly state-not-instruction receiver and intent transmitter.
  - `AD-24` (Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It) — Remote console isolates chrome state; zero room-facing output or physical media rendering on remote client.
  - `AD-29` (The Projector Reports Its Own Liveness and Nothing Else, and One Predicate Decides It) — Screen evaluator integrity preserved; remote input never alters projector liveness.
  - `AD-37` (Remote Control Pairing, Single Controller, and Intent Relay) — Single-controller pairing authority; host workstation physical audio playback with lightweight SSE telemetry mirroring.
  - `DEC-101`, `DEC-102`, `DEC-103`, `DEC-104`, `DEC-105`
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser) — Presenter console controls and visual hierarchy across viewport sizes.
  - `FR-35` (Remote Presenter Control) — Robust, authenticated remote controlling via SSE stream, heartbeat tolerance, and reconnect resilience.
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
  - `UC-29` (Remote Presenter Control: Mobile/Secondary Controller Pairing, Slide Advance, and State Mirroring)
- **Components**: `presenter`
- **Touches**: `present-channel`, `remote-control`

---

## 1. Problem Statement & Motivation

During hand-testing of the remote presenter console on physical smartphones and tablets, operators reported severe media seekbar instability:
1. **Seekbar Stutter and Freezes ("seperti ngadat2, glitch2, kadang berhenti")**:
   - The seekbar stutters, jitters back and forth, and intermittently freezes during playback.
   - Root cause:
     - On the host workstation, the React audio element's `onTimeUpdate` fires ~4 times per second, dispatching `SET_TIME` into `mediaStore`.
     - `PresenterOperator.tsx` subscribes to `mediaStore` and fires `broadcastState` on every store tick. On each tick, it maps and serializes the entire `playlistManifest` array into an unbounded sequential Promise chain (`this.queue = this.queue.then(...)`).
     - Network latency causes queue backlog, and Go backend channel buffers (`make(clientChan, 16)`) drop overflowing SSE packets, delivering bursty, out-of-order, or stalled timestamps to the remote device.
2. **Seekbar Rubber-Banding to the Beginning ("di host berjalan dengan baik, tapi di remote kembali ke awal")**:
   - When seeking on the host, the host plays correctly, but the remote seekbar snaps back to `0:00`.
   - When seeking on the remote, the slider immediately jumps back to `0:00` or the pre-seek position before jumping forward.
   - Root cause:
     - In remote mode (`mode === 'remote'`), `<MediaStage isInert={true} />` was mounting local `<audio>` / `<video>` elements with `src` assigned. Because remote does not play physical sound, local element `currentTime` was `0:00`.
     - Whenever the remote local element emitted `timeupdate` or metadata loaded, it dispatched `store.dispatch({ type: 'SET_TIME', currentTime: el.currentTime })` (0s), clobbering the host's authoritative SSE telemetry in `mediaStore`.
     - In `MediaControlBar.tsx`, `commitSeek` on remote immediately cleared `setSeekingTime(null)` without an optimistic store dispatch or hold, causing instant rubber-banding while waiting for the network roundtrip.
3. **Touch Scrubbing Interruption on Mobile ("kadang berhenti")**:
   - On touchscreens (smartphones/tablets), vertical finger jitter during horizontal slider drag triggers browser scroll gestures, firing `pointercancel`.
   - `MediaControlBar.tsx` did not handle `pointercancel` or touch cancel events, leaving `isSeekingRef.current = true` stuck and freezing the seekbar until an accidental blur occurred.

---

## 2. Technical Architecture & Ticket Breakdown

### SPEC-119-01: Passive Inert MediaStage on Remote Mode (`isInert`) & Suppression of Local Playback Dispatchers
- **Target**: `src/operator/present/media-player/MediaStage.tsx`, `src/operator/present/PresenterOperator.tsx`, `tests/presenter-media-player.test.mjs`
- **Scope**:
  - Introduce explicit `isInert?: boolean` capability prop on `MediaStageProps`, bound in `PresenterOperator.tsx` as `isInert={mode === 'remote'}` (decoupling inert remote behavior from generic audio volume muting).
  - In `MediaStage.tsx`, when `isInert === true`:
    - Guard `store.subscribe`: do not assign `src` and do not invoke `load()` or `play()` on local media elements.
    - Guard all element callbacks (`handleTimeUpdate`, `handleLoadedMetadata`, `handlePlay`, `handlePause`, `handleEnded`, `handleError`): return immediately without dispatching any synthetic local actions (`SET_TIME`, `SET_DURATION`, `SET_PLAYING`, `SET_PROJECT_STATUS`, etc.) to `store`.
    - On mount with `isInert === true`, strip `src` and pause any residual elements.
  - Remote `mediaStore` is driven strictly by authoritative host SSE telemetry (AD-24, AD-37).
- **Touches**: `present-channel`

### SPEC-119-02: Optimized Host Media Telemetry Throttling & Coalescing Broadcast Queue
- **Target**: `src/operator/present/PresenterOperator.tsx`, `src/lib/presenter-remote-client.ts`, `tests/remote-presenting-client.test.mjs`
- **Scope**:
  - In `PresenterOperator.tsx`:
    - Decouple `playlistManifest` broadcasting from `timeupdate`: only include `playlistManifest` when playlist items change (length, IDs, order) or when a remote (re)connects / resumes (`remoteState === 'connected'`), avoiding massive JSON serialization on every 250ms store tick.
    - Throttle continuous playback `currentTime` broadcasts to at most once per 500ms while playing, while immediately broadcasting discrete state transitions (play, pause, stop, seek, select track, volume, mute).
  - In `PresenterRemoteSession.broadcastState` (`presenter-remote-client.ts`):
    - Replace unbounded sequential Promise chaining with a single-flight coalescing queue: if a network request is in-flight, merge incoming states into a pending slot with latest-state precedence.
    - When the in-flight request resolves, dispatch the pending consolidated state in a single HTTP POST and clear the slot.
    - Drop superseded intermediate timestamps, preventing HTTP queue backlog and Go SSE buffer drops.
- **Touches**: `remote-control`, `present-channel`
- **Blocked by**: `["SPEC-119-01"]`

### SPEC-119-03: Optimistic Seek Hold, Telemetry Reconciliation & Rubber-Banding Elimination
- **Target**: `src/operator/present/media-player/MediaControlBar.tsx`, `tests/presenter-media-player.test.mjs`
- **Scope**:
  - In `MediaControlBar.tsx` `commitSeek`:
    - When `onRemoteMediaIntent` is present, optimistically dispatch `store.dispatch({ type: 'SET_TIME', currentTime: val })` on remote `mediaStore`.
    - Maintain an optimistic seek hold / grace period (1000ms from commit) ignoring regressing incoming `state.currentTime` updates from host if they reflect the stale pre-seek timestamp.
  - Ensure zero rubber-banding: dragging and releasing the seekbar on remote keeps the slider at the target position smoothly while host executes seek.
- **Touches**: `present-channel`
- **Blocked by**: `["SPEC-119-02"]`

### SPEC-119-04: Mobile Touch Ergonomics, Pointer Cancel Resilience & Smooth Scrubbing
- **Target**: `src/operator/present/media-player/MediaControlBar.tsx`, `tests/presenter-media-player.test.mjs`
- **Scope**:
  - Add `touch-action: none` (`touch-none`) to the range slider input in `MediaControlBar.tsx` so vertical scroll gestures do not cancel horizontal scrubbing.
  - Implement idempotent seek finalization: attach `onPointerCancel={handleSeekPointerUp}`, `onTouchEnd`, `onTouchCancel`, and pointer capture handlers, guarded by `if (!isSeekingRef.current) return;` to prevent duplicate commits across multi-event touch cycles.
  - Automated tests and defect injection guards verifying touch scrubbing reliability.
- **Touches**: `present-channel`
- **Blocked by**: `["SPEC-119-03"]`
