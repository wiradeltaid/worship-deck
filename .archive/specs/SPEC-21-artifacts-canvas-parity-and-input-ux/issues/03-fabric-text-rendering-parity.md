# SPEC-21-03 — Fabric Text Rendering Alignment

**Status:** closed

## Component & Scope
- **Component**: `registry` (Admin UI Canvas Editor & Models)
- **Satisfies**: `UC-14` (Template Authoring Controls)
- **Files**:
  - `src/components/admin/ArtifactEditor.tsx`
  - `src/lib/registry/canvas-utils.ts` (`serializeTextStyle`)
- **Tests**:
  - `tests/smoke-spec-21.test.mjs` (T-21-07, T-21-08, T-21-09, T-21-10)
  - `tests/artifact-editor-controls.test.mjs`

## Context & Root Cause
In user testing, PPTX export and Presenter mode (`/presenter`) matched 1:1, but the Canvas Artifact Editor rendered line breaks and word wrapping differently:
1. **`splitByGrapheme: true`**: In `ArtifactEditor.tsx:189`, Fabric `Textbox` was instantiated with `splitByGrapheme: true`. Fabric breaks words in half across lines at character boundaries (e.g. "Bandung In" on line 1 and "ternational" on line 2). Conversely, DOM CSS (`ArtifactSlide.tsx`) uses `whiteSpace: 'pre-wrap'` (wrapping at whole word boundaries), and PPTX wraps at whole words ("Bandung" on line 1, "International" on line 2).
2. **Font Stack Mismatch**: `ArtifactSlide.tsx` resolves fonts using `getFontStack(style.fontFamily)` (providing robust fallback families such as `sans-serif`, `serif`, `cursive`), whereas `ArtifactEditor.tsx` passed bare `style?.fontFamily ?? DEFAULT_FONT_FAMILY`.
3. **Line Height Defaults**: `ArtifactSlide.tsx` defaults to `TEXT_LINE_HEIGHT = 1.2` (`render-model.ts`), whereas `ArtifactEditor.tsx` used `1.16` as its fallback.

## Implementation Requirements

1. **Remove `splitByGrapheme` from `fabric.Textbox`**:
   In `src/components/admin/ArtifactEditor.tsx`:
   ```typescript
   // Remove `splitByGrapheme: true` (or set `splitByGrapheme: false`)
   // so Fabric wraps at whole word boundaries, matching CSS whiteSpace: 'pre-wrap' and PPTX.
   ```

2. **Align `fontFamily` Stack in Fabric Canvas**:
   In `ArtifactEditor.tsx` (`elementToFabricObject`):
   ```typescript
   fontFamily: getFontStack(style?.fontFamily),
   ```
   Import `getFontStack` from `@/lib/registry/font-catalog`.

3. **Align `lineHeight` Default to `TEXT_LINE_HEIGHT = 1.2`**:
   - In `ArtifactEditor.tsx`:
     - Pass `lineHeight: style?.lineHeight ?? TEXT_LINE_HEIGHT` in `elementToFabricObject`.
     - In `syncSelection`, fallback to `TEXT_LINE_HEIGHT` (instead of `1.16`).
   - In `src/lib/registry/canvas-utils.ts` (`serializeTextStyle`):
     - Update the comparison and fallback default:
       ```typescript
       if (typeof (obj as any).lineHeight === 'number' && Math.abs((obj as any).lineHeight - TEXT_LINE_HEIGHT) > 0.01) {
         style.lineHeight = (obj as any).lineHeight;
       }
       ```
       Implicit `TEXT_LINE_HEIGHT = 1.2` continues to be omitted from stored JSON payloads.
   - Import `TEXT_LINE_HEIGHT` from `@/lib/artifacts/render-model` (or re-export safely).

## Acceptance Criteria
- [ ] Text containing long words (e.g. "Bandung International Community") wraps at word boundaries in the Canvas Editor, matching Presentation View and PPTX.
- [ ] Fabric Textbox uses the full font stack from `getFontStack` so fallback font metrics match CSS rendering.
- [ ] Fabric Textbox default line height is `1.2`, matching `ArtifactSlide.tsx` and `render-model.ts`.
- [ ] Explicitly authored line heights (e.g. `1.5`) persist in slide JSON.
