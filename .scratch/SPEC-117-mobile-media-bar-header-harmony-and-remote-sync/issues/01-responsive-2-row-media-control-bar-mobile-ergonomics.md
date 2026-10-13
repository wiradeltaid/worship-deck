# SPEC-117-01 — Responsive 2-Row Layout and Touch Ergonomics for MediaControlBar on Mobile Screens

**Satisfies:** [UC-12, UC-29, FR-16, FR-25, FR-35]
**Blocked by:** []
**Status:** closed

## Summary
Refactor `MediaControlBar.tsx` to provide an ergonomic responsive 2-row layout on mobile and compact screens (< 768px) while strictly preserving the compact 1-row layout on desktop screens (>= 768px). Row 1 houses track identification, full-width scrubbar, and drawer launcher, while Row 2 organizes transport controls, playback modes, volume slider, and video projection toggle with touch-friendly spacing.

## Key Responsibilities
1. **Responsive Container Restructuring (`src/operator/present/media-player/MediaControlBar.tsx`)**:
   - Replace fixed `flex-row h-13` with responsive Tailwind classes: `flex flex-col md:flex-row h-auto md:h-13 py-2 md:py-0 gap-2 md:gap-3 items-stretch md:items-center justify-between`.
2. **Row 1: Track Information, Full-Width Scrubbing, and Playlist Launcher**:
   - On mobile screens, render a dedicated top row containing:
     - Media type icon (`Music` / `Video`) + Track name (truncated with title tooltip) + Source indicator badge (`[LOCAL]` / `[CLOUD]`).
     - Current playback time (`formatTime(displayTime)`), full-width scrubbar slider, and total duration (`formatTime(duration)`).
     - Playlist Drawer launcher button (`[Media (N)]`) positioned at the right edge for quick thumb access.
3. **Row 2: Transport Buttons, Playback Modes, Volume Slider, and Projection**:
   - On mobile screens, render a dedicated bottom row containing:
     - Primary transport cluster: `Prev` (`SkipBack`), `Play`/`Pause` toggle (accented, high-contrast, touch-friendly min 40px width), `Next` (`SkipForward`), `Stop` (`Square`), and `Fade Out` (`TrendingDown`).
     - Mode cluster: `Shuffle` toggle and 3-state `Repeat` toggle (`off` -> `all` -> `one` -> `off`).
     - Audio cluster: `Mute` toggle and Software Volume Slider (`flex w-24`).
     - Video projection button: `Project Video` / `Take Off Projector`.
4. **Desktop Layout Parity**:
   - When viewport width >= 768px (`md:`), elements cleanly collapse into the established single horizontal bar without layout shift.
5. **Localization & Accessibility**:
   - Preserve all existing `aria-label`, `data-testid`, and `title` attributes using `useT()`.

## Acceptance Criteria
- On viewports < 768px (including mobile phones 380–450px), `MediaControlBar` displays in 2 distinct rows without horizontal overflow, wrapping artifacts, or compressed sliders.
- The seekbar in Row 1 expands across available width on mobile, allowing precise scrub and seek without touching transport buttons.
- On viewports >= 768px, `MediaControlBar` renders in a single horizontal row (`h-13`), matching desktop operator ergonomics.
- All transport, volume, fade, shuffle, repeat, and projection buttons remain fully interactive and trigger respective local engine actions or remote intents.
- Automated tests in `tests/presenter-media-player.test.mjs` and `tests/remote-screen.test.mjs` pass cleanly.
