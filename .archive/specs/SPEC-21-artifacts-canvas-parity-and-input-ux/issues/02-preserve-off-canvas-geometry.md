# SPEC-21-02 — Preserve Off-Canvas Geometry on Save

**Status:** closed

## Component & Scope
- **Component**: `registry` (Serializer & Canvas Models)
- **Satisfies**: `UC-14` (Template Authoring Controls)
- **Files**:
  - `src/lib/registry/canvas-utils.ts` (`serializeCanvas`)
  - `.how/registry/06-flows/canvas-authoring-controls.md`
- **Tests**:
  - `tests/smoke-spec-21.test.mjs` (T-21-03, T-21-04, T-21-05, T-21-06)
  - `tests/smoke-spec-20.test.mjs` (update T-20-09)

## Context & Root Cause
In SPEC-20-04, `serializeCanvas` introduced slide-boundary upper clamping:
```typescript
const clampedW = Math.max(MIN_ELEMENT_W_PCT, Math.min(100 - computedX, w));
const clampedH = Math.max(MIN_ELEMENT_H_PCT, Math.min(100 - computedY, h));
```
This forcibly truncated elements placed near or beyond the right or bottom edges of the slide (e.g. `x = 70%`, `w = 50%` was truncated to `w = 30%`).
When saved and reloaded, the bounding box shrank, causing unintended word wrapping and shrink-to-fit triggers.
This directly contradicted the render model contract (`src/lib/artifacts/render-model.ts`) and presentation viewer policy (`src/components/artifacts/ArtifactSlide.tsx`), which explicitly state that elements may extend past the slide boundary and are clipped by the stage's `overflow: hidden`.

## Implementation Requirements

1. **Remove Slide-Edge Upper Boundary Clamping in `serializeCanvas`**:
   In `src/lib/registry/canvas-utils.ts`:
   ```typescript
   // SPEC-21-02: Retain minimum dimension floor, but do not truncate off-canvas bleeding
   const clampedW = Math.max(MIN_ELEMENT_W_PCT, w);
   const clampedH = Math.max(MIN_ELEMENT_H_PCT, h);
   ```

2. **Preserve Height Auto-Sync and Width Intentional Resizing**:
   - Ensure `h = isText ? Math.max(source.h, measuredTextHeightPct) : ...` continues to function.
   - Ensure `w = isWidthResized ? pxToPct(measuredWidth, CANVAS_WIDTH) : isText ? Math.max(source.w, measuredTextWidthPct) : source.w` continues to respect operator handle narrowing.

3. **Update Documentation**:
   - In `.how/registry/06-flows/canvas-authoring-controls.md`:
     Update line 72 to document that off-canvas bleeding is permitted and preserved without bounding box boundary clamping, matching PowerPoint and Presentation View.

## Acceptance Criteria
- [ ] An element positioned at `x = 70%`, `w = 50%` serializes as `w = 50%` (not clamped to `30%`).
- [ ] An element positioned at `y = 85%`, `h = 30%` serializes as `h = 30%` (not clamped to `15%`).
- [ ] Round-trip save and reload of an off-canvas element preserves its authored position and dimensions without shrinking.
- [ ] When text height expands beyond `source.h`, `h` auto-syncs to encapsulate the text lines.
- [ ] When an operator intentionally narrows the textbox via side handles, the narrowed width persists.
- [ ] In Presentation View and PPTX export, off-canvas elements render at stored geometry and bleed off-stage naturally under `overflow: hidden`.
