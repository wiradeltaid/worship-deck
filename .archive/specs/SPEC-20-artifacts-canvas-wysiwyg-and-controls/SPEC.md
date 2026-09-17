# SPEC-20 — Artifacts Canvas WYSIWYG Auto-Sync, Live Drag Rubberband, Layout Stability & Combobox Font Picker

## Problem Statement

During manual user acceptance testing of SPEC-19 on the development environment (`presenter-dev.bic.my.id`), four critical user experience and architectural defects were observed:

1. **Font Search Input Keyboard Focus Theft & Typeahead Navigation (Follow-up SPEC-19-01)**:
   - When typing in the font family search text field (e.g., typing "mont"), only the first character (e.g., "a", "l", "i") registers or jumps immediately to the matching item in the list, and subsequent keystrokes cannot be entered.
   - **Root Cause**: Base UI's `@base-ui/react/select` (`<SelectPrimitive.Popup>` and `<SelectPrimitive.List>`) enforces ARIA listbox behavior with native typeahead search. When an alphanumeric key is pressed, Base UI's native event listeners intercept the keypress to navigate between options and immediately shift focus away from the `<Input>` to the focused `<SelectItem>`. Once focus leaves the input, subsequent typing lands on the select list instead of the search field. React synthetic event `stopPropagation()` does not intercept Base UI's native capture listeners.

2. **Absence of Real-time Visual Rubberband during Drag-to-Draw (Catatan 1)**:
   - When drawing a shape or text box by clicking and dragging on the canvas, no visual box or outline appears during the drag action. The shape only abruptly appears when the mouse button is released.
   - **Root Cause**: In `ArtifactEditor.tsx`, the canvas drawing handler registers `mouse:down` (which stores `dragStart`) and `mouse:up` (which calculates dimensions and calls `insertDrawnElement`). There is no `mouse:move` handler during drawing mode to render an active preview rectangle on the canvas.

3. **Deck Sequence Height Collapse on Non-Canvas Slides (Catatan 2)**:
   - When selecting a song set entry or announcement set marker in the Deck Sequence list, the right column hides the canvas (`!isEditable`) and renders a `rounded-2xl border-dashed p-6` banner without a fixed aspect ratio. Because the layout uses CSS Grid (`lg:grid-cols-[330px_minmax(0,1fr)]`) where the left sidebar (`aside`) height derives from the grid row height (`lg:h-0 lg:min-h-full`), the absence of the ~750px canvas stage causes the row height to collapse drastically down to the content height of the banner (~180px), causing jarring UI jumping and scrollbar inconsistencies.
   - **Root Cause**: The right column's height was dictated purely by the presence of the editable Fabric canvas rather than maintaining a constant 16:9 stage viewport footprint across all slide types.

4. **Canvas vs Presentation Auto-Shrink Text Discrepancy & Manual Box Resizing (Catatan 3)**:
   - In the canvas editor, text with large font sizes (e.g. 60px - 100px) displays cleanly at the authored size because `fabric.Textbox` allows text to expand vertically beyond its initial box height without clipping. However, upon switching to Presentation View (`ArtifactSlide.tsx`) or downloading PPTX, the text suddenly downscales to a tiny size (e.g. 25px).
   - In SPEC-19, a warning badge (`⚠️ Text exceeds box bounds; presentation and PPTX will auto-shrink text to fit`) was added, forcing operators to manually drag bounding box handles to eliminate the warning.
   - **Deliberate Policy Reversal from SPEC-19-05**: SPEC-19-05 treated text overflow as an operator error requiring manual box stretching. In real church production, this created friction because the canvas already looked visually correct. SPEC-20 deliberately supersedes this pattern: instead of requiring manual stretching and showing a warning badge, `serializeCanvas` and the editor automatically calculate and synchronize bounding box dimensions (`h` and `w`) to encapsulate the measured rendered text upon save. True WYSIWYG parity is achieved automatically, and the manual warning badge is retired.
   - **Root Cause**: In `src/lib/registry/canvas-utils.ts` (`serializeCanvas`), lines 322-328:
     ```typescript
     const h = isText
       ? scaleY !== 1
         ? source.h * scaleY
         : source.h
       : isHeightResized
         ? pxToPct(measuredHeight, CANVAS_HEIGHT)
         : source.h;
     ```
     For text elements, `source.h` was locked and never updated when font size or text lines expanded vertically. When saved, the element retained a tiny `h` (e.g. 10% = 54px). In `ArtifactSlide.tsx`, `largestFittingTextScale` saw that the 100px text exceeded the 54px container and aggressively shrank the font. In PPTX, `estimateTextFitScale` did the same.

---

## Solution Architecture

### 1. Combobox Font Picker via Popover Primitive (SPEC-20-01)
- In `ArtifactEditor.tsx`, replace the Base UI `<Select>` for Font Family with a dedicated **Combobox pattern** using `@base-ui/react/popover` (`Popover`, `PopoverTrigger`, `PopoverContent`).
- The trigger button maintains identical visual design to a select trigger: displays current font label, font preview style, and ChevronDown icon.
- `PopoverContent` renders directly beneath the trigger (`side="bottom"`, `align="start"`, `sideOffset={4}`).
- Because `Popover` does not implement listbox typeahead or manage list item focus, the `<Input>` inside `PopoverContent` retains uninterrupted native keyboard focus. Spacebar, backspace, and text input filter the font list in real-time without focus theft.
- Clicking any font item updates `fontFamily`, applies the font to the active Fabric canvas text object, and closes the popover.

### 2. Live Drag Rubberband Preview on Canvas (SPEC-20-02)
- In `ArtifactEditor.tsx`, introduce real-time drawing feedback:
  - On `mouse:down`: When `drawingTool` is active, record `dragStart` and instantiate a temporary Fabric preview object:
    - For `rect`: a temporary rectangle with dashed stroke (`stroke: '#5C2E16'`, `strokeDashArray: [4, 4]`, `fill: 'rgba(92, 46, 22, 0.2)'`, `selectable: false`, `evented: false`).
    - For `text`: a temporary text box outline (`stroke: '#2563EB'`, `strokeDashArray: [4, 4]`, `fill: 'rgba(37, 99, 235, 0.1)'`, `selectable: false`, `evented: false`).
    - Add the preview object to canvas.
  - On `mouse:move`: If `dragStart` and preview object exist, compute `left = Math.min(dragStart.x, pointer.x)`, `top = Math.min(dragStart.y, pointer.y)`, `width = Math.abs(pointer.x - dragStart.x)`, `height = Math.abs(pointer.y - dragStart.y)`. Update preview object geometry and invoke `canvas.requestRenderAll()`.
  - On `mouse:up`: Remove the temporary preview object from canvas, compute final coordinates (falling back to default dimensions if click distance < 10px), and invoke `insertDrawnElement`.
  - On Escape or cancel: Cleanly remove any active preview object from canvas.

### 3. Stable 16:9 Stage Viewport for Non-Canvas Slides (SPEC-20-03)
- In `ArtifactEditor.tsx`, ensure the right column preserves a constant 16:9 stage viewport height regardless of whether the slide has an editable canvas:
  - When `!isEditable` (e.g. `song-set-entry` or `ann-set-marker`), render a **16:9 Stage Placeholder Card** (`aspect-video rounded-xl border border-border bg-card flex flex-col items-center justify-center p-8 text-center`).
  - Inside the placeholder stage, display an informative banner indicating the slide's purpose (e.g., *"Song set slides are rendered dynamically from the Song Database; to customize song lyrics, edit the song in Song Catalog"*).
  - Because the right column maintains an identical 16:9 aspect ratio container in both editable and non-editable states, the CSS Grid row height remains perfectly stable.
  - Deck Sequence in the left sidebar maintains a steady height across all slide selections without collapsing or causing window scrollbar conflicts.

### 4. Auto-Sync Textbox Bounding Box Height for True WYSIWYG Parity (SPEC-20-04)
- In `src/lib/registry/canvas-utils.ts` (`serializeCanvas`):
  - For text elements (`isText`), synchronize the stored bounding box height `h` with the measured rendered text height:
    ```typescript
    const measuredTextHeightPct = pxToPct(measuredHeight, CANVAS_HEIGHT);
    const h = isText
      ? Math.max(source.h, measuredTextHeightPct)
      : isHeightResized
        ? pxToPct(measuredHeight, CANVAS_HEIGHT)
        : source.h;
    ```
  - Ensure the box stays within canvas bounds (`Math.min(100 - next.y, h)`).
  - **Horizontal Width Handling**: `fabric.Textbox` naturally breaks text into lines based on box width `w`. If continuous text without spaces exceeds the authored width, operators can expand `w` via the horizontal resize handles shipped in SPEC-18. Additionally, `serializeCanvas` checks if `measuredWidth > authoredWidth` and expands `w` (clamped to `100 - next.x`) so text does not clip or trigger horizontal auto-shrink.
  - **Stored Slides Lifecycle**: Auto-sync executes upon save in the canvas editor. Existing saved templates created prior to SPEC-20 retain their authored dimensions until opened and saved by an operator, ensuring non-destructive data handling.
- In `ArtifactEditor.tsx`:
  - When font size changes or text is modified, automatically update the textbox dimensions so the bounding box accommodates the rendered text.
  - Remove the manual "Text exceeds box bounds" warning badge, because bounding box height is now auto-synchronized to accommodate the text upon save.
- **Impact on Presentation View & PPTX**:
  - In `ArtifactSlide.tsx`, `boxHeight` now automatically accommodates the rendered text height, so `fitsAt(1.0)` is satisfied (`largestFittingTextScale = 1.0`). No auto-shrink occurs!
  - In PPTX export (`pptx-draw.ts`), `estimateTextFitScale` evaluates to `1.0`. No auto-shrink occurs!
  - Font sizes in the presentation view and downloaded PPTX match the visual appearance of the editor canvas 1:1.
  - The manual warning badge is eliminated as auto-fit parity is guaranteed by default.
- **Test Regression & Migration Requirements**:
  - `tests/smoke-spec-19.test.mjs`: Refactor line 247-270 assertion so the 0.75 pt/px math invariant is preserved while adjusting the badge check to acknowledge that SPEC-20 replaced the manual overflow badge with auto-sync `h`.
  - `tests/artifact-editor-layout.test.mjs`: Update line 280 font dropdown assertion from Base UI Select's `alignItemWithTrigger={false}` to Popover's `side="bottom"` and `align="start"`.
  - `.how/registry/06-flows/canvas-authoring-controls.md`: Update documentation to replace the manual badge guidance with auto-sync bounding box explanation.

---

## Tickets & Dependencies

Tickets execute in sequential dependency order to satisfy WDI Method's `parallel-tickets-blocked` guard for concurrent modifications to `ArtifactEditor.tsx`:

- **SPEC-20-01**: Combobox Font Picker via Popover Primitive (`blocked_by: []`).
- **SPEC-20-02**: Real-time Shape & Text Drag-to-Draw Rubberband Preview (`blocked_by: ["SPEC-20-01"]`).
- **SPEC-20-03**: Stable 16:9 Stage Viewport for Non-Canvas Slides (`blocked_by: ["SPEC-20-02"]`).
- **SPEC-20-04**: Auto-Sync Textbox Bounding Box Height for True WYSIWYG Parity (`blocked_by: ["SPEC-20-03"]`).

---

## User Stories

1. As an operator choosing a font, I want to type any search query into the search box with spaces and backspaces without focus jumping or the menu closing, and see the font list filter instantly.
2. As a slide designer, I want to see a real-time rubberband rectangle while dragging to draw a shape or text box, so I know exactly where and how large the element will be before releasing the mouse.
3. As a slide designer browsing through slides in the Deck Sequence, I want the Deck Sequence list to maintain a stable height when clicking on song sets and announcements, without jumping or collapsing.
4. As a presenter, I want text created on the canvas at font size 60px or 100px to appear at that exact visual scale in presentation mode and PPTX export, without unexpected font shrinking.

---

## Acceptance Criteria

1. Typing in the font search box permits smooth text input without losing focus, filters the categorized fonts instantly, and selecting a font updates the active text on canvas.
2. While dragging on canvas with the Rectangle or Text tool active, a live dashed preview rectangle tracks the mouse position in real-time. Releasing the mouse commits the element at that exact size and position.
3. Selecting a `song-set-entry` or `ann-set-marker` slide renders a stable 16:9 stage container, keeping the Deck Sequence list at a consistent height without layout jumping or window scrollbar overflow.
4. Large text created or resized on canvas persists an automatically calculated bounding box height `h` that encapsulates the rendered text lines, preventing `largestFittingTextScale` in `ArtifactSlide.tsx` and PPTX export from shrinking the text.
5. All unit, layout, and regression test suites pass cleanly.
