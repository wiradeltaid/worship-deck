# 08: Canvas realtime object stacking preservation (BUG-26 / LAINNYA 2)

**What to build:** Configure Fabric.js on the canvas with `preserveObjectStacking: true` so that clicking or selecting an element keeps it in its true layer depth rather than automatically rendering it on top of all other objects.

**Blocked by:** none

**Status:** open

**Done when:**
- Selecting an element on the canvas does not alter its visual stacking layer relative to other overlapping elements.
- Elements positioned below other elements in z-order stay visually beneath them even while selected and active.
- Selection border and transformation handles remain accessible and interactive.

### Implementation Steps

- [ ] In `src/components/admin/ArtifactEditor.tsx` (~L485), `new fabric.Canvas(canvasRef.current, { ... })` is instantiated.
- [ ] Currently, `preserveObjectStacking` is omitted, defaulting to `false`. In Fabric.js, `preserveObjectStacking: false` forces the active object to the top of the render stack (`_chooseObjectsToRender()` concatenates `activeObject` at the end of the drawn objects array).
- [ ] As a result, clicking any lower-layer element immediately pops it to the front visually, making it impossible for the operator to see its true z-order relationship with overlapping elements or to simulate layer adjustments (`bringForward`, `sendBackward`) in real time while selected.
- [ ] Add `preserveObjectStacking: true` to the `new fabric.Canvas` options:
  ```ts
  const canvas = new fabric.Canvas(canvasRef.current, {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    selection: true,
    fireRightClick: true,
    stopContextMenu: true,
    backgroundColor: layout.backgroundColor,
    preserveObjectStacking: true,
  });
  ```
- [ ] Ensure that selection bounding boxes and control handles remain interactive and legible while the object is rendered at its true z-index.
- [ ] Add regression tests in `tests/artifact-editor-controls.test.mjs` verifying that `preserveObjectStacking: true` is set on canvas creation and that selecting an object does not alter its position in the canvas's rendering order.
