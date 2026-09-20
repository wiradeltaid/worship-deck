# WYSIWYG Parity Analysis: Canvas vs Presenter vs PPTX

These six screenshots expose a split that SPEC-22 was meant to close: **Canvas and Presenter mostly agree with each other**, while **PPTX still reflows text on its own rules**. Jenis 2 adds a second class of failure — **font substitution** — that geometry fixes alone cannot solve.

---

## 1. Jenis 1 — “Bandung international community”

### What each surface shows

| Surface | Line 1 | Line 2 | Line 3 |
|---|---|---|---|
| **Canvas** (img 1) | Bandung | internation**a** | community |
| **Presenter** (img 2) | Bandung | internation**a** | community |
| **PPTX** (img 3) | Bandung | internation**a** | **l** community |

The typed string is `Bandung international community` (spaces, no manual `\n`).

### What is *not* happening vs what *is*

**Canvas/Presenter — the `l` is not “deleted” from the data model.** Both engines likely keep the full word `international` on line 2. The trailing **`l` extends past the text box’s right edge** and is **clipped** by the per-element `overflow: hidden` policy:

```41:45:src/components/artifacts/ArtifactSlide.tsx
    // Policy: an element never paints outside its own box. This clips the
    // element's own content only — the box itself is never clamped, so
    // deck-inherited off-canvas geometry survives untouched.
    overflow: 'hidden',
```

On Canvas, Fabric `Textbox` with `splitByGrapheme: false` wraps at word boundaries when possible, but **when a single word is wider than the box it breaks at character boundaries**. The visible result is `internationa` with the final glyph sitting outside the clip rect.

**PPTX — this is a real line break, not clipping.** LibreOffice/PowerPoint receives a narrower effective wrap column (historically from default text-box insets; still relevant for legacy exports) and applies **character-level overflow splitting**: the word becomes `internationa` + `l`, and the orphan `l` lands on line 3 ahead of `community`. That is exactly the failure mode documented in SPEC-22:

```38:42:.scratch/SPEC-22-pptx-text-wrap-parity/SPEC.md
When a Latin word sits at the **start of a line** and exceeds the remaining width, PowerPoint and LibreOffice **break within the word** (character-level overflow), rather than moving the whole word to the next line.
```

So: **Canvas/Presenter lose the `l` to clipping; PPTX moves the `l` to line 3 as `l community`.**

### Why Canvas ≈ Presenter but both ≠ PPTX

**Shared behavior (Canvas + Presenter):**
- Same percentage geometry via `render-model.ts` (`toCssGeometry` / reference 960×540).
- Same font stack via `getFontStack()` (Google Fonts loaded in `spa/index.html` / `projected.html`).
- Whole-word wrapping intent (`splitByGrapheme: false` on Canvas; CSS `pre-wrap` on Presenter).

**Divergence (Presenter only):**
- Presenter runs **browser-measured shrink-to-fit** (`largestFittingTextScale` bisection in `ArtifactSlide.tsx`); Canvas does **not**. That can change scale and vertical rhythm, but in these screenshots the line breaks match — the dominant issue is horizontal clipping, not scale.

**Divergence (PPTX):**
Three code-level causes stack:

| Layer | Cause | Code |
|---|---|---|
| **A — Narrower wrap column** | Default PPTX text-box insets (~0.2″ horizontal) narrowed the line vs Canvas/CSS 100% width | Fixed by `margin: 0` in `pptx-draw.ts` |
| **B — Independent reflow** | Office re-wraps unless hard breaks are injected | `resolveElementTextForPptx()` joins `wrapLines` with `\n` |
| **C — Fit scale blind to soft-wrap** | Old path counted only explicit `\n`, exporting at full size | `resolveWrapLineCount()` + `estimateTextFitScale()` |

```274:289:src/lib/artifacts/render-model.ts
export function resolveElementTextForPptx(
  element: ResolvedElement
): string | undefined {
  // ...
  if (Array.isArray(element.wrapLines) && element.wrapLines.length > 0) {
    const flatWrap = element.wrapLines.join(' ').replace(/\s+/g, ' ').trim();
    const flatText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (flatWrap === flatText) {
      const joined = element.wrapLines.join('\n');
      if (joined.trim()) return joined;
    }
  }
  return text;
}
```

```255:263:src/lib/pptx-draw.ts
  slide.addText(text, {
    x: geometry.x,
    y: geometry.y,
    w: geometry.w,
    h: geometry.h,
    margin: 0,
    fontSize,
    fit: 'shrink',
    fontFace: resolveFontFamily(style),
```

**Why PPTX still shows `l community` in your screenshot:** the export likely ran on a **legacy template without `wrapLines`**, or **`wrapLines` captured Fabric’s character-split lines** (e.g. `['Bandung', 'internationa', 'l community']`) rather than whole-word lines. `serializeCanvas` snapshots whatever Fabric reports in `textLines`:

```384:392:src/lib/registry/canvas-utils.ts
      const rawLines = (obj as any).textLines;
      if (!isPlaceholderToken && Array.isArray(rawLines) && rawLines.length > 0) {
        next.wrapLines = rawLines.map(String);
      } else {
        delete next.wrapLines;
      }
```

If the box is too narrow for `international` as a whole word, Fabric’s `textLines` will **include the character split**, and PPTX will faithfully export that split as hard breaks — while Canvas/Presenter **clip** the orphan glyph instead of showing it on line 3.

**Critical gap:** Presenter **does not consume `wrapLines` at all** — it renders raw `content` with CSS re-wrap:

```112:149:src/components/artifacts/ArtifactSlide.tsx
  const text = resolveElementText(element);
  // ...
        {text}
```

So even after SPEC-22, **Presenter and PPTX follow different line-break authorities**.

---

## 2. Jenis 2 — “New text” at center + four off-canvas corners

### Center text
All three surfaces show **“New text” on one line, centered**. Geometry and sans-serif (likely Arial/default) agree here because the box is large enough and no script font is involved.

### Off-canvas corner texts

| Corner | Canvas/Presenter | PPTX |
|---|---|---|
| **Top-left** (white sans) | `ew text` — leading `N` clipped off left/top | Same fragment, similar clip |
| **Top-right** (red **script**) | Red cursive; only `Ne` visible | Red **sans-serif** `N` only — script lost |
| **Bottom-left** (red **script**) | Red cursive `ew text` | Red **sans-serif** `ew text` |
| **Bottom-right** (white sans) | White `N` clipped | White `N` clipped |

Positioning is **intentionally off-canvas** (negative or edge-aligned `%` geometry). SPEC-21 preserves that without clamping:

```366:368:src/lib/registry/canvas-utils.ts
    // SPEC-21-02: Retain minimum dimension floor, but do not truncate off-canvas bleeding
    const clampedW = Math.max(MIN_ELEMENT_W_PCT, w);
    const clampedH = Math.max(MIN_ELEMENT_H_PCT, h);
```

The stage clips at `overflow: hidden` in both Canvas shell and Presenter — by design.

### Font family: why script survives in web but not PPTX

**Canvas and Presenter** resolve fonts through the catalog + CSS stack:

```98:102:src/lib/registry/font-catalog.ts
export function getFontStack(family: string | undefined): string {
  const def = getFontDefinition(family);
  if (!def) return `"${DEFAULT_FONT_FAMILY}", sans-serif`;
  return `"${def.family}", ${def.fallback}`;
}
```

Google Fonts are loaded in the SPA HTML; Fabric and Chromium both render `"Pacifico", cursive` (or whichever script face was chosen).

**PPTX** passes only a bare name to pptxgenjs:

```331:336:src/lib/artifacts/render-model.ts
export function resolveFontFamily(style: ResolvedStyle): string {
  const family = style.fontFamily;
  return typeof family === 'string' && family.trim()
    ? family
    : DEFAULT_FONT_FAMILY;
}
```

```263:263:src/lib/pptx-draw.ts
    fontFace: resolveFontFamily(style),
```

There is **no font embedding step**. `fontFace: "Pacifico"` is an OOXML font reference. If LibreOffice/PowerPoint does not have that face installed locally, it substitutes **Arial/Calibri**. The catalog’s `fallback: 'cursive'` and the Google Fonts URL **do not apply to PPTX**.

### Secondary effects from font substitution

Even with identical `%` boxes:
- Script glyphs are **wider/taller** than sans substitutes → different visible fragments at clip edges (`Ne` vs `N`).
- PPTX **historical default margins** (pre-`margin: 0`) shift ink inward, changing which letters survive clipping.
- Presenter **shrink-to-fit** can scale corner text differently from Canvas (Canvas has no equivalent), though center text stays stable here.

### UI chrome (not a parity defect)
The rounded dark border in Canvas/Presenter is editor/presenter shell chrome (`rounded-xl border`). The thin square frame in the PPTX screenshot is LibreOffice’s page boundary. Neither is slide content.

---

## 3. Root causes mapped to code

| Discrepancy | Root cause | Where |
|---|---|---|
| **`internationa` / missing `l` in Canvas+Presenter** | Word wider than box → character break; trailing glyph clipped by `overflow: hidden` | Fabric `Textbox`, `ArtifactSlide` box policy |
| **`l community` on PPTX line 3** | Office character-level overflow split on a narrower effective column; no/incorrect `wrapLines` hard breaks | Legacy export path; `resolveElementTextForPptx` not engaged; or `wrapLines` mirrors Fabric’s char-split |
| **Canvas ≈ Presenter but different scale/rhythm possible** | Presenter shrink-to-fit; Canvas fixed authored size | `ArtifactSlide` `useLayoutEffect` vs `ArtifactEditor` (no fit pass) |
| **Presenter ignores saved line breaks** | Renders `content` only, not `wrapLines` | `ArtifactSlide.tsx` |
| **Script → sans-serif in PPTX** | `fontFace` name only; no TTF/OTF embed | `pptx-draw.ts`, `resolveFontFamily()` |
| **Off-canvas fragment differences** | Same geometry, different glyph metrics after font substitution + optional PPTX insets | Font catalog vs OOXML font resolution |
| **Three independent layout engines** | Fabric, Chromium CSS, LibreOffice/PowerPoint each shape and break text differently | Architectural — no shared shaper |

---

## 4. Recommended architectural fix

True pixel-perfect WYSIWYG across Fabric, Chromium, LibreOffice, and PowerPoint **is not achievable** while all four independently reflow editable text. The robust design has three tiers:

### Tier 1 — Near-term (extend SPEC-22)

1. **Make `wrapLines` authoritative on all three surfaces**, not just PPTX export:
   - Presenter: when coherent `wrapLines` exist, render `wrapLines.join('\n')` with `whiteSpace: 'pre-wrap'` (same guard as `resolveElementTextForPptx`).
   - Canvas preview: optionally overlay a clip warning when `textLines` contains mid-word splits.

2. **Normalize at save time**, not just snapshot:
   - If `textLines` splits a word mid-grapheme, **widen the box** or **reduce fontSize** until whole-word wraps are achieved, *then* persist `wrapLines`.
   - Prevents exporting `internationa` / `l community` even with hard breaks.

3. **Unify shrink-to-fit policy:**
   - Either add the Presenter bisection pass to Canvas (Fabric scale), or freeze fit scale at save into `style.fitScale` and apply identically in Presenter and PPTX via `estimateTextFitScale`.

4. **PPTX font strategy (pick one):**
   - **Embed licensed fonts** (TTF/OTF into `ppt/media/`) for catalog faces used on a slide, or
   - **Restrict PPTX export to `category: 'system'` fonts** and warn when script/display faces are selected, or
   - **Dual export mode**: “Editable (best-effort fonts)” vs “Exact (rasterized).”

### Tier 2 — Medium-term: canonical `TextLayoutPlan`

At save, produce a frozen layout artifact richer than `wrapLines`:

```typescript
type TextLayoutPlan = {
  lines: string[];           // authoritative hard breaks
  fitScale: number;          // unified shrink factor
  fontFamily: string;      // resolved catalog id
  fontSizePx: number;        // post-fit size
  lineHeight: number;
  // optional: per-line width, ascender/descender for clip safety
};
```

All renderers consume this plan; none re-wrap from raw `content` except the Canvas editor during active editing.

### Tier 3 — Long-term: single shaping engine or rasterized export

- **Exact parity path:** render each text element (or whole slide) through one engine (Canvas/Skia/HarfBuzz on server) → PNG/SVG/vector paths in PPTX. Non-editable in PowerPoint, but pixel-identical.
- **Editable path:** native OOXML textboxes with embedded fonts, explicit `<a:br/>` per line, `margin: 0`, `wrap: none`, documented as best-effort.

The existing `wrapLines + margin: 0` work (DEC-024 / SPEC-22) is a **necessary bridge**, not the destination: Presenter still re-wraps independently, PPTX fonts are not embedded, Fabric can snapshot character splits, and Office still owns final glyph shaping when `fit: 'shrink'` is applied.

---

**Done:** Inspected all six screenshots and the render paths in `ArtifactEditor.tsx`, `ArtifactSlide.tsx`, `canvas-utils.ts`, `pptx-draw.ts`, `render-model.ts`, and `font-catalog.ts`; mapped each visible defect to its code-level cause and proposed a tiered architecture.

**Blocked/uncertain:** Whether the PPTX screenshot was exported before re-save with `wrapLines`, or with character-split `textLines` — that determines if SPEC-22 fixes are active or bypassed; exact pixel parity for editable native text in LibreOffice vs PowerPoint cannot be guaranteed without font embedding or rasterization.

**Next:** Decide export policy (editable best-effort vs exact rasterized), then wire Presenter to honor `wrapLines` and add save-time whole-word normalization before persisting the layout snapshot.
