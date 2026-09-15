# SPEC-36-01 — Font Import UX & Reusable Multi-File Upload in Artifact Editor

**Status:** open
**Blocked by:** none

## What to build

Add an accessible, repeatable "Import Font" action to Artifact Editor that allows operators to import custom font files on demand at any time, whether an unacquired text element is selected or not.

1. **Font Picker Popover Integration:**
   - In `src/components/admin/ArtifactEditor.tsx`, add an "+ Import Font" button inside the Font Family selection popover (at the top of the dropdown list) and as an accessible toolbar action.
   - Ensure the button does not close the popover prematurely on click and opens a file input dialog accepting `.ttf` and `.otf` font files.
   - Support selecting multiple files at once (`multiple` attribute on `<input type="file" accept=".ttf,.otf">`).
   - The file input must reset its value (`e.target.value = ''`) upon completion or cancellation so an operator can re-upload the exact same file without page reload.

2. **Dedicated "Custom / Uploaded Fonts" Category:**
   - In `src/lib/registry/font-catalog.ts`, add a new `custom` category to `FontCategory` and `FONT_CATEGORY_LABELS`:
     `custom: { en: 'Custom / Uploaded Fonts', id: 'Font Kustom / Diunggah' }`.
   - Ensure newly imported or hydrated fonts are placed in the `custom` category rather than defaulting to `sans`.
   - In the font dropdown list, display the `custom` category at the top of the list for immediate access.

3. **Batch Upload Feedback & Selection:**
   - When multiple files are chosen, upload each file to `POST /api/admin/artifacts/fonts` with per-file progress and error tracking (e.g. "Imported 3 of 4 fonts, font X failed").
   - Partial batches remain useful: successfully uploaded faces register immediately without freezing the editor.
   - One-family selection rule: if all successful files in the batch belong to a single family, apply that family once to the text selection that existed when the batch began. If multiple distinct families were imported, leave the selection unchanged and notify the operator of the imported families.
   - After successful upload, immediately register all uploaded font faces via `registerDynamicFontFace(face)` so they are available to Fabric canvas and DOM text elements without page refresh.

## Acceptance criteria

- Operators can click "+ Import Font" inside the Font Selector combobox at any time, even without selecting any canvas element.
- The file dialog supports multi-file selection of `.ttf` and `.otf` files.
- Imported fonts appear under a distinct "Custom / Uploaded Fonts" category in the font picker.
- Newly imported fonts immediately render on the canvas without requiring a page reload.
- Existing "Acquire Font" button for unacquired imported PPTX fonts remains fully functional.
