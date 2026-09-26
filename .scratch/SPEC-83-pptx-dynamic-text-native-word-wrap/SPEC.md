# SPEC-83 — PPTX Dynamic Text Native Word Wrap & Break Parity

## Requirement Traceability & Scope
- **PRD**: `offline-deck`
- **Use Cases**:
  - `UC-18` (Generate and Download Offline PPTX Deck — satisfies `FR-14`)
- **Functional Requirements**:
  - `FR-14` (Offline Presentation Deck Generation)
- **Component**: `hub`
- **Touches**: `pptx`

## Problem Statement

During hand-testing on the development server (`presenter-dev.bic.my.id`, Service ID 8, Slide 8 "Memory Text", Hebrews 1:1-2 NKJV), an unnatural line-wrapping defect was identified in exported PowerPoint presentations:

1. **In-App Slide Presentation (`ArtifactSlide.tsx`)**:
   - In browser DOM with `whiteSpace: "pre-wrap"`, inside a container query box of width `90.34%` (1734.5px at 1080p), Montserrat Bold 45px naturally fits across 5 lines:
     - Line 1: `God, who at various times and in various ways` (~1600px < 1734.5px)
     - Line 2: `spoke in time past to the fathers by the prophets, has`
     - Line 3: `in these last days spoken to us by His Son, whom He`
     - Line 4: `has appointed heir of all things, through whom also He`
     - Line 5: `mad the worlds`
   - "various ways" fits cleanly on Line 1, producing balanced, natural typography.

2. **Exported PPTX with Word Wrap Disabled (`wrap=false` / `wrap="none"`)**:
   - Lines do not wrap at the shape boundary, overflowing past the slide's right edge into void (Finding 3).

3. **Exported PPTX with Word Wrap Enabled (`wrap=true` / `wrap="square"`, Default)**:
   - In PowerPoint, the font size is scaled down to ~26pt (Finding 4).
   - Line 1 prematurely breaks after "in various":
     - Line 1: `God, who at various times and in various`
     - Line 2: `ways spoke in time past to the fathers by the prophets, has in these`
   - An enormous empty gap is left on the right side of Line 1, while Line 2 is densely packed with 13 words starting with "ways".

### Root Cause Analysis

A multi-agent consensus review (conducted with Terra `gpt-5.6-terra` and Composer `composer-2.5`) confirmed a layout-authority collision in the export pipeline:

1. **Placeholder Hydration Measurement Invalidation (`SPEC-23-05`)**:
   - In `src/lib/artifacts/hydrate.ts` and `internal/plan/hydrate.go`, when `{scripture_text}` is replaced with the dynamic scripture text, `wrapLines`, `longestWordPx`, and `measuredWith` are intentionally stripped (`delete resolved.wrapLines`).
   - This stripping is correct: measurements taken at template authoring time measure only the short token string `"{scripture_text}"`, not the hydrated sermon/scripture body.
2. **Headless Fallback Partitioning**:
   - In `src/lib/pptx-draw.ts`, because `element.wrapLines` is absent, `hasAuthoritativeWrap` evaluates to `false`.
   - `renderTextElement` invokes `fallbackLayout = resolveFallbackTextLayout(element)`.
   - In `src/lib/artifacts/render-model.ts`, `partitionParagraphTokens` uses Node.js headless character advance heuristics (`estimateTokenAdvanceEm` / `measureTokenWidthPx`) on a 960x540 canvas (`boxWidthPx = 867.27px`).
   - The heuristic calculates: width up to "in various" = 823.95px; adding "ways" (110.25px + 13.5px space) = 947.70px > 867.27px.
   - The headless estimator concludes that "ways" overflows, wraps after "various", and attaches `options: { softBreakBefore: true }` to the subsequent run.
3. **DrawingML Serialization of Advisory Partitions as Hard Breaks**:
   - PptxGenJS translates `softBreakBefore: true` into `<a:br/>` inside DrawingML `<a:p>`.
   - In DrawingML, `<a:br/>` is an explicit hard line break (Shift+Enter).
   - Even though SPEC-78 enabled native PowerPoint shape word wrapping (`wrap: true` / `wrap="square"` on `<a:bodyPr>`), PowerPoint is strictly obligated to honor `<a:br/>`. It cannot pull "ways" back onto Line 1.
   - Note on Font Scaling: Under SPEC-23-04, `pptx-draw.ts` post-processes slide XML to lock `normAutofit` at `fontScale="100000"` (100%) for LibreOffice compatibility. The observed ~26pt font size in PowerPoint was produced by `fallbackLayout.scale` pre-scaling the 33.75pt font (45px * 0.75 * 0.78 ≈ 26.3pt). The pre-scale is legitimate for vertical containment, but serializing heuristic line breaks as hard `<a:br/>` breaks is the proximate defect that prevents PowerPoint's native word wrap from placing "ways" on Line 1.

## Architecture & Solution

### Three Layers of Text Layout Authority
Align export behavior with a clean separation of responsibilities:
1. **Semantic Text Structure**: Hydrated text content and explicit author paragraph breaks (`\n`).
2. **Authoritative Layout**: Canvas-measured and validated `wrapLines` for the exact resolved string (static slides authored in Canvas DOM). Retained as-is for deterministic layout.
3. **Advisory Layout**: Headless heuristic layout (`resolveFallbackTextLayout`). Used for deterministic font height scaling (`scale`), but **never serialized as `<a:br/>` soft breaks on export**.

### Specific Architectural Changes

1. **Native Word Wrap for Dynamic Unmeasured Text (`wordWrap === true && !hasAuthoritativeWrap`)**:
   - In `src/lib/artifacts/render-model.ts`, implement `resolveExplicitParagraphRunsForPptx(element: ResolvedElement): PptxTextRun[] | undefined`:
     - Normalizes line endings (`\r\n` to `\n`).
     - Splits text on explicit `\n` into paragraph runs (preserving blank lines with `breakLine: true`), without injecting `softBreakBefore: true`.
     - Returns `undefined` if text has no `\n` (caller emits raw string).
   - In `src/lib/pptx-draw.ts` (`renderTextElement`):
     - When `!hasAuthoritativeWrap`:
       - `textRuns = resolveExplicitParagraphRunsForPptx(element) ?? text`.
       - Do NOT emit heuristic `<a:br/>` soft breaks.
       - Set shape wrapping to `wrap: wordWrap` (`wrap="square"` when true, `wrap="none"` when false on `<a:bodyPr>`).
       - Apply deterministic height pre-scaling: `scale = fallbackLayout.scale` (ensuring vertical fit across both PowerPoint and LibreOffice with `fontScale="100000"` locked).
       - Use authored vertical alignment via `resolveVerticalAlign(element.style ?? {})` (`'top' | 'middle' | 'bottom'`), decoupled from heuristic line-count shifts.

2. **Disable Word Wrap (`wordWrap === false && !hasAuthoritativeWrap`)**:
   - Use `resolveExplicitParagraphRunsForPptx(element) ?? text`.
   - Do NOT inject heuristic `<a:br/>` soft breaks.
   - Set `wrap: false` (`wrap="none"` on `<a:bodyPr>`). Lines may overflow horizontally as intended when word wrap is explicitly disabled.

3. **Authoritative Canvas Wrap Preservation (`hasAuthoritativeWrap === true`)**:
   - Elements with verified canvas-measured `wrapLines` continue using `resolveTextRunsForPptx`, `estimateTextFitScale`, and `resolvePptxVerticalAlign`, maintaining existing deterministic layout for static canvas slides.

4. **Multi-Paragraph and Edge-Case Preservation**:
   - Explicit `\n` in lyrics, scripture, and announcement items is preserved as paragraph breaks with `breakLine: true` (yielding distinct `<a:p>` elements in DrawingML).
   - Empty lines (`\n\n`) and CRLF (`\r\n`) are normalized and preserved as empty paragraph runs.
   - If `wrapLines` is present but fails validation (`validateWrapLines` returns `null`), it correctly routes to the unmeasured path (continuous text without broken partitions).

## Verification & Test Plan

1. **Automated DrawingML Guard Test (`tests/pptx-dynamic-text-native-word-wrap.test.mjs`)**:
   - Create a test fixture mimicking Slide 8 (Hebrews 1:1-2 NKJV, Montserrat Bold 45px, 90.34% box width, hydrated dynamic text without `wrapLines`).
   - Export to PPTX with `wordWrap: true`.
   - Parse `ppt/slides/slide1.xml` from the generated zip:
     - Assert `<a:bodyPr ... wrap="square" ...>` is present on the shape.
     - Assert **zero** `<a:br/>` tags are present in the dynamic text frame.
     - Assert text flows continuously without synthetic line breaks.
   - Test explicit `\n`: assert that `"Paragraph 1\n\nParagraph 2"` (including CRLF `\r\n`) produces distinct `<a:p>` paragraphs.
   - Test `wordWrap: false`: assert `<a:bodyPr ... wrap="none" ...>` is present and zero `<a:br/>` tags exist in the unmeasured shape.
   - Test static element with valid `wrapLines`: assert authoritative `<a:br/>` tags remain preserved.
   - Add real-file defect injection proof: artificially inject `softBreakBefore: true` and verify the test fails red before passing green.
2. **End-to-End Suite**:
   - Run `npm test` and `npm run typecheck` to confirm zero regressions across all test suites (including `tests/pptx-word-wrap-option.test.mjs` and `tests/smoke-spec-30.test.mjs`).
