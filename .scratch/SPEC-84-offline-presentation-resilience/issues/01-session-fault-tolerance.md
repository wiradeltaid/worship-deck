# 01: Fault-Tolerant Session Boundary & Last-Known Session Persistence

**What to build:** In `spa/src/lib/auth/SessionProvider.tsx`, wrap the `/api/session` request in a structured `try / catch / finally` handler to strictly distinguish between `HTTP 401 Unauthorized` (which clears stored session state and redirects to `/login`) and network-level failures (`TypeError: Failed to fetch`, aborts, timeouts, or 5xx server responses). When a network failure occurs:
1. Do NOT set status to `unauthed` and do NOT invoke `navigate('/login')`.
2. Inspect `sessionStorage` for a previously verified session record (`worship_deck_last_session`).
3. If a cached session exists, resolve `status: 'authed'` with `isOffline: true` exported on the `SessionContextValue` interface, so that already-opened operator surfaces (`OperatorShell`, `RunSheetPage`, `PresentPage`, `PresentGate`) remain completely functional without flashing or redirecting.
4. If no cached session exists, enter `status: 'unauthed'` with a dedicated network-error message rather than an unauthenticated bounce.
5. In `spa/src/pages/OperatorShell.tsx`, when `isOffline: true` is active, display a subtle, non-intrusive alert banner indicating offline local session operation, and defensively disable server-only actions (such as admin user creation or remote sync artifact) while leaving run-sheet review and presentation actions interactive.
6. In `src/components/LogoutButton.tsx` and wherever explicit logout is triggered, ensure `sessionStorage.removeItem('worship_deck_last_session')` is called prior to navigation, ensuring intentional sign-out clears cached session identity and prevents stale local logins on shared church PCs.
7. In `spa/src/pages/ProjectorPage.tsx` (which sits outside `OperatorShell` and `SessionProvider` by design):
   - Wrap its independent `/api/session` fetch in `try / catch`.
   - On network failure, check whether a local snapshot exists in IndexedDB for the current route's `:id`. If found, bypass `/login` navigation and proceed directly to load the projector client from the local snapshot.
8. Write unit and regression tests in `tests/session-provider-resilience.test.mjs` verifying:
   - 401 causes immediate redirect to `/login` and purges `sessionStorage`.
   - Explicit logout purges `sessionStorage`.
   - Simulated network failure (`TypeError: Failed to fetch`) preserves session from `sessionStorage` and suppresses navigation.
   - `ProjectorPage` boots successfully without network when an offline snapshot is present.
   - Absence/injection test: verify that reverting the catch block causes an unhandled promise rejection or redirect on network failure.

Satisfies `FR-18` and `UC-20`.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `spa/src/lib/auth/SessionProvider.tsx`, `spa/src/pages/OperatorShell.tsx`, `src/components/LogoutButton.tsx`, and `spa/src/pages/ProjectorPage.tsx`.
- [x] In `spa/src/lib/auth/SessionProvider.tsx`:
      - Add `try / catch` around `fetch('/api/session')`.
      - Store successful session body into `sessionStorage.setItem('worship_deck_last_session', JSON.stringify(body))`.
      - On 401/403: clear `sessionStorage.removeItem('worship_deck_last_session')`, set `unauthed`, navigate to `/login`.
      - On network error: read `sessionStorage.getItem('worship_deck_last_session')`. If valid, retain session with `isOffline: true`.
      - Expose `isOffline: boolean` in `SessionContextValue`.
      - Add online/offline event listeners with fail-closed atomic API revalidation (`revalidateSessionOnline`).
- [x] In `src/components/LogoutButton.tsx`:
      - Clear `sessionStorage.removeItem('worship_deck_last_session')` and `clearOfflineStorage()` on logout.
- [x] In `spa/src/pages/OperatorShell.tsx`:
      - If `isOffline`, display a non-blocking alert banner: "Offline — Menjalankan sesi lokal tersimpan" and pass `isOffline` to `Header`.
- [x] In `spa/src/pages/ProjectorPage.tsx`:
      - Catch network errors on `/api/session`, verify cached session, and proceed with `resolvePlanMedia` from offline snapshot.
- [x] In `tests/session-provider-resilience.test.mjs`:
      - Test 401 navigation vs network error recovery.
      - Test explicit logout clears cached storage.
      - Inject defect (remove catch) and verify guard fails.
- [x] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/session-provider-resilience.test.mjs` and `npm run typecheck`.
