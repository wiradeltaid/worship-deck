# Issue 03 — Canvas Context Menu & Drag-to-Create

**Status:** done

## Summary
Satisfies UC-14 (FR-20, AD-38). Clean up sidebar clutter by providing contextual right-click controls on canvas objects and drag-to-create bounding box interaction for Text and Rectangle elements.

## Implementation Details
- Add custom right-click context menu on canvas elements: Bring to Front, Bring Forward, Send Backward, Send to Back, Duplicate, and Delete.
- Add drag-to-create drawing mode for Text and Rectangle tools on the canvas surface, defaulting to standard dimensions if clicked without drag.
- Remove redundant z-index and duplicate/delete buttons from the sidebar cards.

## Tests
- `tests/artifact-preview.test.mjs`
- `tests/canvas-dirty-guard.test.mjs`
