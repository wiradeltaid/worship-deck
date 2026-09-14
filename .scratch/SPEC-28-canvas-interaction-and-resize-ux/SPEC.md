# SPEC-28 — Canvas Editor Interaction UX, Text Ghosting Elimination & Bounding Box Resize Invariants

## 1. Problem Statement

Hand testing by the product owner on 2026-09-14 (`/admin/artifacts`) surfaced two critical interaction and layout UX regressions in the Canvas Editor:

### 1.1 Text Ghosting on Interaction / Color Change
In the Option A Canvas Editor architecture (`ArtifactEditor.tsx`), `<ArtifactSlide>` serves as the underlying visual DOM layer, while Fabric.js operates as an overlay for selection borders and transformation handles.
When element colors are modified or styling is applied (`handleFontColorChange`, `applyTextStyle`), Fabric text objects can inadvertently render visible text fills (or shadows) instead of remaining 100% transparent. This causes the Fabric canvas layer to paint an opaque text run directly over the HTML DOM text run below, producing a double-text "ghosting" effect with slight antialiasing/subpixel divergence. Furthermore, because the Fabric proxy previously carried stale geometry, this ghost layer was fighting with the DOM layer underneath.

### 1.2 Text Bounding Box Resize Invariants & Font Size Coupling
The relationship between the user-facing Font Size control and the interactive bounding box resize handles exhibits three related defects:
1. **Unintended Visual Downscaling on Box Shrink**:
   When the user drags the bounding box resize handles to make the box smaller, the authored font-size number in the toolbar remains unchanged, but the visual text shrinks dramatically via the shrink-to-fit mechanism (`ArtifactSlide` `--artifact-fit-scale`). Reducing the bounding box should wrap and clip text via container `overflow: hidden` rather than automatically collapsing the visual font scale without user intent.
2. **Dynamic Minimum Height & Bounding Box Adaptation**:
   When font size is increased via the toolbar, the bounding box height and handles do not automatically expand to accommodate the larger font size. If the font size is increased beyond the existing bounding box height, the text collapses via shrink-to-fit and does not render at full scale until the user manually stretches the handles.
3. **Asymmetric Box Sizing Boundary Constraints**:
   The bounding box must enforce an intrinsic lower bound based on the current font-size and single-line/content height in reference-canvas pixels: `minTextHeightRefPx = fontSizePx * effectiveLineHeight`. A user drag cannot shrink the resize handles below this minimum height. Conversely, the upper bound can be freely overridden by the user (expanding the box wider/taller than the single-line minimum). When font size decreases, the existing enlarged box must not collapse; when font size increases, the box height must auto-expand and persist so the text renders immediately without requiring manual handle dragging.

---

## 2. Solution & Architectural Decisions

### 2.1 Complete Ghosting Elimination on Fabric Text Proxy
Every Fabric text proxy object must remain strictly non-visual for its full lifetime:
- Enforce 100% transparency on all interactive Fabric Textbox proxy objects (`fill: 'transparent'`, `stroke: 'transparent'`, `shadow: null`) across all canvas lifecycles: mount, selection sync, color changes (`handleFontColorChange`), style application (`applyTextStyle`), and object transformations.
- Centralize a non-visual proxy invariant rule: toolbar changes update `liveElements` and metadata (`obj.data.fontColor`, `obj.data.authoredFontSize`), but never assign visible `fill`, `stroke`, or shadow rendering to the Fabric object.

### 2.2 Shared No-Shrink-on-Resize Policy & Checkpoint Validation
A user box resize must never change authored font size or visual font scale:
- In `ArtifactSlide.tsx` and `canvas-utils.ts` (`applyFabricTextFit`), the shrink-to-fit mechanism must not trigger on manual bounding box resizing. An explicit editor-mode / element flag or standard CSS wrapping (`white-space: pre-wrap`) with container clipping (`overflow: hidden`) governs overflow without compromising production runtime safety.
- **Phased Validation Checkpoint**: Ship Issue 01 first and verify whether eliminating the stale ghost layer resolves the perceived scale lag, before finalizing the runtime shrink-to-fit decoupling in Issue 03.

### 2.3 Reference-Canvas Coordinate Alignment & Asymmetric Box Sizing
- **Coordinate Space**: Compute `minTextHeightRefPx = fontSizePx * effectiveLineHeight` in fixed reference-canvas pixels (`CANVAS_HEIGHT = 540`), converted to persisted percentage `h = pxToPct(minTextHeightRefPx, CANVAS_HEIGHT)`. Screen-space conversions apply only to interactive Fabric control handles, never to stored layout data.
- **Clamping in `onObjectScaling`**: In `canvas.on('object:scaling')`, ensure the clamp is guarded with `isFabricTextObject(target)` so shapes and images are not affected, clamping `target.height` to `minTextHeightRefPx` before synchronizing into `liveElements` and before normalizing scale in `object:modified`.
- **Multi-Selection & Auto-Expansion on Font Size Increase**: When font size increases in `handleFontSizeCommit`, loop over all active text objects (`canvas.getActiveObjects()`), compute each object's required single-line minimum height, expand `h` accordingly, update Fabric `height`, and set persistence flags (`userResizedHeight = true`, `authoredHeight = minTextHeightRefPx`).
- **Asymmetric Retention**: Decreasing font size never shrinks geometry; manually enlarged boxes remain untouched.

---

## 3. User Stories & Acceptance Criteria

### User Stories
1. As an administrator editing a slide, when I change the font color of text, I want only a single clean colored text run to appear without any ghosting or duplicated shadow layers.
2. As an administrator adjusting text bounding box handles, I want shrinking the box to wrap or clip text according to standard box model rules, rather than unexpectedly shrinking the visual font size.
3. As an administrator increasing font size in the toolbar, I want the bounding box handles to automatically expand so that the enlarged text renders immediately at full size without requiring me to manually stretch the box.
4. As an administrator, I want the bounding box to enforce a minimum height matching the font size, preventing accidental collapse of the text box below a readable single-line height.

### Acceptance Criteria
1. Changing font color, family, style, shadow, or font size leaves every selected Fabric text proxy non-visual (`fill: 'transparent'`, `stroke: 'transparent'`, `shadow: null`) while the DOM slide renders the selected style cleanly.
2. Shrinking a text box at a fixed font size does not change its visible fit scale (`fitScale = 1.0`); text wraps at the boundary and clips at `overflow: hidden`.
3. Increasing font size past the box's current single-line height immediately expands the saved box height for all selected text elements and renders at full scale.
4. A resize drag below the calculated minimum single-line height clamps to the minimum for text objects while leaving shapes and images unconstrained.
5. Decreasing font size does not reduce a previously enlarged box.

---

## 4. Implementation Plan & Issues

- **01: Complete Ghosting Elimination on Fabric Text Proxy**:
  Ensure all text interactions keep the Fabric canvas layer non-visual (`fill: 'transparent'`, `stroke: 'transparent'`, `shadow: null`) and route all visual updates to DOM `<ArtifactSlide>`.
- **02: Bounding Box Auto-Expansion on Font Size Increase**:
  Automatically adapt element height in reference-canvas coordinates when font size increases across single and multi-selection, setting persistence flags and updating Fabric proxy height.
- **03: Minimum Box Height Invariant and Shrink-to-Fit Decoupling**:
  Enforce minimum height constraints in `onObjectScaling` (text-guarded) based on reference-canvas font size and decouple box resizing from visual scale reduction without compromising runtime slide safety.
