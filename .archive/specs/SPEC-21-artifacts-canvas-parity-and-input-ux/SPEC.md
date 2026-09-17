# SPEC-21 — Canvas Editor Input UX, Off-Canvas Geometry Preservation & Cross-Renderer Text Parity

> **Supersession Notice**: SPEC-21 explicitly supersedes the slide boundary clamping policy of SPEC-20-04 (`Math.min(100 - computedX, w)` and `Math.min(100 - computedY, h)` in `serializeCanvas`). The height auto-sync (`h = Math.max(source.h, measuredTextHeightPct)`) and intentional width handle narrowing (`isWidthResized`) introduced in SPEC-20 remain fully active.

---

## 1. Problem Statement

Following deployment of SPEC-20 to the development environment (`presenter-dev.bic.my.id`), manual user acceptance testing revealed three critical issues:

### 1.1 Font Size Input Mid-Keystroke Clamping (Catatan 1)
- **Symptom**: When an operator highlights the font size input field and attempts to type `12`, typing the first digit `1` immediately reverts/clamps the input value to `8`. Clearing the input works, but typing `20` is similarly blocked because typing `2` immediately snaps to `8`.
- **Root Cause**: In `src/components/admin/ArtifactEditor.tsx`:
  ```typescript
  const handleFontSizeInput = (raw: string) => {
    setFontSizeInput(raw);
    const parsed = Number(raw);
    if (!raw.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    const clamped = clampFontSize(parsed);
    setFontSize(clamped);
    // ...
    if (updated) {
      canvas.requestRenderAll();
      syncSelection(canvas); // <-- invokes setFontSizeInput(String(clamped))
      markDirty();
    }
  };
  ```
  Because `MIN_FONT_SIZE = 8`, `clampFontSize(1)` returns `8`. The canvas text object is updated to size 8 immediately on keystroke, and `syncSelection(canvas)` reads `selectedText.fontSize` (8) and executes `setFontSizeInput(String(8))`. This immediately overwrites the input field draft from `"1"` to `"8"` during the same keystroke, destroying the operator's typing flow.

### 1.2 Off-Canvas Bounding Box Save-Time Truncation (Catatan 5a)
- **Symptom**: When an operator positions text or shapes that extend past the right or bottom canvas edges (off-canvas bleed, e.g. `x = 70%`, `w = 50%`), the bounding box is automatically truncated upon save to fit within `100%` (e.g. `w` shrinks to `30%`). On reload or presentation, the narrowed box causes unexpected line wrapping and font downscaling. In PowerPoint (PPTX) and presentation slides, off-canvas elements are a standard design technique and should not be forcibly clamped.
- **Root Cause**: In `src/lib/registry/canvas-utils.ts` (`serializeCanvas`), lines 338-339:
  ```typescript
  const clampedW = Math.max(MIN_ELEMENT_W_PCT, Math.min(100 - computedX, w));
  const clampedH = Math.max(MIN_ELEMENT_H_PCT, Math.min(100 - computedY, h));
  ```
  This enforced an artificial maximum dimension of `100 - computedX`, which contradicts the core architecture contract in `src/lib/artifacts/render-model.ts` ("*Values may be negative or greater than 100 — that is deliberate clipping inherited from the source deck and is never clamped*") and `src/components/artifacts/ArtifactSlide.tsx` ("*an element never paints outside its own box... the box itself is never clamped, so deck-inherited off-canvas geometry survives untouched*"). Slide boundaries are enforced naturally by the presentation stage's `overflow: hidden`.

### 1.3 Canvas Editor vs Presenter Mode & PPTX Text Layout Discrepancy (Catatan 5b & 5c)
- **Symptom**: PPTX export and Presenter mode (`/presenter`) match each other 1:1, but the Canvas Artifact Editor displays text with different line breaks and wrapping behavior.
  - **Case 1 (Image 3 vs 4)**: In Canvas, "Bandung International Community" wrapped as:
    - Line 1: `Bandung In`
    - Line 2: `ternational`
    - Line 3: `Community`
    Whereas in Presenter Mode (and PPTX), it wrapped cleanly as:
    - Line 1: `Bandung`
    - Line 2: `International`
    - Line 3: `Community`
  - **Case 2 (Image 1 vs 2)**: "New text" in canvas remained on 1 line, but in Presenter mode wrapped into two lines ("New te" on line 1, "xt" on line 2) or displayed layout shifts.
- **Root Causes**:
  1. **Fabric `splitByGrapheme: true`**: In `ArtifactEditor.tsx:189`, `fabric.Textbox` was configured with `splitByGrapheme: true`. Fabric breaks words mid-character across lines (grapheme split) rather than wrapping at whole word boundaries. In contrast, DOM CSS (`ArtifactSlide.tsx`) uses `whiteSpace: 'pre-wrap'` (wrapping at word boundaries), and PPTX (`pptxgenjs`) wraps at whole words.
  2. **Font Stack Discrepancy**: `ArtifactSlide.tsx` uses `getFontStack(style.fontFamily)` (e.g. `"Caveat", cursive`), whereas `ArtifactEditor.tsx` passed bare `style?.fontFamily ?? DEFAULT_FONT_FAMILY` (e.g. `"Caveat"`), causing canvas font fallback differences when custom fonts load or render.
  3. **Line Height Default Mismatch**: `ArtifactSlide.tsx` defaults to `TEXT_LINE_HEIGHT = 1.2` (`render-model.ts`), whereas `ArtifactEditor.tsx` used Fabric's internal default (~1.16) and `syncSelection` fell back to `1.16`.

---

## 2. Solution Architecture

### 2.1 Font Size Input Deferred Commit (SPEC-21-01)
- **Decouple Draft State from Canvas Commit**:
  - `onChange`: Only updates the React draft state `setFontSizeInput(raw)`. Does NOT mutate canvas objects, does NOT clamp, and does NOT invoke `syncSelection`.
  - `onBlur` & `onKeyDown (Enter)`: Commits the input.
    - If empty or non-numeric/invalid (`<= 0`): Revert `fontSizeInput` to the last committed `fontSize` without mutating canvas.
    - If numeric and valid: Apply `clampFontSize(parsed)` (`MIN_FONT_SIZE = 8`, `MAX_FONT_SIZE = 240`), update canvas active text objects with the clamped font size, update `fontSize`, and synchronize `fontSizeInput` with `String(clamped)`.
  - **Focus-Safe `syncSelection`**: `syncSelection` must not overwrite `fontSizeInput` while the font size input currently has user focus.

### 2.2 Preserve Off-Canvas Geometry in `serializeCanvas` (SPEC-21-02)
- In `src/lib/registry/canvas-utils.ts` (`serializeCanvas`), eliminate the slide-edge upper clamp while preserving minimum element safety:
  ```typescript
  // SPEC-21-02: Allow off-canvas bleeding; slide stage overflow-hidden clips content
  const clampedW = Math.max(MIN_ELEMENT_W_PCT, w);
  const clampedH = Math.max(MIN_ELEMENT_H_PCT, h);
  ```
- Elements extending past 100% (or negative coordinates) retain their authored dimensions upon save and reload.
- Height auto-sync (`h = Math.max(source.h, measuredTextHeightPct)`) and intentional width handle narrowing (`isWidthResized`) remain fully intact.

### 2.3 Fabric Text Rendering Alignment (SPEC-21-03)
- In `src/components/admin/ArtifactEditor.tsx`:
  - **Remove `splitByGrapheme: true`** (or set `splitByGrapheme: false`) on `fabric.Textbox` instantiation. Fabric will wrap text at whole word boundaries, matching CSS `whiteSpace: 'pre-wrap'` and PPTX.
  - **Use `getFontStack` in Fabric Textbox**: Pass `fontFamily: getFontStack(style?.fontFamily)` so fallback font metrics match `ArtifactSlide.tsx`.
  - **Align `lineHeight` Default to `TEXT_LINE_HEIGHT = 1.2`**:
    - Pass `lineHeight: style?.lineHeight ?? TEXT_LINE_HEIGHT` to `fabric.Textbox`.
    - Update `syncSelection` fallback from `1.16` to `TEXT_LINE_HEIGHT`.
    - Update `serializeTextStyle` construction default from `1.16` to `TEXT_LINE_HEIGHT` so implicit line heights are omitted from persisted JSON payloads.

### 2.4 Test & Documentation Migration (SPEC-21-04)
- Create `tests/smoke-spec-21.test.mjs` containing T-21-01 through T-21-11 covering:
  - Font size deferred commit on blur/Enter.
  - Absence of mid-keystroke `syncSelection` overwrites.
  - Off-canvas width and height preservation in `serializeCanvas`.
  - Preservation of height auto-sync and handle narrowing.
  - Absence of `splitByGrapheme: true`.
  - Alignment of `getFontStack` and `TEXT_LINE_HEIGHT = 1.2`.
- Update `tests/smoke-spec-20.test.mjs` (supersede T-20-09 clamp assertion with off-canvas preservation).
- Update `tests/artifact-editor-controls.test.mjs` (font size commit and line-height defaults).
- Update `.how/registry/06-flows/canvas-authoring-controls.md` to document off-canvas geometry allowance.

---

## 3. Tickets & Dependencies

```
SPEC-21: Canvas Editor Input UX & Cross-Renderer Text Parity
├── SPEC-21-01: Font Size Input Deferred Commit             (ArtifactEditor.tsx)
├── SPEC-21-02: Preserve Off-Canvas Geometry on Save        (canvas-utils.ts, docs)
├── SPEC-21-03: Fabric Text Rendering Parity                (ArtifactEditor.tsx, canvas-utils.ts)
└── SPEC-21-04: Test & Documentation Migration              (smoke-spec-21, smoke-spec-20, docs)
```

1. **SPEC-21-01**: Font Size Input Deferred Commit (`blocked_by: []`).
2. **SPEC-21-02**: Preserve Off-Canvas Geometry on Save (`blocked_by: ["SPEC-21-01"]`).
3. **SPEC-21-03**: Fabric Text Rendering Parity (`blocked_by: ["SPEC-21-02"]`).
4. **SPEC-21-04**: Test & Documentation Migration (`blocked_by: ["SPEC-21-03"]`).
