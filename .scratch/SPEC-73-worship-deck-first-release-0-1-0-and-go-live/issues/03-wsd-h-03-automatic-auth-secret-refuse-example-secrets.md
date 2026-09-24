# 03: [WSD-H-03] Automatic AUTH_SECRET in desktop mode and refuse example secrets

**What to build:** In `internal/auth/session.go`, `cmd/api/main.go`, `internal/httpapi/auth.go`, and `.env.example`:
1. Automatic `AUTH_SECRET` in desktop mode:
   - When running in desktop mode with an empty `AUTH_SECRET` environment variable, read the secret from a dedicated secret file located inside the desktop data directory (`%LOCALAPPDATA%\WorshipDeck\auth-secret.dat`).
   - If the secret file does not exist, securely generate a cryptographically random string (at least 32 bytes / 256 bits), persist it to the file with owner-only access permissions (0600), and use it for session signing.
   - Subsequent desktop executions must reuse the existing secret file so existing sessions remain valid.
   - If the secret file is unreadable, malformed, empty, or fails permission checks, fail startup immediately with an actionable error—never silently overwrite an existing secret file (which would invalidate user sessions) and never fall back to an insecure default.
   - If `AUTH_SECRET` is explicitly provided via environment, that value takes precedence.
   - Desktop secret generation MUST NOT leak the secret into application logs, `runtime.json`, or HTTP responses.
2. Server mode strict preservation:
   - In server mode (non-desktop), if `AUTH_SECRET` is unset, the server continues to refuse login attempts with 503 "Auth not configured" (preventing auto-generated secrets from leaking to multi-tenant server deployments).
3. Rejection of example placeholder secrets on startup (Owner Decision Q5):
   - Refuse server execution during startup initialization (in `cmd/api/main.go` and `internal/auth/session.go`) if either `AUTH_SECRET` or `JWT_SECRET` matches or begins with known insecure placeholders:
     - `change-me`, `change-me*` (any string prefixed with `change-me`)
     - `your-secret-here`, `your-secret-here*`
     - `secret`, `password`
   - Terminate startup with a clear, actionable stderr error message directing the operator to configure a secure secret.
4. Testing:
   - Add unit and startup integration tests in `internal/auth/session_test.go` and `cmd/api/main_test.go` covering:
     (1) Auto-generation, persistence, and reuse across restarts in desktop mode.
     (2) Malformed/unreadable secret file produces actionable startup error without silent overwrite.
     (3) Rejection of all prohibited placeholder forms for both `AUTH_SECRET` and `JWT_SECRET` during server startup.
     (4) Prove each refusal rule red-first by mutating the check and observing failure.
     (5) Server mode 503 response when unset.
     (6) Secret value never appears in captured log streams.

**Blocked by:** 02-wsd-h-02-desktop-mode-worshipdeck-data-folder.

**Status:** closed

- [x] Read `internal/auth/session.go`, `internal/httpapi/auth.go`, and `cmd/api/main.go`.
- [x] In `internal/auth/session.go`: implement desktop-mode secret file resolution, permission verification, and cryptographically secure generation.
- [x] In `cmd/api/main.go` and `internal/auth/session.go`: validate `AUTH_SECRET` and `JWT_SECRET` against prohibited placeholder list (`change-me*`, `your-secret-here*`), failing startup on match.
- [x] Ensure server mode behavior remains unchanged (503 when unset).
- [x] Add Go tests verifying:
      (1) Desktop mode auto-generates and reuses secret file.
      (2) Malformed/empty secret file fails cleanly without secret regeneration.
      (3) Server mode returns 503 when unset.
      (4) Insecure placeholder secrets (`change-me*`, `your-secret-here*`) terminate startup with clear message (proven red first).
      (5) Secret value never appears in captured log output.
- [x] Verify `go test ./internal/auth/...` and `go test ./cmd/api/...` pass cleanly.
