---
title: 'The remote relay and the pairing, in Go'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_revision: 'cdf161b'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '.how/presenter/02-contracts/03-remote-control.md'
  - '.how/presenter/SDD-presenter.md'
  - '.what/presenter/03-domain/state-machines.md'
  - '.control/decisions/DEC-006-remote-presenter-control.md'
  - '.how/_platform/ARCHITECTURE-SPINE.md'
warnings: []
deferred:
  - 'OQ-53 — the code lifetime and freshness window: pick the numbers, export them once, justify them in a comment. Do not reopen whether they should be one pair.'
  - 'OQ-54 — a second remote stays refused; do not design promotion.'
  - 'OQ-55 — a pairing does not survive the presenting client reloading its page.'
---

<intent-contract>

## Intent

**Problem:** FR-35 promises the Operator can control the presenting laptop from a phone. Nothing can
cross devices today — `BroadcastChannel` reaches only tabs of one browser on one device — and there is
no realtime transport anywhere in the repository.

**Approach:** LC-17 and LC-18 on `api`. Five paths — `pair`, `claim`, `stream`, `intent`, `delete` —
with SSE for server-to-client and ordinary POST for client-to-server. The pairing lives in process
memory, keyed to the **presenting role**, and grants a remote the right to send intents to one
presenting client.

## Boundaries & Constraints

**Always:** Every path inside AD-5's gate matcher in `internal/gate`, with its assertion in
`tests/go-http-gate.test.mjs` in this same change set. Possession of the displayed code is what
authorises a claim; being a signed-in Operator is necessary and not sufficient. The code lifetime and
the stream freshness window are one pair, exported once and read by both ends. The pairing is keyed to
the presenting role, never to a stream connection.

**Never:** No table, no startup DDL, no `data_version` bump. No edit to `src/lib/present-channel.ts` —
no new message variant is minted in this wave. No "caller must be presenting" check on a claim: the
remote is by definition not the presenting client. No takeover of a live pairing.

**Block If:** A path is added without its matcher entry — that is an unauthenticated endpoint, not a
missing test. The corpus (`.what/`, `.how/`, an applied `DEC-`) needs editing to make the code fit.

</intent-contract>

## Acceptance

Each line is a test in `tests/remote-control-go-http.test.mjs` unless it names another file.

1. **`POST /api/present/{id}/remote/pair`** claims the presenting role for the caller and returns a
   short-lived single-use code. Called again while the first code is unclaimed, it returns a **new**
   code and the old one no longer works.
2. **`POST …/remote/claim`** with a valid code binds that caller as the remote and returns the current
   session state. With a wrong, expired, or already-used code it is **400**, and the body does not say
   which of the three it was.
3. A **second claim** against a live pairing is **409**. The first remote keeps working — prove that,
   not just the status code.
4. **`POST …/remote/intent`** accepts the six existing intents and rejects an unknown `type` with
   **400**. An intent from a caller holding no live pairing is **409**, not 403 — the caller is
   authenticated, it simply is not the remote.
5. **`GET …/remote/stream`** emits `text/event-stream`, delivers an intent posted by the paired remote,
   and closes the older stream when the same role reconnects.
6. **A second client claiming the presenting role** takes it; the first client's stream is closed and
   its pairing ends. Both must not believe they hold the role.
7. **`DELETE …/remote/pair`** ends the pairing and is idempotent — a second call is 204.
8. **Every one of the five paths returns 401 without a session.** Two guards, and they prove different
   things — this criterion was corrected on 2026-08-22 after the proof was actually run. `internal/gate`
   gates everything under `/api/` that is not on an explicit exempt list, so a new path is safe by
   default and there is no per-path matcher entry to omit; the AD-5 danger here is an **exemption**.
   `internal/gate/gate_test.go` is therefore the guard that proves the boundary, and it MUST be seen to
   fail when `/api/present` is added to `exemptPrefixes`. `tests/go-http-gate.test.mjs` asserts the 401
   over real HTTP but **cannot** prove the boundary, because the handler's own `sessionFrom` check
   answers 401 too — it passes with the paths exempted. Both are kept; only the first is the proof.
9. **An API restart ends every pairing.** After a restart the remote's next intent is 409 with
   pair-again, and no pairing is resurrected.
10. `tests/remote-control-go-http.test.mjs` is registered in `package.json` `scripts.test`. That list
    does not glob; an unregistered file never runs and nothing detects the omission.

## Out of scope for this story

The presenting client consuming the stream (5-2) and the phone screen (5-3). This story is the relay
and nothing above it. It is testable on its own over HTTP, which is why it goes first.

## Verification

`go build ./...`, `go vet ./...`, `go test ./...`, `npm test`, `npm run typecheck`. Report failures with
their output. If a test or build fails and the cause is unknown, diagnose before proposing a fix; a
third failed fix attempt is the signal to stop and report rather than try a fourth.
