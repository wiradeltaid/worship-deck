# SPEC-117 — Mobile Media Bar Ergonomics, Header Layout Harmony, Bidirectional Presentation Telemetry, and Remote Local Media Manifest

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-10` (presenter-authority BroadcastChannel, state-not-instruction, idempotent-on-the-wire) — Host workstation executes physical output; remote client acts strictly as an intent transmitter and telemetry receiver.
  - `AD-24` (Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It) — Remote console isolates chrome state; zero room-facing output on remote client.
  - `AD-29` (The Projector Reports Its Own Liveness and Nothing Else, and One Predicate Decides It) — The projector liveness predicate is strictly between presenting host and physical screen; remote client observes host status.
  - `AD-37` (Remote Control Pairing, Single Controller, and Intent Relay) — Strict authenticated single-use pairing and remote intent routing.
  - `DEC-101` (Persistent Video Projection, Slide Fallback, and Local Storage Transport Preferences) — Host workstation executes persistent projection and audio fallback while remote controls and observes state.
  - `DEC-102` (Unified Remote Presenter Console & QR Code Instant Pairing)
  - `DEC-103` (Target-Authority Remote Presenter Console Architecture)
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser) — Presenter console controls and projector synchronization.
  - `FR-25` (Display the Operator interface in the Operator's language) — Full bilingual localization via `useT()`.
  - `FR-35` (Remote Presenter Control) — Robust, authenticated remote controlling via SSE stream and intent dispatching.
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
  - `UC-29` (Remote Presenter Control: Mobile/Secondary Controller Pairing, Slide Advance, and State Mirroring)
- **Components**: `presenter`
- **Touches**: `remote-control`, `present-channel`, `media-player`, `media-drawer`, `presenter-header`

---

## 1. Problem Statement & Motivation

During hands-on testing of the unified mobile presenter console (`/remote`) on physical smartphone devices following the release of `SPEC-116`, four critical ergonomics, visual hierarchy, and telemetry desynchronization issues were uncovered:

1. **Media Control Bar Excessive Crowding on Mobile Screens (`Image #1`)**:
   - `MediaControlBar.tsx` currently forces 14 distinct buttons, sliders, badges, and time indicators into a single horizontal row (`flex-row h-13`).
   - On mobile screens (width < 768px, typically 380–450px), buttons crowd against each other, the track name overflows, and the seekbar is compressed into an unusable, un-scrubbable sliver.
   - Operators holding smartphones cannot comfortably seek tracks or press playback buttons without accidental mis-taps.

2. **Presenter Header Layout Fracture & Staggered Wrap During Guest Live (`Image #2`)**:
   - In `PresenterOperator.tsx`, the top-right header actions are artificially split into Row 1, Row 2, and Row 3.
   - On remote consoles, host-only actions (`PresenterDisplayControl`, `Remote Code Pairing`, `OfflineReadinessBadge`, `Emergency Edit`, `Run Sheet`) are hidden (`mode !== 'remote'`).
   - This leaves Row 1 with only a single orphan button (`[All slides]`), Row 2 with only `[Unlock Service]`, and `[Request Congregation Screen Reopen]` orphaned as an external flex sibling.
   - When Guest Feed transitions to `Guest Live` (`confirmed-live`), Header Row 3 expands horizontally to ~520px with the Camera title, device selector, Disarm button, `Guest Live` badge, and `Revert to Deck (Esc)` button.
   - This causes an unsightly "staircase" wrap, pushing upper orphan buttons into disjointed rows with uneven margins.

3. **Desynchronization of Host Slide Advancements on Remote Console**:
   - While remote-to-host slide intents work properly, host-to-remote slide changes do not propagate. When an AV booth operator moves slides on the host workstation (using keyboard arrows, spacebar, clicking thumbnails, or auto-loop), the mobile phone remote fails to update and remains stuck on the initial slide.
   - Root Cause: In `PresenterOperator.tsx`, `setIndexAndSync` and `setBlankAndSync` invoke local BroadcastChannel (`broadcast(...)`), but never call `remoteSessionRef.current?.broadcastState({ index, blank })`. Slide index, blank state, live transition, background override, and presentation lock are never mirrored over SSE during ongoing service navigation.

4. **Inability of Remote Console to View Host Computer's Local Media Songs**:
   - In `PresenterOperator.tsx`, remote hydration only queries `GET /api/media/playlist`, which returns songs stored on the cloud server.
   - Local tracks loaded from the church computer's storage reside strictly within the host PC's browser IndexedDB (`localMediaRegistry`).
   - The host workstation never mirrors its playlist manifest (`mediaStore.items`) to remote clients. As a result, mobile operators only see cloud songs (e.g., `Media (2) [CLOUD]`) and cannot cue or view the local background music or video tracks stored on the host computer.

5. **Observation on Guest Switch Initial State & Host Device Gating**:
   - During initial verification, Guest Switch was temporarily reported unavailable until the physical capture device was selected on the host workstation and refreshed. This confirmed that host capture devices remain un-armed (`uiState: idle`) until explicit operator permission or selection occurs, reinforcing that remote controllers observe host readiness and require clear visual feedback when host capture is disarmed or unselected.

---

## 2. Technical Architecture & Invariants

```
┌────────────────────────────────────────────────────────┐
│             MOBILE REMOTE CONSOLE (/remote)            │
│  - Responsive 2-Row Media Bar (< 768px)                │
│  - Unified, single-line header action toolbar          │
│  - Mirrors host slide index, blank, transition & lock  │
│  - Renders mirrored local computer playlist manifest   │
└────────────────────────────────────────────────────────┘
                           ▲  │
       SSE State Telemetry │  │ Remote Intents
   (index, blank, manifest)│  │ (sync, media-select, etc.)
                           │  ▼
┌────────────────────────────────────────────────────────┐
│            HOST PRESENTATION WORKSTATION               │
│  - Executes all physical hardware & audio playback     │
│  - Broadcasts slide index & blank changes over SSE     │
│  - Mirrors playlistManifest (cloud + local items)      │
│  - Cues local media files upon remote intent receipt   │
└────────────────────────────────────────────────────────┘
```

### 2.1 Responsive 2-Row Media Control Bar (< 768px)
- On desktop view (`md:flex-row md:h-13`): maintain the existing compact 1-row layout.
- On mobile view (`< 768px`): restructure `MediaControlBar.tsx` into a 2-row layout (`flex-col h-auto py-2 gap-2`):
  - **Row 1 (Track Info & Scrubbing)**: Media icon, track title with truncation, source badge (`[CLOUD]` / `[COMPUTER]`), current time, full-width scrubbar, total duration, and `Media (N)` drawer launcher button.
  - **Row 2 (Transport & Audio)**:
    - Transport buttons: `Prev`, `Play/Pause` (accented), `Next`, `Stop`, `Fade Out`.
    - Mode buttons: `Shuffle`, 3-state `Repeat`.
    - Audio controls: `Mute` toggle and Software Volume Slider.
    - Projection button: `Project Video`.

### 2.2 Header Layout Harmony & Zero Layout Shift
- In `PresenterOperator.tsx`, refactor header actions on `mode === 'remote'` to eliminate artificial row breaks:
  - Collapse upper actions into a single flat flex container: `[Request Congregation Screen Reopen]`, `[Unlock Service]`, and `[All slides]` aligned horizontally.
  - Refactor `PresenterGuestFeedControl.tsx` for compact representation:
    - On mobile / remote, suppress the redundant read-only device dropdown when live.
    - When `uiState === 'confirmed-live'`, present a streamlined status strip (`[Guest Live]` + `[Revert to Deck (Esc)]`) that does not expand beyond container boundaries.

### 2.3 Comprehensive Host-to-Remote Telemetry Synchronization
- In `PresenterOperator.tsx`:
  - `setIndexAndSync(clamped)`: call `remoteSessionRef.current?.broadcastState({ index: clamped })`.
  - `setBlankAndSync(blank)`: call `remoteSessionRef.current?.broadcastState({ blank })`.
  - `setTransitionAndSync(transition)`: call `remoteSessionRef.current?.broadcastState({ transition })`.
  - `setBackgroundAndSync(background)`: call `remoteSessionRef.current?.broadcastState({ background })`.
  - `setPresentationLock(locked)`: call `remoteSessionRef.current?.broadcastState({ presentationLock: locked })`.
- In `src/lib/presenter-remote-client.ts`: extend `RemoteControlSessionState` with `presentationLock?: boolean; playlistManifest?: PlaylistItemSummary[]`.
- In `RemoteOperator.tsx` & `PresenterOperator.tsx`: ensure remote state consumers update UI immediately upon receipt.

### 2.4 Remote Local Computer Media Manifest & Remote Cueing
- Extend `RemoteControlSessionState` with `playlistManifest?: Array<{ id: string; name: string; type: 'audio' | 'video'; source: 'cloud' | 'local'; duration: number; orderKey?: number }>`.
- On Host Workstation: subscribe to `mediaStore` and broadcast `playlistManifest` whenever playlist items change or when a remote client pairs.
- On Remote Client: merge `playlistManifest` into `mediaStore.items`, displaying both Cloud and Computer songs with their respective badges (`[CLOUD]` vs `[COMPUTER]`).
- When a remote operator clicks a computer song, dispatch `media-select-item` `{ id }` to host. Host workstation, possessing the local file handle/IndexedDB blob, authoritative cues and plays the media.

---

## 3. Tickets Breakdown

1. **`SPEC-117-01`**: Responsive 2-Row Layout and Touch Ergonomics for MediaControlBar on Mobile Screens.
2. **`SPEC-117-02`**: Presenter Header Layout Harmony, Compact Guest Feed Controls, and Remote View Consolidation.
3. **`SPEC-117-03`**: Bidirectional Presentation Telemetry Synchronization: Slide Index, Blank Screen, Transition, Background & Lock.
4. **`SPEC-117-04`**: Remote Local Computer Media Playlist Manifest Mirroring, Multi-Source Availability & Remote Cueing.
