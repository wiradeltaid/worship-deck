# SPEC-121-02 — Isolated Mobile QR Pairing Gateway & Token-Based Remote Authorization

**Satisfies:** [FR-35, UC-29]
**Blocked by:** ["SPEC-121-01"]
**Status:** closed

## Summary
Eliminate the mobile QR pairing login barrier while hardening presenter authority:
1. In `internal/gate/gate.go`, exempt `/remote` and `POST /api/present/:id/remote/claim` from strict session cookie checks.
2. In `spa/src/App.tsx`, allow `PresentGate` to yield to `RemotePage` when a valid claim code or remote session token is present.
3. In `internal/httpapi/remote.go`, refactor `postRemoteClaim`, `getRemoteStream`, `postRemoteResume`, and `postRemoteIntent` so that an unauthenticated remote client carrying a valid `remote_session_token` is recognized as an authorized remote controller without requiring an operator cookie session (`sess := sessionFrom(r)`).
4. Add rate limiting to `POST /api/present/:id/remote/claim` (max 5 failed attempts per service per minute) to eliminate PIN brute-forcing on church LANs.
5. In `getRemoteStream`, reject `?role=presenter` unless the caller is the proven `presenterUID` established via `POST /pair`.
6. In `deleteRemotePair`, reject requests unless the caller is the active `presenterUID` or an administrator.

## Acceptance Criteria
- A clean smartphone browser without pre-existing cookies successfully claims pairing via QR URL and controls slides.
- Handler-level checks in `postRemoteClaim`, `getRemoteStream`, `postRemoteResume`, and `postRemoteIntent` accept valid remote capability tokens.
- Brute-force guessing of the 6-digit PIN is throttled with HTTP 429 after 5 failed attempts.
- Remote tokens possess zero authority over admin endpoints or data mutation.
- Sibling sessions cannot hijack presenter stream role without the pairing secret.
- Only authorized presenters or admins can revoke or delete pairing sessions.
- Automated tests prove unauthenticated claim success, role hijacking refusal, rate limiting, and un-pair DoS defense.
