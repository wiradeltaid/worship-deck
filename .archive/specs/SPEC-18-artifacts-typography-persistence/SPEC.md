# SPEC-18 — Artifacts Canvas Typography & Layout Persistence Follow-up

## Problem Statement

During manual verification of SPEC-17 on the dev environment (`presenter-dev.bic.my.id`), three distinct issues and improvement requests were identified:

1. **Text Shadow Blur Setting Does Not Persist (Reverts to Default 4 on Save/Reload)**:
   While the `shadowBlur` slider (0–20) changes blur in real time on the canvas, upon saving and reloading the slide, the blur reverts back to the default value of 4. Root cause analysis confirms that:
   - `TextStyle` in `src/lib/registry/types.ts` only defines `textShadow?: boolean;` without a blur property.
   - `internal/plan/validate_artifact.go` only permits boolean `textShadow` in `allowedStyleKeys`, with no `textShadowBlur` field allowed.
   - `serializeTextStyle` in `canvas-utils.ts` only persists `style.textShadow = true;`.
   - `elementToFabricObject` in `ArtifactEditor.tsx`, `ArtifactSlide.tsx`, and `pptx-draw.ts` hardcode shadow blur to 4.

2. **Font Selector Dropdown Group Boundary Contrast & Lack of Quick Text Search**:
   - The 5 category headers in the font dropdown (`SelectLabel`) blend into the dropdown menu items without sufficient visual distinction, making it hard for operators to quickly identify category boundaries.
   - Scrolling through 45 fonts without a text search filter slows down worship operators who already know the name of the font they want (e.g., typing "mont" to immediately pick "Montserrat").

3. **Textbox Width Resize Lost on Save (Text Wraps to Two Lines After Save)**:
   When an operator widens a text box (such as "Welcome to" on the `welcome` slide with font size 114) by dragging its side resize handles (`mr` / `ml`) on the canvas, the wider box accommodates the large text on a single line. However, after saving and reloading, the text box reverts to its original width (e.g. `56.42%`), forcing large text to wrap into two lines.
   Root cause analysis confirms that in `serializeCanvas` (`canvas-utils.ts`):
   ```typescript
   const w = isText
     ? source.w * scaleX
     : measuredWidth === authoredWidth
       ? source.w
       : pxToPct(measuredWidth, CANVAS_WIDTH);
   ```
   In Fabric.js, dragging a `fabric.Textbox` side handle directly alters `obj.width` while leaving `scaleX = 1`. Because `isText` unconditionally evaluated `source.w * scaleX` (which is `source.w * 1`), changes to `obj.width` were completely discarded during serialization.

## Solution Architecture

1. **Full Text Shadow Blur Persistence Pipeline**:
   - Update `TextStyle` in `src/lib/registry/types.ts` and `ResolvedStyle` in `src/lib/artifacts/runtime-contract.ts` to include `textShadowBlur?: number;`.
   - Update `src/lib/registry/validate.ts` (TS client validator):
     - Add `"textShadowBlur"` to `ALLOWED_STYLE_KEYS`.
     - In `parseStyle`, validate `textShadowBlur` as a finite number between 0 and 20.
   - Update `internal/plan/validate_artifact.go` (Go server validator):
     - Add `"textShadowBlur"` to `allowedStyleKeys`.
     - In `parseStyle`, validate `textShadowBlur` as a non-negative number between 0 and 20 (`math.Round(n)`).
   - Update `serializeTextStyle` in `src/lib/registry/canvas-utils.ts`:
     - When `textObj.shadow` is truthy, read `blur` from `(textObj.shadow as { blur?: number })?.blur`, clamping to 0–20, and serialize `style.textShadow = true` and `style.textShadowBlur = Math.round(blur)`.
     - When shadow is falsy/toggled off, delete both `style.textShadow` and `style.textShadowBlur`.
   - Update `elementToFabricObject` in `ArtifactEditor.tsx` to initialize `fabric.Shadow` with `element.style?.textShadowBlur ?? 4`.
   - Update `ArtifactSlide.tsx` and `pptx-draw.ts` to standardize fallback blur:
     `blur: typeof style?.textShadowBlur === 'number' ? style.textShadowBlur : 4`.

2. **Searchable Grouped Font Picker with High-Contrast Category Headers**:
   - Enhance the font family selector in `ArtifactEditor.tsx`:
     - Provide an integrated search input (filtering the 45 curated fonts in real-time as the operator types) while preventing focus loss.
     - Retain all 5 categories (`System & PowerPoint Safe`, `Modern Sans-Serif`, `Dignified Serif`, `Bold Display & Title`, `Script & Handwriting`) as non-selectable headers.
     - Style category headers with high-contrast background (e.g., `bg-muted/90 text-foreground font-bold px-2.5 py-1 rounded-sm my-1 border-l-2 border-primary text-[11px] select-none`) ensuring instant visual distinction across both light and dark themes.
     - Wire i18n keys for search placeholder in `src/lib/i18n/catalogue-en.ts` and `catalogue-id.ts`.

3. **Textbox Width Resize Persistence**:
   - Fix `serializeCanvas` in `src/lib/registry/canvas-utils.ts`:
     For all elements (including `isText`), calculate `measuredWidth = Math.abs(obj.width ?? 0) * scaleX`.
     If `Math.abs(measuredWidth - authoredWidth) > 1px`, serialize `w: pxToPct(measuredWidth, CANVAS_WIDTH)`.
     Preserve exact `source.w` only when the width was not resized (`Math.abs(measuredWidth - authoredWidth) <= 1px`), guaranteeing zero floating-point jitter for untouched seed layouts.

## Implementation Decisions

1. **Non-Breaking Schema Evolution & Dual Validator Parity**:
   Adding `textShadowBlur` as an optional key in both Go `allowedStyleKeys` and TypeScript `ALLOWED_STYLE_KEYS` preserves exact parity. Existing slides with boolean `textShadow: true` default to `4` seamlessly.
2. **Unified Fallback Standardization**:
   Editor, web slideshow (`ArtifactSlide.tsx`), and PPTX export (`pptx-draw.ts`) all standardize on blur default `4` (retiring arbitrary `3` in PPTX).
3. **Seed Layout Invariance & Round-Trip Fidelity**:
   Checking `Math.abs(measuredWidth - authoredWidth) > 1px` guarantees that untouched seed templates in `default-registry.json` (such as `welcome` with `w: 56.42%`) maintain their exact original percentage values.
4. **Desktop & Mobile Theme Compatibility**:
   The category header styling uses semantic tokens (`bg-muted/90`, `text-foreground`, `border-primary`) so high contrast holds across both light and dark theme palettes.

## Out of Scope

1. Custom hex color inputs for text shadow (retains standard presentation drop-shadow `rgba(0,0,0,0.8)`).
2. Arbitrary external web font URLs outside the curated 45-font catalog.
3. Embedding raw binary font files into PPTX files (PowerPoint and LibreOffice desktop render fonts according to OS-installed font libraries).
4. Textbox height drag-resize persistence (textbox height in presentation view is auto-determined by text content and shrink-to-fit scale, whereas width dictates wrapping boundaries).

## Tickets & Dependencies

- **SPEC-18-01**: Text Shadow Blur Schema, Serialization, and Multi-Surface Persistence (`blocked_by: []`).
- **SPEC-18-02**: Searchable Grouped Font Family Selector with High-Contrast Headers (`blocked_by: ["SPEC-18-01"]`).
- **SPEC-18-03**: Textbox Width Drag-Resize Serialization & Seed Conformance (`blocked_by: ["SPEC-18-01"]`).

## User Stories

1. As an operator configuring worship slides, I want my custom shadow blur adjustments to be saved permanently so they look identical when reloaded.
2. As a worship leader choosing slide fonts, I want to type font names into a search box and see clear category boundaries, so I can find typography in seconds.
3. As an admin styling slide headers with large fonts, I want dragging the width of a text box to stay wide after saving, preventing unwanted text wrapping.

## Acceptance Criteria

1. Adjusting `shadowBlur` to any value between 0 and 20 persists through Save, page reload, web slideshow view, and PPTX export.
2. The font family picker provides an inline search input that filters fonts while maintaining category headers with high-contrast styling.
3. Dragging the width handles of a text element updates and persists `w` percentage on save; large text remains on a single line after reload.
4. All existing unit tests, layout guards, seed conformance tests, and new regression tests pass cleanly.
