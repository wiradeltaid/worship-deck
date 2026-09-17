# SPEC-22 — PPTX Text Wrap Parity (Canvas / Presenter / LibreOffice)

> **Relationship to SPEC-21**: SPEC-21 closed with Canvas ↔ Presenter parity (`splitByGrapheme: false`, font stack, line-height). Post-deploy manual QA on `presenter-dev.bic.my.id` (2026-09-10) found a **remaining defect**: PPTX opened in LibreOffice Impress breaks lines differently from Canvas and Presenter — mid-word splits (`internationa` / `l community`) and descender clipping. SPEC-21 MUST NOT be reopened; this spec addresses the export-renderer gap SPEC-21 did not cover.

---

## 1. Problem Statement

### 1.1 Observed Defect (Owner UAT, 2026-09-10)

Text: `Bandung international community` in a text box sized so `international` wraps to line 2.

| Renderer | Line 1 | Line 2 | Line 3 | Parity |
|---|---|---|---|---|
| Canvas (`/admin/artifacts`) | Bandung | international | community | ✓ baseline |
| Presenter (`/presenter`) | Bandung | international | community | ✓ matches Canvas |
| PPTX → LibreOffice Impress | Bandung | internationa | l community | ✗ mid-word break; `y` descender clipped |

Canvas and Presenter achieve whole-word wrapping. PPTX export does not.

### 1.2 Root Cause Analysis

The defect is **not** a regression of SPEC-21 Fabric settings. It is a **three-layer mismatch** between how the web renderers lay out text and how OOXML/PowerPoint/LibreOffice lay out the same geometry.

#### Layer A — Effective wrap width (primary trigger)

| Surface | Horizontal content width |
|---|---|
| Fabric Textbox / CSS `pre-wrap` | 100% of element box (`w` % of 960px reference); padding/margin = 0 |
| PptxGenJS `slide.addText` (current) | Box `w` **minus** PowerPoint default text-box insets |

`pptx-draw.ts` calls `slide.addText(text, { x, y, w, h, ... })` **without** `margin`. PptxGenJS types document the default ([`index.d.ts` L1857](node_modules/pptxgenjs/types/index.d.ts)):

> PowerPoint defaults to "Normal" margin `[0.05", 0.1", 0.05", 0.1"]` (top, right, bottom, left)

On a 10in-wide slide, left + right inset = **0.2in ≈ 19.2px** at the 960px reference canvas. Canvas/Presenter wrap `international` with the full box width; PPTX wraps with a narrower column. The word fits in the browser but not in the PPTX shape.

#### Layer B — OOXML line-breaking policy (amplification)

When a Latin word sits at the **start of a line** and exceeds the remaining width, PowerPoint and LibreOffice **break within the word** (character-level overflow), rather than moving the whole word to the next line. CSS `white-space: pre-wrap` with default `overflow-wrap: normal` keeps the word intact and may overflow; Fabric `splitByGrapheme: false` wraps at word boundaries before the line starts.

Result: `international` → `internationa` + `l`, creating a spurious third-line fragment and extra vertical ink that the box height was not sized for.

#### Layer C — Fit-scale and height estimation blind to soft-wrap (secondary)

`estimateTextFitScale` in `render-model.ts` counts only explicit `\n`:

```typescript
const lines = text.split('\n').length;
```

For `Bandung international community` (one logical paragraph), `lines = 1`, so `fitScale = 1.0`. No shrink is applied in PPTX even when reflow produces more lines than the box height allows.

`serializeCanvas` syncs `h` from Fabric `measuredHeight` (3 lines). PPTX re-wraps into a **different** 3-line layout with taller ink on line 3 → descender clipping at the box bottom.

#### Layer D — Font metrics variance (residual risk, not this defect's primary driver)

Kerning, sub-pixel rounding, and font substitution differ between LibreOffice, MS PowerPoint, Chromium, and Fabric. At this box width, Layer A dominates; margin removal alone may fix this case. Residual metric drift MUST be handled by the line-break authority model (Section 2.3), not by hoping all engines agree on glyph widths.

### 1.3 Why SPEC-21 Did Not Catch This

SPEC-21 TEST-PLAN manual gate (SPEC-21-03) compared Canvas vs Presenter vs PPTX visually but:

1. SPEC-21's stated symptom was **Canvas wrong, PPTX/Presenter correct** — tests and smoke guards targeted Fabric `splitByGrapheme`, not PPTX inset geometry.
2. No automated assertion inspects OOXML `bodyPr` insets or PPTX line-break output.
3. `estimateTextFitScale` tests use explicit `\n` or single-line overflow; no soft-wrap fixture exists.

---

## 2. Solution Architecture

Cross-renderer parity requires **one authoritative line-break model** and **identical content-box geometry** on every surface.

### 2.1 PPTX Zero-Margin Text Box (SPEC-22-01) — necessary, not sufficient

In `pptx-draw.ts` `renderTextElement`, pass:

```typescript
margin: 0, // or [0, 0, 0, 0] per PptxGenJS Margin type
```

**Effect**: PPTX content area width matches Canvas/CSS box width (modulo inch/pt rounding).

**Not sufficient alone** because: font-metric drift can still change wrap points; `estimateTextFitScale` remains blind to soft-wrap; LibreOffice may still character-break an overlong word if width is borderline.

### 2.2 Canvas-Authoritative Wrap Lines (SPEC-22-02) — structural fix

At `serializeCanvas` save time, read Fabric `Textbox.textLines` (whole-word wrapped lines as rendered on the 960×540 reference canvas) and persist a **wrap snapshot** on the text element:

```typescript
// Proposed shape on CanvasElement (text only)
wrapLines?: string[];  // e.g. ["Bandung", "international", "community"]
```

Rules:

- `wrapLines` is written on every text save when Fabric reports `textLines`.
- `content` remains the operator-editable source string (spaces preserved); `wrapLines` is derived layout, not a second source of truth for editing.
- When `wrapLines` is absent (legacy templates), renderers fall back to current behaviour.

**PPTX export** (`resolveElementTextForPptx`): if `wrapLines` present, emit `wrapLines.join('\n')` so OOXML treats each canvas line as a hard break — **no re-wrap inside the shape**.

**Presenter** (`ArtifactSlide`): continue rendering `content` with CSS `pre-wrap` (already matches Canvas when geometry aligns). `wrapLines` is a PPTX/export aid; Presenter does not need hard breaks if Layer A is fixed.

**`estimateTextFitScale`**: use `wrapLines?.length ?? text.split('\n').length` for line count.

### 2.3 Shared Line-Count Contract in `render-model` (SPEC-22-03)

Centralise in `render-model.ts`:

| Function | Responsibility |
|---|---|
| `resolveWrapLineCount(element)` | `wrapLines.length` if set, else explicit `\n` count |
| `resolveElementTextForPptx(element)` | Hard-break text for export |
| `estimateTextFitScale(element)` | Uses `resolveWrapLineCount` |

Height sync in `serializeCanvas` SHOULD use the same line count × `TEXT_LINE_HEIGHT × fontSize` cross-check against `measuredHeight` to catch Fabric measurement drift.

### 2.4 Explicit Non-Goals

- **Not in scope**: pixel-perfect glyph positioning across LibreOffice vs MS PowerPoint vs Chromium. Goal is **same line breaks and readable descenders**, not identical sub-pixel kerning.
- **Not in scope**: hyphenation dictionaries or locale-specific syllable breaks.
- **Not in scope**: Re-opening SPEC-21 tickets.

### 2.5 Residual Font-Metric Strategy

If margin zero + `wrapLines` still drifts on exotic fonts:

1. Document in `.how/registry/06-flows/canvas-authoring-controls.md` that **authoring preview** (Canvas/Presenter) is canonical; PPTX is a faithful export of saved wrap lines.
2. Future wave MAY add server-side `opentype.js` measurement — out of SPEC-22 unless T-22-06 fails in QA.

---

## 3. Tickets & Dependencies

```
SPEC-22: PPTX Text Wrap Parity
├── SPEC-22-01: PPTX Zero-Margin Text Box Geometry     (pptx-draw.ts)
├── SPEC-22-02: Persist Canvas Wrap-Line Snapshot      (canvas-utils.ts, runtime-contract)
├── SPEC-22-03: Shared Export Text & Fit-Scale Contract (render-model.ts, pptx-draw.ts)
└── SPEC-22-04: Test, OOXML Guard & Documentation      (smoke-spec-22, docs, specs.yaml)
```

| Ticket | `blocked_by` | Files |
|---|---|---|
| SPEC-22-01 | — | `src/lib/pptx-draw.ts` |
| SPEC-22-02 | SPEC-22-01 | `src/lib/registry/canvas-utils.ts`, `src/lib/artifacts/runtime-contract.ts` |
| SPEC-22-03 | SPEC-22-02 | `src/lib/artifacts/render-model.ts`, `src/lib/pptx-draw.ts` |
| SPEC-22-04 | SPEC-22-03 | `tests/smoke-spec-22.test.mjs`, `tests/artifact-render-model.test.mjs`, `.how/registry/06-flows/canvas-authoring-controls.md` |

---

## 4. Acceptance Criteria

1. PPTX `slide.addText` passes `margin: 0`; generated OOXML `bodyPr` has zero `lIns`/`rIns`/`tIns`/`bIns` (or equivalent PptxGenJS output).
2. Saving a text element persists `wrapLines` matching Fabric `textLines` for the Bandung fixture.
3. PPTX export of the Bandung fixture emits hard breaks: line 2 is `international` whole, never `internationa`.
4. `estimateTextFitScale` for the fixture uses wrap line count 3, not 1.
5. Canvas, Presenter, and PPTX (LibreOffice manual gate) show identical line breaks for the fixture.
6. Legacy elements without `wrapLines` continue to export (degraded parity acceptable; no crash).
7. Full test suite green including new `smoke-spec-22.test.mjs`.

---

## 5. User Stories

1. As a slide operator, when I size a title box so a long word wraps cleanly in the editor, the downloaded PPTX shows the same line breaks in LibreOffice and PowerPoint.
2. As a presenter, I trust that what I see in `/presenter` is what the congregation USB deck contains.
3. As a maintainer, I have automated guards on PPTX text-box geometry so margin regressions cannot silently reintroduce mid-word breaks.
