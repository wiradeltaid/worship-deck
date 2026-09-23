# 01: A dropped remote reconnects its stream directly, without re-pairing, while the grant is still live

**What to build:** SCN-6 (`.what/presenter/05-scenarios/SCN-6-remote-drops-mid-service.md`) and the
remote-control contract (`.how/presenter/02-contracts/03-remote-control.md`) both promise that a
remote's own network drop does not require re-pairing as long as the pairing grant itself is still
live — "the pairing is keyed to that role, not to a stream connection." Confirmed by a 2026-09-23
reconciliation pass that the server already supports exactly this: `GET
/api/present/{id}/remote/stream?role=remote` (`internal/httpapi/remote.go`, `getRemoteStream`)
accepts a direct reconnect whenever `state.hasPairedRemote && state.pairedRemoteUID == sess.UID` —
no call to `claim` required, since the check is against the caller's existing authenticated session,
not a fresh pairing code.

The client never uses this path. `RemoteControlSession` (`src/lib/presenter-remote-client.ts`) only
ever calls `openStream()` from inside `claim(code)` — there is no method that reopens the stream on
its own. When the `EventSource`'s `onerror` fires (a wifi blip, a backgrounded tab, screen sleep), the
session sets its state to `'disconnected'` and stops; the UI then shows the pairing-code entry screen
again. Because `postRemoteClaim` (`internal/httpapi/remote.go`) rejects a second claim with `409`
whenever `state.hasPairedRemote` is already true — regardless of whether the caller is the *same*
remote — the Operator is now stuck: the direct-reconnect path that would have worked was never tried,
and the path the UI actually offers (re-entering the code) is refused by the server as long as the old
grant is still live. Any qualifying drop currently locks the remote out until the presenting client
explicitly ends the pairing (`DELETE /remote/pair`) and a fresh code is issued.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Read `src/lib/presenter-remote-client.ts`'s `RemoteControlSession` (`claim`, `openStream`,
      `es.onerror`) and `internal/httpapi/remote.go`'s `getRemoteStream` and `postRemoteClaim` in full
      first. **Confirmed by peer review:** the direct-reconnect path is real (`getRemoteStream`
      accepts `role=remote` whenever `hasPairedRemote && pairedRemoteUID == sess.UID`, with no code
      involved, and `postRemoteClaim` is not on this path at all) — this part of the fix is
      client-only. But the fix is not *purely* client-only end to end: see the status-blindness point
      below, which may need a small server-side addition.
- [ ] `RemoteControlSession` gains a reconnect path that calls `openStream()` directly (not `claim()`)
      after `es.onerror`, using the same authenticated session — no pairing code involved.
- [ ] **Browser `EventSource.onerror` exposes no HTTP status — the client cannot tell a terminal 409
      (grant ended) apart from a transient network blip from this event alone (confirmed by peer
      review; this is a genuine gap in the naive design, not just an implementation detail).** Do not
      rely on `onerror` alone to decide "fall back to pairing." Choose and implement one:
      (a) a bounded, backed-off retry loop that reopens the stream directly a fixed number of times
      before falling back to the pairing screen, accepting that a `409`-caused failure wastes those
      retries before falling back correctly anyway; or (b) a small authoritative status check — a
      plain `fetch` (which does expose status codes, unlike `EventSource`) to a lightweight pairing-status
      endpoint, called before deciding to show the pairing screen. State which was chosen and why.
- [ ] **Stale-callback / stream-generation guard, or an older stream's error can corrupt state after a
      newer one already connected (confirmed by peer review as currently absent).** Give each
      `openStream()` call a generation identifier (or equivalent) so a delayed `onerror`/`onmessage`
      from a superseded `EventSource` cannot overwrite state set by a stream that has already
      reconnected — and so a delayed retry cannot reopen a stream after `stop()`, a service change, or
      component unmount. State the test: start a reconnect, let a second one supersede it, then let the
      first's stale callback fire — the second stream's state must win.
- [ ] **The unpair/reconnect race is real, not just theoretical (confirmed by peer review) — cover it
      explicitly, do not assume it away.** If a reconnect attempt and a `DELETE /remote/pair` call race,
      whichever reaches `getOrCreateSession`'s lock first wins; a reconnect that lands first can briefly
      reopen a channel that the unpair then immediately closes, and — because the channel read loop can
      drain already-queued messages before observing closure — an in-flight state message can still
      reach the browser after the pairing has technically ended. State the test: reconnect racing an
      unpair, in both orderings, and confirm the UI ends up in a consistent state either way (not stuck
      showing "connected" after the grant is actually gone).
- [ ] If the direct reconnect (and its retries) exhausts without success, the UI falls back to the
      pairing-code entry screen exactly as it does today.
- [ ] State an explicit test for the exact bug found: two reconnect attempts in a row (simulating a
      drop-and-return) from the *same* remote must not hit `postRemoteClaim`'s 409 "A remote is
      already paired" — because the fix means `claim` is never called for this case at all. Also test:
      a *different* remote UID attempting the direct-reconnect path is correctly refused (matches
      today's `pairedRemoteUID` check), and expired/invalid authentication on the reconnect attempt is
      handled as its own case — a reconnect cannot fix an expired login session, and the fallback there
      is signing in again, not re-entering a pairing code.
- [ ] **Decide explicitly whether a full page reload (a brand-new `RemoteControlSession` instance, not
      just a dropped stream within one) is in scope (peer review found this is not covered by a
      runtime-only retry path today, and it is genuinely ambiguous whether SCN-6's promise extends
      here).** If yes, the session must attempt a direct reconnect on startup, before ever showing the
      pairing screen, and state what happens given `getRemoteStream` provides no state snapshot on
      first connect (only forward events) — the remote may need to request current state explicitly.
      If reload is ruled out of scope, say so and explain why SCN-6's "no re-pairing needed" promise is
      read as covering only an in-session drop, not a reload.
- [ ] `RemoteOperator.tsx`'s UI states (connected / disconnected / reconnecting / needs pairing) are
      updated to reflect a distinct "reconnecting" state during the automatic retry, separate from
      "needs pairing" (which now only appears once the grant is confirmed gone or retries are
      exhausted) — do not collapse the two into one loading spinner the Operator can't tell apart.
- [ ] **Out of scope for this ticket, but flag it rather than silently building around it (found by
      peer review while tracing the unpair path):** `deleteRemotePair` requires only an authenticated
      session — it does not verify the caller is the presenter or the paired remote for that service.
      Any signed-in user who knows a service id can end that service's pairing. This materially affects
      this ticket's own "the presenting client explicitly unpaired" premise (anyone could trigger that
      branch), but fixing that authorization gap is a separate concern — report it, do not fix it here.
- [ ] `RemoteControlSession` currently has zero test coverage in this repo (confirmed by peer review
      during the reconciliation pass) — this ticket's own tests are this class's first, so verify the
      existing `openStream`/`claim`/`sendIntent` behavior is not accidentally changed while adding the
      reconnect path.
