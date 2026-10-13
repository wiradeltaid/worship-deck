# SPEC-116-03 — Guest HDMI Capture Remote Telemetry, Idempotent Projection, and Projector Reopen/Refocus Protocol

**Satisfies:** [UC-12, UC-29, FR-16, FR-25, FR-35]
**Blocked by:** ["SPEC-116-02"]
**Status:** done

## Summary
Extend Go backend `allowedIntentTypes` with guest HDMI capture intents (`guest-arm`, `guest-disarm`, `guest-project`) and projector refocus intent (`request-reopen-projector`), contract `guestFeed` and `projector` telemetry in `RemoteControlSessionState`, mirror host state via SSE broadcasts, render Header Row 3 Guest Capture controls on remote devices without triggering local `getUserMedia`, and provide a popup-blocker-safe reopen/refocus protocol.

## Key Responsibilities
1. **Go HTTP Backend Intent Whitelist (`internal/httpapi/remote.go`)**:
   - Add `guest-arm`, `guest-disarm`, `guest-project`, and `request-reopen-projector` to `allowedIntentTypes`.
   - Validate incoming payload structure, enforce `planIdentity`, reject unauthenticated requests with 401, reject unpaired callers with 409, and forward over presenter SSE channels.
2. **Client-Side Intent Types & Handlers (`presenter-remote-client.ts`)**:
   - Add `{ type: 'guest-arm'; planIdentity: string }`, `{ type: 'guest-disarm'; planIdentity: string }`, `{ type: 'guest-project'; projected: boolean; planIdentity: string }`, and `{ type: 'request-reopen-projector'; planIdentity: string }` to `PresenterRemoteIntent`.
   - In `PresenterActionHandlers` and `applyRemoteIntent`, handle guest capture actions on host by delegating to `guestFeedControllerRef.current` and projector display controls.
3. **Telemetry Contracting & Emission Lifecycle (`presenter-remote-client.ts`, `PresenterOperator.tsx`)**:
   - Contract in `RemoteControlSessionState`:
     - `guestFeed?: { uiState: GuestFeedUiState; projection: ProjectedSource; frameHealth: FrameHealthStatus; errorMessage: string | null }`
     - `projector?: { hasOpen: boolean; isAlive: boolean }`
   - Host `PresenterOperator` subscribes to `PresenterGuestFeedController` and projector liveness changes, calling `broadcastState()` on every transition.
4. **Remote Surface Isolation for Capture (`PresenterOperator.tsx`, `PresenterGuestFeedControl.tsx`)**:
   - Render Header Row 3 Guest Feed controls on remote mode based on mirrored telemetry.
   - Dispatch remote intents on user click without invoking local `navigator.mediaDevices.getUserMedia()`.
5. **Projector Reopen / Refocus Protocol & Popup-Blocker Safety (`PresenterOperator.tsx`)**:
   - If host projector window is still open: host immediately calls `projectorRef.current.focus()` (clean, zero-popup blocker).
   - If host projector window is closed: host renders a high-visibility, 1-click action prompt on the presenter console (`[Buka Proyektor Sekarang]`), allowing the booth operator to grant user-activation safely.

## Acceptance Criteria
- Go backend accepts `guest-arm`, `guest-disarm`, `guest-project`, and `request-reopen-projector` from paired remote clients, rejecting unauthenticated callers with 401 and unpaired callers with 409.
- Triggering Arm or Project Guest Video from mobile dispatches the intent to the host workstation.
- Mobile device never prompts for camera or microphone permissions (`getUserMedia`).
- Host workstation arms the physical USB capture card and reflects live status back to the mobile screen via SSE.
- Requesting projector reopen from mobile focuses existing projector or presents an immediate 1-click CTA on the host workstation.

## Comments
- Extended Go backend `allowedIntentTypes` with `guest-arm`, `guest-disarm`, `guest-project`, and `request-reopen-projector` with strict boolean validation on `projected`.
- Added client-side remote intent types and handlers in `presenter-remote-client.ts` delegating to `guestFeedController` and projector window display controls on host machine.
- Contracted concrete union telemetry types (`GuestFeedUiState`, `ProjectedSource`, `FrameHealthStatus`) in `RemoteControlSessionState['guestFeed']` and bidirectional SSE state broadcasts on host.
- Isolated remote capture surface in `PresenterGuestFeedControl.tsx`, mounting Header Row 3 on remote without invoking local `navigator.mediaDevices.getUserMedia()`.
- Implemented projector reopen/refocus protocol: zero-popup refocus when projector window is open, and prominent 1-click CTA banner (`[Buka Proyektor Sekarang]`) on host when closed.
- Peer review passed: DeepSeek V4 Pro verdict `SETUJU` (with advisory AD-29 remote liveness-blindness recommendation adopted); Terra Codex findings addressed (tightened telemetry union types, full `ProjectedSource` object emission, and end-to-end SSE serialization test coverage).
- Verified green across: `tests/presenter-guest-feed-controls.test.mjs` (33/33 pass), `tests/remote-control-go-http.test.mjs` (9/9 pass), `tests/remote-screen.test.mjs` (13/13 pass), `tests/remote-presenting-client.test.mjs` (26/26 pass), `smoke:spec-115` (77/77 pass), `npm run typecheck` (0 errors), `npm run build` (clean build), `public-repo-guard.test.mjs` (5/5 pass), `go test ./...` (100% green), `git diff --check` (clean).
