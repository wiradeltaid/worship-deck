# SPEC-35 — PPTX Modern 16:9 Widescreen Parity (33.867 cm x 19.05 cm) & 1:1 Canvas Font Alignment

> **Status:** Open — drafted for G5 Release under UC-6, UC-14 / FR-20.
> **Review:** Reviewed 2026-09-15 — all findings resolved in this draft.
> **Component:** registry, hub, pptx (`src/lib/artifacts/render-model.ts`, `src/lib/pptx-draw.ts`, `internal/pptximport/text_extract.go`, `internal/pptximport/typography.go`, `internal/pptximport/parser.go`, `internal/pptximport/smart_background.go`)
> **Touches:** artifacts, pptx, admin
> **Depends on:** SPEC-34

```yaml
reviewed:
  date: '2026-09-15'
  sha: '3bef9adb8c909b02ee9798e28c1e603e1aef7192'
  lenses: [structure, prose, edge-case-hunter]
```

## 1. Problem statement

Operators testing PPTX import and export observed a persistent numeric font-size discrepancy between the web Canvas Editor and Microsoft PowerPoint:

1. **Font Size Mismatch (Font 12 in Canvas != Font 12 in PPTX):**
   In `src/lib/artifacts/render-model.ts` and `src/lib/pptx-draw.ts`, PPTX export currently hardcodes `PPTX_SLIDE_WIDTH_IN = 10` and `PPTX_SLIDE_HEIGHT_IN = 5.625` with `pres.layout = 'LAYOUT_16x9'`. This defines a **25.4 cm x 14.288 cm** slide (720 pt x 405 pt). Because the reference canvas height is 540 units while the slide height is 405 pt, the codebase uses `PX_TO_PT = 405 / 540 = 0.75`.

   Consequently, Canvas font 12 exports as 9 pt, while imported DrawingML `sz="1200"` (12 pt) becomes 16 Canvas units. The mismatch is in the conversion contract, not in template data.

2. **Modern PowerPoint Dimensions:**
   Modern widescreen PowerPoint is **33.867 cm x 19.05 cm**: exactly `960 / 72` inches x `540 / 72` inches (960 pt x 540 pt; 12,192,000 EMU x 6,858,000 EMU). PptxGenJS provides that layout as `LAYOUT_WIDE`.

   With the unchanged 960x540 reference canvas, `PX_TO_PT = 540 / 540 = 1.0`. Canvas font 12 therefore serializes as 12 pt and an imported 12 pt modern-widescreen run becomes 12 Canvas units.

   This is **numeric conversion parity within the application contract**, not a claim that a CSS pixel and a typographic point have identical physical size on every display, zoom level, browser, font renderer, or PowerPoint installation. Existing text-fit logic remains authoritative: an element that must shrink to fit may deliberately serialize below its authored size after the base conversion.

3. **Character Spacing (Letter Spacing) Tracking Parity:**
   DrawingML `a:rPr/@spc` is hundredths of a point. With the modern export contract, `spc = round(letterSpacing * 100)` and import uses `(spc / 100) / pxToPt`. Therefore `1.5` authored Canvas units produces `spc="150"` in a modern export and imports back as `1.5` units.

4. **Dynamic Import Parser Adaptation:**
   The importer currently hardcodes `PxToPt = 0.75`. It must derive `pxToPt` from the validated `p:sldSz/@cy` slide height: `float64(cy) / 12700.0 / 540.0`. Modern 540 pt slides produce `1.0`; legacy 405 pt 16:9 slides produce `0.75` and retain their existing proportional import behaviour.

## 2. Decisions and invariants

### 2.1 Modern 16:9 Widescreen Export Dimensions
- `PPTX_SLIDE_WIDTH_IN` is the exact expression `960 / 72`, not the rounded literal `13.3333`; `PPTX_SLIDE_HEIGHT_IN` is `540 / 72` (7.5); `PPTX_SLIDE_HEIGHT_PT` is 540.
- `PX_TO_PT = PPTX_SLIDE_HEIGHT_PT / REFERENCE_CANVAS.height = 1.0`.
- `pres.layout = 'LAYOUT_WIDE'`; `FULL_BLEED` continues to consume the shared constants.
- `toPptxGeometry()` preserves percentage placement and dimensions, including intentional off-canvas values. Its base font conversion is direct at `PX_TO_PT = 1.0`; later text-fit scaling is unchanged.
- Existing template data is not migrated. It remains percentage-based, so every box keeps the same relative 16:9 placement; the deliberate larger point values and physical slide dimensions remain proportionate.

### 2.2 Dynamic PPTX Import Slide Height Adaptation
- `ParsePresentation` continues to reject missing, zero, and negative `p:sldSz/@cx` or `@cy`, before scale calculation, and continues to enforce its 16:9 tolerance. A malformed archive must never silently default to a 1.0 scale.
- After that validation, compute `slideHeightPt := float64(cy) / 12700.0` and `pxToPt := slideHeightPt / 540.0` once per presentation.
- Thread the scale through `parseSlide`, `extractElementFromNode`, `extractTextStyle`, and `extractTextStyleWithWarnings` into both `DrawingMLSzToPx` and `DrawingMLSpcToPx`. Direct helper callers and tests must use an explicit scale.
- The conversion helpers retain a defensive finite-positive fallback only for direct callers; it is not the parser's malformed-package policy.

### 2.3 Character Spacing Parity on Export
- `patchCharacterSpacing` writes `round(letterSpacing * 100)` to every mapped run's `a:rPr/@spc`; absent or zero spacing emits no `spc` attribute.
- Positive and negative tracking values preserve sign. `1.5` produces `150`; `-0.5` produces `-50`.

### 2.4 Unchanged invariants and proof perimeter
- `REFERENCE_CANVAS` remains `{ width: 960, height: 540 }`; `ArtifactSlide.tsx` remains based on 540 `cqh`; `ArtifactEditor.tsx` remains 960x540; accepted imports remain 16:9.
- Tests must cover modern and legacy imports, invalid or absent dimensions, unit conversion, actual generated OOXML slide dimensions and `spc`, a sufficiently large unshrunk text run, and 0/50/100 plus off-canvas percentage geometry.
- `tests/smoke-spec-35.test.mjs` must be explicitly added to the named `npm test` command. Its absence guards must be proven red-then-green by injecting each claimed defect and reverting it.

## 3. Tickets

- **SPEC-35-01:** PPTX Modern Widescreen Dimensions (`LAYOUT_WIDE`), exact export constants, `PX_TO_PT = 1.0`, and percentage-geometry compatibility.
- **SPEC-35-02:** Validated dynamic import scale threaded through every text-style extraction path.
- **SPEC-35-03:** Character-spacing parity, full conformance coverage, registered executable absence guards, and complete-suite verification.
