---
type: lc
id: LC-16
name: Slide plan builder
lc_type: service
container: api
component: hub
created: 2026-08-18
---

# LC-16 — Slide plan builder

## Responsibility

Single source of order and hydrated layout (AD-7, AD-12). Used by preview, PPTX, Presenter. A persisted Service reads `service_registry_snapshots`; preview (no Service) still reads the live registry.

## Depends on

LC-15 (read templates) logically; code `buildSlidePlan`.

## Interface

Plan AST. Renderer does not look up Registry.

Lyric slides (FR-5, BR-6 — **amended, DEC-004 Supplement S7**; the text below replaces this LC's prior
description, which cited an as-built shape the Supplement corrects): `src/lib/lyrics.ts` /
`internal/plan/lyrics.go` (hand-mirrored ports; DEC-004 S7 requires each to carry a header comment
naming the other, so an edit to one is visibly incomplete until the other matches).

- Refrain headers: `Reff`, `Chorus`, or `Refrain`, with or without a trailing number (`Reff 2`, `Chorus 3`, `Refrain 2`) — all three accepted (S7 L1).
- A refrain with its own body is used verbatim for the verse it follows; different refrains per verse are preserved, never collapsed to the first one (S7 L2).
- A refrain header with no body inherits the nearest preceding non-empty refrain (S7 L3).
- Slide order follows the lyric database's own order; the parser does not rebuild sequence (S7 L4).
- **A blank line inside a section is a hard slide break** — one paragraph, one slide (S7 L5). This is also how the Operator's inline lyric edit (UC-28) decides where slides break: moving a paragraph break in the editor moves the slide boundary, with no separate splitting control.
- **Character-count splitting is retired.** `CONTINUOUS_CHAR_BUDGET = 320` no longer governs anything; the lyric text alone decides slide breaks (S7 L6). `maxLinesPerSlide` was already inert on the production path and retires with it.
- `skipTitle` is gone (AD-20).

**Lyric source resolution (FR-34, UC-28, BR-7):** for a Song Set entry, this LC reads
`song_set_inputs.lyric_override` for that `(service_id, variable_name)` first; if it is null (never
edited this Service), it falls through to `hymns.lyrics` for the entry's resolved
`(song_book_code, song_number)`. The override, once set, wins for that Service regardless of any later
change to the Song Book row — the two only reconverge if the Operator uses "Save to Song Book" (which
this LC does not perform; it only reads the result) or edits the override again.

**Song Set expansion is list-driven, not four fixed cases (DEC-004 Supplement S2, AD-31).** This LC's
plan builder must expand **every** currently-configured Song Set entry through the one shared Title /
Verse / Reff trio (AD-33) — replacing the four named plan paths (`bt-opening-song`, `bt-closing-song`,
`ds-opening-song`, `ds-closing-song`) with a loop over the Registry's live entry list, the same shape
the existing `song-set` / `dsMiddle` case in `internal/plan/plan.go` already uses for "extra" songs
beyond the four. A Service with more than four Song Set entries is the normal shape, not an edge case
(Supplement S2).

**Background resolution (Supplement S4, AD-33, AD-34):** a Verse/Reff slide's background is the entry's
own weekly `song_set_inputs.background_id`, else the Admin global default, else blank — and a **live**
in-service change to that background (AD-34) is a presenter-session override this LC never reads or
persists; it exists only on the presenter/projector channel.

## Notes

Registered on Hub because Hub generate/preview is the on-request write-time caller. Presenter only consumes.
