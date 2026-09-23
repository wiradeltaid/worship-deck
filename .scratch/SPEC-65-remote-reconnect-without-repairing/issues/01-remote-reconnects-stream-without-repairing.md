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
      (grant ended) apart from a transient network blip from this event alone.**
      **Policy decision (adopted via maintainer review):** Adopt option (b): perform a lightweight
      `fetch` status check to determine whether the pairing grant is still active before deciding whether
      to attempt stream reconnection or immediately transition to the pairing-code entry screen.
      This prevents wasting blind retries on terminal 409s.
- [ ] **Stale-callback / stream-generation guard (mirroring `PresenterRemoteSession` in the same file).**
      Give each `openStream()` call an incremental `generation` identifier (or epoch token) so a delayed
      `onerror`/`onmessage` from a superseded `EventSource` cannot overwrite state set by a stream that has
      already reconnected — and so a delayed retry cannot reopen a stream after `stop()`, a service change, or
      component unmount. State the test: start a reconnect, let a second one supersede it, then let the
      first's stale callback fire — the second stream's state must win.
- [ ] **The unpair/reconnect race is real (inter-handler critical section window between `deleteRemotePair`
      and `getRemoteStream`) — cover it explicitly, do not assume it away.** If a reconnect attempt and a
      `DELETE /remote/pair` call race, confirm the UI ends up in a consistent state either way (not stuck
      showing "connected" after the grant is actually gone).
- [ ] If the direct reconnect exhausts or the grant is confirmed dead, the UI falls back to the
      pairing-code entry screen.
- [ ] State an explicit test for the exact bug found: two reconnect attempts in a row (simulating a
      drop-and-return) from the *same* remote must not hit `postRemoteClaim`'s 409 "A remote is
      already paired" — because the fix means `claim` is never called for this case at all. Also test:
      a *different* remote UID attempting the direct-reconnect path is correctly refused (matches
      today's `pairedRemoteUID` check), and expired/invalid authentication on the reconnect attempt is
      handled as its own case — a reconnect cannot fix an expired login session, and the fallback there
      is signing in again, not re-entering a pairing code.
- [ ] **Scope decision (adopted via maintainer review): Full page reload is OUT OF SCOPE for v1.**
      SCN-6's "no re-pairing needed" promise is defined strictly for in-session stream drops (Wi-Fi blips,
      tab sleep). Reloading the page initializes a brand new session instance without stored pairing credentials,
      which would require persistent device pairing storage and state rehydration out of scope for this ticket.
- [ ] `RemoteOperator.tsx`'s UI states (connected / disconnected / reconnecting / needs pairing) are
      updated to reflect a distinct "reconnecting" visual banner inside the paired view itself, separate
      from the "needs pairing" screen — currently `RemoteOperator.tsx` only renders connection warnings in the
      unpaired view.
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
