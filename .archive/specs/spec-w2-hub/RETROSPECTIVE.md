# Retrospective — W2, release `go-spa-cutover`

**Wave:** W2 · **Size:** L · **FR:** FR-14 · **UC:** UC-18 · **Stories:** 2-1, 2-2, 2-3, all `done`
**Run at:** 2026-08-22, weeks after the last story shipped
**Mode:** stories · **Spec folder:** `_bmad-output/specs/spec-w2-hub/`

## Epic summary

W2 landed the DEC-003 / AD-30 process split: a Go always-on API, a Vite React SPA, and PptxGenJS
demoted to an on-demand Node child that draws a finished plan and exits. `FR-14` / `UC-18` — an
Operator downloads a PPTX that presents offline — was the human-testable proof.

`pending_stories` is empty: all three story artifacts carry `status: done` in their own frontmatter,
so the completeness gate passes and the machine verdict is not forced to `rejected`.

## Acceptance, judged against the SPEC's own criteria

Each line was re-verified against the code today rather than read off the RTM, because the central
finding of this retrospective is that the RTM was green while the system was not.

| Declared criterion | Verified | Evidence |
| --- | --- | --- |
| `GET /api/services/[id]/pptx` served by the Go API | yes | `internal/httpapi/server.go:36` |
| The Node child draws an already-finished plan and exits | yes | `internal/httpapi/server.go:191` into `internal/pptx` |
| The worker never opens SQLite, imports `getDb`, or calls `buildSlidePlan` | yes | no match for any of them under `workers/pptx/` |
| Slide order from one planner in the Go process | yes | `internal/plan` |
| `Cache-Control: private, no-store` on gated responses | yes | `internal/httpapi/server.go:134` |
| Next.js runtime absent | yes | `tests/no-nextjs-runtime.test.mjs` passes; `src/app/` does not exist |
| Named tests pass | yes | 14 tests across `pptx-worker`, `pptx-go-http`, `go-http-gate`, `no-nextjs-runtime` |

**Verdict: accepted-with-open-items.** Every declared criterion holds. The open items below are not
criteria W2 missed; they are defects and process gaps that closing the wave on time would have caught.

## What worked

- **The isolation rules held.** The worker genuinely cannot reach SQLite or the planner. That is the
  property of this wave most likely to have rotted quietly, and it did not.
- **The absence guards earned their place.** `no-nextjs-runtime.test.mjs` is why "Next.js is gone" is a
  fact rather than a belief; without it the retired runtime could creep back through a dependency.
- **The deadline landed as a default, not an opt-in.** `Draw` delegates to `DrawWithTimeout` carrying
  `DefaultDrawTimeout` (`internal/pptx/worker.go:15-16`), so the HTTP route is bounded without the
  caller remembering to ask. A timeout that must be requested is a timeout that will be forgotten.

## What did not work

**1. `done` and `green` were both true while CI had never passed.** Thirty runs on `main` were failure
or cancelled. Two independent causes sat inside this wave's blast radius: `formatTimestamp` truncated
sub-second precision when the millisecond field was zero, failing six Go CRUD tests on Linux; and once
that was fixed, `npm test` hung for **2 hours 4 minutes** because the harness killed `go run` rather
than its process group, leaving the compiled server alive holding the stdio pipe. Suite time after the
fix: under a minute.

**Root cause, and it is a process one.** The RTM's `green` field reads a story's *named test*, not the
pipeline. `wdi-build` Step 5 does require CI green on the pushed head SHA — but this wave recorded an
owner isolation override ("this wave runs on `main`", SPEC § Assumptions) and committed straight to
`main` with no PR. No PR meant no pushed head to watch, so the one step that would have caught a red
pipeline had nothing to attach to. **The isolation override and the CI gate are coupled, and the SPEC
recorded the override without noting that it disarms Step 5.**

**2. The harness was never held to the standard the product code was.** This project proves every
absence-guard by injecting the defect. `tests/helpers/go-api.mjs` spawned and killed a server for every
HTTP suite and carried no such proof, so a kill that missed its target went unnoticed across thirty
runs. The test infrastructure was trusted precisely because it was infrastructure.

**3. One site of nine was fixed and announced as the fix.** Eight test files carried inline duplicates
of the spawn and kill logic. "How many places do this same thing?" was asked after the claim, not
before.

**4. `internal/pptx` shipped without a deadline.** `cmd.Run()` with no context meant one wedged render
held an HTTP handler open indefinitely. Story 2-2's contract was a child that draws **and exits**;
nothing enforced the second verb. Closed this cycle.

**5. Phase 4 never ran, and the cost compounded silently.** The wave shipped and sat open for weeks. In
that time its durable conventions — worker isolation, the planner rule, the gated-response envelope,
the session re-check — stayed trapped in a wave folder no reader consults; the codebase structure map
drifted until it was missing six `internal/` packages, `internal/gate` among them, which AD-5 names as
the authorization boundary; and the platform inventories drifted to 45 plan-versus-code gaps. None of
it was visible as a failure. V19 flags a missing retrospective, and only as advisory.

## What we would do differently

- **Treat an isolation override as disarming the CI gate, and say so where the override is recorded.**
  If a wave runs on `main` with no PR, Step 5 needs a substitute — watch the branch's own runs — or the
  override should not be granted.
- **Prove the harness like a guard.** Anything that starts, kills, or reaps a process is load-bearing
  test infrastructure and earns the same injection proof as a product absence-guard.
- **Count the call sites before claiming the fix.** A repair to shared behaviour is not done until the
  duplicates are enumerated.
- **Close the wave while the wave is fresh.** Everything Phase 4 catches is cheap on the day and
  expensive a month later.

## Action items

| # | Item | Owner | Status |
| --- | --- | --- | --- |
| 1 | `tests/helpers/go-api.mjs` reap proved by injection, like a product absence-guard | coordinator | **done** this cycle. The verification first demanded was itself wrong and had to be reversed: `kill(pid, 0)` succeeds on a zombie, and the busy-wait blocked the event loop that would have reaped it |
| 2 | All nine spawn sites migrated to the shared helper | coordinator | **done** — eight inline duplicates removed |
| 3 | PPTX draw bounded by a deadline, on by default | coordinator | **done** — `DefaultDrawTimeout`, `DrawWithContext` |
| 4 | W2's durable conventions distilled into `.constitution/project/codebase-conventions-guide.md` | coordinator | **done** this cycle — four rules landed; three wave-scoped rules named as retired so they are not revived |
| 5 | Both structure maps re-derived from the tracked tree | coordinator | **done** this cycle |
| 6 | Platform inventories refreshed from code | coordinator | **done** this cycle — 45 gaps to 0 |
| 7 | Record that an isolation override disarms `wdi-build` Step 5, and what substitutes for it | **owner** — a method change, not a project one | **open**, filed as OQ-51 |
| 8 | Decide whether a wave left open long after its last story is `done` should be a validator finding rather than nothing | **owner** — a method change | **open**, filed as OQ-51 |

Items 7 and 8 are the two the coordinator cannot take: both change `wdi-build` or `validate.py`, which
live in the WDI Method package, and this repository's rules forbid inventing or patching a method file
locally. They are filed together as OQ-51 because they are one gap seen from two sides — a wave whose
closure nobody is accountable for.

## Assumptions recorded

- The retrospective ran on the evidence alone. Phase 3's team discussion is opt-in and was not asked
  for.
- `bmad-review` was **not** re-run over W2's diff. The diff is weeks old and its defects have since
  been found by other means — CI, a deployed dev server, and this cycle's corpus review — so a lens
  pass would report what is already fixed. Scope narrowing recorded rather than left implicit.
- Session logs for the original story runs were unavailable. The process lessons above come from the
  commit record, the CI history, and this session's own work.
