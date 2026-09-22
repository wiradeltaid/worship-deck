---
type: course-correction
id: DEC-057
status: applied
accepted_by: "kodesh87 (2026-09-22)"
touches:
  - .how/_platform/ARCHITECTURE-SPINE.md
  - .how/registry/SDD-registry.md
  - .control/registry/decisions.yaml
supersedes: AD-31
superseded_by: null
created: '2026-09-22'
---

# DEC-057 — A Song Set entry, or an Announcement Set, may be placed more than once on the main spine

## Decision

> **The main spine may carry more than one placement of the same Song Set entry or the same
> Announcement Set.** Each placement is its own `artifact_templates` row with its own `id` and
> `position`, referencing the same `variable_name` (Song Set) or `ann_set_id` (Announcement Set).
> This decision **supersedes AD-31 in part — its uniqueness clause only**: *"AD-19's uniqueness rule
> survives in a new shape: at most one live main-spine row may carry a given Song Set
> `variable_name`, enforced on the write path exactly as AD-19 enforced slot uniqueness."* That
> clause no longer holds. Every other clause of AD-31 stands unqualified: a Song Set entry's
> `variable_name` and title are Admin-authored, `general` keeps AD-19's closed treatment, and an
> Announcement Set is its own Admin-authored ordered list of General slides.

## Why

Wave W11 (AD-38, DEC-008 — Unified Artifact Canvas Authoring and Direct Spine Composition) shipped
direct spine composition where an Admin picks a Song Set entry or Announcement Set from a "New
Slide" dropdown and it is inserted as its own spine node, with no check against it already being
placed elsewhere on the spine. `tests/registry-go-http.test.mjs`'s **W11-01** test asserts this
directly: two `POST /api/admin/artifacts` calls with `variableName: 'opening_song_bt'` both return
201 and both rows persist. This shipped, is green, and reflects a real want — the same song or the
same announcement block legitimately repeating at two points in one service (e.g. an opening and a
closing hymn using the same entry).

AD-31's uniqueness clause was never enforced anywhere in the write path (`src/lib/registry/store.ts`,
`validate.ts`, `internal/httpapi/song_set_entries.go` — the uniqueness checks there guard the
**catalog's** `variable_name`, i.e. two catalog entries cannot share a name; none of them count or
reject a second **spine placement**). The planning assumption behind AD-31's clause — that a Song Set
entry's identity and its spine placement count are the same thing to protect — turned out to be void
the moment direct multi-placement composition was wanted. `wdi-reconcile` → `wdi-review` surfaced the
contradiction (AD-38's Rule 1 vs. AD-31's Rule) while re-stamping the architecture spine and
`SDD-registry.md`; the owner confirmed by ruling, 2026-09-22: repeated placement is correct, wanted
behaviour, not a defect to close.

## Cost, accepted

- **A live-registry read can no longer assume "one row per Song Set entry."** Any surface reading the
  main spine to build a per-entry index (rather than iterating spine rows in order) must account for
  the same `variable_name` appearing at more than one position. `buildSlidePlan` already iterates in
  spine order (AD-20) and is unaffected; a future surface that keys off `variable_name` alone is the
  one place this cost lands.
- **Deleting or renaming a Song Set catalog entry now potentially touches more than one spine row.**
  This was already true for edits (a rename updates the catalog, not the spine's own copy) and stays
  true; the only change is that "more than one" replaces "at most one."

## Trace

- Supersedes in part: **AD-31** — the spine-placement uniqueness clause only, in
  `.how/_platform/ARCHITECTURE-SPINE.md`.
- Confirmed already shipped, not newly authorized: AD-38 (DEC-008), `tests/registry-go-http.test.mjs`
  test `multiple dynamic insertions of song-set and announcement-set markers on spine (W11-01)`.
- Untouched and still binding: every other clause of AD-31; AD-19's `general`-kind closed vocabulary;
  AD-20 (spine order is the single source of slide order).
- Owner ruled 2026-09-22, in response to `wdi-review`'s finding while re-stamping
  `.how/_platform/ARCHITECTURE-SPINE.md` and `.how/registry/SDD-registry.md`.
