# SPEC-23-01 — Longest-Word Slack Invariant on Persist

**Status:** closed

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`
- **Files**: `src/lib/artifacts/render-model.ts`, `src/lib/registry/canvas-utils.ts`
- **Tests**: `tests/smoke-spec-23.test.mjs` (T-23-01, T-23-02, T-23-03, T-23-17, T-23-18)
- **Blocked by**: —

## Context

Fabric never breaks a word at `splitByGrapheme: false`; it widens itself to fit one
(`fabric/dist/index.node.mjs:23007-23010`), and `serializeCanvas` persists that widened value as `w`
(`canvas-utils.ts:341-358`). The stored box ends up exactly as wide as the longest word, with no slack for
the shaping differences between three engines. SPEC.md §1.3 has the full mechanism.

## Implementation Requirements

Numbered steps are the work; MUST / MUST NOT marks a constraint the finished code has to satisfy.

1. Export `WRAP_SLACK_RATIO` from `render-model.ts` — the single unit-conversion table for this project,
   so the constant belongs there and nowhere else. Comment what it absorbs: the disagreement between
   Fabric's un-kerned per-grapheme advance sum and a shaped run in Chromium or LibreOffice.

2. **Calibrate the ratio before hard-coding it; do not inherit 1.02 on trust.** `1.02` is this spec's
   starting proposal, not a measurement. Measure the real disagreement on fixture F-1 — the width Fabric
   reports for `international` against the width Chromium lays it out at, at the same size and face — and
   set the constant above the observed delta with room to spare. Land that measurement as **T-23-18**, so
   the number has a test behind it rather than a paragraph. If the observed delta exceeds 2%, the
   constant moves and SPEC.md §2.1 is corrected; that is an expected outcome of this step, not a failure
   of it.

3. Add a pure helper to `render-model.ts`:

   ```ts
   applyWrapSlack(authoredWidthPct: number, longestWordWidthPx: number): number
   ```

   `longestWordWidthPx` is the same quantity the element persists as `longestWordPx`; the two names are
   one number, and nothing else in this spec measures a word. The helper returns the wider of the authored
   width and the slacked word width, as a percentage of `REFERENCE_CANVAS.width`. Total and pure — a
   non-finite or non-positive word width returns the authored width unchanged.

4. **Cap the widening at the canvas.** When `longestWordPx` exceeds `REFERENCE_CANVAS.width`, no box width
   can hold the word and widening only pushes it further off the slide while leaving the fit scale at 1.
   In that case the helper MUST NOT widen: return the authored width, and let SPEC-23-02's shrink branch
   take the case. A single unbroken string longer than the slide is the shape that hits this.

5. In `serializeCanvas`, when the object is a Fabric text object, read the longest word width from the
   object (`dynamicMinWidth` after wrapping, scaled by `scaleX`) and pass it through `applyWrapSlack`
   before the `MIN_ELEMENT_W_PCT` clamp.

6. **Re-wrap after widening, or write no wrap at all.** `textLines` read before the slack is applied
   describes the pre-widening box, and a wider box may hold the same text on fewer lines. Persisting both
   in one pass would store a wrap that contradicts the width stored beside it, and the export would break
   lines the canvas no longer breaks. So: after `w` changes, re-run the Fabric wrap at the new width and
   read `textLines` from that, **or** omit `wrapLines` for that element and let the healing pass
   (SPEC-23-05) supply it on the next open. Either is acceptable; silently keeping the stale array is not.

7. The slack MUST NOT be applied to non-text elements, and MUST NOT shrink anything — it is a floor on
   `w`, never a ceiling.

8. Off-canvas geometry stays untouched. Widening may push `x + w` past 100%; that is expected and MUST
   NOT be clamped (SPEC-21-02). Requirement 4 caps the word width, not the box position.

9. **Persist the measurement, not only its consequence.** Alongside `w`, write `longestWordPx?: number` —
   the longest word's width in reference-canvas pixels at the authored font size, as Fabric measured it.
   Add it to `types.ts`, `validate.ts`, `runtime-contract.ts` and `hydrate.ts` the way SPEC-22-02 added
   `wrapLines`.

   It exists because SPEC-23-02 must make the same judgement on the server, where there is no layout
   engine and no measured font. Carrying the number the canvas already computed is the only way the two
   enforcement points cannot disagree about which word is longest.

10. **Stamp the measurement with what it was measured against.** A width measured for 96px Arial is wrong
    the moment the operator switches the element to Great Vibes or changes the size, and a stale width
    would then drive both the slack floor and the export shrink. Persist the face alongside the number:

    ```ts
    longestWordPx?: number;
    measuredWith?: { fontFamily: string; fontSize: number; fontWeight: string; fontStyle: string };
    ```

    A reader whose element style no longer matches `measuredWith` MUST treat the element as **unmeasured**
    and take the fallback path, exactly as if the field were absent. Both fields are written together and
    cleared together; one without the other is invalid and `validate.ts` MUST reject it.

11. `longestWordPx` follows the `wrapLines` rules: omitted rather than written as `0` or `null` when
    unknown, and never written for a `placeholderKey` element, whose text is not yet known at authoring
    time.

## Acceptance Criteria

- [x] `applyWrapSlack` is pure, total, and unit-tested at its edges: zero, negative, `NaN`, `Infinity`,
      word narrower than the box, word wider than the box, and word wider than the whole canvas.
- [x] T-23-18 measures the Fabric-vs-Chromium delta on F-1 and asserts `WRAP_SLACK_RATIO` exceeds it.
- [x] `serializeCanvas` on F-1 persists a `w` at least `WRAP_SLACK_RATIO` wider than the longest word.
- [x] A text element whose authored box is already wider than its longest word is serialized unchanged.
- [x] An element whose longest word exceeds the canvas width is **not** widened.
- [x] After a save that changed `w`, the stored `wrapLines` either matches a re-wrap at the new width or
      is absent — never a stale array from the pre-widening box.
- [x] Shape and image elements are unaffected.
- [x] Off-canvas `x`/`w` values survive serialization without clamping (T-23-17).
- [x] `longestWordPx` and `measuredWith` are written together, omitted together, round-trip through
      validate and hydrate unchanged, and are rejected by `validate.ts` when only one is present.
- [x] An element whose style no longer matches its `measuredWith` is treated as unmeasured by every reader.
- [x] An element saved with `longestWordPx` satisfies `w ≥ longestWordPx × WRAP_SLACK_RATIO`, unless
      requirement 4 capped it — the two fields cannot be written inconsistently with each other.

## Comments

- Implemented `WRAP_SLACK_RATIO` (1.02) and `applyWrapSlack` in `render-model.ts`.
- Added `longestWordPx` and `measuredWith` across TS (`types.ts`, `validate.ts`, `runtime-contract.ts`, `hydrate.ts`) and Go (`types.go`, `validate_artifact.go`, `hydrate.go`).
- Integrated slack widening and re-wrap in `serializeCanvas` (`canvas-utils.ts`).
- Dual-reviewed by agent and `cursor-agent composer-2.5`; addressed feedback including Go/TS placeholder measurement stripping, font family normalization, re-wrap verification, and Go validation tests.
- Verified with automated tests in `tests/smoke-spec-23.test.mjs` (T-23-01, T-23-02, T-23-03, T-23-17, T-23-18).

