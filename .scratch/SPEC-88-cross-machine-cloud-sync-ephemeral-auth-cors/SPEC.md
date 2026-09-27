# SPEC-88 — Cross-Machine Cloud Sync with Ephemeral Admin Auth and CORS

## Requirement Traceability & Scope
- **PRD**: `offline-deck`
- **Architectural Decisions**:
  - `AD-30` (Three-Tier Architecture — Go HTTP API + Vite React SPA + Node.js PPTX worker)
- **Use Cases**:
  - `UC-32` (I sync this WorshipDeck with another instance — satisfies `FR-40`)
- **Functional Requirements**:
  - `FR-40` (Manual Device Sync — Delta sync of services, hymns, song sets, backgrounds, and announcements between two instances)
  - `FR-21` (Offline Operation Guarantee and Data Sovereignty)
- **Components**: `registry`, `hub`
- **Touches**: `services`, `settings`, `uploads`

---

## Problem Statement

WorshipDeck currently supports on-demand delta synchronization (`/admin/sync`) designed under SPEC-47 and specified under `UC-32` / `FR-40`. However, testing cross-machine synchronization between a desktop workstation (Windows) and a remote server instance (Ubuntu Linux on cloud/VPS) reveals three critical architectural gaps that prevent real cross-machine sync from functioning:

1. **Gate Middleware Cookie-Only Dependency on Sync Endpoints:**
   - The Go HTTP API middleware gate (`internal/httpapi/server.go`) currently authenticates requests exclusively via `r.Cookie("auth_session")`.
   - When an operator on a local workstation triggers "Pull from Cloud" or "Push to Cloud" pointing to an external remote server URL (`remoteUrl !== window.location.origin`), browser cross-origin requests cannot rely on local same-origin session cookies.
   - The backend currently does not extract or verify `Authorization: Bearer <token>` on `/api/sync/*` and `/api/sync/assets/*` routes, causing all cross-machine sync requests to be rejected immediately with HTTP 401 Unauthorized.

2. **Absence of CORS (Cross-Origin Resource Sharing) Handlers:**
   - In a cross-machine deployment (e.g. desktop web client communicating with `https://worship.mychurch.org`), the browser initiates preflight `OPTIONS` requests before `GET` and `POST` sync calls.
   - The Go server currently has zero CORS configuration: it neither responds to `OPTIONS` preflight requests nor returns `Access-Control-Allow-Origin` and `Access-Control-Allow-Headers` on `/api/sync/*` or `/api/auth/login`, resulting in immediate browser fetch rejections.
   - A secure CORS implementation requires an explicit deployer-configurable origin allowlist (`SYNC_ALLOWED_ORIGINS` with loopback defaults), strict request origin matching (never wildcard `*` with credentials or unvalidated origin reflection), and preservation of both `Vary: Origin` and `Vary: Cookie`.

3. **Confusing Token Placeholder vs. Secure Ephemeral Authentication Flow:**
   - The current UI (`spa/src/pages/AdminSyncPage.tsx`) exposes a confusing password input labeled `Device Authorization Token (Optional)` with placeholder `Bearer token or 6-digit pairing code`, which conflates remote server authentication with the separate 6-digit presenter-to-phone remote control pairing code.
   - Storing credentials or long-lived tokens in browser storage (`localStorage` / `sessionStorage`) introduces token leakage hazards.
   - When an operator initiates Push or Pull targeting a remote host, the application must prompt for remote admin credentials in an ephemeral modal dialog, perform handshake authentication in memory, conduct the delta sync transfer with `Authorization: Bearer <token>`, and strictly bind the token to the normalized remote origin. The token is held exclusively in memory, never persisted to browser storage, and cleared immediately on origin change, user disconnect, or HTTP 401.

---

## Architecture & Detailed Solution

### 1. Go API Bearer Token Support in Gate Middleware (`internal/httpapi/server.go`)
- Extend `s.gate(next http.Handler)`:
  - For paths matching `/api/sync/` or `/api/sync`:
    - First check cookie `r.Cookie(auth.CookieName)`.
    - If cookie is missing or invalid: inspect `r.Header.Get("Authorization")`.
    - If header begins with prefix `Bearer `, extract the token string.
    - Verify token using `auth.Verify(bearerToken)`.
    - If valid, validate session against the database (`auth.ValidateAgainstDB`) and ensure admin role (`current.Role == "admin"`).
    - If valid admin session, attach context via `withSession(r, current)` and allow request to proceed.
- Retain strict fail-closed protection:
  - An invalid, expired, or malformed Bearer token returns HTTP 401 Unauthorized.
  - A valid token belonging to a non-admin account returns HTTP 403 Forbidden.
  - Non-sync routes (`/api/admin/*`, `/api/services/*`) MUST NOT accept Bearer tokens; they continue to require the standard session cookie.

### 2. Configured CORS Allowlist & Minimal Preflight Handling (`internal/httpapi/server.go`)
- **Allowed Origins Resolution**:
  - Parse `SYNC_ALLOWED_ORIGINS` environment variable (comma-separated list of origins).
  - If unset or in desktop mode, default to loopback origins: `http://localhost:*`, `http://127.0.0.1:*`. If wildcard `*` is explicitly configured in `SYNC_ALLOWED_ORIGINS`, allow all origins (without credentials).
  - Inspect incoming `Origin` header. If origin matches the configured allowlist (or if request is same-origin loopback):
    - On preflight `OPTIONS` requests to `/api/sync/*` and `/api/auth/login`:
      - Respond HTTP 204 No Content.
      - Set `Access-Control-Allow-Origin: <request-origin>`.
      - Set `Access-Control-Allow-Methods: GET, POST, OPTIONS`.
      - Set `Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Content-SHA256`.
      - Set `Access-Control-Max-Age: 86400`.
      - Set `Vary: Origin`.
    - On actual `GET` / `POST` responses to `/api/sync/*` and `/api/auth/login`:
      - Set `Access-Control-Allow-Origin: <request-origin>`.
      - Set `Vary: Origin, Cookie`.
  - If `Origin` does not match the allowlist: do not emit `Access-Control-Allow-Origin` headers, allowing the browser to fail closed.

### 3. Expose Session Token on Login Response & Structured HTTP Errors (`internal/httpapi/auth.go`, `src/lib/sync/client.ts`)
- Update `postLogin`:
  - When credentials are valid, in addition to issuing the `Set-Cookie: auth_session=...; HttpOnly` header, include the signed token string in the JSON response body:
    ```json
    {
      "ok": true,
      "role": "admin",
      "username": "admin",
      "token": "<signed-session-token>"
    }
    ```
- Structured Sync Client HTTP Errors (`src/lib/sync/client.ts`):
  - Ensure all sync and asset client helpers (`pullSync`, `pushSyncChunked`, `checkSyncAssets`, `uploadSyncAsset`, `downloadSyncAsset`, `getSyncStatus`) throw a structured `SyncHttpError` carrying `error.status = res.status` (in addition to `message`), enabling the UI to unambiguously detect HTTP 401 Unauthorized across all network operations.

### 4. Ephemeral Remote Authentication & Origin-Bound Lifecycle (`AdminSyncPage.tsx`)
- **UI Simplification**:
  - Remove the legacy `Device Authorization Token (Optional)` field and misleading `"Bearer token or 6-digit pairing code"` placeholder from Connection Settings.
  - Retain `Remote Web Server URL` as the primary configuration input.
  - Display remote session status chip:
    - Same-origin: `Local Workstation (Active Session)`.
    - Remote origin with active in-memory token: `Remote Session Active (In-Memory)` with an inline `Disconnect` button.
    - Remote origin without in-memory token: `Remote Cloud (Authentication Required)`.
- **Origin-Bound Ephemeral Token Lifecycle**:
  - Maintain state: `remoteOrigin: string`, `remoteToken: string | null`.
  - Normalized Origin Invariant: If `remoteUrl` changes such that its normalized origin changes, immediately invalidate and clear `remoteToken = null` so a credential from host A is never sent to host B.
  - When operator clicks **Push to Cloud** or **Pull from Cloud**:
    - If `remoteUrl` is foreign origin (`new URL(remoteUrl, window.location.origin).origin !== window.location.origin`):
      - If `!remoteToken`:
        - Open `RemoteAuthDialog` prompting for Remote Admin Username and Password.
        - On submit: call `loginRemote(remoteUrl, username, password)`.
        - On success: store token in `remoteToken` bound to that origin, close dialog, clear password from memory immediately, and execute the queued push/pull action exactly once.
        - On failure: display error inside the modal.
      - If `remoteToken` exists:
        - Execute push/pull with `Authorization: Bearer ${remoteToken}`.
        - If any sync request fails with HTTP 401 (`err.status === 401`): clear `remoteToken = null` and re-open `RemoteAuthDialog` with message: *"Remote session expired. Please log in again."*
  - **Storage Invariant**: Credentials, passwords, and remote session tokens MUST NEVER be written to `localStorage`, `sessionStorage`, cookies, IndexedDB, or disk.

---

## Ticket Breakdown

- **SPEC-88-01**: Go HTTP API Sync Bearer Token Support and Safe CORS Preflight (`internal/httpapi/server.go`)
- **SPEC-88-02**: Login JSON Response Token Export and Structured Sync Client HTTP Errors (`internal/httpapi/auth.go`, `src/lib/sync/client.ts`)
- **SPEC-88-03**: React Admin Sync Ephemeral Remote Authentication Modal and Origin-Bound Lifecycle (`spa/src/pages/AdminSyncPage.tsx`)
- **SPEC-88-04**: Dual-Instance Go Contract Tests, CORS Header Validation, and Storage Absence Guards (`tests/sync-cors-and-bearer-auth.test.mjs`, `tests/admin-sync-ephemeral-auth.test.mjs`)
