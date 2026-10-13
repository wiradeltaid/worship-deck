# SPEC-118-04 — Resilient Remote Pairing Connection, Reconnect Retention, and Heartbeat Jitter Tolerance

**Satisfies:** [UC-29, FR-35]
**Blocked by:** ["SPEC-118-03"]
**Status:** open

## Summary
Harden the remote control connection protocol in Go backend (`internal/httpapi/remote.go`) and client (`presenter-remote-client.ts`). Implement token-based session resumption (`session_token`) so that mobile controllers can reconnect seamlessly after transient Wi-Fi drops or screen locks without needing a new PIN, while preserving the strict one-time-burn posture of the 6-digit pairing code and single-controller authority (AD-37). Tune SSE heartbeat tolerance from 15s to 30s.

## Key Responsibilities
1. **Durable Token-Based Session Resumption (`internal/httpapi/remote.go`)**:
   - Maintain the one-time-burn posture for the 6-digit PIN: claiming the PIN burns `r.code` so rogue devices cannot guess or reuse it.
   - Upon successful claim (`POST /api/present/{id}/remote/claim`), generate an opaque 32-byte hex `session_token` stored in the active presenting remote session and returned in the claim response.
   - Introduce `POST /api/present/{id}/remote/resume` (accepting `{ token: string, planIdentity: string }`):
     - If `token` matches the active remote session's `session_token`, re-bind the caller and return HTTP 200 with current presentation state.
     - If `token` is invalid or stale, return HTTP 401.
   - Allow SSE stream reconnection via `GET /api/present/{id}/remote/stream?token=<token>`.
2. **Single-Controller Authority Enforcement (AD-37)**:
   - If the host laptop generates a new pairing code or if an operator issues an explicit new claim, any prior `session_token` is immediately revoked and the previous stream receives a `role-lost` event.
   - A second distinct device cannot hijack an ongoing session using stale credentials.
3. **SSE Heartbeat Grace Tuning**:
   - Increase `StreamFreshnessWindow` from 15s to **30s** in `remote.go`.
   - The server maintains its 7.5s ping ticker; the 30s window allows 3–4 missed pings during hall Wi-Fi jitter or mobile OS sleep before the host terminates the stream.
4. **Client-Side Transparent Reconnect (`src/lib/presenter-remote-client.ts`, `src/operator/present/RemoteOperator.tsx`)**:
   - In `RemoteControlSession`, save `session_token` to `sessionStorage` upon successful claim.
   - On SSE connection drop or error, transition status to `reconnecting` and attempt automatic reconnection via `resume` with exponential backoff (1s, 2s, 4s, max 8s).
   - Only transition to `disconnected` (showing PIN entry) if `resume` returns 401 (explicit revocation) or after 5 consecutive failed resume attempts.
   - If the user reloads the page or navigates back, auto-resume using the stored `session_token`.
5. **Clean Session Teardown**:
   - `DELETE /api/present/{id}/remote/pair` clears the active pair and revokes `session_token`.

## Acceptance Criteria
- When a remote phone temporarily loses connection (Wi-Fi drop or browser backgrounding), it automatically reconnects using `session_token` without resetting to the PIN entry screen.
- The 6-digit pairing code remains single-use and burned on first claim, preserving AD-37 security.
- Generating a new pair on host revokes prior tokens, enforcing the single-controller invariant.
- SSE stream survives transient 15–20s network pauses without dropping.
- Automated tests in `tests/remote-control-go-http.test.mjs` and `tests/remote-presenting-client.test.mjs` pass cleanly.
