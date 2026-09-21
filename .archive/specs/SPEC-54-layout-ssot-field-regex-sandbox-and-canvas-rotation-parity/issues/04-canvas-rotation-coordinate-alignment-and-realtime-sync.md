# Issue SPEC-54-04 — Canvas Element Rotation Coordinate Alignment and Real-Time Preview Sync

**Status:** closed  
**Spec:** SPEC-54  
**Component:** registry  
**Satisfies:** [UC-14, FR-20, FR-21]  
**Blocked by:** [SPEC-54-03]  
**Touches:** [artifacts]  

## Description

Fix the coordinate origin and rotation pivot alignment between the Fabric.js interaction canvas and the `ArtifactSlide` DOM visual layer by implementing complete bidirectional center-origin geometry conversions across all editor interactions, and bind real-time rotation events so rotating elements (e.g. `Prayer Request` on the `Family & Youth of the Week` announcement slide) remain centered over their selection handles and render continuously during user interaction.

## Key Changes

1. **Complete Bidirectional Center-Origin Geometry Alignment:**
   - In `src/lib/registry/canvas-utils.ts`, configure Fabric objects (textboxes, shapes, lines, images) to align with CSS `transformOrigin: 'center center'`:
     - Fabric Object Construction (Top-Left to Center):
       ```ts
       originX: 'center',
       originY: 'center',
       left: pctToPx(element.x + element.w / 2, CANVAS_WIDTH),
       top: pctToPx(element.y + element.h / 2, CANVAS_HEIGHT),
       angle: typeof element.rotation === 'number' ? element.rotation : 0,
       ```
     - Fabric Object Serialization & Persistence (Center to Top-Left):
       ```ts
       const wPct = pxToPct(target.getScaledWidth(), CANVAS_WIDTH);
       const hPct = pxToPct(target.getScaledHeight(), CANVAS_HEIGHT);
       const xPct = pxToPct(target.left - target.getScaledWidth() / 2, CANVAS_WIDTH);
       const yPct = pxToPct(target.top - target.getScaledHeight() / 2, CANVAS_HEIGHT);
       const rotation = Math.round((((target.angle % 360) + 360) % 360));
       ```
     - Enumerate and update all transform event handlers (`object:moving`, `object:scaling`, `object:resizing`, `object:rotating`, `syncTextClipOnMove`, `syncTextClipOnScale`) to use center-origin math.
   - This ensures that at any rotation angle (e.g. 90° for `Prayer Request`), Fabric's bounding box and rotation control handle stay centered directly on the visually rendered DOM text instead of flying off into the top-left coordinate space.

2. **Real-Time Live Preview Synchronization in `ArtifactEditor.tsx`:**
   - In `src/components/admin/ArtifactEditor.tsx`, bind Fabric's `object:rotating` event in addition to `object:modified`.
   - During active rotation drag, immediately update `liveInstance` with the current object angle, providing instant, continuous WYSIWYG feedback on the underlying visual slide layer.

3. **Clip Path and Selection Handle Alignment:**
   - Update `syncTextClipOnMove` and `syncTextClipOnScale` to respect center-origin transforms and rotation angles so that clipped text containers remain synchronized during and after rotation.

4. **Shared-Path Coverage Rationale:**
   - Text, shape, image, and line elements share the identical `canvas-utils.ts` and `ArtifactEditor.tsx` transform pipeline. Center-origin geometry is enforced across all element types to prevent regression across shapes and images.

## Verification & Tests

- **Numerical Geometry Invariant Tests Across Cardinal Angles:**
  - In `tests/artifact-editor-rotation.test.mjs`:
    - Test coordinate round-tripping (`top-left -> center -> top-left`) at 0°, 90°, 180°, and 270°.
    - Assert that the calculated center coordinate matches `pctToPx(x + w/2)` within 0.01px tolerance.
    - Assert that Fabric object bounding boxes surround the exact visual center of the element.
- **Real-Time Event Listener Test:**
  - Verify that Fabric canvas registers the `object:rotating` event listener for real-time `liveInstance` synchronization.
