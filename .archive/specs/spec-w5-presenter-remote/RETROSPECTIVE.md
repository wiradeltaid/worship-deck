# Retrospective — W5, release `presenter-remote`

**Wave:** W5 · **Size:** M · **FR:** FR-35 · **UC:** UC-29 · **Stories:** 5-1, 5-2, 5-3, all `done`
**Run at:** 2026-08-22, the same day the wave opened and closed
**Mode:** stories · **Spec folder:** `_bmad-output/specs/spec-w5-presenter-remote/`

Run although V19 makes it advisory at size M. W2's retrospective found that the wave nobody closed cost
the most, and a retrospective run on the day is cheap.

## Epic summary

The Operator can control the presenting laptop from a phone (FR-35). Three stories, in blocking order:
the Go relay and pairing, the presenting client holding the stream, the phone screen. `pending_stories`
is empty — all three story files carry `status: 'done'` — and the RTM has all three green.

## Acceptance

| Declared criterion | Verified | Evidence |
| --- | --- | --- |
| Five relay paths behave, including every refusal | yes | `tests/remote-control-go-http.test.mjs`, 9 of 10 acceptance lines have tests; the tenth is a registration fact |
| Paths are inside the AD-5 boundary | yes | `internal/gate/gate_test.go` fails when `/api/present` is exempted — proved by injection |
| An intent enters where a local key press enters | yes | `tests/remote-presenting-client.test.mjs` AC-1 |
| No queue, no replay, no buffer | yes | AC-6 fails on a real pending-intent queue written into the real module |
| A remote never moves the projector's liveness verdict | yes | AC-5, after being widened this wave — see below |
| The projector path is untouched | yes | no change to `src/lib/present-channel.ts`, `src/projected/`, `spa/src/projected/` |
| The phone screen's guards hold | yes | Guards 3, 4 and 5 each fail on a real injection |
| SSE survives the dev proxy | yes | `X-Accel-Buffering: no` asserted; removing the line fails the test |

**Verdict: accepted-with-open-items.** Every criterion holds. The open item is not a defect: FR-35's
proof of done is a human holding a phone, and no test in this repository can stand in for it.

## What worked

- **Ordering the stories by testability.** The relay first meant story 5-1 was provable over HTTP with
  nothing above it, and each later story had something real to talk to. A screen-first order would have
  produced a screen nobody could exercise.
- **Deciding the transport in the contract, not in the story.** DEC-006 deliberately left it open and
  `03-remote-control.md` closed it, so the builder never had to weigh SSE against WebSocket mid-task.
- **Writing SCN-6 before any code.** It named three additions — a replay queue, a shared liveness
  indicator, an intent buffer that flushes on reconnect — as forbidden. All three are the kind of thing
  a careful builder adds in the name of reliability, and the story could point at them as decided rather
  than arguing them at review time.
- **The design held.** No worker needed to touch the projector path, `present-channel.ts`, or the
  corpus. Where a design is right, that shows up as an absence of edits.

## What did not work

**1. Two guards were narrower than their names, and both were found only by injecting into the real
file.** This is the wave's central lesson and it repeated twice.

- AC-5 scanned the `LivenessEvent` union and was pinned in both directions, so it stopped a new event
  type called `remote-anything`. It did not stop `if (remoteConnected) dispatchLiveness({type:'ack'})`
  in `PresenterOperator.tsx` — the union is untouched and the whole suite stayed green. Nobody would
  name an event `remote-ack`; somebody might well write that line while making a reconnect feel
  responsive, and AD-29 exists to forbid exactly it.
- Each guard shipped with a "guard proof" test that fed a synthetic string to the scanner function.
  That proves the scanner and says nothing about the file walk. The same shape was found earlier the
  same day in `tests/translator-guard.test.mjs` and in the W5 gate assertion.

**2. One acceptance criterion was wrong, and it was mine.** Story 5-1 item 8 demanded "remove one path
from the matcher and watch the test fail". `internal/gate` gates everything under `/api/` that is not
on an explicit exempt list, so a new path is safe by default and there is no per-path entry to remove;
the AD-5 danger is an **exemption**. Running the proof is what discovered the criterion was written
against an imagined design.

**3. `tests/go-http-gate.test.mjs` reads like a boundary proof and is not one.** It asserts 401 over
real HTTP, and passes with the paths exempted, because the handler's own `sessionFrom` check answers
401 too. Defence in depth is good; a test whose name claims more than it proves is not. It now carries
a comment saying which of the two guards proves the boundary.

**4. Both inventory owner columns were wrong on the first derive.** `/api/present` went to hub, and the
remote screen went to hub because `_screen_owner` matched `/present` and `/slideshow` and the route is
`/services/[id]/remote`. Fixed in the reader, not the tables — that column is re-derived on every write,
a lesson this project had already paid for once with `/api/bible-translations`.

**5. A timing pair was declared twice.** `src/lib/remote-timing.ts` and `internal/httpapi/remote.go`
each held 60s/15s, and the TypeScript file's own comment admitted it — "or mirrored with documented
constants". Go cannot read a `.ts` file, so two files meant two units each picking an honest number,
which is how AD-29's projector heartbeat once reported a healthy screen dead. The file was also dead
code. Deleted; the server is the single source and `expiresIn` travels in the pair response.

**6. An nginx behaviour would have made this look broken on dev while working locally.** nginx buffers
proxied responses by default, so without `X-Accel-Buffering: no` every event would have sat in a
buffer. Caught by reading the dev nginx config before deploying rather than after.

## What we would do differently

- **Write the guard's proof as an injection into the real file, in the same change set.** A scanner unit
  test is not a proof and should not be presented as one. This is now recorded in
  `.constitution/project/codebase-conventions-guide.md` so it stops being rediscovered.
- **Do not write an acceptance criterion that assumes a design you have not read.** Item 8 named a
  matcher shape that does not exist here. Reading `internal/gate/gate.go` first would have cost a
  minute.
- **Check the proxy before the deploy, not after.** One config read caught a defect that would have
  presented as "the feature does not work" with nothing wrong in the code.

## Action items

| # | Item | Owner | Status |
| --- | --- | --- | --- |
| 1 | AC-5 widened to catch a remote-conditioned dispatch, proved by injection | coordinator | **done** |
| 2 | `X-Accel-Buffering: no` on the stream, with the assertion that fails without it | coordinator | **done** |
| 3 | Duplicated timing pair removed; server is the single source | coordinator | **done** |
| 4 | Story 5-1 acceptance item 8 corrected to name the guard that proves the boundary | coordinator | **done** |
| 5 | The no-component-testing fact distilled into the conventions guide | coordinator | **done** |
| 6 | Both inventory reader owner heuristics fixed | coordinator | **done** |
| 7 | **Human smoke test on dev: pair a phone, drive the service, lock the phone, confirm the room screen continues** | **owner** | **open** — this is FR-35's proof of done and the only acceptance no test here can supply |
| 8 | OQ-53, OQ-54, OQ-55 remain owner decisions; the build followed the stated assumptions and did not reopen them | **owner** | **open** |

## Assumptions recorded

- No team discussion; Phase 3 is opt-in and was not asked for.
- `bmad-review` was not run over the wave diff as a separate pass. Every story was verified by
  injection against the real files, the corpus review ran earlier the same day, and the two findings a
  lens pass would most plausibly have raised — the narrow AD-29 guard and the duplicated timing pair —
  were found and fixed. **Scope narrowing recorded rather than left implicit.**
