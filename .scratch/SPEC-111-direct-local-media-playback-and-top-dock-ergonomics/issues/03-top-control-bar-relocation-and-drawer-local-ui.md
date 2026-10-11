# SPEC-111-03 — Top Media Control Bar Relocation Above Slide Monitors & Drawer Local UI

**Satisfies:** [UC-12, FR-16]
**Blocked by:** [SPEC-111-02]
**Status:** open

## Summary
Relocate the media dock from the bottom of the page to a top horizontal bar positioned between the header cluster and slide preview monitors, and update the Media Drawer with local file picking and source badges.

## Key Responsibilities
1. **`<src/operator/present/media-player/MediaTopBar.tsx>` (Relocated MediaDock)**:
   - Mount directly below the header cluster (below `presenter-header-row-3`) and directly above the Current Slide and Next Slide monitors in `PresenterOperator.tsx`.
   - Zero-scroll layout: height collapses to 0 when no media is loaded/active; smoothly expands to ~40–44px when media is active.
   - Retain full instant panic controls on the left operating directly on the operator console audio output:
     - Play / Pause toggle
     - Fade Out (~3s linear attenuation with auto-pause and volume restore)
     - Instant Mute toggle
     - Take Off Screen (pull projected video off sanctuary screen back to slides)
     - Stop & Close
   - Scrub bar, current time / duration display, and volume slider.
   - Ensure all buttons apply `onMouseDown={(e) => e.preventDefault()}` to prevent button focus retention so global `Space` advances slides reliably.
   - Invariant: Panic controls remain 100% active even under Presentation Lock.
2. **`MediaDrawer.tsx`**:
   - Add local file selection button via `window.showOpenFilePicker` alongside existing cloud upload.
   - Render clear visual badges: `[LOKAL]` (with readiness/permission status) vs `[CLOUD]`.
   - Provide "Izinkan Akses" and "Hubungkan Ulang" action buttons for items needing permission or missing handles.

## Acceptance Criteria
- Media controls are 100% visible above the fold without scrolling, regardless of slide list length.
- Presentation lock does not disable Pause, Fade, Mute, or Take Off Screen controls.
- Playlist items unmistakably display `[LOKAL]` vs `[CLOUD]` badges.
- Global `Space` key navigation reliably advances slides after clicking media controls.
