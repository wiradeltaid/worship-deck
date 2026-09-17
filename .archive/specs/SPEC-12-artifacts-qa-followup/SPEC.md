# SPEC-12 — Artifacts QA Follow-up (Main Spine, Song Sets, Announcement Sets)

## Problem Statement

The Admin uses the Artifact Registry (`/admin/artifacts`) to author the Main Spine deck, Song Set
layouts, and Announcement Sets that every Service is built from. Wave W11 (DEC-008, closed spec
`_bmad-output/specs/spec-w11-artifacts-overhaul/`) rebuilt this editor's canvas, toolbar, and
list/rename UX. The Admin then ran a full manual pass over the shipped result (recorded verbatim in
`.work/requirements/prompt-04..07-*.md`) and found 16 concrete problems, filed as `BUG-1`..`BUG-16`
in `.control/registry/defects.yaml`:

- Some things W11 explicitly promised — drag-to-reorder the Deck Sequence, the canvas right-click
  context menu (align/duplicate/delete) — **do not work**, even though the code implementing them
  already exists (`ArtifactEditor.tsx`) and one of the two even has a ticket marked `done` with this
  exact scope (`W11-03`). The Admin cannot reorder slides by dragging, cannot delete a selected
  canvas element by right-click or by pressing Delete, and cannot duplicate or reorder an element's
  stacking.
- Two Element Properties controls silently do nothing: changing Font Size or Font Color in the
  toolbar never changes the selected text on the canvas.
- Selecting a shape resets its color picker to a default instead of showing the shape's actual
  color; an inserted image renders squashed instead of at its real aspect ratio; every dropdown in
  the app (not just one screen) shows the internal key instead of the chosen item's label once
  something is selected.
- The Announcement Set editor shows what looks like two duplicate title areas, and editing the
  second one after saving the first produces a "modified by another session" conflict error — the
  Admin confirmed live this is one reproducible bug (a stale concurrency check), not two separate
  cosmetic issues.
- A cluster of consistency gaps make Main Spine, Song Sets, and Announcement Sets feel like three
  different UIs instead of one: inconsistent "New"/"Add" button wording and color, a toolbar with
  unnecessary "(Drag)" labels and a background-picker icon that reads as a color swatch, an Element
  Properties panel that hides and reshows (pushing the canvas up and down), a Song Set tab whose
  banner text changes canvas height when switching tabs, and page layout that scrolls the whole
  window instead of fitting the viewport with a sane minimum height.

Every one of these is a gap in an **already-promised** capability — UC-14 "I change a slide's
layout" (FR-20), UC-15 "I reorder slides and deletions stay deleted" (FR-21), UC-24 "I add, rename,
or remove a song-set entry" (FR-29), all owned by the `registry` Product Component
(`.what/registry/SRS-registry.md`, `mode: deep`, `risk_accepted: medium`) — not a new promise. No
new `FR` or `UC` is opened by this spec.

## Solution

Fix each defect at its actual mechanism rather than its symptom. Code inspection already done while
writing this spec (recorded in `defects.yaml`) shows most of these are **regressions or wiring
gaps in existing code**, not unbuilt features:

- `BUG-1`/`BUG-2` (drag-reorder, context menu): the handlers already exist
  (`onDragStart`/`onDragOver`/`onDrop` at `ArtifactEditor.tsx` ~L1772; `contextMenu` state +
  `onContextMenu` + `handleDeleteSelected`/`handleDuplicateSelected` + all four z-order menu items
  at ~L272, ~L2239-2320) — these need `wdi-systematic-debugging` to find why they fail live, not a
  rebuild.
- `BUG-4`/`BUG-5` (font size/color not realtime): the font-size input and the color `<input
  type="color">` update React state but never call `applyTextStyle()` (~L1048), the exact function
  Bold/Italic already call directly (~L1067-1093). The fix is that one missing call, in both places.
- `BUG-6` (shape color not synced): the selection-sync function (~L318-337) has a branch for text
  elements' `fill`, none for shape elements' — add the missing branch.
- `BUG-7` (image stretched): `scaleX`/`scaleY` are set independently to fill the drag-created box on
  both axes (~L156-174) instead of preserving the image's native ratio — needs a contain-style fit.
- `BUG-8` (every dropdown shows the raw value): `src/components/ui/select.tsx`'s `SelectValue`
  (built on `@base-ui/react/select`) is used bare everywhere with no label-lookup renderer — fixing
  this ONE shared component fixes every dropdown app-wide, including the Main Spine "New Slide"
  dropdown and the Toolbar's predefined-placeholder dropdown, and closes the Admin's separate ask to
  "scan every dropdown in the app."
- `BUG-9` (Announcement Set duplicate title area + conflict error): the Admin's own live
  clarification is the load-bearing clue — two identical-content title blocks, editing the second
  after saving the first throws a stale-session conflict, meaning the two blocks very likely read
  from/write to two independent concurrency tokens for what should be one thing (or two things that
  need to share one). `wdi-systematic-debugging` names the exact mechanism before either collapsing
  the UI or unifying the token.
- `BUG-3` (no keyboard Delete) and `BUG-10` (no underline) are genuinely unbuilt, not regressions —
  the first is a new but narrow exception to a prior scope decision (OQ-13, "canvas stays
  pointer-first"), recorded as `DEC-012`; the second closes a previously-recorded gap (`OQ-41`) where
  the server's own `allowedStyleKeys` allowlist (`internal/plan/validate_artifact.go` ~L49-52) has
  never included `textDecoration`.
- The remaining consistency items (`BUG-11` through `BUG-17`) are UX/design-system work under three
  decisions opened alongside this spec — `DEC-009` (every create-action button uses the shadcn
  `Button` `default`/primary variant, not a muted gray), `DEC-010` (a "New" vs "Add" naming
  convention; "Insert" retired from the vocabulary), `DEC-011` (every per-slide title area in this
  editor keeps its own Rename, with Reset/Save regrouped under a "Canvas:" label) — all three
  **`status: applied`** as of 2026-09-08, accepted by the owner and landed into
  `.how/_platform/design-system.md`. A same-day codebase sweep (requested by the owner when
  accepting these) found a fourth `DEC-009` site (`BUG-17`, the Toolbar's "+ Add Placeholder"
  button) and a third `DEC-011` site (the Announcement Set's slide-level title area) beyond what
  manual QA alone had surfaced — both folded in.

## User Stories

1. As an Admin reordering the Main Spine, I want to drag a Deck Sequence card and drop it in a new
   position, so that I can restructure the deck quickly instead of deleting and re-adding rows.
2. As an Admin editing a canvas element, I want to press Delete or Backspace with it selected, so
   that I don't have to reach for a menu just to remove one box.
3. As an Admin editing a canvas, I want a right-click context menu offering Bring to Front/Forward,
   Send Backward/to Back, Duplicate, and Delete, so that I can manage layering and cloning without
   hunting through a sidebar.
4. As an Admin styling text, I want the Font Size field to change the selected text's size the
   moment I edit it, so that I see the result immediately instead of wondering if anything happened.
5. As an Admin styling text, I want the Font Color picker to actually change the selected text's
   color, so that the control is not silently broken.
6. As an Admin styling text, I want an Underline toggle next to Bold and Italic, so that I have the
   same basic rich-text controls for every text element.
7. As an Admin selecting a shape, I want its color picker to show the shape's own current color
   instead of resetting to a default, so that I know what I'm about to change before I change it.
8. As an Admin inserting an image, I want it to render at its real aspect ratio inside the box I
   drew, so that photos and logos are not visibly squashed or stretched.
9. As an Admin using any dropdown in the Artifact Registry (New Slide kind, predefined placeholder,
   or any other), I want the selected value to show the same label the list showed, not an internal
   key like `song:opening_song_bt`, so that I always know what I actually picked.
10. As an Admin editing an Announcement Set, I want one title area for the slide I'm editing, not
    two near-identical blocks, so that I don't accidentally edit the wrong one and hit a stale-data
    conflict error.
11. As an Admin renaming an Announcement Set or its active slide, I want the "Active Announcement
    Set" label and the title area's height to stay put, so that the canvas below doesn't jump.
12. As an Admin opening the Main Spine editor on a normal laptop screen, I want the editor to fit the
    visible viewport (with a sane minimum height), so that I'm not scrolling the whole page just to
    see the Deck Sequence list past the first few rows.
13. As an Admin using the element toolbar, I want the Add buttons to show icons only (Text,
    Rectangle, Image) without a redundant "(Drag)" label, so that the toolbar reads faster.
14. As an Admin using the element toolbar, I want the Change Background control to use an
    image/background icon (not one that reads as a color-picker swatch) with the word "Background"
    dropped from its label, so that it's not confused with a font/shape color control.
15. As an Admin selecting an element or not, I want the Element Properties panel to always be
    visible — showing "No properties to change" or "Select element first" when appropriate — instead
    of appearing and disappearing and shifting the canvas.
16. As an Admin using Song Sets, I want the "Verse Layout" tab to stop saying "(2/3 Formula)" and I
    want its explanatory banner to either appear consistently across all three sub-slide tabs or
    move somewhere that doesn't change the canvas's height when I switch tabs.
17. As an Admin renaming a Song Set, I want to rename its code (`variableName`) next to its title,
    the same way I can already rename the title itself.
18. As an Admin creating a new Song Set, Announcement Set, or Main Spine slide, I want the "New ..."
    creation area laid out the same way across all three screens, so the UI feels like one product.
19. As an Admin, I want every primary create-action button (New Song Set, New Announcement Set, Main
    Spine's "+ Add", the Toolbar's "+ Add Placeholder") to be clearly legible (not gray-on-white),
    consistent with how the rest of the app already renders a primary button (`DEC-009`).
20. As an Admin, I want "New" and "Add" used consistently across every creation button in the
    Artifact Registry per one written rule, so I don't have to guess which verb a given button will
    use (`DEC-010`).

## Implementation Decisions

- **No new `FR`/`UC`/domain entity.** Every story above is a refinement of UC-14/UC-15/UC-24
  (`registry`, `mode: deep`, `risk_accepted: medium`). Nothing here changes `.what/registry/` or
  `.how/registry/` — it changes what the shipped code actually does.
- **Modules touched, all inside the `registry` component's `spa`/`api` containers:**
  - `src/components/admin/ArtifactEditor.tsx` — the canvas, toolbar, Element Properties panel, Deck
    Sequence list, and title area (Main Spine's own instance and the shared component Song
    Sets/Announcement Sets reuse).
  - `src/components/admin/AnnouncementSetsPanel.tsx`, `src/components/admin/SongSetEntriesPanel.tsx`
    — the "New ..." creation blocks, Announcement Set title-area duplication.
  - `src/components/ui/select.tsx` — the shared `SelectValue` label-lookup fix (one change, every
    dropdown app-wide).
  - `internal/plan/validate_artifact.go` — `allowedStyleKeys` gains `textDecoration`.
  - `.how/_platform/design-system.md` — carries the create-action button variant rule (`DEC-009`),
    the New/Add naming rule (`DEC-010`), and the per-slide title-area rule (`DEC-011`), applied
    2026-09-08; this SPEC does not restate their content, it cites the `DEC-` files.
- **Debugging-first items** (per this project's `AGENTS.md`, `wdi-systematic-debugging` runs before
  any patch): BUG-1, BUG-2, BUG-4, BUG-5, BUG-8, BUG-9 all touch code that already exists and reads
  as correct — confirm the actual failure live before changing anything. BUG-3, BUG-6, BUG-7, BUG-10
  through BUG-17 are ordinary implementation/UX work with no live-reproduction step needed.
- **Decision gates — `DEC-009`, `DEC-010`, `DEC-011`, `DEC-012`, all `status: applied`** (accepted
  by the owner 2026-09-08; button variant, New/Add naming, per-slide title-area grouping, and the
  keyboard-Delete exception to OQ-13, respectively). Every gated ticket item now proceeds without a
  waiting condition.
- **This spec stops before any code is written.** Only `to-spec`/`to-tickets` ran here (`wdi-build`
  Phase 1-2); Phase 3 (tdd/implement/code-review/ship) runs in a separate session under
  `wdi-autopilot`, in its own isolated worktree.

## Testing Decisions

- **Seam: the existing `node --test` suite in `tests/`, no new test framework.** This repo has no
  browser-rendering harness for CSS layout (checked while writing this spec) — a rendered-layout
  measurement (BUG-11's viewport fit) is out of reach for this seam; that ticket verifies manually
  via the `run` skill instead, with only a static structural guard (matching
  `tests/operator-shadcn-guard.test.mjs`'s pattern of asserting class strings, not rendering) for
  regression protection.
- **Prior art to follow, by area:**
  - Canvas element mutation/serialization logic → `tests/artifact-editor-controls.test.mjs` (tests
    the underlying logic directly, not full DOM rendering — follow this style for BUG-4/5/6/7's new
    cases, not a rendering harness).
  - Canvas dirty-state and preview → `tests/canvas-dirty-guard.test.mjs`, `tests/artifact-preview.test.mjs`.
  - Backend style/placeholder validation → `tests/registry.test.mjs`, `tests/registry-go-http.test.mjs`.
  - shadcn/operator-chrome conventions → `tests/operator-shadcn-guard.test.mjs`.
  - Song Set / Announcement Set registry behaviour → `tests/song-books-seed.test.mjs`,
    `tests/announcement-sets.test.mjs`.
- **What makes a good test here:** assert the actual behaviour reaching the Fabric.js object /
  server allowlist / rendered label — never a literal that can't fail. Every absence-style claim
  (a feature that's "not implemented," a control that "does nothing") MUST be seen failing against
  the current code before any fix, per this project's TDD guard convention — this is the one
  guard-rail every debugging-first ticket below repeats explicitly, because `BUG-2`'s own ticket
  (`W11-03`) was marked `done` with tests that never actually asserted the behaviour they claimed.

## Out of Scope

- Any new `FR`/`UC`/domain entity — none of this is a new promise.
- Full keyboard navigation of the canvas (arrow-key nudge, Tab focus order) — `DEC-012` admits only
  the one Delete/Backspace exception; OQ-13's broader pointer-first stance stands.
- The concurrency-token redesign implied by `BUG-9`, beyond whatever `wdi-systematic-debugging`
  finds is the minimal fix — a larger optimistic-concurrency rework across the Registry API is not
  authorized by this spec if the reproduction turns out to need one; that would stop and go back to
  the owner as its own decision.
- Anything in `Presenter` or `Hub` — this spec is `registry`-only.

## Further Notes

- This spec supersedes a hand-authored draft that briefly existed at
  `_bmad-output/specs/spec-w12-artifacts-qa-followup/` (deleted) and used the retired `W12` alias
  instead of the current `SPEC-<N>` scheme — recorded in `.control/memlog/registry.md` so the false
  start isn't silently lost.
- Every `BUG-`/`DEC-`/`OQ-` id cited above already exists in the registries
  (`.control/registry/defects.yaml`, `.control/registry/decisions.yaml`,
  `.control/questions/answered.md`) with full detail; this document does not repeat their content,
  only cites it, per this project's "the contract is a projection, not a duplicate" rule.
- `DEC-009` through `DEC-012` were accepted and applied the same day they were opened (2026-09-08),
  at the owner's explicit request to enforce each rule across the whole codebase rather than only
  the sites manual QA had already found. That sweep is what surfaced `BUG-17` and the third
  `DEC-011` site — recorded here so a later reader does not read the smaller original scope in
  `defects.yaml`'s header comment as the whole story.
