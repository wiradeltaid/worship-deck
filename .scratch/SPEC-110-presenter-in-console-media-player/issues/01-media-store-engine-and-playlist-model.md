# SPEC-110-01 — Media Store, Pure Playlist Model, and Engine Lifecycle

**Satisfies:** [UC-12, UC-28, FR-16, FR-33]
**Blocked by:** none
**Status:** closed

## Summary
Implement the underlying domain model, pure playlist transitions, external subscription store, and singleton HTMLMediaElement engine wrapper in `src/operator/present/media-player/`.

## Key Responsibilities
1. **`playlist-model.ts`**:
   - Pure operations: `addItems`, `removeItem`, `moveItem(from, to)`, `getNextItem(current, playlist)`.
   - Invariant: Currently loaded/playing item cannot be removed.
   - Progression rule: Audio track auto-advances to the next audio track; halts if next track is video or current track is video.
2. **`media-store.ts`**:
   - External state store using `useSyncExternalStore` pattern.
   - Decouple high-frequency `currentTime` updates from general React context via fine-grained selectors to prevent re-rendering slide previews.
3. **`media-engine.ts` & `MediaStage.tsx`**:
   - Encapsulate `<audio>` and `<video>` elements as permanent DOM nodes that survive view toggles (drawer open/close).
   - Implement `play()`, `pause()`, `seek(time)`, `setVolume(vol)`, `fade(durationMs = 3000)`.
   - Linear volume reduction over 3s during fade, restoring initial volume on subsequent play.
   - **Fade Cancellation**: Stopping playback or switching tracks mid-fade immediately cancels the attenuation timer and restores volume.
   - **`play()` Promise Rejection Safety**: Catch `play()` rejections (browser autoplay blocks or buffering stalls) and update status without freezing the UI or panic controls.
   - **Decode Error Handling**: On `onerror` / `MEDIA_ERR_*`, halt playback, mark track status as `Gagal`, surface an operator toast, and automatically pull projection back to `deck`.

## Acceptance Criteria
- Unit tests verify playlist ordering, deletion guards, and auto-advance logic.
- Fading audio gradually attenuates volume and pauses cleanly without abruptly clipping audio.
- Rejected `play()` promises do not throw unhandled exceptions or block panic Mute/Pause.
- Decode errors trigger fallback to `deck` and non-blocking failure indicators.
