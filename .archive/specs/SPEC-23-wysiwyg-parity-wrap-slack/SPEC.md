# SPEC-23 — WYSIWYG Parity: Wrap Slack, Fit Width & Font Readiness

> **Relationship to SPEC-22**: SPEC-22 shipped `margin: 0`, the `wrapLines` snapshot, and a wrap-aware
> fit estimate. Owner UAT on 2026-09-10 re-ran the same fixture and the defect **persists unchanged**:
> `internationa` / `l community` in LibreOffice. Investigation (`.scratch/wysiwyg-analysis/analysis-opus-5.md`)
> found SPEC-22's machinery is correct but **inert on every real element**, and that the true trigger is a
> different one that SPEC-22 did not touch. SPEC-22 MUST NOT be reopened; its code stays. This spec closes
> the gap it left.

---

## 1. Problem Statement

### 1.1 Observed Defect (Owner UAT, 2026-09-10, post-SPEC-22)

Two fixtures, three surfaces.

**Case 1 — text wrap.** Text `Bandung international community` in an auto-sized box.

| Renderer | Line 1 | Line 2 | Line 3 | Parity |
|---|---|---|---|---|
| Canvas | Bandung | internationa*(l clipped)* | community | baseline |
| Presenter | Bandung | internationa*(l clipped)* | community | matches Canvas |
| PPTX → LibreOffice | Bandung | internationa | **l community** | ✗ mid-word break |

**Case 2 — script font.** Four off-canvas corner elements, two in `Great Vibes` red.

| Renderer | Face rendered | Off-canvas fragment at the clip edge |
|---|---|---|
| Canvas | Great Vibes | `ew text` (cursive) |
| Presenter | Great Vibes | `ew text` (cursive) |
| PPTX → LibreOffice | Liberation Sans | `lew text` (sans) — different letters visible |

### 1.2 Evidence Gathered

Three findings were verified by execution and by scanning stored data, not inferred from the screenshots.

**E1 — `wrapLines` exists in no stored element.** A byte scan of `data.db` (6.1 MB), `data/default-registry.json`
and `data/local/default-registry.json` returns **zero** occurrences of `wrapLines`. The field is only written
when a text element is re-saved through the canvas, and never for elements carrying `placeholderKey`
(`canvas-utils.ts:386`). Every slide in production still takes the pre-SPEC-22 path.

**E2 — the persisted box width equals the longest word's width, with zero slack.** Fabric `Textbox` with
`splitByGrapheme: false` never breaks a word; instead it widens itself:

```js
// node_modules/fabric/dist/index.node.mjs:23007-23010
if (this.dynamicMinWidth > this.width) { this._set('width', this.dynamicMinWidth); }
// :23292
const maxWidth = Math.max(desiredWidth, largestWordWidth, this.dynamicMinWidth);
```

`serializeCanvas` reads that widened `obj.width`, sees it differs from the authored width by more than 1px,
and writes it back as the element's `w` (`canvas-utils.ts:341-358`). The stored box is therefore exactly as
wide as `"international"` **as measured by Fabric** — a per-grapheme advance sum with no kerning and no
shaping. Chromium and LibreOffice both shape properly. Neither is guaranteed to land under Fabric's number,
and there is no slack to absorb the difference.

**E3 — `margin: 0` is genuinely emitted.** A probe run of `generatePptxFromPlan` on the current tree produces
`<a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" …>`. The "PowerPoint default 0.2in inset"
hypothesis, which SPEC-22 §1.2 Layer A named as the primary trigger, no longer applies to this build.

### 1.3 Root Cause

The wrap decision is made **three times independently, at a boundary with zero tolerance**, and the three
engines differ only in what they do when the answer is "does not fit".

| Engine | Word wider than its column |
|---|---|
| Fabric (canvas) | never breaks — widens the box instead |
| Chromium (`overflow-wrap: normal`) | never breaks — overflows, then the stage clips |
| OOXML (LibreOffice / PowerPoint) | **breaks at the character boundary** |

Canvas and Presenter agree by coincidence of policy, not by shared authority. PPTX has no "let it overflow"
option in DrawingML, so it produces the only other answer available to it.

Three further defects compound this and are in scope here:

**C1 — the PPTX fit estimate is blind to the width axis.**

```ts
// src/lib/artifacts/render-model.ts:309
contentWidth: 0,          // the width axis can never force a shrink
contentHeight: lines * TEXT_LINE_HEIGHT * em,
```

An overlong word therefore never triggers a shrink in PPTX. And with `wrapLines` absent (E1),
`resolveWrapLineCount` falls through to `text.split('\n').length` = 1, so a three-line paragraph is scored as
one line and exports at full size while the presenter measures three lines and shrinks. Measured on the UAT
screenshots the PPTX cap-height is ~5–7% larger than the presenter's. A larger font narrows the column in
relative terms, which pushes the zero-slack decision further toward "does not fit" in PPTX specifically.

**C2 — `<a:normAutofit/>` is emitted with no `fontScale`.** Verified in the probe XML. PowerPoint does not
compute a scale until the shape is edited; LibreOffice computes one of its own at layout time. The same file
therefore renders at two different sizes in the two applications.

**C3 — nothing waits for the web fonts.** The Google stylesheet loads with `display=swap`
(`spa/index.html:9`, `spa/projected.html:9`) and there is no `document.fonts.ready` anywhere in `src/` or
`spa/`. Two consequences, both independent of PPTX:

- Fabric may measure against the fallback face and **persist the resulting geometry permanently** (E2 makes
  that geometry load-bearing).
- The presenter's `applyFit` runs once and is re-run only by a `ResizeObserver` watching the **box**. A font
  swap does not resize the box, so a fit scale computed against the wrong face is never corrected. This
  affects the projected screen directly.

### 1.4 Why `wrapLines` Alone Cannot Close This

Even with E1 fixed by a backfill, Case 1 does not resolve. A paragraph consisting solely of `"international"`
is still wider than the shape, and LibreOffice still breaks it. The output changes from
`internationa` / `l community` to `internationa` / `l` / `community` — different from the browser in a
different way. **`wrapLines` can say where to break; OOXML has no way to say "do not break this word".**
The only reachable fix is to guarantee the column is wide enough, or to shrink until the longest word fits.

Beyond that, `wrapLines` is a snapshot taken at the authored font size, while the presenter's fit scale
is derived from the wrap result. Feeding hard breaks into the presenter would lock in a wrap computed
before shrinking and defeat `largestFittingTextScale` (the "Welcome to" case its doc comment describes).
That is why §2.4 keeps `wrapLines` on the export path only, and treats it as an optimisation rather than a
correctness prerequisite.

### 1.5 Why SPEC-22 Did Not Catch This

1. Every SPEC-22 test constructs `wrapLines` inline in the fixture. None asserts that any **stored** element
   carries the field, so E1 was invisible to a green suite.
2. `T-22-07` asserts the export text of a fixture that already has `wrapLines`; it never exercises the
   pre-SPEC-22 path that all real data still takes.
3. No test measures a word wider than its box — the fixture's box was assumed to be comfortably wider.

---

## 2. Solution Architecture

### 2.1 The invariant

> **A text box is never persisted narrower than its longest word, plus a metric slack.**

This is the load-bearing change. It converts a zero-tolerance decision made three times into a decision that
all three engines reach the same way, because none of them is near the boundary any more. Everything else in
this spec either supports it or fixes a defect discovered alongside it.

The slack is `WRAP_SLACK_RATIO`, and **its value is measured before it is fixed, not asserted here.**
It must exceed the real disagreement between Fabric's un-kerned advance sum and a shaped run in Chromium
or LibreOffice over one word, and stay small enough that an operator does not perceive the box as
mis-sized. `1.02` is this spec's starting proposal, on the reasoning that kerning over a 13-character
Latin word runs well under 1% for the faces in the catalogue — but a spec that fixes a tolerance by
argument is how the first attempt at this defect went wrong. SPEC-23-01 requirement 2 measures the delta
on fixture F-1 and lands it as a test; if it comes back above 2%, the constant moves and this paragraph
is corrected. The constant lives in `render-model.ts`, so a future face that needs more has one place to
change.

### 2.2 Two enforcement points, because there are two ways to lose

The invariant is enforced where geometry is written, **and** where the export size is chosen:

| Point | Mechanism | Covers |
|---|---|---|
| `serializeCanvas` | widen `w` to `longestWordPx × WRAP_SLACK_RATIO` before persisting | new and re-saved elements |
| `estimateTextFitScale` | shrink until `longestWordPx ≤ boxWidth` | any element the operator narrowed by hand after it was measured |

Neither alone is enough: the first cannot reach a box the operator narrows later, the second cannot
widen a box the operator deliberately sized. Together they mean an overlong word is impossible in either
direction — for any element that has been measured.

Both points need the same number: how wide the longest word actually is. There is **no font
measurement on the PPTX path** — no shaping engine, and no guarantee the Node process even has the
face. So the canvas measures it once and persists it as `longestWordPx` beside `wrapLines`, and the
estimator reads that rather than forming a second opinion. An element with no measurement falls back
to today's behaviour exactly; SPEC-23-05 explains how those elements get one, and why it is a healing
pass in the browser rather than a data migration.

### 2.3 Width-aware fit estimate

`estimateTextFitScale` gains a real `contentWidth`, read from the persisted `longestWordPx`. Where the
element carries none it falls back to the current behaviour (`contentWidth: 0`) rather than guessing: an
unmeasured element must produce the deck it produces today, never a guessed shrink.

### 2.4 Export emission fidelity

Three corrections to what is written into the archive, all of them removing a free variable:

- `wrapLines` emits `<a:br/>` runs inside one paragraph (pptxgenjs `softBreakBefore: true`, verified at
  `pptxgen.cjs.js:6231`) instead of `\n`-split paragraphs, so paragraph spacing stops being an
  independent variable between PowerPoint and LibreOffice Impress.
- The bare `<a:normAutofit/>` is replaced by one carrying an explicit `fontScale`, so no reader
  computes a scale of its own. SPEC-23-04 owns which value goes there and why.
- `lineSpacingMultiple` is always emitted, defaulting to `TEXT_LINE_HEIGHT`, so "one line" has one definition.

### 2.5 Font readiness

`document.fonts.ready` gates Fabric object construction and `serializeCanvas`; `document.fonts` `loadingdone`
re-runs the presenter's `applyFit`. This is a correctness fix for stored geometry, not a parity nicety.

### 2.6 Font substitution: mitigated here, solved later

PPTX carries a font **name**, not a binary. Nothing in this spec can make `Great Vibes` render in LibreOffice.
What this spec does is stop the surprise: the catalogue marks which faces survive a PPTX round-trip, the
editor says so at selection time, and each unsafe face names the metric-nearest safe substitute so the
layout does not jump when the substitution happens.

Real font embedding (`ppt/fonts/*.fntdata` + `<p:embeddedFontLst>`, licence-clear for all 35 OFL/Apache faces,
and a natural fit for the existing `postProcessArchive` JSZip stage) is **SPEC-24**, and it is gated on a
spike: embedded-font support must be confirmed in the LibreOffice build the congregation runs, in PowerPoint
on Windows, and in PowerPoint for Mac. That has not been verified and MUST NOT be assumed. Filing it as a
separate spec keeps SPEC-23 shippable without waiting on that answer.

### 2.7 Explicit Non-Goals

- Font embedding, rasterised or vectorised export, and dual-mode export — SPEC-24.
- A central shaping authority (a `TextLayout` contract computed once, executed by all three surfaces) and a
  cross-renderer image-diff parity harness — SPEC-25.
- Sub-pixel glyph parity between Chromium, LibreOffice and PowerPoint. Out of reach while the text stays
  editable; the goal is identical line breaks and identical shrink decisions.
- Measuring substituted placeholder text. It needs the browser, and the browser never sees a hydrated
  instance, so those elements take the unmeasured fallback. SPEC-23-05 §4 says what that costs.
- Hyphenation or locale-specific syllable breaking.
- Reopening SPEC-21 or SPEC-22 tickets.

---

## 3. Tickets & Dependencies

```
SPEC-23: WYSIWYG Parity — Wrap Slack, Fit Width & Font Readiness
├── SPEC-23-01: Longest-word slack invariant on persist        (canvas-utils, render-model)
├── SPEC-23-02: Width-aware PPTX fit estimate                  (render-model)
├── SPEC-23-03: Web-font readiness gate (editor + presenter)   (ArtifactEditor, ArtifactSlide)
├── SPEC-23-04: OOXML emission fidelity                        (pptx-draw, render-model)
├── SPEC-23-05: Measurement coverage                           (canvas-utils, editor, hydrate)
├── SPEC-23-06: PPTX-safe font flags & editor warning          (font-catalog, ArtifactEditor)
└── SPEC-23-07: Tests, injection proofs & documentation        (tests, .how/)
```

Every ticket touches `artifacts`, and this project's validator forbids two tickets that share a `touches`
value from standing without a blocking edge between them. The tickets are therefore a strict chain, ordered
so each one lands on ground the previous one made solid:

| Order | Ticket | `blocked_by` | Files |
|---|---|---|---|
| 1 | SPEC-23-01 | — | `src/lib/artifacts/render-model.ts`, `src/lib/registry/canvas-utils.ts` |
| 2 | SPEC-23-02 | SPEC-23-01 | `src/lib/artifacts/render-model.ts` |
| 3 | SPEC-23-04 | SPEC-23-02 | `src/lib/pptx-draw.ts`, `src/lib/artifacts/render-model.ts` |
| 4 | SPEC-23-03 | SPEC-23-04 | `src/components/admin/ArtifactEditor.tsx`, `src/components/artifacts/ArtifactSlide.tsx` |
| 5 | SPEC-23-05 | SPEC-23-03 | `src/lib/registry/canvas-utils.ts`, `src/components/admin/ArtifactEditor.tsx`, `src/lib/artifacts/hydrate.ts`, `src/lib/artifacts/render-model.ts` |
| 6 | SPEC-23-06 | SPEC-23-05 | `src/lib/registry/font-catalog.ts`, `src/components/admin/ArtifactEditor.tsx` |
| 7 | SPEC-23-07 | SPEC-23-06 | `tests/smoke-spec-23.test.mjs`, `tests/artifact-render-model.test.mjs`, `.how/registry/06-flows/canvas-authoring-controls.md` |

The chain order is not the ticket-number order: SPEC-23-04 lands before SPEC-23-03 because the export path
should be correct before the editor starts writing geometry measured against real fonts.

---

## 4. Acceptance Criteria

1. `serializeCanvas` never persists a text element whose `w` is less than its longest word's width × 1.02.
2. `estimateTextFitScale` returns a scale < 1 for an element whose longest word exceeds its box width, and
   the scale is small enough that the word fits.
3. PPTX export of the Bandung fixture contains `international` as one contiguous run; no slide XML in
   the deck matches a mid-word split of any word in the fixture.
   One exception is admitted, and it is admitted rather than avoided: a word that still does not fit
   at `MIN_TEXT_FIT_SCALE`. That floor is deliberate — below 35% projected text stops being readable
   from the back of the hall — so past it the deck breaks the word and the browser clips it, and the
   two surfaces disagree by design. A test names that branch (T-23-19, fixture F-5); the Bandung
   fixture stays clear of it.
4. Canvas, Presenter and PPTX (LibreOffice manual gate) show the same three line breaks for the fixture, and
   the `l` is visible on all three — not clipped on the web and not orphaned in the deck.
5. Generated slide XML carries `<a:br/>` inside a single `<a:p>` for wrapped lines, an explicit
   `normAutofit fontScale`, and an explicit `lineSpacingMultiple`.
6. Fabric constructs no text object and `serializeCanvas` writes no geometry before `document.fonts.ready`
   resolves.
7. The presenter recomputes its fit scale when a web font finishes loading, with no box resize involved.
8. Every stored element that carries a measurement satisfies the slack invariant, and every stored
   element without one is proven by test to export byte-identical run-level XML to the pre-SPEC-23
   build. That guard MUST fail when no measured element exists to test — a conditional invariant
   over an empty population is how SPEC-22 stayed green.
9. Selecting a non-PPTX-safe face in the editor shows a warning naming the substitute that will appear in
   the deck.
10. Every new absence-guard has been seen to fail with the defect injected, per AGENTS.md — one injection per
    form the guard claims to cover.
11. Full suite green, including the public-repo guard.

---

## 5. User Stories

1. As a slide operator, a long word that fits on one line in the editor is on one line in the downloaded
   deck, whichever machine opens it.
2. As a presenter, the projected screen does not silently keep a text size that was computed before the
   fonts arrived.
3. As an admin, when I pick a handwriting face I am told before I save that the deck will substitute it, and
   with what.
4. As a maintainer, the geometry stored in the registry cannot be a measurement taken against the wrong font.
