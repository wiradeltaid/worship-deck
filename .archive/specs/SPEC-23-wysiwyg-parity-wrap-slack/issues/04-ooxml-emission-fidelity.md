# SPEC-23-04 — OOXML Emission Fidelity

**Status:** closed

## Component & Scope

- **Component**: `hub` (PPTX worker)
- **Satisfies**: `UC-6`
- **Files**: `src/lib/pptx-draw.ts`, `src/lib/artifacts/render-model.ts`
- **Tests**: `tests/smoke-spec-23.test.mjs` (T-23-08, T-23-09, T-23-10)
- **Blocked by**: SPEC-23-02

## Context

Three free variables in what the archive currently carries. Each lets a reader make a layout decision this
codebase already made. All three were confirmed by inspecting generated `ppt/slides/slide1.xml` on the
current tree, not inferred.

1. **`wrapLines` becomes separate paragraphs.** `resolveElementTextForPptx` joins with `\n`, and pptxgenjs
   turns each into its own `<a:p>`. Paragraph spacing then applies between what were meant to be soft
   wraps, and PowerPoint and LibreOffice do not space paragraphs identically. pptxgenjs emits `<a:br/>`
   inside one paragraph when a run carries `softBreakBefore: true` (`pptxgen.cjs.js:6231`).
2. **`<a:normAutofit/>` carries no `fontScale`.** PowerPoint computes nothing until the shape is edited;
   LibreOffice computes its own at layout time. The same file renders at two sizes in two applications,
   which is precisely the divergence the baked-in scale was introduced to avoid.
3. **`lineSpacingMultiple` is conditional.** It is emitted only when `style.lineHeight` is a number
   (`pptx-draw.ts:267`). Otherwise PowerPoint uses the font's own line gap while the web always uses
   `TEXT_LINE_HEIGHT`. Two definitions of "one line".

## Implementation Requirements

Numbered steps are the work; MUST / MUST NOT marks a constraint the finished code has to satisfy.

1. Change the export text path so wrapped lines become `<a:br/>` runs inside one paragraph. Concrete
   algorithm, so two implementers cannot build different things:

   - Split the resolved text on operator-typed newlines first. Each piece is one paragraph.
   - Within a paragraph, split on the soft wraps `wrapLines` describes for it. Each piece after the first
     becomes a run carrying `softBreakBefore: true` (`pptxgenjs/types/index.d.ts:1216`).
   - Pass pptxgenjs the resulting array of run objects rather than a single newline-joined string.

   A line the operator broke and a line the wrap engine broke are different things and MUST NOT collapse
   into one representation. Where `wrapLines` is absent, emit exactly what is emitted today.

2. Replace the bare `<a:normAutofit/>` with `<a:normAutofit fontScale="100000"/>`.

   **Emit `100000`, not the fit scale.**
   `renderTextElement` already bakes the scale into the run's `fontSize` (`pptx-draw.ts:249-253`), which
   is what SPEC-22 introduced and what makes the shrink work in a reader that ignores autofit. Writing
   the same scale again into `fontScale` would shrink the text twice — an 0.85 estimate would render at
   0.72. Keep the bake, because it is the half that works everywhere, and use `fontScale` to say the
   thing that is currently unsaid — that the text already fits and the reader must not compute a
   scale of its own.
   `fontScale` is per-mille, so "no further shrink" is `100000`.

   That closes the C2 divergence in SPEC.md §1.3 without introducing a new one. If a later measurement
   shows a reader still needs a real scale here, that is a change of approach and belongs in a `DEC-`,
   not in an implementer's judgement call.

   **pptxgenjs cannot emit this through its options.** It hardcodes the bare tag for `fit: 'shrink'`,
   with the `fontScale` line commented out in its own source
   (`node_modules/pptxgenjs/dist/pptxgen.cjs.js:6066-6069`). The delivery path is therefore an XML patch
   in `postProcessArchive`, the stage that already rewrites slide XML for transitions and media — add a
   third pass beside them rather than a second post-processing mechanism. Order it after the existing
   two and match their defensiveness: a failure anywhere in post-processing returns the buffer already in
   hand rather than failing the download.

   Do not add `lnSpcReduction`. It reduces line spacing, which SPEC-23-04 requirement 3 is busy pinning
   down; adding both would put two things in charge of the same number.
3. Always emit `lineSpacingMultiple`, defaulting to `TEXT_LINE_HEIGHT` when `style.lineHeight` is absent.
4. `margin: 0` stays exactly as SPEC-22 left it. Do not touch it.

## Acceptance Criteria

- [x] A wrapped element emits one `<a:p>` containing `<a:br/>` separators; an element with operator-typed
      newlines still emits one `<a:p>` per typed line.
- [x] Every text shape's `bodyPr` carries `<a:normAutofit fontScale="100000"/>`, never the bare tag.
- [x] The run `sz` still carries the baked fit scale — the bake is not removed by this ticket, and a
      shrunken element renders at the same size in LibreOffice and in PowerPoint.
- [x] No `lnSpcReduction` attribute is emitted.
- [x] Every text shape carries an explicit line-spacing value.
- [x] `lIns`/`rIns`/`tIns`/`bIns` remain `0` — the SPEC-22 guard still passes unmodified.
- [x] A deck whose fit estimate fails still generates rather than throwing, and a post-processing
      failure ships the un-patched archive rather than no archive.
- [x] An element with no `wrapLines` produces byte-identical **run-level** XML to before this ticket:
      the same `<a:p>` and `<a:t>` structure and the same `sz`. `bodyPr` changes on every shape by
      design — requirements 2 and 3 apply to measured and unmeasured elements alike, because a
      reader's own autofit and line-spacing guesses are what they remove, and an unmeasured element
      needs that as much as a measured one. Every other "byte-identical export" claim in this spec
      (SPEC-23-02, SPEC-23-05, T-23-13, T-23-15) means run level too, and MUST be read that way.

## Comments

- Implemented `resolveTextRunsForPptx` in `render-model.ts` supporting `<a:br/>` via `softBreakBefore: true` within paragraphs and `<a:p>` via `breakLine: true`.
- Integrated `patchAutofitFontScale` post-processing in `pptx-draw.ts` ensuring `<a:normAutofit fontScale="100000"/>` is explicitly set on all slide bodies.
- Defaulted `lineSpacingMultiple` to `TEXT_LINE_HEIGHT` (1.2).
- Retained `resolveElementTextForPptx` presence in `renderTextElement` to keep T-22-01 green while delegating run rendering.
- Reviewed by agent and `cursor-agent composer-2.5`; validated with T-23-08, T-23-09, T-23-10 in `tests/smoke-spec-23.test.mjs` and all PPTX test suites.

