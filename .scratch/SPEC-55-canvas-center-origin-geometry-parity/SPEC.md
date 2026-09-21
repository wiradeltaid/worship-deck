# SPEC-55 — Canvas Center-Origin Geometry Parity & Release Jump Elimination

> **Status:** open  
> **Release:** canvas-center-origin-geometry-parity  
> **Component:** registry  
> **Touches:** artifacts, tests  
> **Depends on:** SPEC-54  

## Problem Statement

During operator hand-testing of the Artifact Canvas Editor (`ArtifactEditor.tsx`) following the deployment of SPEC-54 / DEC-055, critical geometric regressions and handler misalignments were discovered:

1. **Mouse Release Element Jumping (`onObjectModified`):**
   - In SPEC-54-04, shapes and images were updated to `originX: 'center', originY: 'center'` in `canvas-utils.ts`, where `target.left` and `target.top` represent the object's center point.
   - During active dragging (`onObjectMoving`), the handler subtracted half-dimensions (`x: pxToPct(left - w / 2)`), correctly synchronizing the top-left visual DOM element with the mouse cursor.
   - However, on mouse release (`onObjectModified` lines 1394–1395), the handler did NOT subtract half-dimensions, directly saving `x: pxToPct(left)` and `y: pxToPct(top)` into `liveElements`.
   - Because `left` was the center of the object, the visual DOM element instantly jumped by `+w/2` to the right and `+h/2` downwards upon mouse release, detaching completely from the Fabric selection bounding box and handles.
   - Subsequent clicks or drags caused cumulative drift, shifting the element further away each time it was touched.

2. **Text Proxy Coordinate Detachment During Drag (`buildTextFabricOptions`):**
   - While shapes and images received center-origin properties, `buildTextFabricOptions` was overlooked and remained at `originX: 'left', originY: 'top'` with `left: pctToPx(element.x)`.
   - In `onObjectMoving`, half-dimensions (`w / 2`, `h / 2`) were subtracted unconditionally. Because `left` on text was already the top-left coordinate, this subtracted half the text width, causing the visual text to fly `w / 2` to the left of the cursor during drag.
   - Upon release (`onObjectModified`), text snapped back to top-left, causing jarring visual jumps while moving text.

3. **Silent Test Suite False-Pass (Testing Blind Spot):**
   - The test suite in `tests/smoke-spec-54.test.mjs` constructed objects using `mockFabric = {}`.
   - Because `mockFabric.Textbox` was undefined in the headless test environment, execution fell through to the headless fallback path (`const fallbackData = { ...common, type: 'text' }`), which inherited `common.originX: 'center'`.
   - The test never constructed a real `fabric.Textbox` through `buildTextFabricOptions`, allowing this major real-browser regression to ship with a green test suite.

4. **Copy, Duplicate, and Auto-Expand-Height Origin Gaps:**
   - `handleCopySelected` and `handleDuplicateSelected` in `ArtifactEditor.tsx` read `obj.left/top` without center-to-top-left conversion, misplacing duplicated shapes and images.
   - Similarly, text auto-expand-height logic (`onTextChanged`, `handleTextContentChange`, `handleFontSizeCommit`) assumed `top` represents the visual top edge, requiring center-origin top-offset compensation when text expands downward.

---

## Solution & Architectural Contracts

### 1. Invariant Coordinate Contract (Option A: Center-Origin Fabric Representation)
- **Persistent / DOM SSOT Model:**
  - `element.x`, `element.y`: Top-left coordinates of the unrotated bounding box in percentage of 960×540 reference canvas.
  - `element.w`, `element.h`: Unrotated bounding box size in percentage of 960×540.
  - `element.rotation`: Degrees around the unrotated center point `(x + w / 2, y + h / 2)`.
  - In `ArtifactSlide.tsx`: CSS `position: absolute; left: element.x%; top: element.y%; width: element.w%; height: element.h%; transform: rotate(...)deg; transform-origin: center center;`.
- **Fabric Interaction Proxy Model:**
  - All Fabric proxy objects (`Textbox`, `Rect`, `Line`, `FabricImage`, and proxy stands) MUST strictly use `originX: 'center', originY: 'center'`.
  - Fabric `left` and `top` represent the unrotated center point in reference pixels: `left = pctToPx(x + w / 2, 960)`, `top = pctToPx(y + h / 2, 540)`.
  - Fabric `angle` equals `element.rotation`.
  - Because Fabric rotates around its center and CSS rotates around its center, Fabric's selection bounding box and rotation handles precisely coincide with the DOM visual element at all rotation angles (0°–360°).
- **Line Geometry Specifics:**
  - For `type === 'line'`, local line coordinates remain `[0, 0, width, height]` (or `[0, 0, width, 0]` for horizontal lines). With `originX: 'center', originY: 'center'`, Fabric centers the line's bounding box at `(left, top)`.

### 2. Pure Bidirectional Conversion Helpers & Numeric Precision (`canvas-utils.ts`)
Consolidate all coordinate conversions into two pure, thoroughly tested helpers in `src/lib/registry/canvas-utils.ts`:
- `topLeftPctToCenterPx(x, y, w, h)`: converts DOM top-left percentages to Fabric center pixels:
  `left = pctToPx(x + w / 2, CANVAS_WIDTH)`
  `top = pctToPx(y + h / 2, CANVAS_HEIGHT)`
- `centerPxToTopLeftPct(left, top, widthPx, heightPx)`: converts Fabric center pixels back to DOM top-left percentages using unrotated local dimensions:
  `x = pxToPct(left - widthPx / 2, CANVAS_WIDTH)`
  `y = pxToPct(top - heightPx / 2, CANVAS_HEIGHT)`
- **Dimension Source Contract:**
  `widthPx = obj.getScaledWidth ? obj.getScaledWidth() : Math.abs(obj.width ?? 0) * Math.abs(obj.scaleX ?? 1)`
  `heightPx = obj.getScaledHeight ? obj.getScaledHeight() : Math.abs(obj.data?.authoredHeight ?? obj.height ?? 0) * Math.abs(obj.scaleY ?? 1)`
- **Numeric Precision Policy:**
  Float comparisons and round-trip assertions enforce an epsilon tolerance of $\le 0.05\%$ (or $0.5\text{px}$ on $960\times 540$) to prevent floating-point representation jitter while preserving pixel-perfect alignment.

### 3. Rotated Text Height Expansion Geometry
When text content grows in height (`computeAutoExpandedHeight`):
- To keep the unrotated top edge stationary, the center position must shift along the local Y-axis of the rotated element by $\Delta h / 2$:
  - Local $\Delta Y = (\text{newHeight} - \text{oldHeight}) / 2$
  - $\text{newCenterLeft} = \text{left} + \Delta Y \cdot \sin(\theta)$
  - $\text{newCenterTop} = \text{top} + \Delta Y \cdot \cos(\theta)$
  - At $\theta = 0^\circ$: $\Delta \text{left} = 0$, $\Delta \text{top} = \Delta Y$ (expands directly downward).
  - At $\theta = 90^\circ$: $\Delta \text{left} = \Delta Y$, $\Delta \text{top} = 0$ (expands along the rotated layout axis).

### 4. Text Clip-Path Initialization Causal Rationale
- In `applyFabricTextFit` (lines ~397–406), `tb.clipPath` was previously constructed using top-left origin: `new fabric.Rect({ left: tb.left, top: tb.top, ... })`.
- Because `tb` is now center-origin, a clip path with top-left origin clips the bottom-right quadrant of the text box on first paint until the object is moved.
- Setting `originX: 'center', originY: 'center', angle: tb.angle ?? 0` ensures the clip boundary aligns with the text box from initial paint.

### 5. Visual-Handler Parity Invariant Table

| Operation | Fabric Proxy State | DOM Visual State (`ArtifactSlide`) | Parity Invariant |
|---|---|---|---|
| **Initial Render** | `left = x + w/2`, `originX: 'center'` | `left: x%`, `width: w%` | Fabric center == DOM center |
| **Active Move** | `left = cursor_x` | `x = left - w/2` | Visual tracks cursor, zero offset |
| **Mouse Release (`onObjectModified`)** | `left = center` | `x = centerPxToTopLeftPct(left, w)` | **No jump**: coordinates identical before and after release |
| **Scaling / Resizing** | `left = center`, `w = width*scaleX` | `x = left - w/2`, `w = scaleX*w` | Bounds expand from center/handle |
| **Rotation (0°–360°)** | `angle = deg`, `origin: center` | `transform: rotate(deg)`, `origin: center` | Selection box rotates around DOM center |
| **Duplicate / Paste** | `left = clone_center + cascade` | `x = clone_top_left + cascade` | Cascaded offset identical across types |
| **Text Auto-Expand** | `h = newH`, `center` compensated | `h: newH%`, top edge anchored | Visual top edge stays fixed |

---

## User Stories

1. As an administrator editing slide artifacts, when I drag a shape, image, or text element and release the mouse, I want the visual element to stay exactly under the selection handles without jumping to the right or down.
2. As an administrator dragging text on canvas, I want the visual text to move smoothly in sync with the mouse cursor without detaching or jumping to the left.
3. As an administrator rotating an element (such as Prayer Request rotated 90°), I want the selection bounding box and rotation handle to remain perfectly centered over the visual text, allowing intuitive manipulation.
4. As an administrator duplicating or copying an element, I want the cloned element to appear at the expected cascaded offset without being distorted by center-origin offsets.
