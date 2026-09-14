# SPEC-30 — PPTX Whole-Word Fallback Wrapping and Fit Parity

> **Status:** Draft / Open
> **Component:** registry (`src/lib/artifacts/render-model.ts`, `src/lib/pptx-draw.ts`)
> **Touches:** artifacts, pptx
> **Depends on:** SPEC-29
>
> **Second-opinion revision — 2026-09-14.** The reported defect is confirmed: an element without a valid measurement and trusted `wrapLines` reaches the PPTX renderer as one unpartitioned paragraph at scale `1`, letting PowerPoint perform a character-level break. The remedy is approved only as a bounded, shared fallback layout contract. It must preserve authored geometry and explicit paragraphs, use whole-token soft breaks only when a token fits at the effective scale, and retain SPEC-29's minimum-scale overflow policy. It must not claim pixel-identical glyph layout or that every arbitrarily long unbroken token can be made to fit.

## 1. Problem statement

Owner UAT found that `"Bandung international community"`, authored at `180px` in template `custom-08bbe5aa`, wraps by complete words in Canvas/Presenter but is fragmented by PPTX export:

- Canvas/Presenter: `Bandung` / `international` / `community`
- PPTX: `Bandung` / `internationa` / `l community`

The live element has neither `wrapLines` nor a current `longestWordPx` plus matching `measuredWith` stamp. `isMeasurementValid` therefore rejects stored measurement data, `resolveWrapLineCount` falls back to explicit newline count (`1`), and `estimateTextFitScale` supplies `contentWidth: 0`, returning scale `1`. The renderer then sends one wrapping-enabled DrawingML paragraph to PowerPoint. Even with the zero text margin established by SPEC-22, PowerPoint can split an oversized word at a character boundary.

## 2. Decisions and invariants

### 2.1 One deterministic fallback layout input

`render-model.ts` MUST resolve the text from `resolveElementText(element)` before calculating fallback layout; it MUST NOT use stale authored content after placeholder substitution.

For a text element without a valid stored `longestWordPx`/`measuredWith` pair, it MUST derive a deterministic fallback longest-token width from the resolved explicit paragraphs, current font size, and the existing headless character-advance policy. The implementation may use browser canvas metrics when available, but browser-only measurement MUST NOT be the only path: PPTX generation and its tests run headlessly. The fallback and its line partitioner MUST use one shared measurement helper, rather than two estimates that can disagree.

A valid stored measurement remains preferred. A mismatched font family, size, weight, style, placeholder substitution, absent value, non-finite value, or non-positive value selects the fallback; it must never yield a zero content width for non-empty text.

### 2.2 Fit and wrapping form one bounded calculation

The fallback MUST estimate whole-token wrapping for every explicit paragraph, calculate width and height constraints, and resolve an effective scale through the existing `resolveTextFitScale` / `MIN_TEXT_FIT_SCALE` policy. It MUST re-evaluate the fallback partition at that effective scale, because shrinking can change which tokens fit together. If that re-evaluation changes the number of lines, it MUST recompute fit until stable with a small, documented iteration bound; on a bound hit it MUST choose the smaller scale (the safe, non-overflowing result).

The width constraint is the longest token, not an invented break inside it. For a token that fits at or above `MIN_TEXT_FIT_SCALE`, the resolved scale MUST make the token no wider than the zero-margin PPTX box. For a token that cannot fit even at the floor, SPEC-29's residual-overflow policy remains authoritative: retain the floor, top-anchor if vertical overflow occurs, surface the condition to the editor where applicable, and do not mutate `w`, `h`, or text content.

### 2.3 Fallback PPTX soft breaks preserve document structure

Trusted `wrapLines` remain the preferred layout hint and continue to be validated by the shared SPEC-29 validator. When that hint is absent or rejected, `resolveTextRunsForPptx` MUST use the fallback partition from §2.2 instead of returning a single unpartitioned string.

- A computed wrap between complete tokens is emitted as `softBreakBefore` (`<a:br/>`) within the same DrawingML paragraph.
- Each authored `\n`, including consecutive empty paragraphs, is emitted as a paragraph boundary (`breakLine` / `<a:p>`), never as a soft break.
- Fallback wrapping may normalize collapsible ordinary whitespace in the same way CSS normal whitespace does, but must preserve token order, punctuation attached to its token, paragraph count, and non-breaking whitespace as an unbreakable token boundary.
- A no-whitespace token (including a long URL, a CJK string without separators, or an emoji/grapheme sequence) is indivisible for this feature. The fallback MUST NOT add a character, syllable, or grapheme break merely to make a line fit.

The current runtime contract has one style per text element, not independently styled inline runs. This work MUST NOT introduce a second rich-text model. The run builder must nevertheless retain its existing per-run options so a future inline-style extension can apply a line break without flattening styling.

### 2.4 Parity is a behavior boundary, not a pixel promise

Canvas and Presenter share their DOM visual layer; PPTX uses PowerPoint's layout engine. This SPEC promises the same authored box, resolved effective-scale policy, explicit paragraphs, and complete-token fallback break topology for tokens that fit at or above the scale floor. It does not promise identical glyph metrics, pixel positions, or behavior for a token that cannot fit at the readability floor. `fit: 'shrink'` remains a PowerPoint refinement only; it must not become the primary source of fallback line topology.

## 3. Acceptance criteria

1. For non-empty text without a valid measurement, the fallback supplies a finite positive longest-token width and a whole-token line estimate; `estimateTextFitScale` no longer bypasses its width constraint with `contentWidth: 0`.
2. The `180px`, approximately `102.15%`-wide synthetic reproduction of `"Bandung international community"` resolves whole-token lines and a non-`1` scale when its longest token exceeds the box. The generated PPTX XML contains two `<a:br/>` elements in one paragraph and no text run containing a fragment of `international`.
3. Fallback resolution applies after placeholder substitution and handles valid stored measurements, stale/missing measurements, absent/rejected `wrapLines`, repeated ordinary whitespace, punctuation, non-breaking spaces, explicit newlines, and consecutive blank paragraphs.
4. Valid SPEC-29 `wrapLines` snapshots remain authoritative and produce their existing paragraph/soft-break structure. Malformed snapshots remain ignored and are not silently repaired from their fragments.
5. A single oversized unbroken token is scaled to fit whenever its required scale is at least `MIN_TEXT_FIT_SCALE`. Below that floor, the feature inserts no intra-token break, preserves authored geometry, and follows the existing residual-overflow/top-anchor behavior.
6. `tests/smoke-spec-30.test.mjs` executes the production render-model and `generatePptxFromPlan` paths, inspects PPTX XML, and is added explicitly to the `package.json` test command. A real PowerPoint smoke/conformance run is recorded when COM is available; source/XML inspection alone is not presented as visual proof.
7. Every new absence guard is proved red by temporarily injecting each asserted production defect (at least: zero fallback width, whole paragraph passthrough, and an intra-token fallback break), then reverting it. The targeted SPEC-30 suite, affected regression suites, public-repository guard, and full `npm test` pass.

## 4. Work breakdown

- **SPEC-30-01 — Shared fallback measurement and converged fit:** Add the deterministic fallback measurement and bounded fit/partition convergence in `render-model.ts`. Keep valid stored measurements preferred and preserve the current minimum-scale behavior.
- **SPEC-30-02 — Fallback whole-token PPTX runs:** Make `resolveTextRunsForPptx` consume the resolved fallback partition when `wrapLines` is absent or invalid. Preserve author paragraph boundaries and do not introduce rich text or character-level breaking.
- **SPEC-30-03 — Production-path parity evidence:** Add registered tests for the reproduction, trusted and invalid snapshots, paragraph/token edge cases, scale-floor behavior, and generated OOXML. Include the conditional real-PowerPoint smoke procedure and the required red-then-green guard evidence.

## 5. Out of scope

- Changing authored `x`, `y`, `w`, or `h`, including automatic width expansion.
- Hyphenation, dictionary-based language segmentation, URL reformatting, truncation, or inserting character/grapheme breaks.
- Replacing Fabric, adding a fourth text-layout engine, or introducing rich inline text styling.
- Claiming pixel-identical rendering across Chromium, Microsoft PowerPoint, and other office suites.
