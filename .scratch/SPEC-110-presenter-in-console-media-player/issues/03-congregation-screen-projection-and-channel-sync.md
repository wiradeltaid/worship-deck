# SPEC-110-03 — Congregation Screen Video Projection & Channel Sync

**Satisfies:** [UC-12, UC-28, FR-16, FR-33]
**Blocked by:** [SPEC-110-02]
**Status:** closed

## Summary
Extend `present-channel.ts` and `ProjectorClient.tsx` to support `ProjectedSource` with `kind: 'media'`, allowing manual video projection with crossfade transitions, mutual exclusivity with guest feeds, and projector-side mute enforcement.

## Key Responsibilities
1. **`present-channel.ts` Wire Protocol**:
   - Extend `ProjectedSource` to include:
     ```ts
     | { kind: 'media'; mediaId: string; mediaUrl: string; isPlaying: boolean; mediaTime: number; at: number; revision: number }
     ```
   - Update `projectionOf()` in `present-channel.ts` to parse the new `kind: 'media'` branch, failing closed to `{ kind: 'deck' }` on unrecognized inputs.
   - Enforce mutual exclusivity on the presenter: at most one of `guest` or `media` is active at any time. Activating one immediately clears the other.
   - Add projector acknowledgment message: `ProjectorMediaStatusMessage` `{ type: 'projector-media-status', mediaId: string, state: 'attached' | 'unavailable', reason?: string }` (governed by AD-29).
2. **`ProjectorClient.tsx` & `ProjectedMediaLayer.tsx`**:
   - Render plain video `<video muted src={mediaUrl}>` at layer `z-30` reusing `getGuestTransitionStyle` for entering/exiting visual continuity (does not reuse the guest MediaStream bridge).
   - Strictly enforce `muted` attribute and `video.muted = true` upon mount and every state update to prevent HDMI sound collision.
   - Clock sync & drift correction: Seek if drift > 0.5s; nudge `playbackRate` if drift is between 0.05s–0.5s.
3. **Presenter Side & Fail-Closed Invariants**:
   - Status badge transitions: `Mengirim…` $\to$ `DI LAYAR` upon projector acknowledgment $\to$ `Gagal` upon timeout.
   - On Presenter boot/reload, if in-memory media state is empty, broadcast an authoritative `{ kind: 'deck' }` to ensure no orphan video plays on projector.
   - On Projector reconnect mid-video, fail-closed to `{ kind: 'deck' }` if authoritative projection is not active.
   - Changing items or track completion automatically disables projection (`kind: 'deck'`).

## Acceptance Criteria
- Video in projector window remains strictly muted under all conditions.
- Disabling projection or changing items cleanly returns congregation display to active slide.
- Projector reconnects cleanly without rendering broken media elements or playing orphan video.
