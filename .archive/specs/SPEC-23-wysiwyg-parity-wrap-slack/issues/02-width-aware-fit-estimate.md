# SPEC-23-02 — Width-Aware PPTX Fit Estimate

**Status:** closed

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-6`, `UC-14`
- **Files**: `src/lib/artifacts/render-model.ts`
- **Tests**: `tests/smoke-spec-23.test.mjs` (T-23-04, T-23-05), `tests/artifact-render-model.test.mjs`
- **Blocked by**: SPEC-23-01

## Context

`estimateTextFitScale` passes `contentWidth: 0` (`render-model.ts:309`), so the width axis can never force
a shrink. A word wider than its box is invisible to the estimator, and the deck exports at a size that
guarantees LibreOffice will break the word.

SPEC-23-01 prevents this for newly saved elements. It cannot reach elements already stored, nor an element
the operator deliberately narrowed. This ticket is the second enforcement point for the same invariant
(SPEC.md §2.2).

A second, smaller defect sits in the same function: with `wrapLines` absent — which is every stored element
today — `resolveWrapLineCount` falls through to counting explicit newlines and reports 1, so a three-line
paragraph exports at full size while the presenter measures three lines and shrinks.

## Implementation Requirements

Numbered steps are the work; MUST / MUST NOT marks a constraint the finished code has to satisfy.

1. Give `estimateTextFitScale` a real `contentWidth`, read from `element.longestWordPx` — the measurement
   SPEC-23-01 persists. There is **no font measurement on the server**: this codebase has no shaping
   engine on the PPTX path, and inventing an advance table here would create a second opinion about
   glyph widths that could disagree with the canvas. Carrying the canvas's own number is the only way
   the two enforcement points stay consistent by construction.
2. When the element is **unmeasured** — no `longestWordPx`, or a `measuredWith` that no longer
   matches its style, or a `placeholderKey` element — fall back to `contentWidth: 0`, which is
   today's behaviour exactly. An unmeasured element
   MUST produce the byte-identical deck it produces now, never a guessed shrink. Expose which branch was
   taken (return value or a sibling pure predicate) so T-23-05 can assert on it rather than infer it.
3. When `wrapLines` is absent but `longestWordPx` is present, estimate the line count rather than
   assuming one. Use the cheapest bound that cannot overshoot:

   ```
   words        = content.split(/\s+/).filter(Boolean)
   longestWord  = the longest of words        // recomputed here, not persisted
   if (!words.length || !longestWord.length) return newlineCount
   charsPerLine   = max(1, floor(boxWidthPx / (longestWordPx / longestWord.length)))
   upper          = max(words.length, newlineCount)
   estimatedLines = clamp(ceil(totalChars / charsPerLine), newlineCount, upper)
   ```

   Only the *width* of the longest word is persisted, never the word — recover it by re-splitting
   `element.content` on whitespace and taking the longest token. The two guards are not decoration:
   empty or whitespace-only text divides by zero, and text with more newlines than words inverts the
   clamp so its lower bound exceeds its upper. Where `longestWordPx` is absent, keep today's newline
   count — do not guess.
4. This estimate exists only for the window in which an element has been measured but not yet re-saved
   with `wrapLines`. Once SPEC-23-05's healing pass has run, `wrapLines` is present and this branch is
   dead code on that element. Do not invest further precision in it.
5. `MIN_TEXT_FIT_SCALE` still floors the result. A word that cannot fit even at the floor clips, as today —
   but it clips at a size the browser also clips at, which is the parity this ticket buys.
6. No change to `textFitRatio`, `quantizeTextFitScale` or `largestFittingTextScale`. The browser path is
   correct and MUST NOT be touched.

## Acceptance Criteria

- [x] An element whose longest word exceeds its box width returns a scale below 1, and at that scale the
      word fits within the box — asserted against an element read from stored state, not only against a
      hand-built fixture.
- [x] Empty text, whitespace-only text, and text with more newlines than words all return a line count
      without dividing by zero or inverting the clamp.
- [x] An element with a comfortable box returns exactly 1 — no gratuitous shrinking of anything that
      already fits.
- [x] An element with no `longestWordPx` returns the scale it returned before this ticket, and the deck it
      produces is byte-identical to the pre-SPEC-23 deck for that element.
- [x] The branch taken (measured vs unmeasured) is observable from outside the function.
- [x] A three-line soft-wrapped paragraph without `wrapLines` no longer scores as one line.
- [x] Every existing `artifact-render-model.test.mjs` assertion still passes unmodified.

## Comments

- Implemented `isTextFitScaleMeasured` and `estimateWrappedLineCount` in `render-model.ts`.
- Updated `estimateTextFitScale` to pass `contentWidth: element.longestWordPx` when measured, shrinking words wider than box.
- Updated `resolveWrapLineCount` to estimate lines when `wrapLines` is absent but measurements exist.
- Dual-reviewed by agent and `cursor-agent composer-2.5`; validated comfortable box non-shrinking behavior, placeholder fallback, and sub-floor clamping.
- Verified in `tests/smoke-spec-23.test.mjs` (T-23-04, T-23-05, T-23-19) and `tests/artifact-render-model.test.mjs`.

