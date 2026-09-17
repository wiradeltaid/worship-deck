# Ticket SPEC-20-02 — Real-time Shape & Text Drag-to-Draw Rubberband Preview

**Status:** ready-for-agent

## Component
`registry` (`src/components/admin/ArtifactEditor.tsx`)

## Dependencies
`blocked_by: ["SPEC-20-01"]`

## Problem
During QA of SPEC-19 on `presenter-dev.bic.my.id`:
1. When drawing a rectangle or text element by dragging across the canvas, no visual box or outline appears during the drag. The element only appears abruptly when the mouse button is released.
2. Root Cause: In `ArtifactEditor.tsx`, the canvas event handling for `drawingTool` only hooks `mouse:down` and `mouse:up`. There is no `mouse:move` listener to render an in-progress preview bounding box or rubberband shape during drag interaction.

## Requirements
1. In `src/components/admin/ArtifactEditor.tsx`:
   - Keep a reference to a temporary preview Fabric object (`previewShapeRef.current`).
   - On `mouse:down`:
     - When `drawingToolRef.current` is active (`'rect'` or `'text'`), record `dragStart = { x: pointer.x, y: pointer.y }`.
     - Instantiate a temporary Fabric object:
       - For `rect`: `new fabric.Rect({ left: pointer.x, top: pointer.y, width: 0, height: 0, fill: 'rgba(92, 46, 22, 0.25)', stroke: '#5C2E16', strokeWidth: 1.5, strokeDashArray: [4, 4], selectable: false, evented: false })`.
       - For `text`: `new fabric.Rect({ left: pointer.x, top: pointer.y, width: 0, height: 0, fill: 'rgba(37, 99, 235, 0.15)', stroke: '#2563EB', strokeWidth: 1.5, strokeDashArray: [4, 4], selectable: false, evented: false })`.
     - Add the preview object to `canvas` and assign it to `previewShapeRef.current`.
   - On `mouse:move`:
     - If `dragStart` and `previewShapeRef.current` exist:
       - Compute `left = Math.min(dragStart.x, pointer.x)`, `top = Math.min(dragStart.y, pointer.y)`.
       - Compute `width = Math.abs(pointer.x - dragStart.x)`, `height = Math.abs(pointer.y - dragStart.y)`.
       - Update the preview object: `previewShapeRef.current.set({ left, top, width, height })`.
       - Call `canvas.requestRenderAll()`.
   - On `mouse:up`:
     - If `previewShapeRef.current` exists:
       - Remove `previewShapeRef.current` from `canvas`.
       - `previewShapeRef.current = null`.
     - Finalize coordinates and call `insertDrawnElement(...)`.
   - On drawing tool cancellation (Escape key pressed, `setDrawingTool(null)`, or canvas unmount):
     - Ensure any active `previewShapeRef.current` is removed from canvas and discarded.

## Acceptance Criteria
- While dragging on canvas with the Rectangle or Text tool active, a live dashed preview box tracks the pointer in real-time.
- Releasing the mouse commits the element at the exact drawn position and dimensions, with no leftover preview artifacts.
- Pressing Escape while dragging cancels the preview and cleans up the temporary object.
- Automated tests in `tests/smoke-spec-20.test.mjs` verify `mouse:move` registration and preview lifecycle.
