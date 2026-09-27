# 04: Dual-Instance Go Contract Tests, CORS Header Validation, and Storage Absence Guards

**What to build:** Create comprehensive test suites and absence guards verifying CORS, Bearer token authentication, dual-instance data transfer, and ephemeral UI security:

1. **Go API CORS & Bearer Token Contract Suite (`tests/sync-cors-and-bearer-auth.test.mjs`)**:
   - Spawn real Go HTTP API server process (`./cmd/api`) on loopback port.
   - Test 1: `OPTIONS /api/sync/pull` and `OPTIONS /api/auth/login` preflight request returns 204 with `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods` (`GET, POST, OPTIONS`), and `Access-Control-Allow-Headers`.
   - Test 2: Unapproved origin in `Origin` header does not receive `Access-Control-Allow-Origin`.
   - Test 3: `POST /api/auth/login` returns valid session token in response body alongside HttpOnly cookie.
   - Test 4: `GET /api/sync/pull` without cookie but with `Authorization: Bearer <valid-admin-token>` returns HTTP 200 with sync data payload.
   - Test 5: `POST /api/sync/push` without cookie but with `Authorization: Bearer <valid-admin-token>` correctly applies sync mutations.
   - Test 6: Requests to `/api/sync/pull` with invalid or expired Bearer token return HTTP 401 Unauthorized.
   - Test 7: Requests to `/api/sync/pull` with valid token for non-admin account return HTTP 403 Forbidden.
   - Test 8: Non-sync endpoints (`/api/admin/background-library`) reject Bearer tokens without cookie, returning HTTP 401.

2. **Dual-Instance Data Transfer Contract Test (`tests/sync-cors-and-bearer-auth.test.mjs`)**:
   - Spawn Instance A (port P1, db A) and Instance B (port P2, db B) with isolated SQLite databases.
   - Authenticate on Instance B via `POST /api/auth/login`, receive Bearer token.
   - From test harness acting as Instance A's sync client, push service mutation to Instance B using `Authorization: Bearer <token>`.
   - Verify Instance B applies the mutation to its database.
   - Pull from Instance B to Instance A, verifying cross-instance delta exchange without cookie sharing.

3. **React Ephemeral Authentication & Storage Absence Guard (`tests/admin-sync-ephemeral-auth.test.mjs`)**:
   - Inspect `spa/src/pages/AdminSyncPage.tsx`:
     - Absence guard: verify string `"Bearer token or 6-digit pairing code"` and `"wpw_sync_device_token"` in `localStorage.setItem` are completely absent.
     - Presence guard: verify `RemoteAuthDialog` or remote authentication modal is wired.
     - Ephemeral security proof: verify remote token is held exclusively in React state/in-memory and never written to `localStorage`, `sessionStorage`, cookies, or IndexedDB sinks.
     - Prove absence guard red via defect injection before restoring.

4. **CI Integration**:
   - Register test scripts in `package.json` (`smoke:spec-88` / `test:smoke-spec-88`) and append to the main `npm test` script.
   - Ensure tests clean up child processes and temporary database files cleanly across all platforms.

Satisfies `FR-40`, `FR-21`, and `UC-32`.

**Blocked by:** SPEC-88-03

**Status:** open

- [ ] In `tests/sync-cors-and-bearer-auth.test.mjs`:
      - Implement integration tests for Go API CORS headers and Bearer token sync authentication.
      - Implement dual-instance data transfer test between two isolated Go processes.
- [ ] In `tests/admin-sync-ephemeral-auth.test.mjs`:
      - Implement UI and security absence guards verifying ephemeral in-memory token lifecycle across all browser storage sinks.
      - Inject defect to prove absence guard red before restoration.
- [ ] In `package.json`:
      - Wire `smoke:spec-88` and update `test` script.
