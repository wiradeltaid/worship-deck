# 01: Decouple Dynamic Text PPTX Export from Heuristic Soft Breaks & Enable Native Word Wrap

**What to build:** In `src/lib/artifacts/render-model.ts`, implement `resolveExplicitParagraphRunsForPptx(element: ResolvedElement): PptxTextRun[] | undefined` which normalizes `\r\n` to `\n` and splits text on explicit `\n` into distinct paragraph runs (preserving blank lines with `breakLine: true`), without injecting heuristic `softBreakBefore: true`. In `src/lib/pptx-draw.ts`, update `renderTextElement` so that when `!hasAuthoritativeWrap`:
1. When `wordWrap === true` (native wrap default): use `resolveExplicitParagraphRunsForPptx(element) ?? text`, retain deterministic vertical height scaling `scale = fallbackLayout.scale` (ensuring vertical fit across both PowerPoint and LibreOffice with `fontScale="100000"` locked under SPEC-23-04), set `wrap: true` (`wrap="square"` on `<a:bodyPr>`), and use authored vertical alignment `resolveVerticalAlign(element.style ?? {})`.
2. When `wordWrap === false`: use `resolveExplicitParagraphRunsForPptx(element) ?? text`, set `wrap: false` (`wrap="none"` on `<a:bodyPr>`), and omit heuristic `<a:br/>` tags.
3. When `hasAuthoritativeWrap === true`: preserve the existing canvas-measured authoritative wrap path (`resolveTextRunsForPptx`, `estimateTextFitScale`, `resolvePptxVerticalAlign`).
In `tests/pptx-dynamic-text-native-word-wrap.test.mjs`, write automated regression tests inspecting generated PPTX DrawingML XML: verify that unmeasured hydrated scripture text has zero `<a:br/>` elements and has `<a:bodyPr ... wrap="square" ...>`; verify that explicit `\n` and CRLF creates distinct `<a:p>` paragraphs; verify that `wordWrap: false` has `<a:bodyPr ... wrap="none" ...>` without synthetic breaks; verify that static elements with authoritative `wrapLines` preserve `<a:br/>`; and include a defect injection proof asserting that injecting `softBreakBefore` fails the guard. Satisfies `UC-18` and `FR-14`.

**Blocked by:** None (can start immediately).

**Status:** open

- [ ] Read `src/lib/pptx-draw.ts`, `src/lib/artifacts/render-model.ts`, and `tests/pptx-word-wrap-option.test.mjs`.
- [ ] In `src/lib/artifacts/render-model.ts`, implement `resolveExplicitParagraphRunsForPptx`:
      - Extract string content using `resolveElementText(element)`.
      - Return `undefined` if content is empty or undefined.
      - Normalize line endings: replace `\r\n` with `\n`.
      - If text does not contain `\n`, return a single run `{ text }` (or `undefined` so caller uses `text` directly).
      - If text contains `\n`, split paragraphs and return runs with `breakLine: true` on boundaries (matching paragraph structuring without `softBreakBefore`).
- [ ] In `src/lib/pptx-draw.ts` (`renderTextElement`):
      - Update branch logic for `!hasAuthoritativeWrap`:
        - `textRuns = resolveExplicitParagraphRunsForPptx(element) ?? text`
        - `scale = fallbackLayout.scale` (retains vertical pre-scaling for LibreOffice/PPTX `fontScale="100000"`)
        - `valign = resolveVerticalAlign(style ?? {})`
      - Preserve authoritative wrap path when `hasAuthoritativeWrap === true`.
- [ ] In `tests/pptx-dynamic-text-native-word-wrap.test.mjs`:
      - Build a test fixture with Hebrews 1:1-2 NKJV text, Montserrat Bold 45px, 90.34% box width, no `wrapLines` (`hasAuthoritativeWrap === false`).
      - Generate PPTX with `wordWrap: true` and inspect `ppt/slides/slide1.xml`:
        - Assert `<a:bodyPr[^>]*wrap="square"[^>]*>` is present.
        - Assert zero `<a:br/>` tags exist in the dynamic text frame.
      - Generate PPTX with `wordWrap: false` and inspect `ppt/slides/slide1.xml`:
        - Assert `<a:bodyPr[^>]*wrap="none"[^>]*>` is present and zero `<a:br/>` tags exist.
      - Test explicit `\n` and CRLF: assert multiple `<a:p>` elements are created.
      - Test static slide with valid `wrapLines`: assert authoritative `<a:br/>` tags remain intact.
      - Add defect injection test asserting that injecting `softBreakBefore: true` on unmeasured text fails the guard.
- [ ] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/pptx-dynamic-text-native-word-wrap.test.mjs`, `npm test`, and `npm run typecheck` to verify 100% clean pass.
