# Issue SPEC-55-03 — Copy, Duplicate, Auto-Expand-Height, and Clip-Path Center Alignment

**Status:** closed  
**Spec:** SPEC-55  
**Component:** registry  
**Satisfies:** [UC-14, FR-20, FR-21]  
**Blocked by:** [SPEC-55-02]  
**Touches:** [artifacts]  

## Description

Align copy/duplicate element cloning, rotated text auto-expand-height logic, and text clip path construction with center-origin geometry in `ArtifactEditor.tsx` and `canvas-utils.ts`.

## Key Changes

1. **Copy & Duplicate Origin Alignment:**
   - In `handleCopySelected` (lines ~2230–2240) and `handleDuplicateSelected` (lines ~2598–2606), calculate `wPx` and `hPx` first, then convert position using `centerPxToTopLeftPct(leftPx, topPx, wPx, hPx)`.
   - Ensure duplicated or pasted shapes, images, lines, and text appear at the proper cascaded offset without being distorted by center-origin offsets.
2. **Rotated Text Auto-Expand-Height Geometry:**
   - In `onTextChanged`, `handleTextContentChange`, and `handleFontSizeCommit`, convert `target.top` to top-edge before checking bounds (`target.top - currentH / 2`).
   - When expanding downward (`shouldExpand`):
     - Calculate $\Delta Y = (\text{boundedRequiredHeight} - \text{currentH}) / 2$.
     - Account for rotation angle $\theta$:
       `target.left += ΔY * Math.sin(theta * Math.PI / 180)`
       `target.top += ΔY * Math.cos(theta * Math.PI / 180)`
     - This guarantees the unrotated local top edge of the text element remains anchored in place at any rotation angle (0°, 90°, 180°, 270°, and non-cardinal angles like 37°) while the box grows downward.
3. **Clip Path Initialization Causal Alignment:**
   - In `applyFabricTextFit` (canvas-utils.ts lines ~397–406), configure `tb.clipPath` with `originX: tb.originX ?? 'center', originY: tb.originY ?? 'center', angle: tb.angle ?? 0`.
   - Causal Rationale: Without center origin on initial paint, the clip rect positions relative to top-left, erroneously clipping the lower-right quadrant of newly rendered center-origin text until the object is moved.

## Verification & Tests

- Test verifying that duplicating an element places the clone at `(source.x + cascade, source.y + cascade)` accurately across text and shapes.
- Test verifying that expanding text content at 0°, 90°, and 37° keeps the visual top edge anchored while increasing box height downward.
- Test verifying that `applyFabricTextFit` clipPath centers over the text box on initial paint.
