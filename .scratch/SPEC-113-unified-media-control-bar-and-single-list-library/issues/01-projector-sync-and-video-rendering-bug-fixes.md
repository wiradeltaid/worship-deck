# SPEC-113-01 — Projector Media Synchronization, Clock Contract, and Video Rendering Bug Fixes

**Satisfies:** [UC-12, FR-16]
**Blocked by:** []
**Status:** open

## Summary
Resolve critical synchronization, element handover, and video scaling defects in `PresenterOperator.tsx`, `ProjectedMediaLayer.tsx`, `MediaStage.tsx`, and `media-engine.ts`.

## Key Responsibilities
1. **Seekbar Broadcast & Clock Synchronization (`PresenterOperator.tsx`, `present-channel.ts`)**:
   - Introduce dedicated lightweight `media-clock` broadcast event emitting `{ type: 'media-clock', mediaId, mediaTime, at, isPlaying, revision, planIdentity }`.
   - Broadcast on seek commit (`onPointerUp`, `onKeyUp`, `onBlur`), 150ms trailing debounce during active scrubbing, and 2s heartbeat when projected.
   - Projector loop continuously corrects drift and safely returns `playbackRate` to `1.0`.
   - Immediately respond to `request-sync` with current media clock and active projection.
2. **Slide Advance Projection Preservation (`PresenterOperator.tsx`)**:
   - Ensure `projectionRef.current` mirrors `{ kind: 'media', ... }` whenever media projection is active, so `setIndexAndSync` on Next/Prev slide advance never resets projector to `kind: 'deck'`.
3. **Audio-Video State Handover & Fade Fix (`MediaStage.tsx`, `media-engine.ts`)**:
   - Re-apply `el.muted = store.isMuted` and `el.volume = engine.getBaseVolume()` whenever switching active media elements.
   - Decouple fade out attenuation from `store.volume` to prevent zeroing base volume.
   - Replace `display: none` in `MediaStage.tsx` with visually hidden composited element (`absolute h-px w-px opacity-0 pointer-events-none`).
4. **Projector Video Sizing (`ProjectedMediaLayer.tsx`)**:
   - Set `<video>` class to `absolute inset-0 w-full h-full object-contain` within `inset-0 bg-black` container, ensuring video fills screen with clean letterboxing without stretching or natural-size clipping.

## Acceptance Criteria
- Scrubbing or seeking the media seekbar immediately updates projector video playback position without freezing.
- Advancing slides in presenter view keeps projected video playing uninterrupted on projector.
- Switching between audio and video tracks preserves volume and mute settings.
- Low-resolution videos scale to maximum available projector screen dimensions.

## Comments
