# SPEC-33 — PPTX Typography Fidelity, Font Safety Parity, and Missing Font Acquisition

> **Status:** Closed — implemented, dual-reviewed, and verified under DEC-035.
> **Review:** 2026-09-15 · baseline `5f130ca` · lenses: structure, prose, edge-case-hunter.
> **Component:** hub, registry, pptx (`internal/pptximport`, `internal/httpapi`, `internal/plan`, `src/lib/registry/font-catalog.ts`, `src/lib/registry/canvas-utils.ts`, `src/components/artifacts/ArtifactSlide.tsx`, `src/components/admin/ArtifactEditor.tsx`, `src/lib/fonts/embed-fonts.ts`, `src/lib/pptx-draw.ts`)
> **Touches:** artifacts, admin, pptx, api, uploads
> **Depends on:** SPEC-32

## 1. Problem statement

A hand-test of a 12-slide Microsoft PowerPoint import revealed four concrete findings across typography parity, visual presentation, and font lifecycle:

1. **Obsolete PPTX font safety warnings (Finding 2, Markers 1 & 2):**
   In `src/lib/registry/font-catalog.ts`, curated Google Fonts like Montserrat, Roboto, and Inter are flagged with `pptxSafe: false, pptxSubstitute: 'Arial'`. In `ArtifactEditor.tsx`, this renders an amber exclamation mark `⚠` with a tooltip stating the font may not render in PowerPoint export and will fall back to Arial.
   However, `src/lib/fonts/embed-fonts.ts` and `src/lib/pptx-draw.ts` automatically embed TrueType font binaries into generated PPTX packages. But `embedPresentationFonts()` uses `def.pptxSafe` to decide whether a font requires embedding (`if (!def || def.pptxSafe) continue;`), conflating "system font that needs no embedding" with "font safe for export". As a result, the UI displays a false warning to operators even though the font is supported for export.

2. **Text fitting & line-wrap distortion on letter-spaced text (Finding 2, Marker 4):**
   In `src/lib/registry/canvas-utils.ts`, `applyFabricTextFit()` measures text size using a temporary DOM container (`inner`), but omits `letterSpacing` during binary search in `fitsAt(scale)`. For text with large character tracking (such as `BANDUNG INTERNATIONAL COMMUNITY` with `letterSpacing: 16.89px`, adding over 506px of cumulative width across 31 characters):
   - DOM measurement evaluates width without tracking, keeping `bestScale = 1.0`.
   - Fabric's `Textbox` then renders with `charSpacing: 408` and prematurely wraps `COMMUNITY` onto line 2, breaking single-line full-width presentation fidelity compared to the original PowerPoint slide (Finding 1).
   - Furthermore, scaling text down must scale `letterSpacing` proportionally (`baseLetterSpacing * scale`), matching how the DOM slideshow expresses tracking in `em`.

3. **Unacquired custom fonts from PPTX import (Finding 2, Marker 3):**
   When an imported PPTX relies on an unbundled, third-party proprietary typeface (such as `"The Youngest"`) that is not embedded into the `.pptx` archive by PowerPoint and is not part of Google Fonts, the importer stores `fontFamily: "The Youngest"`.
   - In the browser, `getFontStack()` falls back to `"Arial", sans-serif`, turning an elegant cursive script into a distorted, oversized sans-serif block ("Welcome to" at 203px).
   - The system lacks typed unresolved-font tracking across Go and TypeScript validators, causing unknown font properties to be rejected.
   - The system lacks an authenticated font acquisition upload endpoint (`POST /api/admin/fonts`) allowing operators to upload missing `.ttf`/`.otf` files to hydrate the slide.

## 2. Decisions and invariants

### 2.1 Decoupled font safety and verified export readiness

- Disambiguate `pptxSafe` in `src/lib/registry/font-catalog.ts`:
  - `category === 'system'`: Universal system font installed across all PowerPoint machines (Arial, Calibri, Times New Roman, etc.). No font embedding needed in PPTX export.
  - `embeddable: boolean`: Font is supported for TrueType embedding into PPTX packages (all curated Google Fonts with valid definitions, plus dynamically registered font faces).
  - In `src/lib/fonts/embed-fonts.ts`, the embedding worker embeds any used font that is NOT a system font (`category !== 'system'`) and is embeddable. Do NOT set `pptxSafe: true` on Google Fonts in a way that bypasses embedding.
- In `src/components/admin/ArtifactEditor.tsx`:
  - A font is considered **export-ready** when it is a universal system font, a catalog font with confirmed embedding support, or a locally hydrated font face in `font_faces`.
  - The amber exclamation badge `⚠` and Arial fallback claim are suppressed for all export-ready fonts. The warning is shown ONLY when a font face is genuinely unresolved or missing local/network assets.

### 2.2 Proportional tracking in text measurement and Fabric wrap parity

- In `src/lib/registry/canvas-utils.ts`, inside `applyFabricTextFit()`:
  - The base letter spacing `baseLetterSpacing = element.style?.letterSpacing ?? 0`.
  - Inside the binary search function `fitsAt(scale: number)`:
    `inner.style.letterSpacing = `${baseLetterSpacing * scale}px``;
  - Both character glyph width and tracking scale down proportionally with font size.
- Ensure Fabric's `Textbox` text wrapping width accommodates `charSpacing` math:
  - Text box width and line wrapping must preserve the single-line layout of `BANDUNG INTERNATIONAL COMMUNITY` within its authored bounding box (`w: 77.044%` of 1920 = 1479.24px).
  - Test parity across DOM slide view (`ArtifactSlide.tsx`), Fabric editor canvas, and exported PPTX.

### 2.3 Typed unresolved-font contract and admin font acquisition API

- **Typed cross-language contract:**
  - Add optional `fontStatus?: 'system' | 'catalog' | 'embedded' | 'uploaded' | 'unresolved'` to `TextStyle` in both Go (`internal/plan/types.go`, `internal/plan/validate_artifact.go`) and TypeScript (`src/lib/registry/types.ts`, `src/lib/registry/validate.ts`).
  - During PPTX import (`internal/pptximport`), if a DrawingML typeface is not in the system font set and not present in `ppt/fonts/*.fntdata`, set `fontStatus: "unresolved"` and emit a structured import warning naming the unacquired typeface.
- **Script-aware heuristic fallback:**
  - In `src/lib/registry/font-catalog.ts`, `getFontStack()` uses `cursive, sans-serif` when the requested font has `category === 'script'` or known script characteristics (e.g. "The Youngest"), avoiding abrupt fallback to generic Arial.
- **Admin font upload endpoint:**
  - Add route `POST /api/admin/fonts` protected by the existing admin authentication gate.
  - Accepts multipart form upload of `.ttf` or `.otf` binary files up to 16 MiB.
  - Validates binary font table structures, parses family and face metadata, computes SHA-256 digest, and atomically stores the asset in `/data/fonts/` and records it in SQLite `font_faces`.
  - Returns `ImportedFontFace` JSON.
- **Dynamic in-place editor hydration:**
  - In `ArtifactEditor.tsx`, when an element has `fontStatus === 'unresolved'`, display an "Unacquired Font" chip with an upload button.
  - On upload, client calls `registerDynamicFontFace(font)` and awaits `font.load()`. Once loaded, it updates the element's font family, recalculates text fit, and re-renders the canvas without requiring a browser refresh.

## 3. Tracer-bullet breakdown

- **SPEC-33-01**: Font Safety Parity and Verified Export Readiness (`src/lib/registry/font-catalog.ts`, `src/components/admin/ArtifactEditor.tsx`, `src/lib/fonts/embed-fonts.ts`).
- **SPEC-33-02**: Tracking-Aware Proportional Text Fit and Wrap Parity (`src/lib/registry/canvas-utils.ts`, `src/components/artifacts/ArtifactSlide.tsx`, `src/lib/pptx-draw.ts`).
- **SPEC-33-03**: Typed Unresolved-Font Contract and Admin Acquisition API (`internal/plan`, `internal/httpapi`, `src/lib/registry`, `src/components/admin/ArtifactEditor.tsx`).
- **SPEC-33-04**: Production-Path Import-to-Acquisition End-to-End Demo and Absence Guards (`tests/smoke-spec-33.test.mjs`, `tests/public-repo-guard.test.mjs`).
