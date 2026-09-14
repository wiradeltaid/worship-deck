# SPEC-29 — Canvas Text Whole-Word Wrapping, Box Fidelity & Safe Overflow Alignment

> **Review stamp — 2026-09-14: revised after second opinion.** The owner report is confirmed: the save path can preserve Fabric `Textbox.textLines`, and a character-fragmented snapshot can then reach the PPTX path. The original remedy is **not approved as written**. A box cannot be both capped at the canvas width and guaranteed to contain every unbroken word, and automatic width mutation would reopen SPEC-26's no-geometry-drift rule. This revision preserves explicit author geometry, validates optional wrap snapshots, and uses the already-established fit-to-box policy whenever geometry cannot contain the authored text.
>
> **Relationship to prior work.** SPEC-23's measured `longestWordPx` plus `estimateTextFitScale`, and SPEC-26's canonical authored-box / `applyFabricTextFit` policy, remain the architecture. SPEC-29 corrects the remaining unsafe boundary: treating Fabric's internal line array as export authority without validating it. It MUST NOT replace the shared fit policy with another auto-sizing policy.

## 1. Problem Statement

Owner UAT on 2026-09-14 in `/admin/artifacts`, Presenter, and PPTX export reported severe layout failures with 180px text such as `Bandung\nInternational\nCommunity`:

1. The editor can make text appear to exceed its intended box before save, so the operator cannot tell that the saved box is too narrow or short.
2. Fabric can expose a `textLines` array containing character fragments when its internal wrapping is constrained. `serializeCanvas` currently copies that array to `wrapLines`; the export path may convert those entries to soft breaks.
3. CSS flex centering can place an overflowing text block above the box's top clip edge. The first line's ascenders are then lost in Presenter/Projector.
4. PPTX and browser layout engines do not share glyph metrics. A line snapshot is useful only when it is coherent with the original text and every snapshot line ends at a valid word boundary.

The required outcome is not that a 180px word always remains 180px inside any chosen box. It is that every surface renders the full text legibly, never introduces a character-level break, and presents the same authored geometry and effective fit decision.

## 2. Decisions and Invariants

### 2.1 Authored geometry and effective text size are separate

`x`, `y`, `w`, and `h` remain authored template geometry. Fabric's computed dimensions MUST NOT become persisted geometry merely because its layout engine changed them (SPEC-26 / BUG-35).

A font-size edit is an intentional author action, but it does not grant the implementation permission to widen a box arbitrarily. If the longest word is wider than the selected box—or wider than the entire canvas—the only universal, bounded answer is the existing effective-scale policy: measure the element, reduce its rendered font size no lower than `MIN_TEXT_FIT_SCALE`, and use that same decision in Canvas, browser, and PPTX.

The editor MAY grow **height only** after an explicit font-size commit, but only to the measured height at the effective scale and only within the remaining reference canvas height. It MUST then recompute the fit. This is a usability aid, not a new source of width geometry. Width changes remain an explicit resize action (or the already-approved SPEC-23 slack behavior where applicable).

### 2.2 `wrapLines` is an optional, validated export hint

Fabric `textLines` is never authoritative. Before persisting it, the serializer MUST validate that the candidate lines are a lossless partition of the original text's explicit paragraphs:

- Each non-empty candidate line consists of consecutive complete whitespace-delimited tokens from one original paragraph.
- Concatenating candidate tokens with normalized single spaces reproduces that paragraph's normalized token sequence exactly.
- Candidate lines may not cross an explicit newline boundary.
- Empty original paragraphs remain explicit paragraph breaks; the validator MUST NOT collapse them.
- A candidate such as `['Band', 'ung']` for source text `Bandung` is invalid, even though a naive flattened comparison might appear close enough after arbitrary whitespace normalization.

If validation fails, `serializeCanvas` MUST omit `wrapLines`; it MUST NOT repair a string by guessing Fabric metrics. The shared measurement (`longestWordPx`, `measuredWith`) and `estimateTextFitScale` then provide the safe fallback. `resolveTextRunsForPptx`, `resolveElementTextForPptx`, and `resolveWrapLineCount` MUST use the same validator, so stale or externally supplied malformed registry data cannot reintroduce a syllable break.

Explicit author newlines are content, not soft wraps. PPTX must preserve them as paragraph breaks; only trusted soft-wrap entries can become soft breaks.

### 2.3 Box fidelity in the editor

The editor's visual layer remains `ArtifactSlide`, and its interaction-layer text object MUST use the same authored `w`, `h`, effective scale, and clipping bounds. Fabric's clip path MUST be synchronized after move, resize, and font-size edits. The stage may clip at its own edges, but no text may appear outside its own authored box in the interaction layer while the visual layer clips it.

On a font-size commit the implementation MUST:

1. update the selected element's authored font size;
2. obtain an effective scale using the shared fit rules and current authored box;
3. optionally increase `h` only as described in §2.1, record it as an explicit font-size height adjustment, and recompute the final effective scale;
4. reapply Fabric dimensions and clip path from the final authored box; and
5. persist only intentional user geometry plus the measured metadata required by SPEC-23.

A single unbreakable word wider than the canvas is a supported edge case: it is scaled down when possible. At the minimum readable scale, any residual overflow is clipped consistently and reported by the editor rather than silently changing the word or widening the element off-canvas.

### 2.4 Safe vertical alignment is conditional on overflow

`verticalAlign: middle` and `bottom` retain their normal meaning while the effective text block fits. When the actual content block is taller than its box—after the fit calculation, including the minimum-scale floor—the first visible line MUST be top-anchored. The browser implementation may use CSS `safe center` where supported, but it MUST have a measured `scrollHeight > clientHeight` fallback to `flex-start`; changing `toCssJustifyContent` to unconditional `flex-start` is not acceptable because it breaks valid centered and bottom-aligned templates.

PPTX has no CSS safe-alignment equivalent. Its vertical alignment remains the authored value when its estimated fit succeeds; when its own estimate reaches the minimum scale and still exceeds the box height, it MUST select top alignment. The deck must never sacrifice the first line to preserve symmetric clipping.

## 3. Acceptance Criteria

1. A save of source text `Bandung` with Fabric candidate lines `['Band', 'ung']` persists no `wrapLines`; no PPTX text resolver or line-count resolver accepts that array.
2. Valid candidates containing only complete original tokens are persisted and emitted as soft breaks. Explicit newlines, including consecutive empty paragraphs, remain paragraph breaks.
3. A trusted snapshot and its original text must be validated by one shared helper on both serialization and rendering paths. A divergent duplicate validator is prohibited.
4. A 180px, narrow-box fixture renders whole tokens on Canvas, Presenter/Projector, and PPTX. If its authored dimensions cannot contain the authored size, all surfaces use an effective shrink decision rather than character wrapping or implicit width persistence.
5. A font-size increase may intentionally increase height only to the final effective content height and available canvas height. It does not widen `w` merely because Fabric reports a larger `dynamicMinWidth`; a no-edit save still preserves `w` and `h`.
6. The Fabric interaction layer clips at the same element box as `ArtifactSlide`; after save/reload, text does not newly disappear outside a narrower persisted box.
7. Middle or bottom alignment remains unchanged for fitting content. For verified vertical overflow, Canvas, Presenter, Projector, and PPTX preserve the complete first visible line by top anchoring.
8. The minimum-scale branch is explicitly tested and visually signalled in the editor. It is an accepted readability limit, not permission to emit a broken word.
9. Automated coverage includes serializer/resolver unit cases, a browser save/reload fixture, and PPTX run/XML inspection. The browser and Office/LibreOffice manual smoke test is recorded as a deliverable because a source scan cannot prove glyph visibility.
10. Each new absence guard is proved red by injecting every claimed defect form—at minimum character-split `textLines`, a stale malformed persisted `wrapLines`, and a forced vertical-overflow alignment—then reverting the injection. The full suite and public-repository guard remain green.

## 4. Work Breakdown

### SPEC-29-01 — Trusted whole-word wrap snapshots

Implement a pure, exported validator/canonicalizer for `text` plus candidate `wrapLines`; use it in `serializeCanvas`, PPTX text resolution, and wrap line counting. Invalid data is omitted or ignored, never reconstructed by a second wrapping engine. Cover punctuation, repeated spaces, explicit newlines, blank paragraphs, and character fragmentation.

### SPEC-29-02 — Font-size commit and box coherence

Keep width as explicit author geometry. Reconcile `handleFontSizeCommit`, `applyFabricTextFit`, live editor state, and serialization so the final authored box and the effective fitted text agree. Permit bounded intentional height growth; do not add `widthChange: 'font-size-auto'` or persist Fabric auto-width. Surface minimum-scale residual overflow to the author.

### SPEC-29-03 — Conditional safe vertical overflow

Add actual-overflow detection to the browser text element and a corresponding PPTX estimate branch. Preserve valid middle/bottom alignment, but top-anchor when the final content cannot fit. Add a real browser visual smoke test plus PPTX option/run assertions.

The tickets are sequential because 29-02 must consume the trusted snapshot/fitting contract from 29-01, and 29-03 must use the final measured fit behavior from 29-02.

## 5. Out of Scope

- Replacing Fabric, adding a fourth central text-layout engine, or rasterizing editable text.
- Guaranteeing identical glyph metrics across Chromium, PowerPoint, and LibreOffice.
- Altering existing template widths without an explicit operator resize.
- Hyphenation, locale-specific line breaking, or truncating/rewording a single long token.
- Any new automatic width-expansion mode. A separately designed, explicit “fit box to text” author command may be proposed later if needed.
