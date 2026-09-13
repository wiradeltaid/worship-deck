# SPEC-27 — PPTX as Primary Anchor 1-to-1 Visual Parity (Canvas Editor, Presenter, PPTX with Embedded Fonts)

## Problem Statement

Church operators, designers, and administrators face persistent visual discrepancies across the three slide delivery surfaces:
1. **Canvas Editor vs. Presenter Discrepancy**: A slide configured in the Canvas Editor (`/admin/artifacts`) looks different in the live Presenter/Projector view (`/services/:id/present` and `/services/:id/slideshow`). In particular, large text elements (such as title headlines or custom text with low line-height) render with different line heights, vertical baseline offsets, and clipping. In the editor, text appears comfortably positioned, while in Presenter, ascenders of letters (e.g. "B" and "d") are clipped by the top edge of the 16:9 stage.
2. **Presenter vs. PPTX Export Discrepancy**: The downloaded `.pptx` presentation deck has historically been treated as a downstream afterthought rather than the primary deliverable. In `pptx-draw.ts`, `lineSpacingMultiple: 1.2` emits an OOXML `<a:spcPct val="120000"/>`, which PowerPoint calculates as `1.2 × 1.2 em = 1.44 em` (20% looser than web CSS `1.2 em`), causing multi-line text blocks to spill downward in PowerPoint.
3. **Typography Degradation on External Computers**: Out of 45 curated presentation fonts, 35 are Google Web Fonts (such as *Poppins*, *Montserrat*, *Inter*) not installed in standard Windows desktop installations. When an exported `.pptx` is opened on church sanctuary laptops, Microsoft PowerPoint silently falls back to system fonts (Arial/Calibri), distorting line wrapping, metrics, and visual hierarchy.
4. **Stage Boundary Ambiguity in Editor**: The Canvas Editor workspace features a dark background without a sharply delineated 16:9 stage outline. Operators unknowingly drag elements into negative coordinates (e.g. `y = -5%`), which looks safe in the unclipped editor but gets severely cropped by the 16:9 `overflow: hidden` boundary in Presenter.

Past attempts (SPEC-22 through SPEC-26) attempted to "calibrate" Fabric.js canvas 2D rendering to match CSS DOM. Because Fabric.js and browser CSS DOM employ fundamentally different text layout engines (internal `_fontSizeMult = 1.13` and baseline offset `_fontSizeFraction = 0.222` in Fabric vs. CSS half-leading), fine-tuning constants was inherently fragile and failed across diverse font sizes, line heights, and viewports.

---

## Solution

Establish **Microsoft PowerPoint (OOXML 16:9)** as the **Primary Anchor** for typography and geometry, and align both the Presenter and the Canvas Editor to this anchor:

1. **Single Visual Engine for Web (Option A)**:
   - The Canvas Editor (`ArtifactEditor.tsx`) directly mounts the real `<ArtifactSlide>` React DOM component as its visual layer.
   - Fabric.js no longer renders pseudo-text or shapes; instead, Fabric operates purely as a **transparent interaction layer** overlaid on top of `<ArtifactSlide>`, providing bounding boxes, selection borders, and resize/drag handles.
   - Parity between the Canvas Editor and the live Presenter becomes **100% identical by construction**, eliminating the two-engine divergence problem permanently.
2. **PowerPoint OOXML Line Spacing & Metrics Alignment**:
   - Align `render-model.ts` and `pptx-draw.ts` so that line height multiple in OOXML matches CSS: `spcPct = (lineHeight / 1.2) * 100000`, eliminating the 20% line-pitch bloat.
   - Offset the first-line CSS vertical position by the PowerPoint leading difference ($\Delta = 0.0414\text{ em}$ for standard line heights) so that the first baseline on the web aligns with PowerPoint's top-anchored text frame.
3. **Stage Framing & Bleed Boundary in Canvas Editor**:
   - Provide a crisp, high-contrast 16:9 stage border (`1px solid rgba(255, 255, 255, 0.25)` and drop shadow) with a distinct neutral dark letterbox/pillarbox background.
   - Apply container `overflow: hidden` to the 16:9 stage in the editor, ensuring that any element bleeding off-stage is visibly clipped in the editor exactly as it is in Presenter and PowerPoint Slide Show mode.
4. **TrueType Font Embedding in Exported PPTX**:
   - Bundle TrueType font files (`.ttf`) for all non-system Google Fonts into the `.pptx` ZIP archive under `ppt/fonts/`.
   - Register them in `ppt/presentation.xml` inside `<p:embeddedFontLst>`, ensuring that exported presentations render with exact authored typography on any Windows or Mac computer without font fallback.
5. **Automated Real-PowerPoint Conformance Verification**:
   - Leverage the newly installed Microsoft PowerPoint on the development host via Windows COM automation (`PowerPoint.Application`) to export slide 1 to PNG at 1920x1080, comparing it against the web presenter rendering to guarantee true 1:1 pixel perfection.

---

## User Stories

1. As a worship leader, I want the slide I design in the Canvas Editor to look exactly identical to what appears on the sanctuary projector in Presenter view, so that I never have unexpected line wraps or clipped titles during a service.
2. As an operator, I want the downloaded `.pptx` file to match the layout and line breaks of the web presenter 1-to-1, so that running the presentation in PowerPoint produces the exact same aesthetic.
3. As an operator running PowerPoint on a sanctuary laptop that does not have custom fonts installed, I want the presentation to open with the original designed fonts (e.g. Poppins, Montserrat) embedded, so that text does not revert to generic system fonts.
4. As a designer, I want to clearly see the 16:9 stage boundaries in the Canvas Editor, so that I immediately recognize when an element is positioned outside the visible screen.
5. As a designer, I want elements that extend outside the 16:9 stage to be clipped in the Canvas Editor, so that I am not misled by off-canvas content that will disappear during the live service.
6. As an administrator, I want to adjust line height (from 0.8x to 2.4x) in the Canvas Editor and have that line spacing reflected identically in both the web presenter and the exported PowerPoint file.
7. As an administrator, I want opening a template and clicking Save without making changes to preserve all element positions and dimensions without geometry drift.
8. As a developer, I want automated conformance tests that render slides via real Microsoft PowerPoint and verify pixel parity against web rendering, preventing future visual regressions.

---

## Implementation Decisions

1. **Option A Visual Architecture (Editor)**:
   - In `ArtifactEditor.tsx`, mount `<ArtifactSlide instance={...} />` in the DOM as the visual content layer.
   - Configure the Fabric canvas with `backgroundColor: 'transparent'` and overlay it directly over the `<ArtifactSlide>` stage.
   - Transform `elementToFabricObject` in interactive mode to create transparent proxy rectangles with selection borders and handles for both text and shape elements.
   - Connect Fabric's `object:moving` and `object:scaling` events directly to the in-memory slide instance state so `<ArtifactSlide>` updates position and dimensions in real time.
2. **OOXML Line Spacing Formula**:
   - In `pptx-draw.ts`, calculate `lineSpacingMultiple` for `slide.addText` as:
     $$\text{lineSpacingMultiple} = \frac{\text{style.lineHeight}}{1.2}$$
     For default line height $1.2$, this emits `<a:spcPct val="100000"/>` (100% of natural font line height = $1.2\text{ em}$).
     For tight line height $0.8$, this emits `<a:spcPct val="66667"/>` ($0.8\text{ em}$).
3. **PowerPoint Baseline Offset Compensation**:
   - In `ArtifactSlide.tsx`, adjust the text container's top offset by $\Delta = (\text{pitch} - (A+D))/2$ when `lineHeight < 1.0` so ascenders stay comfortably within the box without clipping.
4. **Editor Stage Styling**:
   - Wrap the 16:9 stage in `ArtifactEditor.tsx` with a distinct border and drop shadow, styled identically to Presenter's letterbox container.
   - Set `overflow: hidden` on the 16:9 stage container in the editor so off-canvas bleed is clipped identically to Presenter and PowerPoint.
5. **PPTX Font Embedding**:
   - Maintain a local font cache of `.ttf` files for Google Fonts in `src/lib/fonts/` or `data/fonts/`.
   - In `src/lib/pptx-draw.ts`, during the `postProcessArchive` step with `JSZip`:
     - Add font files to `ppt/fonts/<fontname>.fntdata`.
     - Append `<p:embeddedFont>` entries to `<p:embeddedFontLst>` in `ppt/presentation.xml`.
     - Add corresponding `<Relationship>` entries in `ppt/_rels/presentation.xml.rels`.
6. **Real-PowerPoint Conformance Test**:
   - Create `tests/pptx-conformance.test.mjs` that runs on Windows when `PowerPoint.Application` COM is available.
   - The test exports a sample presentation via the backend, drives PowerPoint to export the slide to PNG, and verifies bounding box and text line positions against `<ArtifactSlide>`.

---

## Testing Decisions

1. **True Behavior Testing**: Tests must execute the real production rendering and export code paths (`ArtifactSlide.tsx`, `pptx-draw.ts`, `canvas-utils.ts`), avoiding artificial mocks or copies.
2. **Two-Engine Web Parity (0 Divergences)**: Ensure the committed parity harness continues to report 0 GEOM, 0 WRAP, 0 FIT, 0 CLIP, 0 OVERRUN across all 32 shipped templates.
3. **PowerPoint Export Conformance**:
   - Test that generated PPTX contains correct `<a:spcPct>` values matching the normalized line spacing formula.
   - Test that non-system fonts used in a slide are embedded in `ppt/fonts/` and declared in `ppt/presentation.xml`.
   - Test that real Microsoft PowerPoint COM automation can open the presentation and export a PNG without errors.
4. **Absence-Guards Proven Red**:
   - Re-verifying absence guards by injecting defects (disabling font embedding, breaking line spacing normalization, breaking stage clipping) and confirming tests fail red before restoring green.

---

## Out of Scope

- In-place text editing inside the Fabric canvas (editing is conducted via the dedicated toolbar input and property panel).
- Third-party desktop office suites other than Microsoft PowerPoint (e.g. LibreOffice, Apple Keynote, Google Slides) — while they can read the PPTX, Microsoft PowerPoint is the sole primary anchor.
- Custom user-uploaded font files (only curated fonts from `FONT_CATALOG` are supported for embedding).

---

## Further Notes

- The project's public repository safety rules remain strictly enforced: no real congregation data, personal names, or non-synthetic media will be committed.
- All modifications maintain backward compatibility with existing templates and database snapshots.
