# Ticket SPEC-18-03 — Textbox Width Drag-Resize Serialization & Seed Conformance

**Status:** ready-for-agent

## Description

Fix the defect where widening a text element on the canvas (e.g. "Welcome to" on the `welcome` slide with large font size like 114) is lost upon saving, reverting the box to its original width and forcing text to wrap into two lines after reload.

## Root Cause Analysis
In `src/lib/registry/canvas-utils.ts` (`serializeCanvas`):
```typescript
const w = isText
  ? source.w * scaleX
  : measuredWidth === authoredWidth
    ? source.w
    : pxToPct(measuredWidth, CANVAS_WIDTH);
```
In Fabric.js, dragging side handles (`mr` / `ml`) on a `fabric.Textbox` alters `obj.width` directly while `scaleX` remains `1`. Because `isText` unconditionally evaluated `source.w * scaleX` (`source.w * 1`), the dragged width was discarded and `source.w` was restored on save!

## Requirements

1. **Serialization Width Calculation (`src/lib/registry/canvas-utils.ts`)**:
   - Refactor `w` computation in `serializeCanvas`:
     ```typescript
     const measuredWidth = Math.abs(obj.width ?? 0) * scaleX;
     const isWidthResized = Math.abs(measuredWidth - authoredWidth) > 1;

     const w = isWidthResized
       ? pxToPct(measuredWidth, CANVAS_WIDTH)
       : source.w;
     ```
   - Applies to text and shape elements alike, handling both side-handle drags (`scaleX === 1` with modified `obj.width`) and corner-handle drags (`scaleX !== 1`).
   - For untouched elements, `isWidthResized` is `false`, preserving the exact original `source.w` without floating-point conversion noise.

2. **Automated Unit & Regression Tests (`tests/artifact-editor-controls.test.mjs`)**:
   - Add a test: `serializeCanvas persists widened text box when scaleX is 1`:
     Simulate an object with `source.w = 56.42`, `obj.width = 750` (widened to ~78.12%), and `scaleX = 1`.
     Assert `serialized[0].w` is updated to ~`78.12%` and NOT reverted to `56.42%`.
   - Add a test: `serializeCanvas persists corner-scaled text box when scaleX !== 1`:
     Simulate text with `source.w = 50.0`, `scaleX = 1.5`, `obj.width = 480` -> visual width 720px (`75%`). Assert `w` persists as `75%`.
   - Add an active round-trip test: `serializeCanvas preserves exact source.w for welcome slide element e1 (w: 56.42) when not resized`.
   - Verify `registry-seed-conformance.test.mjs` remains 100% green.

3. **Smoke Test (`tests/smoke-spec-18.test.mjs`)**:
   - Add end-to-end assertions verifying `serializeCanvas` persists textbox width and seed templates are untouched.

## Acceptance Criteria
- Dragging textbox side handles to make text wider persists through Save.
- Corner-scaling text box also persists scaled width correctly.
- Large text (font size 114) on widened text boxes stays on one line after reload.
- Untouched seed layouts retain exact original percentages.
- All test suites green.
