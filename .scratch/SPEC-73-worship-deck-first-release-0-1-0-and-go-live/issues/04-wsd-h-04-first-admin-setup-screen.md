# 04: [WSD-H-04] First admin created on a setup screen

**What to build:** In `spa/src/pages/LoginPage.tsx`, `spa/src/pages/SetupPage.tsx` (or integrated within `LoginPage.tsx`), `internal/httpapi/auth.go`, `internal/auth/accounts.go`, and `internal/gate/gate.go`:
1. Loopback Setup Endpoint (`POST /api/setup/admin`):
   - Available ONLY in desktop mode.
   - Available ONLY over loopback (`127.0.0.1` / `::1`).
   - Available ONLY while the `accounts` table contains exactly 0 accounts.
   - Checks account count and inserts the initial administrator account within a single atomic database transaction. If an account already exists, immediately reject with 403 Forbidden.
   - Hashes passwords using the established scrypt parameters matching standard account creation.
   - Assigns role `admin` and logs in the newly created user immediately by returning a valid session cookie.
2. Restricted Setup Status Endpoint (`GET /api/setup/status`):
   - Restricted strictly to loopback callers in desktop mode (returns 403 Forbidden / 404 to remote callers or in server mode), preventing external account-state reconnaissance.
   - Returns JSON payload: `{ "setupRequired": true }` when account count is 0, `{ "setupRequired": false }` when >= 1 accounts exist.
3. Frontend First-Run Setup Screen:
   - On `LoginPage.tsx`, query `GET /api/setup/status`.
   - When setup is required, render the initial Setup Screen: Username, Password, Confirm Password.
   - Provide localized labels in English and Indonesian (`catalogue-en.ts` and `catalogue-id.ts`) adhering to approved nomenclature.
   - Upon successful setup submission, navigate directly into the operator console.
4. Gate & Security Controls:
   - Update `internal/gate/gate.go` to permit `/api/setup/admin` and `/api/setup/status` without an active session, guarded strictly by desktop mode and loopback checks.
5. Testing:
   - Add tests verifying rejection in server mode, rejection from non-loopback IPs, rejection when an account already exists, single-account creation under concurrency, and successful happy-path admin creation.

**Blocked by:** 03-wsd-h-03-automatic-auth-secret-refuse-example-secrets.

**Status:** closed

- [x] Read `internal/gate/gate.go`, `internal/httpapi/auth.go`, and `spa/src/pages/LoginPage.tsx`.
- [x] In `internal/httpapi/auth.go`: implement `POST /api/setup/admin` and `GET /api/setup/status` with atomic transaction, desktop mode check, and loopback enforcement.
- [x] In `internal/gate/gate.go`: update session gate allowlist with strict desktop/loopback guards.
- [x] In `spa/src/pages/LoginPage.tsx`: render Setup Screen when zero accounts exist in desktop mode.
- [x] Add i18n keys for setup form in `src/lib/i18n/catalogue-en.ts` and `catalogue-id.ts`.
- [x] Add Go tests in `internal/httpapi/auth_test.go` and `internal/gate/gate_test.go` verifying:
      (1) Setup rejected when an account already exists.
      (2) Setup rejected in server mode.
      (3) Setup and status rejected for remote/non-loopback requests.
      (4) Happy path creates admin and sets session cookie.
- [x] Add client test in `tests/first-admin-setup.test.mjs` and add to `package.json` `scripts.test`.
- [x] Verify `go test ./...` and `npm test` pass cleanly.
