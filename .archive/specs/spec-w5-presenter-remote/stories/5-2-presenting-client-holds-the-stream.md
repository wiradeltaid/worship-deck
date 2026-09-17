---
title: 'The presenting client holds the stream and applies remote intents'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_revision: '217e450'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '.what/presenter/05-scenarios/SCN-6-remote-drops-mid-service.md'
  - '.how/presenter/02-contracts/03-remote-control.md'
  - '.how/presenter/SDD-presenter.md'
  - '.what/presenter/03-domain/state-machines.md'
warnings: []
deferred:
  - 'OQ-55 — a pairing does not survive the presenting client reloading its page. Do not build persistence for it.'
---

<intent-contract>

## Intent

**Problem:** The relay from story 5-1 exists and nothing consumes it. No laptop claims the presenting
role, holds a stream, or applies an arriving intent.

**Approach:** `PresenterOperator` claims the presenting role when it mounts, holds the SSE stream, and
routes an arriving intent into the **same call it already uses for a local key press** —
`setIndexAndSync`, the blank toggle, the transition and background setters. It also publishes its
current state so the remote can mirror it.

## Boundaries & Constraints

**Always:** A remote intent enters where the Operator's own hand enters, upstream of the single
controller. `planIdentity` is checked on an arriving intent exactly as a receiver checks it on the
channel.

**Never:** No queue, no replay, no intent buffer that flushes on reconnect. No remote signal reaches the
liveness evaluator. No change to `src/lib/present-channel.ts` and no change to the projector side.

**Block If:** Making this work requires editing the projector path. The design says it should not; if it
does, report rather than making it fit.

</intent-contract>

## Acceptance

Tests in `tests/remote-presenting-client.test.mjs` unless another file is named.

1. **An arriving intent moves the deck through the existing local path.** Assert at module level that
   the intent handler calls the same function a key press calls — `setIndexAndSync` for an index,
   the blank setter for `blank`, and so on. Not a parallel implementation that happens to agree.
2. **`planIdentity` mismatch refuses the intent** and the deck does not move. The phone may be looking
   at a deck this laptop no longer has.
3. **`blank`, `transition` and `background` arriving remotely behave exactly as locally** — including
   that advancing while blanked moves the deck and leaves the blank alone, which
   `PresenterOperator.setIndexAndSync` already documents.
4. **The remote's state disappearing changes nothing.** Simulate the stream ending: assert the deck
   index, blank state and transition are untouched and the projector broadcast is not re-sent.
5. **No remote input reaches the liveness evaluator.** A source-level guard: the liveness reducer's
   inputs are the projector acknowledgement, the retained handle, and nothing else. Prove it by
   injecting a remote signal into that reducer and watching this test fail, then revert. AD-29 owns
   that predicate and a dead remote is not a dead projector.
6. **No queue, no replay, no buffer.** A source guard over the remote client module asserting the
   absence of retry-on-reconnect, a pending-intent array, and a flush-on-open path. `SCN-6` names all
   three by name. Prove the guard by writing each one in turn and watching it fail, then reverting —
   three injections, not one, because a guard that catches one of three shapes covers neither other.
7. **The presenting role is claimed on mount and released on unmount**, and losing the role to another
   client leaves this client presenting locally while telling the Operator the remote link is gone.
8. **The projector path is untouched.** `git diff` for this story shows no change to
   `src/lib/present-channel.ts`, `src/projected/`, or `spa/src/projected/`. If it does, that is the
   Block If above.
9. `tests/remote-presenting-client.test.mjs` is registered in `package.json` `scripts.test`.

## Verification

`npm test`, `npm run typecheck`, `npm run spa:build`, `go build ./...`, `go test ./...`. Report failures
with their output. Diagnose before fixing when the cause is unknown; a third failed fix attempt is the
signal to stop and report.
