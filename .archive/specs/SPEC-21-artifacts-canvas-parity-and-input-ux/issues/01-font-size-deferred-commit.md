# SPEC-21-01 — Font Size Input Deferred Commit

**Status:** closed

## Component & Scope
- **Component**: `registry` (Admin UI / Artifact Editor)
- **Satisfies**: `UC-14` (Template Authoring Controls)
- **Files**:
  - `src/components/admin/ArtifactEditor.tsx`
  - `src/lib/registry/canvas-utils.ts` (helper functions: `commitFontSizeFromDraft`, `parseFontSizeDraft`)
- **Tests**:
  - `tests/smoke-spec-21.test.mjs` (T-21-01, T-21-02)
  - `tests/artifact-editor-controls.test.mjs`

## Context & Root Cause
In `ArtifactEditor.tsx`, `handleFontSizeInput` was executing on every `onChange` event, immediately clamping the input value (`clampFontSize(1) -> 8`) and calling `syncSelection(canvas)`. In turn, `syncSelection` immediately executed `setFontSizeInput(String(8))`, overwriting the text input field from `"1"` to `"8"` during the same keystroke.
As a result, operators could not type multi-digit font sizes such as `"12"` or `"20"`.

## Implementation Requirements

1. **Extract Pure Commit Logic (`canvas-utils.ts`)**:
   - Create and export:
     ```typescript
     export function parseFontSizeDraft(raw: string): number | null {
       const trimmed = raw.trim();
       if (!trimmed) return null;
       const parsed = Number(trimmed);
       return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
     }

     export function commitFontSizeFromDraft(
       raw: string,
       committedFontSize: number
     ): { fontSize: number; inputValue: string } {
       const parsed = parseFontSizeDraft(raw);
       if (parsed === null) {
         return { fontSize: committedFontSize, inputValue: String(committedFontSize) };
       }
       const clamped = clampFontSize(parsed);
       return { fontSize: clamped, inputValue: String(clamped) };
     }
     ```

2. **Decouple Draft State in `ArtifactEditor.tsx`**:
   - `handleFontSizeInputChange`: Only call `setFontSizeInput(raw)`. Do NOT mutate canvas active objects, do NOT clamp, and do NOT invoke `syncSelection`.
   - `handleFontSizeCommit`:
     ```typescript
     const handleFontSizeCommit = () => {
       const result = commitFontSizeFromDraft(fontSizeInput, fontSize);
       setFontSize(result.fontSize);
       setFontSizeInput(result.inputValue);

       const canvas = fabricCanvasRef.current;
       if (!canvas) return;
       let updated = false;
       for (const obj of canvas.getActiveObjects()) {
         if (!isFabricTextObject(obj)) continue;
         obj.set({ fontSize: result.fontSize });
         const objData = (obj as any).data;
         if (objData) {
           objData.authoredHeight = (obj.height ?? 0) * (obj.scaleY ?? 1);
         }
         updated = true;
       }
       if (updated) {
         canvas.requestRenderAll();
         markDirty();
       }
     };
     ```
   - Wire input triggers:
     - `onBlur={handleFontSizeCommit}`
     - `onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}`

3. **Focus Protection in `syncSelection`**:
   - Ensure `syncSelection(canvas)` does not overwrite `fontSizeInput` if the font size `<Input>` element is currently focused (`document.activeElement`).

## Acceptance Criteria
- [ ] Highlighting font size input and typing `1` leaves the text as `1` without immediately snapping to `8`.
- [ ] Typing `2` then blur or Enter commits font size `12` on canvas and updates the input value to `12`.
- [ ] Typing `2` then `0` then blur or Enter commits font size `20`.
- [ ] Clearing the input field and blurring reverts the field and canvas to the previous valid font size (not defaulting to 8).
- [ ] Typing invalid characters (e.g. `abc`) and blurring reverts to the previous valid font size.
- [ ] Multi-selected text objects on canvas all update to the committed font size.
