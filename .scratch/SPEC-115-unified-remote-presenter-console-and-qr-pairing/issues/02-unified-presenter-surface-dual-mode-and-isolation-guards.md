# SPEC-115-02 — Unified Presenter Surface Dual-Mode Architecture & Surface Isolation Guards

**Satisfies:** [UC-12, UC-29, FR-16, FR-35]
**Blocked by:** ["SPEC-115-01"]
**Status:** open

## Summary
Unify `PresenterOperator.tsx` and `RemoteOperator.tsx` under a single canonical console architecture parameterized by `mode: 'host' | 'remote'`, enforcing strict surface isolation guards for audio, projector broadcast, and local device hardware, while excluding durable editing mutations from the remote console.

## Key Responsibilities
1. **Dual-Mode Console Shell (`PresenterOperator.tsx`, `RemoteOperator.tsx`)**:
   - Parameterize `PresenterOperator` with `mode?: 'host' | 'remote'` (default `'host'`).
   - In `RemoteOperator.tsx`, once paired, render `PresenterOperator` in `mode="remote"`, giving the remote device the identical presenter console layout (Slide Filmstrip, Active Slide Stage, Media Control Bar, Drawer, Scripture lookup, live transition selectors).
2. **Durable Mutation Boundary (Host Authority)**:
   - In `mode="remote"`, durable mutation surfaces (Emergency Edit modal, Run Sheet item additions/reordering, service metadata editing) are disabled or hidden.
   - The remote console has live operational control (slides navigation, media transport, cueing, blanking, scripture overlay broadcast), but zero durable editing authority.
3. **Surface Isolation Invariants (Remote Mode)**:
   - **Audio Mute Invariant**: In `mode="remote"`, all local media elements (`mediaAudioRef`, `mediaVideoRef`) are strictly muted with volume locked to 0. Audio outputs exclusively on the target host machine connected to the church sound system.
   - **Projector Bypass Invariant (AD-10, AD-29)**: In `mode="remote"`, local `BroadcastChannel` instantiation to the sanctuary screen is suppressed. Remote clients never open or manage physical projector windows and never alter the host-projector AD-29 liveness evaluator.
   - **Hardware Capture Bypass Invariant**: In `mode="remote"`, UVC HDMI capture card enumeration (`navigator.mediaDevices.enumerateDevices`) and camera/microphone permission prompts (`getUserMedia`) are completely disabled.
   - **Cache & Offline Persistence Isolation**: In `mode="remote"`, Cache API and IndexedDB writes are prohibited. No local media or slide AST files are cached offline.
   - **Read-Through Visual Preview**: Slide ASTs, thumbnail images, and scripture lookup (KJV/TB) are fetched transiently in read-through mode solely for visual rendering on the remote screen, without local disk persistence.

## Acceptance Criteria
- Paired remote device displays the identical presenter console layout as the host workstation.
- Remote device plays zero sound; audio elements are muted with volume 0 and audio plays exclusively on the host.
- Remote device never opens or attempts to broadcast to a local projector screen or alter AD-29 predicate.
- Remote device never prompts for camera/microphone permissions or enumerates devices.
- Remote device performs zero Cache API or IndexedDB writes.
- Emergency Edit modal and durable service modification tools are hidden or disabled in remote mode.

## Comments
