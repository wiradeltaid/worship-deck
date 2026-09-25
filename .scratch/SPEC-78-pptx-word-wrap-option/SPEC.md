# SPEC-78 — PPTX Text Box Word Wrap Option on Export

## Problem Statement

When downloading presentation decks as Microsoft PowerPoint files (`/api/services/{id}/pptx`), slide text boxes currently have native word wrapping disabled in DrawingML whenever the canvas editor has partitioned line breaks (`hasAuthoritativeWrap`) or soft breaks (`hasSoftBreaks`):

```ts
const shouldWrap = !hasAuthoritativeWrap && !hasSoftBreaks;
slide.addText(textRuns as any, { ... wrap: shouldWrap, ... });
```

This causes pptxgenjs to emit DrawingML text body properties with `wrap="none"` (no text wrapping).

Consequently:
1. When church operators open the downloaded `.pptx` in desktop Microsoft PowerPoint or LibreOffice and edit text (e.g., modifying song lyrics, updating announcement names, or adding sermon points), text boxes do not wrap. Text overflows in a single continuous line horizontally off the slide canvas.
2. If viewing machines have slight font rendering differences or substitute uninstalled fonts, text lines overflow outside the intended bounding box instead of wrapping within the shape box.
3. Church operators expect text boxes across sequence deck slides (announcements, song sets, sermon titles, and custom text areas) to support native word wrapping so that text remains cleanly bounded within its authored shape box upon download and editing.

## Solution

1. **Decouple Native DrawingML Wrap from Canvas Partitioning**:
   - In `src/lib/pptx-draw.ts`, separate line partitioning from DrawingML `wrap` body properties.
   - Maintain canvas-derived line breaks via `<a:br/>` and paragraph runs (`<a:p>`), while configuring DrawingML shape properties with `wrap: true` (`wrap="square"`).
   - This ensures intentional line breaks from canvas authoring are respected, while Microsoft PowerPoint reflows text within the shape box if edited or rendered on different displays.

2. **Configurable Word Wrap Export Option**:
   - Accept an optional `wordWrap?: boolean` option in `generatePptxFromPlan` (defaulting to `true`).
   - Query parameter contract on `GET /api/services/{id}/pptx`:
     - Default: `wrap=true` (native PowerPoint word wrapping enabled) when the parameter is omitted, empty, or `"true"`.
     - Explicit disable: `wrap=false` (sets `wrap: false` / `wrap="none"` in DrawingML) when parameter is `"false"` or `"0"`.
   - Forward `wordWrap` cleanly through Go HTTP handler (`internal/httpapi/server.go`) into the worker JSON payload and `workers/pptx/draw.mjs`.

3. **UI Export Controls**:
   - In `spa/src/pages/RunSheetPage.tsx`, enhance the "Download PPTX" action with an intuitive options popover or dropdown allowing operators to choose:
     - **Word Wrap in PowerPoint (Default)**: Text reflows within boxes when edited; line breaks preserved.
     - **Disable PowerPoint Word Wrap**: Disables native shape wrapping (`wrap=false`).

4. **Universal Coverage across All Sequence Slides**:
   - Because all slide types (announcements, song sets, liturgy, sermon notes, and custom slides) map to `ResolvedElement` text elements rendered by `renderTextElement`, a single decoupled option automatically covers every user text area without fragile per-template special casing.

5. **Automated Verification**:
   - Author `tests/pptx-word-wrap-option.test.mjs` asserting:
     - Default PPTX generation emits DrawingML text shapes with `wrap="square"` (or omits `wrap="none"`) while preserving `<a:br/>` line break runs.
     - Explicit `wordWrap: false` emits `wrap="none"`.
     - Query parameter `?wrap=true` and `?wrap=false` in Go API server translates cleanly to worker payload.
     - Source guards asserting `renderTextElement` respects the `wordWrap` export option.

## User Stories

1. As a church slide operator opening a downloaded PowerPoint file on a church laptop, I want text boxes in song sets and announcements to wrap within their shapes when I edit words, so that text does not run off the screen.
2. As a slide designer creating custom text areas on canvas slides, I want my intentional line breaks to be preserved in PPTX while retaining word wrap capabilities in PowerPoint.
3. As an operator needing to disable PowerPoint shape wrapping, I want the option to export with native wrapping disabled.
4. As a repository maintainer, I want automated tests verifying that PowerPoint DrawingML output contains valid wrap attributes and preserves line break elements across both export modes.
