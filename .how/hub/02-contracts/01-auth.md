---
type: contract
component: hub
lc: LC-1
direction: exposed
created: 2026-08-18
updated: 2026-08-19
---

# Contract — Auth

## Source of truth

`none` — prose. `internal/httpapi`, `src/lib/auth/rate-limit.ts`.

## Purpose

UC-9. Log in, log out, change password.

## Operations

| Operation | Purpose | Realizes |
| --- | --- | --- |
| POST `/api/auth/login` | Session cookie | UC-9 |
| POST `/api/auth/logout` | Revoke session | UC-9 |
| POST `/api/auth/change-password` | Change password | UC-9 |

## Five lanes

| Lane | Answer |
| --- | --- |
| Authentication | Login without a session. Logout/change password: valid session (AD-5). The `role` cookie is not trusted on its own. |
| Validation | JSON object; username ≤96, password ≤128; empty = generic 401 |
| Error handling | `{ error }` envelope in `cross-cutting.md`. Same 401 credentials message for wrong user and wrong password. 503 if `AUTH_SECRET` is short. 429 lockout text. |
| Rate limiting | 5 failures per (username, IP) / 15 minutes; 20 failures per IP / 15 minutes. `Retry-After` when limited. [verified] `rate-limit.ts` |
| Idempotency | Logging in again overwrites the cookie. Logging out again is safe. Change password is not idempotent (hash changes). |

## Error behaviour

| Condition | Response | Caller should |
| --- | --- | --- |
| Corrupt JSON | 400 | Fix the body |
| Wrong credentials / disguised lockout | 401 `Invalid username or password` | Do not enumerate accounts |
| Too many attempts | 429 lockout message + Retry-After | Wait for the window |
| AUTH_SECRET absent | 503 | Fix the host |

## Compatibility

Changing the disguised 401 text, or adding a required login field, is breaking for form clients.

## Constraints

Process timeout is the Go API default — [ASSUMED], never read as a number (DEC-003 retired the Next.js shape). No special body-size limit on this route.
