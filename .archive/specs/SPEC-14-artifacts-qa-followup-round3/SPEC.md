# SPEC-14 — Artifacts QA Follow-up Round 3 (Canvas Z-Order, Dragging Visuals, Seed Save Validation, Song Set Inline Rename, Toolbar Stability)

## Problem Statement

Following the completion of SPEC-13 (`DEC-015`), manual testing by the Administrator identified residual issues and new UX/technical refinements across the Artifact Registry editor (`/admin/artifacts`):

1. **Canvas Image Dragging Visual Glitch (`BUG-7` residual / SPEC-13-03)**:
   Images can now be resized and moved, but while dragging (`object:moving`), parts of the image visually disappear or cut off within a fixed bounding window until the mouse is released (`object:modified`), at which point it renders properly. This occurs because `clipPath: clipBox` is initialized with `absolutePositioned: true` in absolute canvas coordinates, staying stationary while the image translates under it during drag.
2. **Deck Sequence Page Scroll Residual (`BUG-11` residual / SPEC-13-04)**:
   The Deck Sequence container height was clamped, but on standard 1080p/laptop displays, the overall window still develops a slight vertical scrollbar because the combined height of the top navigation, page headers, tabs, "New Slide" box, and Deck Sequence container (`max-h-[calc(100vh-320px)]`) slightly exceeds the available viewport.
3. **Seed Element Deletion Save Refusal (`BUG-18` residual / DEC-014 / SPEC-13-08)**:
   While the UI-level deletion prevention (`deleteHintShipped`) was removed, attempting to save a template where a seeded element (e.g., `e1`) was deleted fails with:
   `element e1 is part of the shipped template and cannot be removed or renamed in layout default`.
   Both backend Go validation (`internal/plan/validate_artifact.go` in `AssertStableAgainstSeed`) and client-side store validation (`src/lib/registry/store.ts` in `assertStableAgainstSeed`) still reject deletion, renaming, or modifying required flags of seed elements, directly violating `DEC-014`.
4. **Announcement Set Select Value Text Contrast (`BUG-21` residual / SPEC-13-11)**:
   The active set label is selected on mount, but its text renders greyed out (styled like a placeholder with `data-placeholder:text-muted-foreground`), whereas selecting it manually displays crisp, high-contrast white text.
5. **Text Shadow & Line Height Controls Simplification (`BUG-22` refinement / SPEC-13-12)**:
   The text properties row currently renders two separate buttons (`MoveVertical` and `Sparkles`) and one slider (`input type="range"`), creating visual ambiguity. The control should be simplified:
   - Icon toggle for text shadow (reflecting a shadow icon or 'S') positioned immediately to the left of the slider.
   - The slider only appears when the shadow toggle is active (ON).
   - Line height remains accessible without cluttering the conditional shadow controls.
6. **Song Set Inline Rename in Configured List (`BUG-24` refinement / SPEC-13-13)**:
   Because the Title/Verse/Reff canvas trio is shared across all song sets (per `AD-33`), the large Rename Card placed directly above the shared canvas causes confusion (implying the canvas is owned by the selected entry). Renaming both fields (`title` and `variableName` code) should be performed inline within the list item of "Configured Song Sets", without causing layout shifts or container expansion.
7. **Toolbar Properties Bar Height Expansion on Selection (`BUG-25` / LAINNYA 1)**:
   When an element on the canvas is selected, the properties toolbar expands vertically due to `flex-wrap` wrapping 10+ controls on medium viewports, visibly pushing the canvas downward.
8. **Canvas Selection Jumps Element Visually to Top (`BUG-26` / LAINNYA 2)**:
   Clicking an element on the canvas automatically renders it on top of all other elements, obscuring its true z-order in the layer stack and preventing operators from seeing real-time z-order relationships. This is caused by Fabric.js's default `preserveObjectStacking: false`.
9. **Canvas "Bring Forward" Action Ineffective (`BUG-27` / LAINNYA 3)**:
   "Bring forward" (+1 layer step) does not visibly advance the element's layer in the stack, while Bring to Front, Send Backward, and Send to Back function as expected.

## Solution

1. **Synchronize Image ClipPath During Dragging (Ticket 01)**:
   Update image `clipPath` during `object:moving` (or adjust clipPath positioning) so the clipping rectangle moves synchronously with the image while dragging, eliminating visual cutoffs before mouse release.
2. **Clamp Deck Sequence Viewport Height (Ticket 02)**:
   Adjust the Deck Sequence container and sidebar height calculation (e.g., `max-h-[calc(100vh-380px)]` or flex-bounded viewport clamping) to completely eliminate window-level vertical scroll on laptop viewports.
3. **Align Backend & Store Validation with DEC-014 (Ticket 03)**:
   Remove the restriction in `internal/plan/validate_artifact.go` (`AssertStableAgainstSeed`) and `src/lib/registry/store.ts` (`assertStableAgainstSeed`) that forbids removing, renaming, or un-requiring seed elements, honoring `DEC-014`'s principle that seeded elements are ordinary editable and deletable elements.
4. **Fix Announcement Set Select Text Color & Active State (Ticket 04)**:
   Ensure `AnnouncementSetsPanel` passes proper controlled value and items mapping to Base UI `Select`, ensuring the active set's label renders with primary foreground contrast rather than placeholder muted styling on initial load.
5. **Simplify Text Shadow Toggle and Conditional Slider (Ticket 05)**:
   Restructure text styling controls so the shadow toggle icon button (using a shadow glyph or 'S') sits adjacent to its slider, with the slider rendered conditionally when shadow is active. Line-height controls remain intact and untouched.
6. **Move Song Set Rename Inline to Entry List Items (Ticket 06)**:
   Move title and code (`variableName`) rename affordances directly inside each row of the "Configured Song Sets" list with stable-height inputs (h-8), and remove the redundant top Rename Card from above the Shared Canvas Trio.
7. **Stabilize Properties Toolbar Height (Ticket 07)**:
   Constrain the properties toolbar container to a single, stable vertical height (e.g., `h-11` or `min-h-[44px] max-h-[44px]` with `flex-nowrap overflow-x-auto` or compact layout) so selecting an element never alters the container height or shifts the canvas.
8. **Preserve Canvas Stacking Order on Selection (Ticket 08)**:
   Configure `preserveObjectStacking: true` on `new fabric.Canvas(...)` in `ArtifactEditor.tsx`, ensuring selected objects remain in their true z-order layer instead of jumping visually to the top of the stack.
9. **Fix Layer Bring Forward Ordering (Ticket 09)**:
   Ensure `bringObjectForward` correctly increments the visual and data stack index of the target object relative to sibling objects and triggers immediate canvas re-rendering under `preserveObjectStacking: true`.

## User Stories

1. As an Admin dragging an inserted image across the canvas, I want to see the image intact throughout the drag operation, so that parts of the image do not vanish while moving.
2. As an Admin using the Artifact Editor on a laptop display, I want the window to remain completely free of vertical scrollbars, so that the canvas and controls stay firmly within the viewport.
3. As an Admin deleting a default or seeded element on a layout, I want to save the template without backend rejection, so that seed content is truly editable and deletable per DEC-014.
4. As an Admin opening Announcement Sets, I want the selected set name to display in clear, high-contrast text immediately upon load, without appearing greyed out.
5. As an Admin applying text styling, I want a clean text shadow toggle button that reveals an adjustment slider only when activated, so that the toolbar remains uncluttered.
6. As an Admin managing Song Sets, I want to rename an entry's title and code inline within its list row, without resizing the row or confusing the entry name with the shared canvas below.
7. As an Admin selecting different elements on the canvas, I want the properties toolbar above the canvas to maintain an identical height, so that the canvas never jumps or shifts.
8. As an Admin clicking any element on the canvas, I want it to stay in its true layer depth rather than automatically leaping to the top, so that I can see the real stacking relationships between layers.
9. As an Admin clicking "Bring forward" (+1), I want the selected element to advance one layer forward in real time, so that incremental z-order adjustments work reliably.

## Implementation Decisions

- **Architecture Invariants**: Fully aligned with `DEC-014` (seed elements are ordinary deletable content) and `AD-33` (Song Set Title/Verse/Reff canvas is shared across all song sets). No new `AD-N` or `FR`/`UC` is required.
- **Affected Modules**:
  - `src/components/admin/ArtifactEditor.tsx`: image drag clipPath sync, deck sequence viewport clamp, toolbar height stability, `preserveObjectStacking: true`, bring forward handling.
  - `src/components/admin/SongSetEntriesPanel.tsx`: inline rename in list items, removal of separate top Rename Card.
  - `src/components/admin/AnnouncementSetsPanel.tsx`: select trigger/value contrast and state resolution.
  - `src/lib/registry/canvas-utils.ts`: clipPath moving sync, layer reorder helpers.
  - `src/lib/registry/store.ts`: remove seed element deletion refusal in `assertStableAgainstSeed` (~L294).
  - `internal/plan/validate_artifact.go`: remove seed element deletion refusal in `AssertStableAgainstSeed` (~L648).
  - `.how/_platform/ARCHITECTURE-SPINE.md`: verify `AD-11` clause alignment with `DEC-014`.
- **Test Strategy**: Node.js test suite in `tests/` (`artifact-editor-controls.test.mjs`, `artifact-editor-layout.test.mjs`, `registry.test.mjs`, `operator-shadcn-guard.test.mjs`, `announcement-sets.test.mjs`, `registry-go-http.test.mjs`). Invert tests in `tests/registry.test.mjs` asserting seeded element immutability.

## Out of Scope

- Full multi-level undo/redo history beyond the single "Reset" (discard unsaved changes) step.
- Multi-element selection layer grouping beyond existing ActiveSelection support.
- New server endpoints or schema migrations (purely validation and UI layout fixes).
