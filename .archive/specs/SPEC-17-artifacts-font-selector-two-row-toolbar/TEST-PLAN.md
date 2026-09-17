# Test Plan — SPEC-17 (Artifacts Canvas Font Selector & Two-Row Fixed Toolbar)

## Test Targets
1. `src/lib/registry/font-catalog.ts` (catalog module & deduplicated constants)
2. `src/components/admin/ArtifactEditor.tsx` (two-row fixed toolbar layout & font selection)
3. `src/lib/artifacts/render-model.ts` & `src/lib/pptx-draw.ts` (rendering and export)
4. `src/components/artifacts/ArtifactSlide.tsx` (web slide & projector presentation rendering)
5. `spa/index.html` & `spa/projected.html` (web font stylesheet links)

## Test Suites

### 1. Font Catalog Verification (`tests/artifact-font-catalog.test.mjs`)
- Assert exactly 45 unique font definitions across 5 distinct categories:
  - System Safe / PPTX Universal (10 fonts)
  - Modern Sans-Serif (12 fonts)
  - Dignified Serif (8 fonts)
  - Bold Display & Title Impact (8 fonts)
  - Script & Handwriting (7 fonts)
- Assert every font entry has a `family`, `label`, `category`, and `fallback` stack.
- Assert `getFontStack(family)` returns the correct CSS font-family string.
- Assert default fallback is `'Arial'`.
- Assert `DEFAULT_FONT_FAMILY` in `canvas-utils.ts` and `render-model.ts` is re-exported from `font-catalog.ts`.

### 2. Two-Row Toolbar Fixed Height & Layout Guards (`tests/artifact-editor-layout.test.mjs`)
- Replace the previous single-row `h-11 min-h-[44px] max-h-[44px]` assertion with the new two-row fixed height:
  ```javascript
  assert.ok(
    code.includes('h-[88px] min-h-[88px] max-h-[88px]') || code.includes('h-22 min-h-[88px] max-h-[88px]'),
    'Toolbar properties bar must lock height to 88px fixed two-row panel'
  );
  ```
- Absence guard: Assert absence of `h-11 min-h-[44px] max-h-[44px]` on the toolbar container.
- Guard proof: Synthetic defective code with `h-11` throws assertion error.
- Check that both Row 1 and Row 2 flex containers exist inside the properties toolbar.
- Check that Deck Sequence desktop alignment (`lg:h-0 lg:min-h-full` and `lg:max-h-full`) remains unbroken.

### 3. Font Family Real-time Controls & PPTX Synchronization (`tests/artifact-editor-controls.test.mjs`)
- Assert `fontFamily` selection handler (`handleFontFamilyChange`) exists and updates active text elements on Fabric.js canvas.
- Assert selection-sync (`syncSelection`) extracts and sets `fontFamily` state from active text object.
- Assert `new_text` creation sets `fontFamily` from default or current font state.
- Assert `resolveFontFamily` in `render-model.ts` returns the configured font family.
- Assert `pptx-draw.ts` sets `fontFace: resolveFontFamily(style)` on text slides.
- Assert `ArtifactSlide.tsx` applies `fontFamily: getFontStack(style.fontFamily)`.

### 4. Public Repo Guard Conformance
- Run `tests/public-repo-guard.test.mjs` ensuring no private data or forbidden files are added.
