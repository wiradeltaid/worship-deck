# SPEC-15 — Artifacts QA Follow-up Round 4 (Image Scaling Simulation, Deck Sequence Desktop Bottom Alignment, Toolbar Apply Button Removal, Song Set Edit Zero Layout Shift)

## Problem Statement

Following the completion of SPEC-14 (`DEC-016`), manual testing by the Administrator on dev (`presenter-dev.bic.my.id`) verified that the majority of fixes are working as expected:
- Canvas image translation dragging is fully visible with no clipping (`BUG-7` translation).
- Seeded elements can now be deleted without backend save rejection (`BUG-18`, `DEC-014`).
- Announcement Set select dropdown text renders with high-contrast text on initial mount and change (`BUG-21`).
- Text shadow toggle and conditional blur slider work cleanly (`BUG-22`).
- Redundant header card above the song set canvas trio has been removed (`BUG-24`).
- Properties toolbar height is stable with no vertical canvas shifting (`BUG-25`).
- Object selection preserves true layer depth with `preserveObjectStacking: true` (`BUG-26`).
- "Bring forward" (+1) visibly advances layer ordering in real time (`BUG-27`).

However, four focused issues and refinements were identified for Round 4:

1. **Image Scaling Simulation Glitch During Active Handle Resizing (`BUG-7` residual)**:
   While translating/moving an image no longer clips, when actively resizing an image to a larger size using corner handles, the image content is constrained within its initial bounding box area during the dragging gesture. The visual simulation of resizing does not display the expanded image until the mouse button is released (`object:modified`), causing an abrupt, non-seamless resizing UX.
   *Root Cause*: `ArtifactEditor.tsx` registers a listener for `object:moving` (`onObjectMoving` calling `syncImageClipOnMove`), but has no listener on `object:scaling`. During active scaling, Fabric.js fires `object:scaling` continuously, but the image's `clipPath` (`clipBox`, which has `absolutePositioned: true`) remains at its static pre-scale dimensions and position until `object:modified` fires on mouse release.

2. **Deck Sequence Desktop Height Should Align with Canvas Bottom Edge (`BUG-11` residual)**:
   Page-level window scrollbars are now resolved, and Deck Sequence shrinks according to viewport height. However, on desktop displays, Deck Sequence shrinks excessively (`max-h-[calc(100vh-380px)] min-h-[220px]`). Because the elements from the page header down to the canvas do not shrink, the bottom boundary of the Deck Sequence card should align cleanly with the bottom edge of the canvas, ensuring maximal usable slide list height on desktop while keeping scrolling internal (`overflow-y-auto`).

3. **Obsolete "Apply Style" / "Apply to Selection" Button in Properties Toolbar (`BUG-28`)**:
   The text properties toolbar currently renders an "Apply Style" (`admin.artifacts.applyStyle`) button at its trailing edge (`ArtifactEditor.tsx:2602-2610`). Because all text properties (font family, size, color, bold, italic, underline, alignment, line-height, text shadow) now apply immediately and in real time to the active selection, an explicit "Apply" button is redundant, confusing to operators, and needlessly consumes horizontal toolbar space.

4. **Song Set Entry Edit Mode Height Expansion Shifting Sibling Rows (`BUG-29`)**:
   In `SongSetEntriesPanel.tsx`, clicking the pencil icon on a Configured Song Sets item replaces the ~48px list row with two vertically stacked `Input` components (`draftTitle` and `draftVarName`, each `h-8`) plus buttons, inflating the row height to ~86px. This causes an abrupt vertical layout shift that pushes all subsequent list items down. A clean UI/UX middle-ground solution is required that allows editing title and variable code without expanding list row height.

## Solution

1. **Synchronize Image ClipPath During Active Scaling (Ticket 01)**:
   Add a listener for `object:scaling` on the Fabric canvas in `ArtifactEditor.tsx`. During `object:scaling`, dynamically scale and position the image's `clipPath` (`clipBox`) synchronously with the active scaling transformation (or temporarily expand/sync the clipping mask), ensuring the resizing simulation smoothly reflects the growing/shrinking image in real time before mouse release.

2. **Align Deck Sequence Height with Canvas Bottom Edge on Desktop (Ticket 02)**:
   Update the desktop layout in `ArtifactEditor.tsx` (`lg:grid` mode) so that the left sidebar's Deck Sequence card stretches to align its bottom edge with the bottom edge of the canvas (e.g. using `flex-1 min-h-0` in a flex column matched to the canvas container height, or aligned `max-h` calculation matching canvas bottom offset `calc(100vh-310px)`). Slide items remain scrollable internally via `overflow-y-auto`.

3. **Remove Redundant "Apply Style" Button (Ticket 03)**:
   Remove the "Apply Style" button (`ArtifactEditor.tsx:2602-2610`). Ensure the remaining controls in the properties toolbar retain clean spacing and full real-time reactivity without the redundant button.

4. **Zero-Layout-Shift Song Set Editing (Ticket 04)**:
   Resolve the list item height expansion by transforming the editing pattern:
   - **Recommended Pattern (Top Form Card Re-use)**: When an operator clicks the edit icon on a song set list item, switch the top "New Song Set" card into "Edit Song Set: [Title]" mode, prefilling its Title and Code inputs with action buttons "Update" and "Cancel". The list item below retains its fixed ~48px height with an active editing highlight/badge.
   - **Edge Cases Handled**:
     1. Switching edit targets between list items smoothly updates the top card inputs.
     2. Clicking a list item to select/preview its canvas while edit is active keeps selection intact.
     3. Top card creation is disabled while edit mode is active until saved or canceled.
     4. Canceling edit restores the top card to "New Song Set" with empty inputs.
     5. Conflict handling (409) and variableName synchronization are preserved.
   - **Alternative Pattern (Compact Single-Row or Dialog)**: If retained in-place, lock list row height to ~48px with a single-row inline layout or a lightweight edit dialog.

## User Stories

1. As an Admin resizing an image on the canvas, I want to see the image expand seamlessly in real time while dragging the corner handles, so that there is no visual clipping or boundary cutoff before releasing the mouse.
2. As an Admin viewing the Artifact editor on desktop, I want the Deck Sequence card height to align with the bottom edge of the canvas, so that I have the maximum usable vertical space for slides without window scrollbars.
3. As an Admin adjusting text styles in the toolbar, I want style changes to reflect immediately without a redundant "Apply" button, keeping the toolbar compact and intuitive.
4. As an Admin renaming a song set title or code, I want the editing interaction to occur without expanding the row height in the list, so that the list layout remains stable and free of vertical shifts.

## Implementation Decisions

- **Architecture Invariants**: Complies with `AD-33` (shared canvas trio across song sets) and `DEC-014` (canvas discard-unsaved-changes and editable seed elements). No new `AD-N` or `FR`/`UC` is required.
- **Affected Modules**:
  - `src/components/admin/ArtifactEditor.tsx`: `object:scaling` listener for image clipPath sync, Deck Sequence desktop alignment, removal of "Apply Style" button.
  - `src/components/admin/SongSetEntriesPanel.tsx`: zero-layout-shift edit mode for song set entries (top card state re-use or compact row).
  - `src/lib/registry/canvas-utils.ts`: helper for scaling clipPath synchronization (`syncImageClipOnScale` / `updateImageElementFit`).
  - `tests/artifact-editor-controls.test.mjs`: tests for `object:scaling` image clip sync and removal of "Apply Style" button.
  - `tests/artifact-editor-layout.test.mjs`: tests for Deck Sequence desktop bottom alignment with canvas.
  - `tests/operator-shadcn-guard.test.mjs`: tests for Song Set list item stable height and top card edit mode.

## Out of Scope

- Multi-image bulk upload or cropping tool beyond current contain/cover fit.
- Full undo/redo history stack beyond existing Reset (discard unsaved changes).
- Re-architecting database schema for song set variable names.
