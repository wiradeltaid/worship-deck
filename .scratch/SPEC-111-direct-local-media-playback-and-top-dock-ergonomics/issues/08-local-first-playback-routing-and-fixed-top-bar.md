# SPEC-111-08 — Local-First Playback Routing and Fixed-Height Top Control Bar

**Satisfies:** [UC-12, FR-16]
**Blocked by:** ["SPEC-111-07"]
**Status:** open

## Summary
Implement local-first playback priority routing with strict cue-time verification predicates and relocate media controls to a fixed-height horizontal bar positioned between the header cluster and slide monitors.

## Key Responsibilities
1. **Local-First Playback Routing (Strict K3 Predicate)**:
   - At cue/load time: an item from `Pustaka Cloud` is routed to local Service Worker `/local-media/:sha256` ONLY if ALL four conditions hold:
     1. `sha256` is present and verified in local `media-index`.
     2. Handle permission is `granted`.
     3. File size and lastModified match the verified local record.
     4. `navigator.serviceWorker.controller` is active in BOTH Presenter and Projector windows (preventing failures if hard reload bypassed Service Worker).
   - **Fallback Guard**: If any predicate fails at cue time, surface an operator toast ("Diputar dari cloud: [alasan]") and seamlessly route to cloud stream `/api/media/:id/content`.
   - **Mid-Playback Failure**: If local media I/O fails during active playback, stop cleanly and return to active slide (fail-closed, no unpredictable mid-song switching).
2. **Fixed-Height Top Control Bar (`<src/operator/present/media-player/MediaTopBar.tsx>`)**:
   - Mount directly below `presenter-header-row-3` and directly above Current Slide and Next Slide monitors in `PresenterOperator.tsx`.
   - Fixed height slot (~44px) to guarantee zero layout shift for slide monitors during service.
   - Status disabled when idle; active when media is cued.
   - Render active source indicator: text badge `Lokal` or `Cloud`.
   - Full panic controls on the left: Play/Pause, Fade Out (~3s linear attenuation with auto-pause and volume restore), Mute, Take Off Screen, Stop.
   - Ensure all buttons apply `onMouseDown={(e) => e.preventDefault()}` to preserve global `Space` slide navigation.

## Acceptance Criteria
- Playing a downloaded cloud item prioritizes local stream without remote bandwidth consumption only when all four K3 predicates are verified.
- Any predicate failure at cue time falls back gracefully to cloud stream with an informative operator toast.
- Top control bar renders in a fixed slot without shifting slide preview monitors when activated or dismissed.
- Panic controls remain responsive in 1 click even under Presentation Lock.
