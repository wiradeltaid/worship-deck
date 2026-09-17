# Ticket SPEC-17-02 — Two-Row Fixed Toolbar (`h-[88px]`) with Font Family Grouped Dropdown in `ArtifactEditor.tsx`

**Status:** closed

## Description

Refactor the element properties toolbar in `src/components/admin/ArtifactEditor.tsx` from a single crowded row (`h-11 min-h-[44px]`) into a clean, fixed two-row panel (`h-[88px] min-h-[88px] max-h-[88px]`). Add a categorized Font Family selector with live canvas updates.

## Critical TDD Order for Agent
Two test files actively assert `h-11 min-h-[44px] max-h-[44px]`:
1. `tests/artifact-editor-layout.test.mjs` (test `SPEC-14-07 / BUG-25`)
2. `tests/artifact-editor-controls.test.mjs` (lines 1934–1938)
You **MUST UPDATE BOTH TESTS FIRST** to assert `h-[88px] min-h-[88px] max-h-[88px]` and add absence guards for `h-11`, before refactoring `ArtifactEditor.tsx`. If only layout test is updated, controls test will fail.

## Requirements

1. **Toolbar Container Height Locking**:
   - Container class: `rounded-lg bg-background border border-border text-xs h-[88px] min-h-[88px] max-h-[88px] p-2 flex flex-col justify-between shrink-0`.
   - Guaranteed fixed 88px height across Text, Shape, Image, and None selection states.

2. **Row 1 (Primary Typography & Element Identity)**:
   - Element Type Badge: `[TEXT]`, `[SHAPE]`, `[IMAGE]`, `[NONE]`.
   - Font Family Selector: standard grouped shadcn `<Select value={fontFamily} onValueChange={handleFontFamilyChange}>` (width `w-[180px] h-7 text-xs`) rendering all 5 categories (`<SelectGroup>` with category `<SelectLabel>` and `<SelectItem>`). (Do NOT invent a custom searchable input).
   - Font Size Number Input (`w-16 h-7 text-center`) + Color Picker (`w-6 h-6`).
   - Style Buttons: Bold, Italic, Underline (`size="icon-sm"`).
   - Separator + Alignment Buttons: Left, Center, Right (`size="icon-sm"`).

3. **Row 2 (Advanced Effects & Sliders)**:
   - Line Height icon button + range slider (`0.8`–`2.4`).
   - Text Shadow toggle "S" button + blur range slider (`0`–`20`).
   - Non-Text States:
     - Shape: Row 1 has Fill color; Row 2 displays shape styling info.
     - Image: Row 1 has Dimensions info; Row 2 displays Object Fit (contain/cover).
     - None: Row 1 displays *"Properties (None): Select element first"*; Row 2 displays *"Tip: Del/Backspace to delete, Drag to move"*.

4. **Fabric.js Live Canvas Synchronization**:
   - `handleFontFamilyChange(family: string)` updates `obj.set({ fontFamily: family })` on active text objects, calls `canvas.requestRenderAll()`, and triggers `markDirty()`.
   - `syncSelection(canvas)` reads `selectedText.fontFamily` and sets `setFontFamily(family)`.
   - Text addition handlers (`insertDrawnElement`, `insertPlaceholder`) use current or default `fontFamily`.

5. **Test Updates**:
   - In `tests/artifact-editor-layout.test.mjs`, update assertion to check `h-[88px] min-h-[88px] max-h-[88px]` and add absence guard for `h-11 min-h-[44px]`.
   - In `tests/artifact-editor-controls.test.mjs`, update toolbar height assertion (lines 1934–1938) to check `h-[88px] min-h-[88px] max-h-[88px]`, and assert `fontFamily` state and handler existence.

## Acceptance Criteria
- Two-row toolbar fixed at 88px height in all states.
- Font family dropdown allows picking from all 45 fonts.
- Changing font immediately reflects on selected canvas text.
- Zero canvas jumping or layout shifts when selecting/deselecting elements.
