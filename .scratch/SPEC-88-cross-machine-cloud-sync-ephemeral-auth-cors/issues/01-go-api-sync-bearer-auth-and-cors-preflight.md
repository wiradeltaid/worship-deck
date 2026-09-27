# 01: Go HTTP API Sync Bearer Token Support and Safe CORS Preflight

**What to build:** In `internal/httpapi/server.go`, add Bearer token authentication and safe CORS preflight header support for delta synchronization endpoints:

1. **Bearer Token Support in Gate Middleware (`s.gate`)**:
   - For incoming requests to `/api/sync/` or `/api/sync`:
     - Inspect cookie `r.Cookie(auth.CookieName)` first.
     - If cookie is missing or invalid: inspect `r.Header.Get("Authorization")`.
     - If header begins with prefix `Bearer `, extract the token string.
     - Validate token using `auth.Verify(token)` and verify session against database via `auth.ValidateAgainstDB(s.DB, sess)`.
     - Confirm admin role (`current.Role == "admin"`).
     - If valid admin session, inject into context using `withSession(r, current)` and continue to downstream handler.
     - Fail closed:
       - If token is invalid or expired: respond with HTTP 401 Unauthorized.
       - If token is valid but account role is not admin: respond with HTTP 403 Forbidden.
       - Non-sync endpoints (`/api/admin/*`, `/api/services/*`) MUST NOT accept Bearer tokens; they remain guarded by session cookies.

2. **Safe Origin-Allowlisted CORS Handlers**:
   - Parse `SYNC_ALLOWED_ORIGINS` environment variable (comma-separated origins).
   - If unset or in desktop mode, default to loopback origins: `http://localhost:*`, `http://127.0.0.1:*`. If wildcard `*` is explicitly set in `SYNC_ALLOWED_ORIGINS`, permit all origins.
   - For requests matching `/api/sync/*` and `/api/auth/login`:
     - Check if request `Origin` matches the allowlist:
       - If origin matches:
         - On `OPTIONS` preflight requests:
           - Respond HTTP 204 No Content immediately.
           - Set headers:
             - `Access-Control-Allow-Origin: <request-origin>`
             - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
             - `Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Content-SHA256`
             - `Access-Control-Max-Age: 86400`
             - `Vary: Origin`
         - On actual `GET`/`POST` requests:
           - Set `Access-Control-Allow-Origin: <request-origin>`.
           - Set `Vary: Origin, Cookie`.
       - If origin does not match: do not emit CORS headers, allowing client browsers to fail closed.

Satisfies `FR-40`, `FR-21`, and `UC-32`.

**Blocked by:** none

**Status:** open

- [ ] In `internal/httpapi/server.go`:
      - Implement Bearer token extraction and authentication in `s.gate` middleware for sync routes.
      - Implement safe origin-allowlisted CORS preflight and response headers on `/api/sync/*` and `/api/auth/login`.
- [ ] In `tests/sync-cors-and-bearer-auth.test.mjs`:
      - Verify `OPTIONS` preflight returns 204 with required CORS headers when origin is allowlisted.
      - Verify unapproved origins do not receive `Access-Control-Allow-Origin` headers.
      - Verify `/api/sync/pull` and `/api/sync/push` accept valid `Authorization: Bearer <token>` without session cookie.
      - Verify invalid or expired Bearer tokens return HTTP 401, non-admin Bearer tokens return HTTP 403.
      - Verify non-sync routes reject Bearer tokens without cookie.
