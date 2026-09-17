# Ticket SPEC-19-02 — Live Element Duplication Styling & Geometry Fidelity

**Status:** ready-for-agent

## Component
`registry` (`src/components/admin/ArtifactEditor.tsx`)

## Dependencies
`blocked_by: ["SPEC-19-01"]`

## Problem
In `ArtifactEditor.tsx`, when an operator duplicates a selected element (via the Duplicate button or context menu), the duplicated element does not retain modified styling properties (such as custom font family, size, color, text shadow blur, shape fill color, or resized dimensions). It resets to the stale initial template values. Furthermore, if the element was moved on canvas, duplicating it positions it based on stale template coordinates rather than its current live position.

## Root Cause
In `ArtifactEditor.tsx`, `handleDuplicateSelected` retrieves `source = byId.get(elementId)` where `byId` is populated from `layout.elements` and `addedElementsRef.current`. Unsaved in-progress styling modifications exist solely on the live Fabric.js canvas object (`obj`). `handleDuplicateSelected` only copied `obj.text` into `clonedElement.content` while copying `source.style` verbatim. For shapes, `fill` was not copied at all. Position calculation also used `source.x` and `source.y` instead of `obj.left` and `obj.top`.

## Requirements
1. In `handleDuplicateSelected`:
   - Read live styling from the selected Fabric object (`obj`):
     - For `text`: extract `fontFamily`, `fontSize`, `fill` (font color), `fontWeight`, `fontStyle`, `underline`, `textAlign`, `lineHeight`.
     - For text shadow: if `obj.shadow` is present, set `textShadow: true` and `textShadowBlur: (obj.shadow as any)?.blur ?? 4`.
     - For `shape`: extract `fill` (as `fillColor`) and `opacity`.
   - Read live position and dimensions from Fabric object:
     - `leftPx = obj.left ?? pctToPx(source.x, CANVAS_WIDTH)`
     - `topPx = obj.top ?? pctToPx(source.y, CANVAS_HEIGHT)`
     - `w = pxToPct(Math.abs(obj.width ?? 0) * (obj.scaleX ?? 1), CANVAS_WIDTH)`
     - `h = pxToPct(Math.abs(obj.height ?? 0) * (obj.scaleY ?? 1), CANVAS_HEIGHT)`
     - `x = Math.min(90, pxToPct(leftPx, CANVAS_WIDTH) + pxToPct(INSERT_CASCADE_PX, CANVAS_WIDTH))`
     - `y = Math.min(90, pxToPct(topPx, CANVAS_HEIGHT) + pxToPct(INSERT_CASCADE_PX, CANVAS_HEIGHT))`
   - Populate `clonedElement.style` and geometry with the extracted live values.
   - Add the new element to `addedElementsRef` and canvas, making it the active selection.

## Acceptance Criteria
- Duplicating an element with customized font family, font size 60, red color, and blur 14 creates an exact replica with identical styles.
- Duplicating a moved or resized shape with custom blue fill `#1E40AF` creates a duplicate with identical blue fill, dimensions, and cascaded position from its live location.
- Unit tests verify that `handleDuplicateSelected` preserves live Fabric object properties and coordinates.
