# 09: Canvas layer bring forward reorder mechanism (BUG-27 / LAINNYA 3)

**What to build:** Ensure that the "Bring forward" (+1) context menu and toolbar action correctly increments the selected element's layer in the stack and renders the step forward in real time.

**Blocked by:** 08

**Status:** open

**Done when:**
- Selecting an element and triggering "Bring forward" (+1) advances its visual and object layer by +1 position relative to adjacent canvas elements.
- Under `preserveObjectStacking: true` (Ticket 08), the layer advance is immediately visible on the canvas without deselecting.
- Saving the layout serializes the updated dense `zIndex` matching the new layer order.

### Implementation Steps

- [ ] In `src/components/admin/ArtifactEditor.tsx` (~L930-957), `handleReorderLayer` handles `'forward'` using `canvas.bringObjectForward(obj)`.
- [ ] Investigate why "Bring forward" was observed not to work during manual testing while Bring to Front, Send Backward, and Send to Back all worked:
  1. Under `preserveObjectStacking: false`, an active object was already rendered at the very top, creating the illusion that "bring forward" did nothing.
  2. In Fabric v6, `bringObjectForward(object, intersecting?: boolean)` without `intersecting: true` attempts to swap with `idx + 1`. If the object is at the top of selectable objects (or behind a non-intersecting element when intersecting is passed), it returns `false`.
  3. Verify whether `canvas.bringObjectForward(obj)` or moving the object to `Math.min(objects.length - 1, currentIndex + 1)` correctly re-orders `canvas._objects`.
  4. Ensure `serializeCanvas` reflects index increments in the serialized layout `zIndex` values.
- [ ] With `preserveObjectStacking: true` (Ticket 08) active, verify that calling `canvas.bringObjectForward(obj)`:
  - Swaps the object's position in `canvas._objects`.
  - Re-assigns canvas stacking coordinates.
  - Calls `canvas.requestRenderAll()`.
  - Marks the editor dirty (`markDirty()`).
- [ ] Add regression tests in `tests/artifact-editor-controls.test.mjs` asserting that:
  - An element at layer index 0 moved with action `'forward'` successfully advances to layer index 1.
  - The rendered layer order reflects the +1 step immediately.
  - The resulting serialized elements assign the expected incremented `zIndex`.
