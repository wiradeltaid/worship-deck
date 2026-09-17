# Ticket SPEC-19-05 — Presentation View Auto-Shrink Sync & Canvas Overflow Feedback

**Status:** ready-for-agent

## Component
`presenter` / `registry` (`src/components/artifacts/ArtifactSlide.tsx`, `src/components/admin/ArtifactEditor.tsx`, `src/lib/artifacts/render-model.ts`, `src/lib/pptx-draw.ts`)

## Dependencies
`blocked_by: ["SPEC-19-04"]`

## Problem
1. When text with an unusually large font size (e.g. 180px) is placed on the canvas, it renders at 180px in `ArtifactEditor.tsx` and visually overflows its authored bounding box (`w` and `h`).
2. When viewed in the web presentation slideshow (`ArtifactSlide.tsx`), the text automatically shrinks down significantly and its relative vertical/horizontal alignment changes.
3. In PPTX downloads, font size 50px becomes 37.5pt, but visual proportions remain identical. Operators need clear documentation and visual cues in the editor so that canvas design matches presentation expectations.

## Technical Explanation & Root Cause
1. **PPTX Point (pt) vs Web Pixel (px) Ratio (0.75)**:
   - PowerPoint / Office Open XML measures slide geometry in inches and typography in typographic points (1 in = 72 pt).
   - A standard 16:9 slide is 10 in x 5.625 in (720 pt x 405 pt).
   - The web reference canvas is 960 px x 540 px.
   - Exact ratio: `405 pt / 540 px = 0.75 pt/px`.
   - A font size of 50px on canvas corresponds to `50 * 0.75 = 37.5 pt` in PowerPoint. In both systems, the text takes up exactly `50 / 540 = 9.259%` of the slide height. Visual proportions are 100% identical.
2. **Auto-Shrink Policy in Presentation View (`ArtifactSlide.tsx`) and PPTX Export (`pptx-draw.ts`)**:
   - `ArtifactSlide.tsx` applies `largestFittingTextScale` using container queries (`cqh`) and `ResizeObserver`. If text content exceeds its authored bounding box (`w` x `h`), it automatically reduces `--fit-scale` so text never spills out of the presentation frame.
   - Similarly, PPTX export runs `estimateTextFitScale(element)` in `src/lib/pptx-draw.ts`, downscaling font size when text exceeds the box so downloaded decks do not overflow shapes.
   - Importantly, element coordinates `x` and `y` do NOT change during auto-shrink. Instead, the smaller font size inside the flex container aligns according to `textAlign` and `verticalAlign`, which creates the visual perception of shifted positioning when compared to unconstrained text spilling outside the box in the editor.
   - In `ArtifactEditor.tsx`, Fabric.js's `fabric.Textbox` renders text at full authored size and allows glyphs to visually spill downwards outside the box, giving no indication that shrink-to-fit will trigger upon presentation.

## Requirements
1. In `ArtifactEditor.tsx`:
   - Compute whether active text element content overflows its authored box dimensions (i.e. whether rendered text height exceeds box height at authored font size).
   - When overflowing, render a non-blocking informational badge/hint in the properties toolbar:
     `⚠️ Text exceeds box bounds; presentation and PPTX will auto-shrink text to fit.`
2. In documentation (`.how/registry/06-flows/canvas-authoring-controls.md`):
   - Add a dedicated section explaining:
     - The exact mathematical 0.75 pt/px conversion for PPTX (`50px = 37.5pt`, `100px = 75pt`).
     - How `largestFittingTextScale` and `estimateTextFitScale` ensure worship lyrics and titles never overflow the screen during live presentation.
     - Guidance on sizing textbox width (`w`) and height (`h`) sufficiently large to accommodate desired font sizes without auto-shrink.

## Acceptance Criteria
- When a text element's content exceeds its bounding box height, an overflow warning badge is visibly rendered in the element properties toolbar.
- When the box is widened/heightened sufficiently to contain the text, the overflow warning clears.
- `.how/registry/06-flows/canvas-authoring-controls.md` documents the 0.75 pt/px equivalence and shrink-to-fit behavior.
- Test in `tests/smoke-spec-19.test.mjs` verifies documentation and overflow indicator presence.
