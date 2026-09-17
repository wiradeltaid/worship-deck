# Ticket SPEC-19-03 — Canvas Placement Isolation During Add Element Tool Mode

**Status:** ready-for-agent

## Component
`registry` (`src/components/admin/ArtifactEditor.tsx`)

## Dependencies
`blocked_by: ["SPEC-19-02"]`

## Problem
When an operator activates the Add Text or Add Rectangle button in the top toolbar (`drawingTool === 'text' | 'rect'`), hovering over existing elements (e.g. background shapes or textboxes) changes the cursor to the move/pointer cursor, and clicking selects or drags the underlying shape instead of placing the new element on top.

## Root Cause
Entering `drawingTool` mode currently sets `drawingToolRef.current = tool` and `canvas.defaultCursor = 'crosshair'`, but all existing objects on canvas remain `selectable = true` and `evented = true`. In Fabric.js, mouse events hit existing objects first, triggering selection or move interactions rather than bubbling to the canvas's `mouse:down` and `mouse:up` drawing handlers. Furthermore, `hoverCursor` defaults to `move`, overriding the crosshair cursor when hovering over shapes.

## Requirements
1. In `ArtifactEditor.tsx`:
   - When `drawingTool` becomes non-null:
     - Set `canvas.skipTargetFind = true`.
     - Set `canvas.selection = false`.
     - Set `canvas.defaultCursor = 'crosshair'`.
     - Set `canvas.hoverCursor = 'crosshair'`.
   - When `drawingTool` returns to `null` (after element is inserted or tool toggled off):
     - Set `canvas.skipTargetFind = false`.
     - Set `canvas.selection = true`.
     - Set `canvas.defaultCursor = 'default'`.
     - Set `canvas.hoverCursor = 'move'`.
   - Ensure these properties are properly cleaned up in the `useEffect` cleanup return and on canvas remount.
   - Add Escape key handler: pressing Escape while `drawingTool` is active cancels the tool (`setDrawingTool(null)`).
2. Ensure both click-to-place (default dimension) and drag-to-size (custom dimensions) cleanly add the new element at the targeted coordinates over existing shapes or images without selecting or moving the underlying element.

## Acceptance Criteria
- While Add Text or Add Rectangle is active, the cursor remains a crosshair over the entire canvas (including over existing shapes).
- Clicking or dragging over an existing shape places the new text or shape on top at the specified location without selecting or dragging the underlying shape.
- Underlying shapes do not move or become selected while drawing tool is active.
- Pressing Escape cancels the active drawing tool.
- After element creation or cancellation, drawing tool deactivates and normal object selection/moving resumes.
