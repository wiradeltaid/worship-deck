---
id: SPEC-w5-presenter-remote
companions:
  - ../../../.how/presenter/02-contracts/03-remote-control.md
  - ../../../.how/presenter/SDD-presenter.md
  - ../../../.what/presenter/05-scenarios/SCN-6-remote-drops-mid-service.md
  - ../../../.what/presenter/03-domain/state-machines.md
  - ../../../.what/presenter/SRS-presenter.md
  - ../../../.control/decisions/DEC-006-remote-presenter-control.md
  - ../../../.constitution/project/codebase-stack-guide.md
  - ../../../.constitution/project/codebase-conventions-guide.md
sources:
  - ../../../.control/registry/requirements.yaml
  - ../../../.control/registry/usecases.yaml
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete contract for what to build, test, and validate. Source documents in frontmatter are for traceability only.
>
> **Projection, not authorship.** This file projects `.what/presenter/`, `.how/presenter/` and DEC-006 onto wave W5. It introduces no `FR`, `UC`, `BR` or `AD`. A gap found while building is landed in the corpus by the skill that owns that layer — never patched in here.

# W5 × Presenter — FR-35: the Operator controls the presenting laptop from a phone

## Why

**A person who cannot leave a desk.** The Operator runs the service from the laptop, so they stand at
the laptop for two hours whether or not that is where they are needed. FR-35 lets them walk — advance a
slide from the back of the hall, blank the screen from beside the pulpit, put a verse up while standing
with the person who asked for it.

Nothing today can do this. `BroadcastChannel` reaches only tabs of one browser on one device
(`src/lib/present-channel.ts`), and that was deliberate: AD-10 kept the venue path independent of hub
connectivity. AD-10 also wrote its own exit — *no server realtime channel is introduced "unless product
direction changes"* — and DEC-006 records that the direction changed.

**The shape is what makes it safe.** The phone is a **remote for the laptop**, not a second thing the
projector follows. The owner chose that over a peer controller. It is why AD-10's *Prevents* (a projector
following one controller while ignoring another) and AD-29's one-sender rule survive this wave
untouched.

## Capabilities

- **CAP-6**
  - **intent:** The Operator can run the service from anywhere in the room, and the room screen depends
    on the laptop alone.
  - **success:** The `FR-35` proof of done holds — an Operator signs in on a phone, connects it to the
    presenting laptop by a deliberate step, and from across the hall advances a slide, blanks and
    unblanks the room screen, changes the live Verse/Reff background, and puts a verse on the projector.
    Another Operator signed in elsewhere who has not connected cannot drive it. **The phone shows the
    same presenter view** — the current position, the blank state, the live background — because FR-35
    promises the Operator *sees* it there, not only that they can press things; a remote that controls
    without showing would pass a looser reading of this clause and fail the promise. The phone is then
    closed, slept, or taken off the network and the laptop keeps driving the service unchanged. Proven by
    `tests/remote-control-go-http.test.mjs`, `tests/remote-presenting-client.test.mjs`,
    `tests/remote-screen.test.mjs`, and the existing `tests/go-http-gate.test.mjs`.

`CAP-6` is allocated in `requirements.yaml` and already carries FR-15, FR-16, FR-19, FR-22 and FR-33.
No capability is minted here.

## Constraints

- **The room screen is never a casualty of this feature.** The relay is not in the laptop-to-projector
  path. A relay that is slow, down, restarted, or deleted outright leaves the projector exactly as it
  was (AD-37, AD-1). **A test for this wave that never disconnects the remote mid-service has not
  tested this wave.**
- **No queue, no replay, no intent buffer that flushes on reconnect.** Intents are intended values, not
  deltas — `blank: true`, an absolute index — so a duplicate is harmless and a lost one is corrected by
  the next. `SCN-6` records all three tempting additions as forbidden; each looks like reliability and
  each moves the congregation for a reason nobody in the room can see.
- **A remote's silence MUST NOT move the projector's liveness verdict.** AD-29 owns that predicate. A
  dead remote and a dead projector are different facts, and reporting the first as the second sends the
  Operator hunting a second screen that is working fine.
- **No new message variant is minted.** The six intents exist on `PresentMessage` — index (inside
  `sync`), `blank`, `transition`, `background`, `scripture`, `clear-scripture`. A seventh is a change to
  `src/lib/present-channel.ts` first, under AD-10, and is not this wave's.
- **An intent enters where the Operator's own hand enters.** The presenting client applies a remote
  intent exactly as it applies a local key press — upstream of the single controller — so
  `BroadcastChannel` and the projector path need no change at all.
- **The code is the only thing that authorises a claim.** Signed in as Operator is necessary and not
  sufficient: the server cannot tell two devices of one account apart, so possession of the code
  displayed on the screen being driven is the deliberate act AD-37 requires. This makes the code's
  lifetime a security parameter.
- **The presenting role is claimed, not inferred.** Two laptops may both open the present route for one
  Service. A second client claiming the role takes it and the first is told it lost it, rather than both
  believing they hold it — AD-29 already paid for the neighbouring version of this.
- **One remote per presenting client.** A second claim on a live pairing is refused, never promoted
  (OQ-54). A second `pair` while a code is outstanding replaces and invalidates the first.
- **The pairing lives in process memory, in no table.** No startup DDL (AD-9), no `data_version` bump
  (AD-21). An API restart ends every pairing.
- **Every new path sits inside AD-5's gate matcher with its assertion test in the same change set.**
  That is AD-5's own wording: anything the matcher does not match is served with no session check at
  all.
- **Every new user-facing string is translated in both catalogues**, and **this project's `t` takes
  exactly one argument.** `tests/translator-guard.test.mjs` fails on a second one — a params object is
  silently dropped, and that shipped a literal `VERSE {N}` to an Operator's screen once already.
- **shadcn primitives only**, from `src/components/ui/`.
- **An absence-guard counts only once it has been seen to fail.** Every new or changed guard is proved
  by injecting the defect it claims to catch, in each form it claims to cover, then reverting.
- **Every new test file is registered in `package.json` `scripts.test` in the same change set.** That
  list does not glob and an unregistered file never runs — locally or in CI, with nothing detecting the
  omission.
- **The corpus is not the builder's to change.** No worker edits `.what/`, `.how/`, or an `applied`
  `DEC-`. A deviation from the SDD or an `AD-N` is reported and becomes a `DEC-` through
  `wdi-decision`.

## What the named tests can and cannot prove

Stated here because a green suite must not be mistaken for a working remote. This project has **no DOM and
nothing that renders a React component in a test** — every UI test is a source scan (`tests/operator-shadcn-guard.test.mjs` is the
specimen), and nothing renders a component to assert on it.

- `tests/remote-control-go-http.test.mjs` proves the relay for real: it starts the Go API and exercises
  pair, claim, stream, intent and delete over HTTP, including the refusals — 409 on a second claim, 400
  on an unknown intent, and the gate's 401 without a session.
- `tests/remote-presenting-client.test.mjs` proves the logic that applies an arriving intent, at module
  level, plus the source-level absence of a queue, a replay buffer, and any remote input into the
  liveness evaluator. Those absences are provable by scan and each is proved by injection.
- `tests/remote-screen.test.mjs` is a **source guard, not a behaviour test.** It can assert shadcn-only
  primitives, that every new string is registered in all three i18n files, that `t` is never called with
  a second argument, and that no forbidden pattern appears. It **cannot** assert that a thumb can reach
  the advance control.
- **The phone screen's acceptance is therefore a human smoke test on dev, and it is named as a
  deliverable rather than left implied:** an Operator holds a phone, connects, advances a slide, and
  watches the room screen follow — then locks the phone and watches the service continue.

## Non-goals

- **A phone that drives the projector with the laptop off.** The owner was offered this and chose
  against it; it would overturn AD-10's *Prevents* and AD-29's one-sender rule.
- **Editing a Service, the Registry, or any weekly value from the phone.** This is a control surface for
  a service already running.
- **A durable pairing table.** Deliberately in memory; see Constraints.
- **A second remote.** Refused, not designed. OQ-54 if it is ever wanted.
- **WebSocket.** SSE plus POST is the contract's choice; WebSocket would be a new decision, not a
  refactor.
- **`wdi-ux` output for the phone screen.** UX was skipped on this project by owner choice. The owner's
  brief for this surface is their own sentence — the presenter view, the same, usable one-handed.

## Success signal

An Operator stands at the back of the hall during the second hymn, advances two slides from their phone,
and the congregation sees exactly what it would have seen had they been at the laptop. Their phone then
locks itself in their pocket, and nothing on the room screen changes.

## Assumptions

- **OQ-53** — the pairing code's lifetime and the stream's freshness window are one pair, exported once
  and read by both ends, the discipline AD-29 sets for the heartbeat. The numbers are the build's to
  pick and justify: long enough to walk to the back of the hall, short enough that a code on an
  unwatched screen is not a standing key.
- **OQ-54** — one remote per presenting client; a second claim is refused.
- **OQ-55** — a pairing does not survive the presenting client reloading its page; the Operator pairs
  again.

Each is filed in `.control/questions/assumptions.md`. The build follows the assumption and does not
reopen it.

## Open Questions

None blocking. The three above are assumptions with stated defaults, not questions this wave waits on.
