# SPEC-117-03 — Bidirectional Presentation Telemetry Synchronization: Slide Index, Blank Screen, Transition, Background & Lock

**Satisfies:** [UC-12, UC-29, FR-16, FR-35]
**Blocked by:** ["SPEC-117-02"]
**Status:** open

## Summary
Implement real-time bidirectional telemetry mirroring from the presentation host workstation to connected mobile remote clients over SSE for slide index, blank screen, slide transition, background override, and presentation lock state. When an operator advances or navigates slides on the host PC (via keyboard, mouse, thumbnails, or auto-loop), remote devices immediately reflect the active slide index.

## Key Responsibilities
1. **Host-Side Presentation State Telemetry Broadcasts (`src/operator/present/PresenterOperator.tsx`)**:
   - In `setIndexAndSync(clamped)`: when `mode !== 'remote'`, add `void remoteSessionRef.current?.broadcastState({ index: clamped })`.
   - In `setBlankAndSync(blank)`: when `mode !== 'remote'`, add `void remoteSessionRef.current?.broadcastState({ blank })`.
   - In `setTransitionAndSync(transition)`: when `mode !== 'remote'`, add `void remoteSessionRef.current?.broadcastState({ transition })`.
   - In `setBackgroundAndSync(background)`: when `mode !== 'remote'`, add `void remoteSessionRef.current?.broadcastState({ background })`.
   - Introduce a synchronized lock helper `setPresentationLockAndSync(nextLock)` (or update `presentation-lock-toggle` onClick) to invoke `setPresentationLock(nextLock)` and broadcast `void remoteSessionRef.current?.broadcastState({ presentationLock: nextLock })` on host mode.
2. **Contracting Session State Fields (`src/lib/presenter-remote-client.ts`)**:
   - Extend `RemoteControlSessionState`:
     ```typescript
     export type RemoteControlSessionState = {
       index?: number;
       blank?: boolean;
       transition?: SlideTransition;
       background?: string | null;
       planIdentity?: string;
       presentationLock?: boolean;
       ...
     };
     ```
3. **Remote Consumer State Application & Telemetry Echo-Guard (`src/operator/present/RemoteOperator.tsx`, `PresenterOperator.tsx`)**:
   - In `RemoteOperator.tsx`: update `handleStateUpdate` to propagate `presentationLock` and ensure `controlledState` triggers immediate slide stage, filmstrip, and preview updates.
   - **Echo-Guard Invariant**: Applying received host telemetry on the remote console (`controlledState`) updates local React state and refs without re-dispatching intent messages back to the host, preventing ping-pong synchronization loops.
   - When host changes blank screen state, update the remote `Blank screen (B)` button to reflect the live blank/restore state.
4. **Backend Intent and Broadcast Verification (`internal/httpapi/remote.go`)**:
   - Verify that SSE broadcast events carry updated slide indices and presentation states without connection dropouts or lag.

## Acceptance Criteria
- Navigating slides on the host workstation (Next, Prev, thumbnail click, keyboard arrow, spacebar, auto-loop) immediately updates the current slide and preview on all paired remote mobile devices.
- Blanking the projector screen on the host workstation immediately updates the blank state indicator on the remote console.
- Changing live slide transitions or background overrides on the host immediately syncs to the remote console.
- Locking/unlocking presentation service on the host workstation reflects in the remote console header badge.
- Applying mirrored presentation telemetry on remote does not emit an echo intent back to the host workstation.
- Unit and integration tests in `tests/remote-presenting-client.test.mjs` and `tests/remote-control-go-http.test.mjs` pass cleanly.
