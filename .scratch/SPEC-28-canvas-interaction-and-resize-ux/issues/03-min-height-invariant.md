# 03: Minimum Box Height Invariant and Shrink-to-Fit Decoupling

**What to build:** Enforce an intrinsic minimum height constraint on text bounding boxes in `onObjectScaling` (strictly guarded for text objects) based on reference-canvas font size and line height, preventing resize handles from collapsing the box smaller than its single-line font size, and decouple manual handle shrinking from unintended visual font scale reduction without compromising runtime slide safety.

**Blocked by:** 02 (Bounding Box Auto-Expansion on Font Size Increase)

**Status:** closed

- [x] In `canvas.on('object:scaling')`, clamp the minimum height of text elements (guarded by `isFabricTextObject(target)`) to `minTextHeightRefPx = fontSizePx * effectiveLineHeight` before synchronizing into `liveElements` and before normalizing scale in `object:modified`.
- [x] In `ArtifactSlide.tsx` and `canvas-utils.ts` (`applyFabricTextFit`), decouple box resizing from visual scale reduction so that manual box resizing preserves authored font size and relies on standard CSS wrapping and container `overflow: hidden`.
- [x] Ensure that users can freely override and expand the box larger than the minimum height.
- [x] Add automated smoke test verifying that resize handles cannot collapse a text box below its intrinsic single-line font size height and that shrinking does not collapse visual font scale.
