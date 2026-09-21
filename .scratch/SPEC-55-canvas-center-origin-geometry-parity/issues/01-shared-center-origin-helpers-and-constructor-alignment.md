# Issue SPEC-55-01 — Shared Center-Origin Bidirectional Geometry Helpers and Text/Shape/Line Constructor Alignment

**Status:** closed  
**Spec:** SPEC-55  
**Component:** registry  
**Satisfies:** [UC-14, FR-20, FR-21]  
**Blocked by:** []  
**Touches:** [artifacts]  

## Description

Establish single-source-of-truth bidirectional coordinate conversion helpers in `src/lib/registry/canvas-utils.ts` and align all Fabric object constructors (`buildTextFabricOptions`, `buildShapeFabricOptions`, `elementToFabricObject`, and fallback stands) to strictly use `originX: 'center', originY: 'center'`.

## Key Changes

1. **Add Shared Pure Helpers in `src/lib/registry/canvas-utils.ts`:**
   - Define `centerPxToTopLeftPct(centerLeftPx, centerTopPx, widthPx, heightPx)`: converts Fabric center coordinates (px) back to unrotated DOM top-left percentages (`x`, `y`).
   - Define `topLeftPctToCenterPx(xPct, yPct, wPct, hPct)`: converts DOM top-left percentages (`x`, `y`, `w`, `h`) to Fabric unrotated center coordinates (px) (`left`, `top`, `width`, `height`).
   - Dimension Source: define `getScaledDimensions(obj)` extracting unrotated local dimensions:
     - `w = obj.getScaledWidth ? obj.getScaledWidth() : Math.abs(obj.width ?? 0) * Math.abs(obj.scaleX ?? 1)`
     - `h = obj.getScaledHeight ? obj.getScaledHeight() : Math.abs(obj.data?.authoredHeight ?? obj.height ?? 0) * Math.abs(obj.scaleY ?? 1)`
   - Numeric Precision Policy: enforce an epsilon tolerance of $\le 0.05\%$ on float round-trips.
2. **Align `buildTextFabricOptions`:**
   - Configure `originX: 'center', originY: 'center'`.
   - Calculate `left` and `top` using `topLeftPctToCenterPx(element.x, element.y, element.w, element.h)`.
   - Ensure the real browser `fabric.Textbox` path receives the identical center-origin options as shapes and images.
3. **Refactor `buildShapeFabricOptions` and `elementToFabricObject`:**
   - Route `buildShapeFabricOptions` and `common` through `topLeftPctToCenterPx`.
   - Explicitly handle line elements (`element.type === 'line'`): line coords remain local `[0, 0, width, height]` with center bounding box at `(left, top)`.
   - Ensure all element types (text, shape, line, image proxy, and fallback stand-ins) share the identical center-origin invariant.

## Verification & Tests

- Unit test verifying `topLeftPctToCenterPx` and `centerPxToTopLeftPct` form an exact identity round-trip across representative `x, y, w, h` values within epsilon $\le 0.05\%$.
- Absence guard proof: ensure `buildTextFabricOptions` contains `originX: 'center'` and `originY: 'center'`.
