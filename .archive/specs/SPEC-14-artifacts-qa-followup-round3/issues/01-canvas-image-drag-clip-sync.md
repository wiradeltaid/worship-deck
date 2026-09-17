# 01: Canvas image drag clipPath synchronization (BUG-7 residual / SPEC-13-03)

**What to build:** Synchronize the `clipPath` of Fabric image elements during active drag movement (`object:moving`), so that image elements remain fully visible and properly clipped within their dynamic bounding box without visual disappearance or clipping artifacts while moving across the canvas.

**Blocked by:** none

**Status:** open

**Done when:**
- Dragging an inserted image across the canvas keeps the entire image content fully visible throughout the drag operation.
- The image's `clipPath` coordinates track the image position synchronously during `object:moving`, without waiting for mouse release (`object:modified`).
- No clipping or visual disappearance occurs while the drag is in progress.

### Implementation Steps

- [ ] In `src/components/admin/ArtifactEditor.tsx`, examine the `mountCanvas` event listeners. Currently, `object:modified` triggers `updateImageElementFit(target, fabric)` only after mouse release.
- [ ] During active dragging (`object:moving`), Fabric translates the `fabric.FabricImage` instance, but if its `clipPath` is configured with `absolutePositioned: true`, the clipping box remains fixed at its initial canvas coordinates, causing the image to move outside the clip window and appear visually clipped or partially hidden until `object:modified` fires on mouse up.
- [ ] Implement an `object:moving` event listener on `canvas` (or enhance `updateImageElementFit` / clipPath positioning) that continuously updates `clipPath.set({ left: target.left, top: target.top })` or sets relative clipping without `absolutePositioned: true` so the clip box moves synchronously with the image.
- [ ] Ensure `clipPath.setCoords()` and `canvas.requestRenderAll()` are called appropriately during `object:moving` without causing lag or dropped frames.
- [ ] Ensure `removeCanvasListeners` properly unregisters the `object:moving` listener on canvas unmount/disposal.
- [ ] Add unit/integration tests in `tests/artifact-editor-controls.test.mjs` verifying that moving a Fabric image updates its `clipPath` coordinates to match the image's new position throughout movement, not only upon `object:modified`.
