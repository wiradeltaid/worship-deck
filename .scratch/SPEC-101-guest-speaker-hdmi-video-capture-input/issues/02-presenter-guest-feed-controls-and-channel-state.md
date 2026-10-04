# 02: Presenter Guest Feed Controls, Operator Preview, and Channel Sync

**What to build:** In `<src/operator/present/PresenterGuestFeedControl.tsx>`, `src/operator/present/PresenterOperator.tsx`, and `src/lib/present-channel.ts`:

1. **Presenter Header Controls Component (`<src/operator/present/PresenterGuestFeedControl.tsx>`)**:
   - Device selector dropdown showing available video input devices from `CaptureBroker`.
   - Distinct lifecycle buttons:
     - **"Arm Guest Feed"**: Triggers broker capture within user interaction. Shows loading/arming spinner.
     - **Operator Preview Surface**: Compact, aspect-ratio-contained `<video muted playsInline autoPlay />` thumbnail in the operator toolbar.
     - **Live Signal Badge**: Displays actual resolution and frame rate (e.g. `1080p 60fps` or `1080p 30fps - Ready`). Displays warning if frame compositor stalls.
     - **"Switch to Guest Screen"**: Enabled only when broker is in `ready` state. Transitions state to `live`.
     - **"Revert to Deck"**: High-contrast, immediately accessible emergency panic button. Transitions state back to `ready` while keeping the stream pre-warmed.
     - **"Disarm"**: Releases hardware capture and transitions state to `idle`.
   - Hotkey support:
     - Window capture-phase `Escape` handler guarantees immediate revert even if dropdown `<select>` is focused.
     - `G` hotkey acts with explicit target intent (arms/switches when in `ready`, reverts when in `live`).

2. **Presenter Sync Channel Protocol (`AD-10`)**:
   - Extend `PresentMessage['sync']` in `src/lib/present-channel.ts` with:
     ```ts
     export type ProjectedSource =
       | { kind: 'deck' }
       | { kind: 'guest'; guestSessionId: string };
     ```
   - Invariant: NEVER serialize `MediaStream`, DOM nodes, or binary video buffers into `BroadcastChannel`.
   - Channel state is purely ephemeral broadcast state synchronized under `planIdentity`. `localStorage` is NOT used for live video control.

3. **PresenterOperator Integration & Authority**:
   - Mounts `<src/operator/present/PresenterGuestFeedControl.tsx>` into the Presenter Header alongside display controls.
   - `currentState()` explicitly includes `projection: projectionRef.current`.
   - Scripture overlay mutual exclusivity: switching to guest clears active scripture; pushing scripture reverts to deck.
   - Authoritative failover: on device disconnection (`masterTrack.onended`) or projector `unavailable` message, the Operator Console immediately broadcasts `{ type: 'sync', projection: { kind: 'deck' } }` so presenter and projector states remain in sync.

4. **Automated Unit Tests in `tests/presenter-guest-feed-controls.test.mjs`**:
   - State machine transitions:
     - `idle` -> `arming` -> `ready` -> `live`
     - `live` -> `ready` (revert to deck while stream stays warm)
     - `ready` -> `idle` (disarm)
     - `live` -> `lost` -> fallback broadcast to `deck`
   - Arm button invokes broker; switch button disabled until `ready`.
   - Presenter channel broadcast payload verified: `projection: { kind: 'guest', guestSessionId }`.
   - Revert button resets `projection` to `{ kind: 'deck' }`.
   - Hotkey triggers verified, including `Escape` while form select element has focus.
   - Scripture overlay exclusivity verified.

**Blocked by:** SPEC-101-01

**Status:** open

- [ ] Implement `<src/operator/present/PresenterGuestFeedControl.tsx>` with device picker, preview thumbnail, and panic button.
- [ ] Extend `PresentMessage['sync']` in `src/lib/present-channel.ts` with `projection: ProjectedSource`.
- [ ] Integrate into `PresenterOperator.tsx` header toolbar with authoritative channel failover and window capture-phase `Escape` hotkey.
- [ ] Add comprehensive automated tests in `tests/presenter-guest-feed-controls.test.mjs`.
