# SPEC-114-01 — Media Playback State Sync & Projector Desync Fix

**Satisfies:** [UC-12, FR-16]
**Blocked by:** []
**Status:** open

## Summary
Resolve Bug #1 (MediaDrawer Play/Pause toggle failure) and Bug #2 (video projection desync and 1–3s infinite heartbeat loop) across `MediaDrawer.tsx`, `MediaStage.tsx`, `playlist-model.ts`, and `PresenterOperator.tsx`.

## Key Responsibilities
1. **MediaDrawer Play/Pause Toggle Logic (`MediaDrawer.tsx`)**:
   - Refactor `handlePlayItem` into `handleTogglePlayItem(id: string)`.
   - If the clicked item is the currently selected item and `state.isPlaying === true`, invoke `engine.pause()` and dispatch `SET_PLAYING: false`.
   - If the item is paused or is a different track, dispatch `SELECT_ITEM: id`, and invoke `engine.play()`.
2. **Authoritative Handover Ownership (`MediaStage.tsx`, `PresenterOperator.tsx`)**:
   - Designate `MediaStage.tsx` as the single authoritative controller of HTML media element state transitions.
   - In `MediaStage.tsx`, when the active item transitions while `state.isPlaying` is true, automatically trigger `.play()` on the newly bound media element so local DOM playback advances in lockstep with the projector.
   - When switching active items while paused, keep `state.isPlaying` explicitly `false`.
   - In `MediaDrawer.tsx` `handleToggleProject`, when sending a new item to screen while media is playing, trigger `engine.play()` on the new video so local DOM time matches projector time and eliminates the 2s heartbeat drift reset loop.
3. **Store State Coherence (`playlist-model.ts`, `media-store.ts`)**:
   - Ensure `selectPlaylistItem` properly resets `currentTime: 0` without causing a desynchronized state between store `isPlaying` and HTML element `.paused` status.

## Acceptance Criteria
- Clicking Play on a track in the Media Drawer starts playback; clicking Pause on that same track immediately pauses playback.
- Sending a video track to screen while playing seamlessly switches playback to the video without audio dropouts or infinite 1–3s reset looping.
- Sending a video track to screen while paused cues the video cleanly at frame 0 on the projector without auto-playing or resetting.
- PresenterOperator 2-second heartbeat never rewinds projected video position to 0 during active playback.

## Comments
