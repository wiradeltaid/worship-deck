# SPEC-115-03 — Full-Surface Remote Intent Telemetry & Bidirectional Media/Slide Control

**Satisfies:** [UC-12, UC-29, FR-16, FR-35]
**Blocked by:** ["SPEC-115-02"]
**Status:** closed

## Summary
Formalize the media remote intent schema and authority boundary, expand `PresenterRemoteIntent` and backend relay to support full media transport controls (Play/Pause, Stop, Fade, Seek, Project Video, Shuffle, Repeat), and mirror active media playback state back to remote clients in real time.

## Key Responsibilities
1. **Media Remote Intent Schema & Authority Boundary (`presenter-remote-client.ts`, `internal/httpapi/remote.go`)**:
   - Host workstation remains the sole author of presentation and media element state.
   - Remote actions generate non-authoritative intents routed via `POST /api/present/:id/remote/intent`.
   - Add media intent types to `PresenterRemoteIntent`:
     - `media-play`: triggers `mediaEngine.play()`.
     - `media-pause`: triggers `mediaEngine.pause()`.
     - `media-stop`: triggers `mediaEngine.stop()`.
     - `media-fade`: triggers `mediaEngine.fade()`.
     - `media-seek`: carries `timeSeconds: number` and invokes `mediaEngine.seek(time)`.
     - `media-toggle-project`: toggles `SET_PROJECTED`.
     - `media-select-item`: carries `id: string` and invokes `SELECT_ITEM`.
     - `media-toggle-shuffle`: toggles `SET_SHUFFLE`.
     - `media-cycle-repeat`: cycles `SET_REPEAT_MODE`.
   - Update Go HTTP API whitelist in `internal/httpapi/remote.go` (`allowedIntentTypes`) to accept the new media intents.
2. **Strict Payload Validation, Idempotency & Monotonicity**:
   - Backend strictly validates payload types: whitelist intent types, enforce non-negative numeric time values for seek, validate string ID format.
   - Intents carry `planIdentity` and revision numbers; mismatched plan identity is rejected fail-closed to prevent out-of-order execution across plan reloads.
3. **Intent Dispatching from Remote Console (`PresenterOperator.tsx`)**:
   - In `mode="remote"`, wrap all media control actions (buttons on `MediaControlBar`, `MediaDrawer`, spacebar shortcuts) to dispatch `sendIntent({ type: 'media-...' })` instead of directly controlling local hardware.
4. **Host-to-Remote State Mirroring**:
   - When host media state updates (playhead, isPlaying, isProjected, activeId, shuffle, repeatMode), broadcast mirrored state across SSE channel to remote clients so the remote seekbar and buttons update live in lockstep.

## Acceptance Criteria
- Clicking Play/Pause on the remote device starts/pauses media playback on the host machine.
- Clicking Fade on the remote device attenuates volume and pauses playback on the host machine.
- Clicking Next/Previous or selecting an item in the remote Media Drawer changes the active track on the host machine.
- Toggling Project Video on the remote device switches the host's sanctuary projector between video and slide deck.
- The remote console seekbar and playhead reflect the host's actual playing position in real time.
- Invalid, malformed, or out-of-order intents are rejected by backend validation without crashing host state.

## Comments
