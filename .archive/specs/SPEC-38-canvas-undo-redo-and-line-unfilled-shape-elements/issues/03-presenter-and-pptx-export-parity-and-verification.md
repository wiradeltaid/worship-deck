# SPEC-38-03 — Presenter & PPTX Export Parity, Conformance Tests, and Absence Guards

**What to build:**
Ensure `line` and unfilled `shape` elements render with 100% visual fidelity in the live projection presentation view (`ArtifactSlide.tsx`) and export as native PowerPoint vector shapes in `src/lib/pptx-draw.ts`, accompanied by unified stroke unit conversion in `render-model.ts`, comprehensive smoke tests, regression tests, and absence guards.

**Blocked by:** 01-canvas-session-undo-redo-history-and-controls, 02-line-and-unfilled-shape-elements-and-properties

**Status:** closed

- [x] Unified stroke width conversion in `src/lib/artifacts/render-model.ts`:
  - Add helper `toPptxStrokeWidth(strokeWidthPx: number = 2): number` applying the $0.75\text{ pt/px}$ conversion factor.
  - Calculate outline transparency from `opacity`: `outlineTransparency = opacity !== undefined ? Math.round((1 - opacity) * 100) : undefined`.
- [x] Presenter View rendering (`src/components/artifacts/ArtifactSlide.tsx`):
  - Render `line` elements using SVG `<line x1="0" y1="0" x2="100%" y2={isDiagonal ? "100%" : "0"} />` within an absolute container scaled by container geometry.
  - Render unfilled `shape` elements with `border: `${strokeWidthCss} solid ${strokeColor}``, `backgroundColor: fillColor || 'transparent'`, and CSS `box-sizing: border-box`.
- [x] PPTX Export Engine (`src/lib/pptx-draw.ts`):
  - In `renderElementToSlide`:
    - If `element.type === 'line'`: add PPTX native line shape (`pptx.shapes.LINE`) with line options `{ line: { color: strokeColor, width: toPptxStrokeWidth(strokeWidth), transparency: outlineTransparency } }`.
    - If `element.type === 'shape'`: if `fillColor === 'transparent'` or `!fillColor`, set `fill: { type: 'none' }` and line options `{ line: { color: strokeColor, width: toPptxStrokeWidth(strokeWidth), transparency: outlineTransparency } }`.
- [x] Conformance Testing & Absence Guards:
  - In `tests/smoke-spec-38.test.mjs`:
    - Assert PPTX slide generation emits native line and outline rectangle shapes without errors, verifying generated OpenXML DrawingML tags.
    - Assert `ArtifactSlide` HTML structure contains proper SVG line and bordered outline box.
    - Implement real source-absence guards with defect injection for:
      1. Line and outline shape serialization in `serializeCanvas`.
      2. Stroke width conversion and outline transparency in `pptx-draw.ts`.
      3. Undo/redo reset on slide change in `ArtifactEditor.tsx`.
  - Register `smoke-spec-38.test.mjs` in `package.json` test runner.
