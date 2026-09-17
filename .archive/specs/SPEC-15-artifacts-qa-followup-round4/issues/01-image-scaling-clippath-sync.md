# Ticket SPEC-15-01 — Canvas Image Real-time Scaling ClipPath Synchronisation (`BUG-7` residual)

**Status:** done

## Description

In SPEC-14, dragging an image during translation (`object:moving`) was fixed by synchronizing the `clipPath` coordinates via `syncImageClipOnMove`. However, when resizing an image to a larger size using corner handles, the image content visually clips against its original bounding box while the drag handle is active. The newly expanded dimensions only render once the mouse is released (`object:modified`).

## Root Cause

In `ArtifactEditor.tsx`:
- `canvas.on('object:moving', onObjectMoving)` is registered.
- There is NO listener for `object:scaling`.
- Fabric.js continuously scales the image object during corner handle dragging, but `clipPath` (`clipBox`, which has `absolutePositioned: true`) remains at its pre-scale dimensions and position until `object:modified` fires on mouse release.
- As a result, the image expands inside Fabric's transform, but is clipped by the static initial `clipBox`, giving the appearance of an invisible "window" limiting the resize preview.

## Proposed Solution

1. In `src/lib/registry/canvas-utils.ts`, implement `syncImageClipOnScale(target, fabric)` or extend `syncImageClipOnMove` to handle scale transformations:
   - When scaling, dynamically adjust the `clipBox` width, height, scaleX, scaleY, left, and top to match the target's active bounding rect in canvas coordinates, or update `scaleX`/`scaleY` on `clipBox` directly.
   - Call `clipBox.setCoords()`.
2. In `src/components/admin/ArtifactEditor.tsx`:
   - Add `canvas.on('object:scaling', onObjectScaling)`.
   - In `onObjectScaling`: synchronize the image's `clipPath` and call `canvas.requestRenderAll()`.
   - Remove the listener in `removeCanvasListeners`.
3. In `onObjectModified`: ensure the final contain/cover aspect fit recalculation (`updateImageElementFit`) settles the definitive dimensions cleanly.

## Acceptance Criteria

- When dragging a corner handle to enlarge an image, the image content expands smoothly in real time without being clipped to its starting rectangle.
- When scaling down, the image shrinks smoothly with no visual artifact or clipping boundary mismatch.
- After mouse release, the final image dimensions and aspect ratio remain sharp and accurate.
- Unit test in `tests/artifact-editor-controls.test.mjs` verifies `object:scaling` listener registration and active `clipPath` synchronization.
