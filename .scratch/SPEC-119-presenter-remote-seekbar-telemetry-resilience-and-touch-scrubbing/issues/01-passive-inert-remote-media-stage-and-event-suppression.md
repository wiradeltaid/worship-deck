# SPEC-119-01 — Passive Inert MediaStage on Remote Mode (`isInert`) & Suppression of Local Playback Dispatchers

**Satisfies:** [UC-12, UC-29, FR-16, FR-35]
**Blocked by:** []
**Status:** open

## Summary
Enforce a completely passive, inert posture in `MediaStage.tsx` when `isInert === true` (`mode === 'remote'`). Suppress local media element `src` loading, playback calls, and all synthetic event dispatchers (`SET_TIME`, `SET_DURATION`, `SET_PLAYING`, `SET_PROJECT_STATUS`, etc.) from running on the remote controller. This stops the remote phone's idle local audio element from overriding `mediaStore.currentTime` with `0:00` and clobbering authoritative host SSE telemetry.

## Key Responsibilities
1. **Explicit Inert Prop Capability (`src/operator/present/media-player/MediaStage.tsx`)**:
   - Add explicit `isInert?: boolean` prop on `MediaStageProps` and pass `isInert={mode === 'remote'}` from `PresenterOperator.tsx`, decoupling inert remote behavior from generic volume muting.
2. **Inert Subscription Guard**:
   - In `MediaStage.tsx`, if `isInert === true`, return early from `store.subscribe` so that local `<audio>` / `<video>` elements never load track URLs (`src`), never call `load()`, and never call `play()`.
   - On mount with `isInert === true`, ensure existing media element refs are paused and stripped of `src`.
3. **Event Dispatcher Suppression**:
   - Add explicit `if (isInert) return;` guards across all element event callbacks:
     - `handleTimeUpdate` — must NOT dispatch `SET_TIME` with local `el.currentTime` (which is `0`).
     - `handleLoadedMetadata` — must NOT dispatch `SET_DURATION`.
     - `handlePlay` and `handlePause` — must NOT dispatch `SET_PLAYING`.
     - `handleEnded` — must NOT dispatch teardown actions.
     - `handleError` — must NOT dispatch error toast or error statuses.
4. **Architectural Compliance (AD-24, AD-37)**:
   - Host workstation executes physical output and is the sole authority on media state.
   - Remote controller's `mediaStore` is driven purely by incoming `controlledMediaState` from host SSE events without interference from local device hardware.

## Acceptance Criteria
- When `mode === 'remote'`, `MediaStage` does not load media sources or dispatch local events to `mediaStore`.
- Seeking on the host workstation accurately reflects the new `currentTime` on the remote seekbar without snapping back to `0:00`.
- Automated test in `tests/presenter-media-player.test.mjs` verifies that `isInert` suppresses all media element event dispatchers and proves this with defect injection.
