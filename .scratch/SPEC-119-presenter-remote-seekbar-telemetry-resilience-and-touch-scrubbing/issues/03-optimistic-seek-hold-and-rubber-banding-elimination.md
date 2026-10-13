# SPEC-119-03 — Optimistic Seek Hold, Telemetry Reconciliation & Rubber-Banding Elimination

**Satisfies:** [UC-12, UC-29, FR-16, FR-35]
**Blocked by:** ["SPEC-119-02"]
**Status:** closed
**Closed at:** 2026-10-13
**Verdict:** APPROVED (Peer reviews: DeepSeek V4 Pro via CodeBuddy CN [APPROVED], GLM-5.3 via CodeBuddy CN [APPROVED])

## Summary
Eliminate seekbar rubber-banding on the remote controller (`MediaControlBar.tsx`). When an operator seeks on remote, update the remote `mediaStore` optimistically with the seeked timestamp and maintain an optimistic seek hold grace period so that in-flight or delayed host telemetry does not snap the seekbar back to the pre-seek position before the host processes the seek.

## Key Responsibilities
1. **Optimistic Store Dispatch on Remote Seek (`src/operator/present/media-player/MediaControlBar.tsx`)**:
   - In `commitSeek`, when `onRemoteMediaIntent` is active:
     - Dispatch `store.dispatch({ type: 'SET_TIME', currentTime: val })` optimistically on remote `mediaStore`.
     - Record `lastSeekTargetRef.current = val` and `lastSeekCommittedAtRef.current = Date.now()`.
2. **Optimistic Hold Grace Period**:
   - For a short grace window (1000ms) following a remote seek commit, ignore incoming `state.currentTime` updates from host if they regress significantly from `lastSeekTargetRef`.
   - Display the user's committed seek time smoothly without jarring rubber-band jumps.
3. **Smooth Reconciliation**:
   - Once the host's actual post-seek timestamp arrives or the grace window elapses, smoothly resume tracking live host playback time.
   - If the seek fails on the host or duration boundary is reached, fallback cleanly to authoritative host state once grace window elapses.

## Acceptance Criteria
- Dragging and releasing the seekbar on remote keeps the slider at the target time smoothly without snapping back to the pre-seek timestamp.
- Host workstation receives `media-seek` and positions audio playback at the chosen timestamp.
- Automated tests in `tests/presenter-media-player.test.mjs` verify optimistic store dispatch and grace period reconciliation.
