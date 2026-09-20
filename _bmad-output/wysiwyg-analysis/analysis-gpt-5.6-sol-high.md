## Finding

The screenshots use different pixel dimensions, so raw pixel offsets are not directly comparable. Normalized geometry is mostly consistent; the major discrepancies come from text layout, font availability, and UI chrome.

### Jenis 1

- Canvas and Presenter logically lay out:
  1. `Bandung`
  2. `international`
  3. `community`
- The final `l` in `international` was not deleted. Whole-word browser wrapping kept it on line 2, but its glyph extended beyond the visible box/slide edge and was clipped by `overflow: hidden`.
- PPTX instead displays:
  1. `Bandung`
  2. `internationa`
  3. `l community`

The PPTX shown matches the pre-SPEC-22 or legacy-template path:

1. PptxGenJS supplied PowerPoint’s default textbox insets: approximately `0.1"` left/right and `0.05"` top/bottom. That made the effective PPTX line about 19 reference pixels narrower than Canvas/CSS.
2. Office then split the oversized word at the character boundary. The remaining `l`, space, and `community` fit together on line 3.
3. PPTX fitting counted only explicit newlines. The source contains spaces but no `\n`, so it was estimated as one line and exported at the authored size. Native `fit: 'shrink'` is not applied consistently by freshly opened PowerPoint/LibreOffice files.
4. Canvas paints at authored size, while Presenter independently measures and shrinks browser text. This explains the smaller/tighter Presenter typography and different vertical baselines.

The current code mitigates this by saving Fabric’s wrap result and forcing those lines into PPTX:

```251:313:src/lib/artifacts/render-model.ts
export function resolveWrapLineCount(element: ResolvedElement): number {
  // Uses coherent Canvas wrapLines when available.
  // ...
}

export function resolveElementTextForPptx(
  element: ResolvedElement
): string | undefined {
  // Converts wrapLines into explicit newline-separated PPTX text.
  // ...
}
```

```225:271:src/lib/pptx-draw.ts
const text = resolveElementTextForPptx(element);
// ...
slide.addText(text, {
  // ...
  margin: 0,
  fontSize,
  fit: 'shrink',
  fontFace: resolveFontFamily(style),
});
```

Therefore, a newly resaved static element should export as `Bandung / international / community`. Legacy elements without `wrapLines` remain best-effort.

### Jenis 2

The four edge elements are intentionally off-canvas:

- Top-left white text starts above/left of the stage, so the leading `N` is clipped and mostly `ew text` remains.
- Top-right red text extends past the top/right edges.
- Bottom-left red text extends past the left/bottom edges.
- Bottom-right white text extends past the right/bottom edges.
- The centered `New text` stays on one line in all three images.

The stored positioning is broadly preserved. Current serialization retains off-canvas dimensions:

```350:390:src/lib/registry/canvas-utils.ts
const w = isWidthResized
  ? pxToPct(measuredWidth, CANVAS_WIDTH)
  : isText
    ? Math.max(source.w, measuredTextWidthPct)
    : source.w;

const h = isText
  ? Math.max(source.h, measuredTextHeightPct)
  : isHeightResized
    ? pxToPct(measuredHeight, CANVAS_HEIGHT)
    : source.h;

const clampedW = Math.max(MIN_ELEMENT_W_PCT, w);
const clampedH = Math.max(MIN_ELEMENT_H_PCT, h);
```

The red script font is retained in Canvas and Presenter because both use browser-loaded Google Fonts and a CSS stack:

```93:109:src/lib/registry/font-catalog.ts
export function getFontStack(family: string | undefined): string {
  const def = getFontDefinition(family);
  if (!def) return `"${DEFAULT_FONT_FAMILY}", sans-serif`;
  return `"${def.family}", ${def.fallback}`;
}
```

PPTX receives only `fontFace: "Great Vibes"`. A PPTX font face is a name, not a CSS stack, and the generator neither embeds nor installs that font. If LibreOffice/PowerPoint cannot find it locally, the office application substitutes a sans-serif face. The catalog’s `fallback: 'cursive'` and Google Fonts URL have no effect on PPTX.

That substitution changes glyph width, ascenders, baseline, and visible off-canvas fragments even though the box coordinates remain unchanged. The pre-fix PPTX margins also move ink inward by several pixels.

The rounded dark borders in Canvas and Presenter are UI chrome from their `rounded-xl`/`rounded-lg border` containers. The square thin PPTX outline is LibreOffice’s page boundary. Neither is slide content and they should not be compared as rendering parity.

## Root causes

| Difference | Cause |
|---|---|
| `internationa` versus `l community` | PPTX default margins narrowed the line; Office character-split the word |
| Missing browser `l` | Glyph remained on line 2 but was outside the visible clipping boundary |
| Font-size/vertical drift | Fabric, Chromium CSS, and Office use independent baseline, line-height, and autofit engines |
| Script becomes sans-serif | PPTX stores a font name but does not embed the Google font |
| Edge fragments differ | Font substitution, textbox margins, and different glyph metrics |
| Rounded versus square border | Editor/Presenter UI chrome versus LibreOffice page frame |
| Residual positioning differences | Same percentage geometry, but different internal text origins and metrics |

## Recommended architecture

True pixel-level parity is impossible while editable text is independently reflowed by Fabric, Chromium, LibreOffice, and PowerPoint.

The robust design is:

1. Bundle licensed font files locally and wait for them to load before measuring.
2. Produce a canonical text-layout plan containing lines, font identity/hash, fit scale, baseline, ascent/descent, and positioned glyph runs—not only `wrapLines`.
3. Make Canvas and Presenter draw that frozen plan through one renderer, preferably Canvas/SVG using a shared HarfBuzz/Skia-style shaping engine.
4. Provide two PPTX modes:
   - **Exact fidelity:** export each slide as one full-slide PNG/SVG or text converted to vector paths.
   - **Editable:** emit native textboxes with zero margins, explicit line boxes, embedded/restricted fonts, and clearly classify it as best-effort.

The existing `wrapLines + margin: 0` solution is a useful bridge, but it is not true WYSIWYG: Presenter ignores `wrapLines`, dynamic placeholders do not save them, PPTX fonts are not embedded, and Office still owns final glyph shaping and autofit.

Done: Inspected all six screenshots, relevant render paths, and the pre-/post-SPEC-21 and SPEC-22 behavior.  
Blocked/uncertain: Exact native-text pixel parity across LibreOffice and PowerPoint cannot be guaranteed without freezing or rasterizing/vectorizing text.  
Next: Choose between exact non-editable PPTX rendering and best-effort editable PPTX, then design the canonical text-layout contract accordingly.
