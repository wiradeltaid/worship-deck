# SPEC-13 — Artifacts QA Follow-up Round 2 (Main Spine, Song Sets, Announcement Sets, Canvas Reset)

## Problem Statement

SPEC-12 (DEC-013 mandate) closed `BUG-1`..`BUG-17` against the Artifact Registry
(`/admin/artifacts`) and shipped 2026-09-08. The Admin then ran a second manual pass over that
result (recorded verbatim in `.work/requirements/prompt-08-artifacts-qa-followup-round2.md`) and
found two different classes of problem:

- **Fixes that did not actually hold.** Several `BUG-` entries SPEC-12 marked `fixed` — and in two
  cases (`BUG-2`'s context menu, `BUG-15`'s song-set code rename), each of whose own ticket
  checkboxes reads `[x] done` — are reopened here because the live behaviour still does not match
  the claim:
  - `BUG-1`/`BUG-8`: drag-reorder and the New Slide dropdown both look inert on a fresh page load
    until a Deck Sequence slide is clicked.
  - `BUG-2`: the canvas context menu still never appears.
  - `BUG-7`: an inserted image no longer stretches but does not grow when its resize handles are
    dragged.
  - `BUG-11`: the canvas fits the viewport now, but the window still shows a vertical scrollbar and
    the Deck Sequence list overshoots the layer.
  - `BUG-14`: the "(2/3 Formula)" wording is gone, but switching Song Set tabs still moves the
    canvas because the layout banner wraps to a different number of lines per tab.
  - `BUG-15`: the Song Set code field still has no Rename control.
  - `BUG-16`: rename-triggered height instability is fixed for Announcement Set's own label, but
    the same problem is still present on Main Spine, Song Books, and the Song Set title
    area.

  Each reopened defect in `.control/registry/defects.yaml` keeps its `fixed_in: SPEC-12` for
  history and adds `reopened_in: SPEC-13`.
- **New findings**, most of them independent of any architecture question:
  - `BUG-20`: inline status text shifting the canvas.
  - `BUG-21`: Announcement Set's default-selected slide showing empty text.
  - `BUG-23`: a Rename control on Song Set's Title/Verse/Reff tabs with no persisted field behind
    it.
  - `BUG-22`: new capability under UC-14 — a line-height and text-shadow control for text elements.
  - `BUG-24`: originally filed as "duplicate a Song Set entry"; corrected during this SPEC's own
    `wdi-review` — `AD-33` already makes every Song Set entry share one canvas, so there is nothing
    per-entry to clone. Refiled as a UI-clarity fix: make that shared scope visible instead.
  - `BUG-18`/`BUG-19`: a deliberate, owner-accepted reversal of an architecture invariant. The
    canvas "Reset" button stops meaning "restore this template from the developer's shipped seed"
    (`AD-11`) and starts meaning "discard my unsaved edits" — with no in-UI path back to the
    shipped original once content is changed, and with seeded elements/backgrounds becoming
    ordinary editable content instead of protected template scaffolding. That reversal is recorded
    as
    `DEC-014` (`status: accepted`, 2026-09-08) because it contradicts `AD-11` outright — per this
    project's `decision-guide.md`, a ticket that contradicts an `AD-N` stops until the decision
    exists; it now does.

Every item here is still inside the `registry` Product Component's already-promised capability —
UC-14 "I change a slide's layout" (FR-20), UC-15 "I reorder slides and deletions stay deleted"
(FR-21), UC-24 "I add, rename, or remove a song-set entry" (FR-29) — `mode: deep`,
`risk_accepted: medium`. No new `FR`/`UC` is opened.

## Solution

Fix each reopened defect at the residual it actually names, not the whole original `BUG-`
description (most of each original defect is confirmed fixed and stays that way):

- `BUG-1`/`BUG-8`: Main Spine does not auto-select a Deck Sequence slide on mount, unlike
  Announcement Sets, which already does. One fix — auto-select the first slide on load — closes
  both residuals (drag-reorder and the New Slide dropdown both read as inactive for the same
  reason).
- `BUG-2`: the context menu wiring SPEC-12 inspected and SPEC-12 ticket 02 marked fixed is
  confirmed still broken live. `wdi-systematic-debugging` runs fresh, including scrutiny of
  whatever test that ticket added — this project's own TDD guard convention exists exactly because
  an earlier ticket for this same defect (`W11-03`) was marked done with a test that never actually
  asserted the live behaviour.
- `BUG-7`: the contain-fit ratio computed at insert time is confirmed correct, but does not
  recompute when the element is resized after insertion — needs the resize-event path traced for
  an image object specifically.
- `BUG-11`: the Deck Sequence list container's height is still unbounded (content-sized) rather
  than clamped to the available flex space, which both overshoots the layer and produces the
  residual window scrollbar SPEC-12's viewport-fit pass did not fully close.
- `BUG-14`: the tab-switch height change is a layout mechanism problem (the role badge and the
  explanatory banner share one row whose height varies with the banner's wrapped line count), not
  a wording problem — SPEC-12 fixed the wording only.
- `BUG-15`: build the Rename control SPEC-12 ticket 07 claimed but never shipped, next to the
  Song Set code field.
- `BUG-16`/`BUG-23`: the title-area component used across Main Spine, Song Books, Announcement
  Sets, and Song Sets needs one height reserved for both its idle and rename states everywhere it
  renders, not a per-screen patch — and the Song Set Title/Verse/Reff trio's copy of this control
  should be removed outright rather than stabilized, because `canvas-adapters.ts`'s `roles` array
  proves its label is a hardcoded UI constant with nothing persisted behind it to rename.
- `BUG-18`/`BUG-19` (`DEC-014`): remove the `refused`/`deleteHintShipped` protection on seeded
  canvas elements; repurpose "Reset" from restore-from-seed to discard-unsaved-edits; make adding a
  background replace the existing one. This is the one ticket pair that also edits `AD-11` in
  `.how/_platform/ARCHITECTURE-SPINE.md` (only the Reset clause — `AD-33` already retired the
  `songset-*` override-record clause that used to sit beside it, see Implementation Decisions),
  because leaving the spine's prose describing a button that no longer behaves that way is exactly
  the kind of drift `wdi-reconcile` exists to catch later for free —
  better to close it in the same change.
- `BUG-20`: give the inline status line a fixed-height slot so its presence/absence stops moving
  the canvas, independent of the toaster (which stays, unmodified).
- `BUG-21`: Announcement Set's default-selected slide-in-set does not sync its text into the text
  field on auto-selection, only on an explicit rename trigger — the same selection-sync gap class
  as `BUG-6` (shape color not read back on select), scoped to text content instead of shape fill.
- `BUG-22`: two new text controls (line-height, text-shadow), icon-only, realtime, following the
  exact `applyTextStyle`/`handleFontColorChange` pattern `BUG-4`/`BUG-5`/`BUG-6` already
  established — plus the matching `allowedStyleKeys` allowlist entries on the Go side, the same
  shape `BUG-10` used for `textDecoration`.
- `BUG-24`: not a Duplicate/Clone action — that request assumed a per-entry canvas override that
  `AD-33` already retired (every Song Set entry shares one Title/Verse/Reff trio). The fix is
  visibility, not a copy mechanism: make the shared scope of that trio unmistakable in the editor,
  and reconsider whether the entries list and the trio editor should be separated, visually and
  navigationally.

## User Stories

1. As an Admin opening the Main Spine editor, I want the first Deck Sequence slide selected
   automatically, so that drag-reorder and the New Slide dropdown work immediately without an
   extra click.
2. As an Admin right-clicking a canvas element, I want the context menu (bring forward/back,
   duplicate, delete) to actually appear, so that the menu SPEC-12 already inspected the code for
   is not still unreachable.
3. As an Admin resizing an inserted image by its handles, I want the image to grow with the
   handles, so that dragging a bigger box does not leave a tiny, unchanged picture inside it.
4. As an Admin opening the Main Spine editor on a normal laptop screen, I want no vertical
   scrollbar on the window and the Deck Sequence list to stop exactly at the editor's own edge, so
   that SPEC-12's viewport fit is not undone by an unbounded list container.
5. As an Admin switching between a Song Set's Title/Verse/Reffrain tabs, I want the canvas to stay
   at the same height on every tab, so that the explanatory banner's wrapped line count does not
   move my work.
6. As an Admin renaming a Song Set's code, I want a Rename control next to it, the same as the
   title already has, so that I do not have to delete and recreate the entry to fix a typo in its
   code.
7. As an Admin entering rename mode anywhere in this editor — a Main Spine slide, a Song Book
   entry, an Announcement Set or its slide, a Song Set's own title — I want the panel's height to
   stay exactly the same as it was before I clicked Rename, so that the canvas below it does not
   jump.
8. As an Admin looking at a Song Set's Title/Verse/Reff tabs, I want them to show a plain label
   with no Rename control, so that I am not offered to rename something that was never a real,
   storable name.
9. As an Admin who has changed or wants to remove something the seeder originally created on a
   canvas, I want to be able to delete or replace it like any other element, and I want the canvas
   "Reset" button to discard my current unsaved edits — not silently replace my work with the
   developer's shipped example — so that the seeded starting point is a starting point, not a
   permanent constraint.
10. As an Admin, I want choosing a new background image to replace the canvas's current
    background, not add a second layer on top of it, so that backgrounds do not silently stack.
11. As an Admin, I want a success or error message to appear without moving my canvas, so that
    "Template renamed" and similar messages do not push my work down the page.
12. As an Admin editing an Announcement Set, I want the first slide-in-set's actual text to show
    the moment it is auto-selected, not only after I trigger rename, so that I am not looking at an
    empty field for content that already exists.
13. As an Admin styling text, I want an icon-only control to adjust line spacing and another to
    toggle a text-shadow effect, both applying to the selected text in realtime, so that I have
    the same basic typographic controls as any slide-authoring tool.
14. As an Admin looking at the Song Set editor, I want it to be obvious that the Title/Verse/Reff
    canvas I am editing is shared by every Song Set entry — not owned by whichever one I have
    selected — so that I do not mistake it for a per-entry canvas the way Main Spine and
    Announcement Set slides work, and stop expecting a "duplicate" action that a shared canvas
    never needed in the first place.

## Implementation Decisions

- **No new `FR`/`UC`/domain entity**, per the Problem Statement. `BUG-22` is a refinement of
  UC-14, the same class of addition `BUG-3`'s keyboard Delete was under `DEC-012` in SPEC-12.
  `BUG-24` (refiled from a duplicate/clone request, per the Problem Statement) is UI clarity work
  on an existing UC-24 screen, not a new capability.
- **`DEC-014` (`status: accepted`, contradicts `AD-11`) gates tickets 08 and 09 only.** Every other
  ticket proceeds without a waiting condition; nothing else in this spec touches `AD-N`.
- **`AD-11` must be edited as part of ticket 08**, not left describing a Reset button that no
  longer restores from seed. **Corrected during this SPEC's `wdi-review`:** only `AD-11`'s own
  Reset clause needs the edit — the `songset-*` override-record clause originally believed to sit
  inside `AD-11` was actually `AD-22`'s, and `AD-22`'s override-record mechanism was already
  retired by `AD-33` (2026-08-20, DEC-004). `AD-33`'s "Reset on a Song Set layout behaves exactly
  as Reset on a General" is a cross-reference to `AD-11`, not a restatement, so it needs no edit of
  its own — see `DEC-014`'s Cost section for the corrected version.
- **Modules touched, all inside the `registry` component:**
  - `src/components/admin/ArtifactEditor.tsx` — Deck Sequence default selection, context menu,
    image resize, viewport/scrollbar layout, canvas Reset/delete/background semantics, inline
    status slot, text line-height/shadow controls, title-area component used everywhere else in
    this editor.
  - `src/components/admin/SongSetEntriesPanel.tsx` — tab banner height, code-field Rename,
    Title/Verse/Reff trio Rename removal, shared-scope clarity messaging for `BUG-24`.
  - `src/components/admin/AnnouncementSetsPanel.tsx` — default-selected slide text sync.
  - `src/lib/registry/canvas-adapters.ts` — the fixed `roles` array `BUG-23` and `BUG-24` both cite.
  - `internal/plan/validate_artifact.go` — `allowedStyleKeys` gains whatever keys `BUG-22`'s
    line-height/shadow controls need, following `BUG-10`'s precedent.
  - `.how/_platform/ARCHITECTURE-SPINE.md` — `AD-11` edited per `DEC-014` (ticket 08 only).
- **Debugging-first items** (per this project's `AGENTS.md`, `wdi-systematic-debugging` runs
  before any patch): `BUG-2` and `BUG-7` both touch code that was already inspected and believed
  correct once, and `BUG-2` in particular has now been marked fixed twice without the live
  behaviour matching — confirm the actual failure live before changing anything. Every other
  ticket is ordinary implementation/UX work.
- **This spec stops before any code is written.** Only `to-spec`/`to-tickets`-equivalent authoring
  ran in this session; Phase 3 (tdd/implement/code-review/ship) runs in a separate session under
  `wdi-autopilot`, in its own isolated worktree — the same split SPEC-12 used.

## Testing Decisions

- **Same seam as SPEC-12: the existing `node --test` suite in `tests/`, no new framework.** This
  repo still has no browser-rendering harness for CSS layout — `BUG-11` (window scrollbar/Deck
  Sequence height), `BUG-14` (tab banner height), `BUG-16`/`BUG-23` (rename-height stability), and
  `BUG-20` (inline status slot) verify manually via the `run` skill, each backed only by a static
  structural guard (class-string assertions, following `tests/operator-shadcn-guard.test.mjs`'s
  pattern) where one is feasible.
- **`BUG-2` names the sharpest instance of this project's absence-guard rule**, because it has now
  been marked fixed twice (`W11-03`, then `SPEC-12` ticket 02) without ever actually working live.
  Whatever test SPEC-12 added for the context menu MUST be read before ticket 02 here writes a new
  one — if it asserted something that could not fail, it is deleted and replaced, not extended.
- **`BUG-18`/`BUG-19` (`DEC-014`) directly contradict two existing pinned tests**:
  `tests/registry-reseed.test.mjs` and `tests/registry-three-kind-reset.test.mjs` currently assert
  the OLD Reset-from-seed behaviour `AD-11` described. Ticket 08 MUST read both before writing a
  single line of implementation — the old assertions are rewritten to match the new discard
  semantics (or retired with a note, if nothing about them survives), never left half-pinning a
  behaviour the product no longer has. This is the one ticket in this spec where "make the test
  pass" and "revert an intentional, owner-accepted product change" look identical from the outside
  — the `AD-11` edit mandated by `DEC-014` is what tells them apart.
- **Prior art to follow, by area:**
  - Canvas element mutation/serialization → `tests/artifact-editor-controls.test.mjs` (tickets 01,
    03, 06, 07, 08, 09, 12, 13's non-Go-side assertions).
  - Canvas layout / dirty-state / preview → `tests/artifact-editor-layout.test.mjs`,
    `tests/canvas-dirty-guard.test.mjs`, `tests/artifact-preview.test.mjs` (tickets 04, 05, 07,
    10).
  - Reset/reseed behaviour → `tests/registry-reseed.test.mjs`, `tests/registry-three-kind-reset.test.mjs`
    (ticket 08).
  - Backend style/placeholder validation → `tests/registry.test.mjs`,
    `tests/registry-go-http.test.mjs` (ticket 12's `allowedStyleKeys` change).
  - Song Set / Announcement Set registry behaviour → `tests/song-books-seed.test.mjs`,
    `tests/announcement-sets.test.mjs`, `tests/registry-kind-rename.test.mjs` (tickets 06, 11).
  - shadcn/operator-chrome conventions → `tests/operator-shadcn-guard.test.mjs` (ticket 07's
    Rename-control removal, and ticket 13's shared-scope messaging — a static structural guard,
    no data-layer test needed since ticket 13 is UI-only).
- **What makes a good test here:** the same rule as SPEC-12 — assert the actual behaviour reaching
  the Fabric.js object, the server allowlist, or the rendered field, never a literal that cannot
  fail. Every absence-style claim MUST be seen failing against the current (still-broken) code
  before any fix, and `BUG-2` is the ticket that most needs this proven, not assumed.

## Out of Scope

- Any new `FR`/`UC`/domain entity — none of this is a new promise.
- Anything `AD-11` still governs beyond the Reset/seeded-element/background clauses `DEC-014`
  names — the two-layer seed precedence, "never overwrites administrator edits", and the
  first-boot bootstrap mechanism (`AD-17`) are untouched.
- A full undo/redo history for the canvas — `BUG-18` gives Reset one discard step back to the last
  Save; it does not open a broader undo stack, which is a separate decision if ever requested.
- Full keyboard navigation of the canvas — `DEC-012`'s narrow Delete/Backspace exception stands;
  nothing here reopens OQ-13's pointer-first stance.
- Anything in `Presenter` or `Hub` — this spec is `registry`-only, same as SPEC-12.

## Further Notes

- This spec's ticket numbering restarts at `01` inside its own folder
  (`.scratch/SPEC-13-artifacts-qa-followup-round2/issues/`), per this project's convention that a
  ticket number is unique only inside one spec — the RTM key is `SPEC-13-01`, not a continuation of
  SPEC-12's `01`..`08`.
- Every `BUG-`/`DEC-`/`AD-` cited above already exists in full in its own registry
  (`.control/registry/defects.yaml`, `.control/registry/decisions.yaml`,
  `.how/_platform/ARCHITECTURE-SPINE.md`) or is opened alongside this spec (`DEC-014`) — this
  document cites, it does not repeat.
- `DEC-014` was accepted the same day this spec was authored (2026-09-08), directly by the owner,
  choosing explicitly among three options presented in-session (keep `AD-11` unchanged; repurpose
  Reset to discard and add a separate restore-to-seed action; repurpose Reset to discard and drop
  restore-to-seed from the UI entirely). The owner chose the third. That choice, and its cost, are
  recorded in full in `DEC-014` itself — not restated here beyond the Problem Statement and
  Solution sections above.
