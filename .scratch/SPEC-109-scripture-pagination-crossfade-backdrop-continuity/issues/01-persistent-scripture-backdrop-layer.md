# 01: Persistent Scripture Backdrop Layer and Lifecycle Continuity

**Satisfies:** [UC-12, UC-13, FR-16, FR-19, AD-23]
**Blocked by:** none
**Status:** open

**What to build:** In `src/projected/ProjectorClient.tsx`:

1. **Dedicated Backdrop State & Ref Lifecycle**:
   - Manage `backdropPhase: 'hidden' | 'entering-start' | 'active' | 'exiting'` alongside `overlayPhase` and `outgoingPhase`.
   - Maintain `backdropTimerRef` to track any pending backdrop transition timeouts.
   - Integrate `backdropTimerRef` into all cancellation and teardown paths:
     - Rapid clicks / successive `applyScriptureOverlay` calls.
     - `clearScriptureOverlay` cancellation.
     - Stale plan rejection (`adoptsSharedState` failure).
     - Component cleanup on unmount and channel close.

2. **Lifecycle State Machine & Reload Parity**:
   - **Initial Projector Sync / Reload (UC-12 Invariant)**:
     - When `isInitialSyncRef.current === true`: if `nextScripture` exists, set `backdropPhase` directly to `'active'` without scheduling any entrance animation, preserving the instant reload contract.
   - **User-Triggered Initial Entrance** (`!currentActive \to newScripture`):
     - If `durationMs === 0`: `setBackdropPhase('active')` synchronously.
     - If animated: `setBackdropPhase('entering-start')`, then transition to `'active'` on a 20ms tick.
   - **Scripture-to-Scripture Pagination** (`currentActive` exists and `newScripture` received):
     - Keep `backdropPhase` strictly at `'active'`! Do NOT trigger entrance or exit animations on the backdrop layer. The backdrop remains solidly opaque at 1.0 throughout page navigation.
   - **Clear Scripture** (`clearScriptureOverlay`):
     - If `durationMs === 0`: `setBackdropPhase('hidden')` immediately.
     - If animated: `setBackdropPhase('exiting')`, and transition to `'hidden'` after `durationMs` timer.

3. **DOM Layer Mount & Stacking Order**:
   - Mount `<div data-testid="projector-scripture-backdrop" ... />` at `z-20` immediately before `outgoingOverlay` and `activeOverlay`.
   - Style with `getScriptureBackdropStyle(transition, backdropPhase)` from `@/lib/transitions` and solid `bg-[#0B1220]`.
   - Ensure pointer events are disabled (`pointer-events-none`).
