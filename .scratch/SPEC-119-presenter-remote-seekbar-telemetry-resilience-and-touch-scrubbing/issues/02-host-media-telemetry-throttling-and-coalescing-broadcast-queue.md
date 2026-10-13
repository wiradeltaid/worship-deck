# SPEC-119-02 — Optimized Host Media Telemetry Throttling & Coalescing Broadcast Queue

**Satisfies:** [UC-12, UC-29, FR-16, FR-35]
**Blocked by:** ["SPEC-119-01"]
**Status:** closed
**Closed at:** 2026-10-13
**Verdict:** APPROVED (Peer reviews: DeepSeek V4 Pro via CodeBuddy CN [APPROVED], GLM-5.3 via CodeBuddy CN [APPROVED])

## Summary
Optimize media telemetry broadcasting on host workstation (`PresenterOperator.tsx`) and client connection manager (`presenter-remote-client.ts`). Decouple `playlistManifest` from continuous store clock ticks, throttle continuous `currentTime` broadcasts to at most once per 500ms, and implement a single-flight coalescing broadcast queue. This eliminates HTTP request flooding, promise backlogs, and Go backend SSE buffer overflows that cause stuttering and freezes.

## Key Responsibilities
1. **Decouple Manifest Broadcasting from Playback Clock (`src/operator/present/PresenterOperator.tsx`)**:
   - Only include `playlistManifest` in `broadcastState` when the playlist items array actually changes (additions, moves, deletions) or upon initial remote connection / SSE reconnect / resume (`remoteState === 'connected'`).
   - Do NOT serialize the entire `playlistManifest` array on every 250ms store tick.
2. **Throttle Continuous Playback Clock**:
   - When playing, throttle continuous `currentTime` telemetry broadcasts to at most once per 500ms.
   - Immediately broadcast discrete state transitions: play, pause, stop, seek, track selection, volume change, mute toggle, and repeat/shuffle changes.
3. **Single-Flight Coalescing Queue (`src/lib/presenter-remote-client.ts`)**:
   - Refactor `PresenterRemoteSession.broadcastState`:
     - Maintain an `isBroadcasting` flag and a `pendingState` slot.
     - If a broadcast HTTP request is currently in-flight, merge incoming state updates into `pendingState` with latest-state precedence.
     - When the in-flight request resolves, dispatch `pendingState` in a single consolidated HTTP POST and clear the slot.
     - Supersede older intermediate timestamps, eliminating sequential promise chaining backlogs and buffer overflow in Go's `remoteChans` (buffer 16).

## Acceptance Criteria
- Host workstation limits continuous media telemetry HTTP POST requests to at most ~2 requests per second during playback, instead of unbounded 4+ requests per second with full manifest dumps.
- Discrete actions (play/pause/seek) broadcast immediately without delay.
- In-flight request coalescing ensures zero sequential queue accumulation under network latency.
- Automated tests in `tests/remote-presenting-client.test.mjs` verify throttled and coalesced broadcast behavior.
