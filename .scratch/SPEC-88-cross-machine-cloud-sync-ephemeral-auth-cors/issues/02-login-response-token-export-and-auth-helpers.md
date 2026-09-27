# 02: Login JSON Response Token Export and Structured Sync Client HTTP Errors

**What to build:** In `internal/httpapi/auth.go` and `src/lib/sync/client.ts`, expose the signed session token in the login response and wire structured HTTP error handling into the sync client:

1. **Token Export in Go Login Handler (`internal/httpapi/auth.go`)**:
   - In `postLogin`:
     - Currently generates `auth_session` cookie value via `auth.NewSession(acct.ID, acct.Username, acct.Role)` and returns JSON `{ "ok": true, "role": acct.Role, "username": acct.Username }`.
     - Update JSON response to also include `"token": token`:
       ```json
       {
         "ok": true,
         "role": "admin",
         "username": "admin",
         "token": "..."
       }
       ```
     - Preserves the existing `Set-Cookie: auth_session=...; HttpOnly` header for same-origin web browser sessions, while enabling cross-origin and programmatic clients to capture the Bearer token directly.

2. **Structured Error Contract & Remote Auth Helper in Sync Client (`src/lib/sync/client.ts`)**:
   - Export structured error class:
     ```ts
     export class SyncHttpError extends Error {
       status: number;
       constructor(message: string, status: number) {
         super(message);
         this.status = status;
         this.name = 'SyncHttpError';
       }
     }
     ```
   - Ensure all sync and asset helpers (`pullSync`, `pushSyncChunked`, `checkSyncAssets`, `uploadSyncAsset`, `downloadSyncAsset`, `getSyncStatus`) throw `SyncHttpError` with `status: res.status` when HTTP response is not ok (`!res.ok`).
   - Export function `loginRemote(remoteUrl: string, username: string, password: string): Promise<{ ok: boolean; token: string; role: string }>`:
     - Issues a `POST` request to `${remoteUrl.replace(/\/+$/, '')}/api/auth/login` with `{ username, password }`.
     - On HTTP 200, extracts and returns `{ ok: true, token: data.token, role: data.role }`.
     - On non-200, throws `SyncHttpError` with server error message and HTTP status code.

Satisfies `FR-40`, `FR-21`, and `UC-32`.

**Blocked by:** SPEC-88-01

**Status:** closed

- [x] In `internal/httpapi/auth.go`:
      - Return `token` field in `postLogin` response JSON.
- [x] In `src/lib/sync/client.ts`:
      - Implement and export `SyncHttpError` with `status` property.
      - Ensure all sync functions reject with `SyncHttpError` preserving `res.status`.
      - Export `loginRemote` helper for cross-origin remote authentication.
- [x] In `tests/sync-cors-and-bearer-auth.test.mjs`:
      - Verify `POST /api/auth/login` returns valid session token in response body.
      - Verify `loginRemote` authenticates and receives token.
