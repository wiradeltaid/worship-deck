# 03: Bidirectional Scripture Overlay Push, Page Navigation, and Exit Transition Parity

**Satisfies:** [UC-12, UC-13, FR-16, FR-19, AD-23]
**Blocked by:** SPEC-108-02
**Status:** closed

**What to build:** In `src/projected/ProjectorClient.tsx`:

1. **State Machine, Idempotency, and Direction Tracking**:
   - In `applyScriptureOverlay`:
     - Compare incoming `newScripture` against `activeOverlayRef.current`:
       - If identical in `reference`, `text`, `currentPage`, and `typographyMode`: Treat as idempotent re-sync (do NOT re-trigger animations or flicker).
       - If `!activeOverlayRef.current`: direction is `'initial'`.
       - If `activeOverlayRef.current`:
         - If `newScripture.currentPage === activeOverlayRef.current.currentPage`: direction is `'same-page'`.
         - If `(newScripture.currentPage ?? 0) > (activeOverlayRef.current.currentPage ?? 0)`: direction is `'next'`.
         - If `(newScripture.currentPage ?? 0) < (activeOverlayRef.current.currentPage ?? 0)`: direction is `'prev'`.
   - Update `overlayPhase: 'hidden' | 'entering-start' | 'active' | 'exiting'` and `outgoingPhase: 'hidden' | 'exiting-start' | 'exiting'`.

2. **Dynamic Duration & Timer Cancellation**:
   - Read canonical duration from `SLIDE_TRANSITION_SPECS[transition]`:
     - If `durationMs === 0` (`none` / `cut`):
       - For entrance/page turn: immediately set `activeOverlay = newScripture`, `overlayPhase = 'active'`, `outgoingOverlay = null`, `outgoingPhase = 'hidden'` with zero timer scheduling.
       - For exit (`clearScriptureOverlay`): immediately clear `activeOverlay = null`, `outgoingOverlay = null`, `overlayPhase = 'hidden'`, `outgoingPhase = 'hidden'` with zero delay.
     - If animated (`durationMs > 0`):
       - Mount incoming overlay with `overlayPhase = 'entering-start'`.
       - Next tick (20ms) set `overlayPhase = 'active'` and `outgoingPhase = 'exiting'`.
       - Schedule outgoing cleanup timer for `durationMs` (500ms for fade/dissolve, 450ms for push), cleanly clearing `outgoingOverlay` and setting `outgoingPhase = 'hidden'` upon completion.
   - Cleanly cancel all timers upon rapid click interruptions (`applyScriptureOverlay` / `clearScriptureOverlay` re-invocations) without ghost text lingering or orphaned timers.

3. **JSX Presentation Rendering**:
   - Replace hardcoded Tailwind `transition-opacity duration-300` classes on scripture containers with inline styles computed via `getScriptureTransitionStyle(transition, phase, direction)`.
   - Ensure `pointer-events-none`, `z-20` stacking, and 16:9 inner stage scaling remain intact.
