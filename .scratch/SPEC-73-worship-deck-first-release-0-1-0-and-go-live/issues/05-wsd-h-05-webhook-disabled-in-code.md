# 05: [WSD-H-05] Webhook disabled in code

**What to build:** In `internal/httpapi/webhook.go`, `internal/httpapi/server.go`, `scripts/setup.mjs`, `.env.example`, and `.constitution/project/deployment.md`:
1. Disable Webhook in Code (Owner Decision Q1):
   - In `internal/httpapi/webhook.go`: ensure `POST /api/webhook` remains a registered route (maintaining routing topology and session-free gate allowance), but unconditionally returns exactly HTTP 503 Service Unavailable with response body `"Webhook intake is disabled in this release"` immediately before reading the request body.
   - Use a non-configurable code constant rather than an environment flag, ensuring reenabling requires deliberate code updates and security reviews.
2. Configuration & Setup Scripts Hygiene:
   - In `scripts/setup.mjs`: stop generating or writing `WEBHOOK_SECRET` to `.env`.
   - In `.env.example`: remove `WEBHOOK_SECRET`.
   - In `.constitution/project/deployment.md`: update deployment documentation reflecting that webhook intake is paused for 0.1.0 and will be reintroduced in a future release.
3. Testing:
   - In Go test `internal/httpapi/webhook_test.go`: assert that sending a valid webhook payload with `X-Webhook-Secret` returns HTTP 503 with exact body `"Webhook intake is disabled in this release"`, creates no service records, and does not read from the request body (proven using a specialized `io.Reader` that fails the test if `Read` is called, seen red first).
   - In `tests/webhook-auth.test.mjs`: update client test assertions to verify that setup does not write `WEBHOOK_SECRET` and requests are cleanly refused with HTTP 503 without unhandled server panics.

**Blocked by:** None (can start immediately; Owner Q1 confirmed).

**Status:** open

- [ ] Read `internal/httpapi/webhook.go`, `scripts/setup.mjs`, and `.env.example`.
- [ ] In `internal/httpapi/webhook.go`: return immediate HTTP 503 "Webhook intake is disabled in this release" before reading request body.
- [ ] In `scripts/setup.mjs`: remove `WEBHOOK_SECRET` generation.
- [ ] In `.env.example`: remove `WEBHOOK_SECRET` entry.
- [ ] In `.constitution/project/deployment.md`: update picoclaw webhook section to reflect disabled status.
- [ ] Add Go test in `internal/httpapi/webhook_test.go` confirming body is unread (reader fails on Read call) and request rejected with HTTP 503. Verify red first, then green.
- [ ] Update `tests/webhook-auth.test.mjs` and verify `npm test` passes cleanly.
