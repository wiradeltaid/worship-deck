# SPEC-19 — Artifacts Canvas Interactions, Shape Persistence & Typography Refinement

## Problem Statement

During manual user QA of SPEC-18 on the development environment (`presenter-dev.bic.my.id`), one defect from SPEC-18-02 and four critical canvas/presentation functional observations were confirmed:

1. **SPEC-18-02 Defect Follow-up: Font Search Input Unresponsive & Dropdown Mispositioned**:
   - The search input inside the font family `<SelectContent>` dropdown cannot be typed into (`textfield search font tidak bisa diketik`).
   - The dropdown popup renders far below the trigger (underneath the canvas workspace) rather than anchoring neatly directly beneath the font family selector in the element properties toolbar.
   - Root Cause:
     - In `src/components/ui/select.tsx`, `SelectContent` defaults to `alignItemWithTrigger = true`. In Base UI (`@base-ui/react/select`), when `alignItemWithTrigger` is enabled, the popup positioner offsets the entire popup to align the currently selected item over the trigger. Because the font catalog contains 45 items categorized in groups, selecting an item further down displaces the popup downward across the screen.
     - Base UI's `<SelectPrimitive.Popup>` enforces focus management and intercepts alphanumeric keystrokes for option typeahead navigation. Keystrokes inside `<Input>` do not register because the select primitive captures focus and traps events, or closes on Space / Enter.

2. **Element Duplication Loses Live Styling and Properties (Catatan 1)**:
   - When duplicating an element on canvas, the duplicated element reverts to default or stale template styles instead of inheriting the live properties of the duplicated element.
   - Root Cause:
     - In `ArtifactEditor.tsx`, `handleDuplicateSelected` retrieves `source = byId.get(elementId)` from `layout.elements` and `addedElementsRef.current`. Stale uncommitted changes made on the canvas (such as font family, font size, bold/italic, text color, text shadow blur, shape fill color, or resized dimensions) exist only on the live Fabric object (`obj`) and were never read during cloning. Only `obj.text` was copied.

3. **Canvas Element Interaction Interferes with "Add Element" Mode (Catatan 2)**:
   - When an operator activates the Add Text or Add Rectangle tool (`drawingTool === 'text' | 'rect'`), hovering over existing shapes on canvas displays the move cursor and clicking selects or drags the underlying shape instead of placing the new element on top.
   - Root Cause:
     - In `ArtifactEditor.tsx`, entering `drawingTool` mode only alters `canvas.defaultCursor = 'crosshair'`. Existing Fabric objects retain `selectable: true` and `evented: true`. Fabric's target detection intercepts pointer events before they reach the canvas drawing handlers (`onMouseDown` / `onMouseUp`).

4. **Shape Fill Color Reverts to Brown (`#5C2E16`) on Save (Catatan 3)**:
   - When an operator changes a shape's fill color via the Shape Properties color picker, the color updates in real-time on the canvas. However, upon clicking Save and reloading, the shape reverts to the default brown (`#5C2E16`).
   - Root Cause:
     - In `src/lib/registry/canvas-utils.ts`, `serializeCanvas` has an `if (isText)` block that updates `next.content` and `next.style = serializeTextStyle(...)`. For shapes (`source.type === 'shape'`), there is no serialization of `obj.fill` or `obj.opacity`. `next.style` retains the stale authored `source.style`.

5. **Discrepancy Between Editor Canvas and Presentation View Auto-Shrink Text (Catatan 4 & 5)**:
   - A font size of 50px in the canvas exports to 37.5pt in PPTX, though visual positioning is identical.
   - A text box with font size 180 appears massive on the editor canvas, but shrinks dramatically in presentation view (`ArtifactSlide.tsx`) and shifts relative position.
   - Root Cause:
     - PPTX uses typographic points (pt) at 72 pt/in, whereas the reference canvas uses 960x540 pixels. The exact conversion factor is `405pt / 540px = 0.75 pt/px`, making 50px equal to 37.5pt with 100% physical proportion parity.
     - In `ArtifactSlide.tsx`, `largestFittingTextScale` auto-downscales text when it overflows the authored `w` x `h` percentage container. In `ArtifactEditor.tsx`, `fabric.Textbox` renders text at full 180px spilling outside its bounding box without visual feedback that shrink-to-fit will trigger in presentation view.

## Solution Architecture

1. **Searchable Font Dropdown Keyboard Isolation & Popper Positioning (SPEC-19-01)**:
   - In `src/components/ui/select.tsx` and `ArtifactEditor.tsx`:
     - Note that baseline search input rendering and label filtering was introduced in SPEC-18-02. The critical remaining delta is positioning and event isolation.
     - Explicitly set `alignItemWithTrigger={false}`, `side="bottom"`, `align="start"`, and `sideOffset={4}` on the font selector's `SelectContent`.
     - Isolate the search `<Input>` container: stop propagation of `keydown`, `keyup`, and `pointerdown` events so that typing (including spaces, backspace, and arrow keys) is handled natively by the input without triggering Base UI Select keyboard navigation or selection.
     - Ensure the search input reliably receives focus on open and does not blur when clicked.

2. **Live Canvas Object Cloning for Duplication (SPEC-19-02)**:
   - In `ArtifactEditor.tsx`, update `handleDuplicateSelected`:
     - Extract live visual and typographic styles directly from the active Fabric object (`obj`):
       - For text: extract `fontFamily`, `fontSize`, `fill` (as `fontColor`), `fontWeight`, `fontStyle`, `underline`, `textAlign`, `lineHeight`, `shadow` (setting `textShadow: true` and `textShadowBlur: obj.shadow.blur ?? 4`).
       - For shape: extract `fill` (as `fillColor`) and `opacity`.
     - Extract live position and dimensions:
       - `leftPx = obj.left ?? pctToPx(source.x, CANVAS_WIDTH)`
       - `topPx = obj.top ?? pctToPx(source.y, CANVAS_HEIGHT)`
       - `clonedElement.x = Math.min(90, pxToPct(leftPx, CANVAS_WIDTH) + pxToPct(INSERT_CASCADE_PX, CANVAS_WIDTH))`
       - `clonedElement.y = Math.min(90, pxToPct(topPx, CANVAS_HEIGHT) + pxToPct(INSERT_CASCADE_PX, CANVAS_HEIGHT))`
       - `w: pxToPct(Math.abs(obj.width ?? 0) * (obj.scaleX ?? 1), CANVAS_WIDTH)`
       - `h: pxToPct(Math.abs(obj.height ?? 0) * (obj.scaleY ?? 1), CANVAS_HEIGHT)`
     - Assign cloned properties to `clonedElement.style` and geometry, guaranteeing exact visual parity between original and duplicate.

3. **Canvas Drawing Mode Event Isolation (`skipTargetFind`) (SPEC-19-03)**:
   - In `ArtifactEditor.tsx`, when `drawingTool` is active (`'text'` or `'rect'`):
     - Set `canvas.skipTargetFind = true` and `canvas.selection = false`.
     - Set both `canvas.defaultCursor = 'crosshair'` and `canvas.hoverCursor = 'crosshair'` so hovering over existing shapes displays crosshairs rather than move/pointer cursors.
     - Mouse down/up placement handlers support both single-click (default size) and drag-to-size box placement cleanly over existing shapes.
     - Add Escape key listener to cancel drawing tool without placement.
     - When `drawingTool` is reset to `null` (or on canvas disposal/remount), restore `canvas.skipTargetFind = false`, `canvas.selection = true`, `canvas.defaultCursor = 'default'`, and `canvas.hoverCursor = 'move'`.

4. **Shape Fill Color & Opacity Serialization (SPEC-19-04)**:
   - In `src/lib/registry/canvas-utils.ts`, update `serializeCanvas`:
     - Add serialization branch for `source.type === 'shape'`:
       ```typescript
       if (source.type === 'shape') {
         const fill = typeof (obj as any).fill === 'string' ? (obj as any).fill : undefined;
         const opacity = typeof (obj as any).opacity === 'number' ? (obj as any).opacity : undefined;
         next.style = {
           ...source.style,
           ...(fill ? { fillColor: fill } : {}),
           ...(opacity !== undefined ? { opacity } : {}),
         };
       }
       ```
     - Add comprehensive test coverage asserting round-trip serialization where live `obj.fill !== source.style.fillColor` (e.g. `#1E40AF` vs `#5C2E16`).

5. **Presentation View Auto-Shrink Sync & Canvas Overflow Feedback (SPEC-19-05)**:
   - Document the mathematical relationship between 540px canvas and 405pt PPTX (`PX_TO_PT = 0.75`):
     - `405pt / 540px = 0.75 pt/px`.
     - A 50px font maps to 37.5pt in PPTX, maintaining identical physical screen/slide height ratio (9.259%).
     - Document that shrink-to-fit applies to both presentation view (`ArtifactSlide.tsx` via `largestFittingTextScale`) and PPTX export (`pptx-draw.ts` via `estimateTextFitScale`).
     - Clarify that element coordinates `x`/`y` never move; in-box scale and flex alignment alter visual text placement when text is shrunken.
   - Selected UX strategy: In `ArtifactEditor.tsx`, compute whether active text content exceeds its authored bounding box (`w` x `h`) at authored font size (e.g. 180px). When overflowing, display a subtle, non-blocking warning badge/hint in the properties toolbar:
     `⚠️ Text exceeds box bounds; presentation and PPTX will auto-shrink text to fit.`
   - Document this behavior concretely in `.how/registry/06-flows/canvas-authoring-controls.md`.

## Implementation Decisions

1. **Base UI Popper Alignment**:
   Configuring `alignItemWithTrigger={false}` anchors the popup menu strictly relative to the trigger button bounds, eliminating jarring popup displacement across varying item counts.
2. **Fabric `skipTargetFind` for Drawing Mode**:
   Using `canvas.skipTargetFind = true` and `canvas.hoverCursor = 'crosshair'` is Fabric.js's canonical mechanism for click-to-place and shape-drawing tools. It avoids mutating individual object `selectable`/`evented` flags.
3. **Live Serialization on Duplicate**:
   Cloning from the live Fabric object (styles, position, and dimensions) rather than the stale initial template state ensures WYSIWYG fidelity for in-progress edits before Save.
4. **Transparent Point-to-Pixel Ratio (0.75)**:
   Standardize and clarify documentation: 1 CSS canvas pixel = 0.75 PPTX points. Visual proportions remain 100% identical.
5. **Non-Blocking Overflow Hint**:
   Providing visual feedback rather than forced box mutation gives operators full control while removing surprise downscaling in live presentations.

## Out of Scope

1. Redesigning Base UI Select into a completely separate Combobox component (maintains standard Select with keyboard isolation).
2. Multi-point vector polygon drawing (retains rectangle shapes).
3. Disabling presentation view shrink-to-fit (shrink-to-fit is essential during live service to prevent song lyrics from overflowing the projector).

## Tickets & Dependencies

To satisfy WDI Method rule `parallel-tickets-blocked` (tickets sharing touches `['artifacts']` must not run concurrently without a dependency edge), tickets execute in serial order:

- **SPEC-19-01**: Searchable Font Dropdown Keyboard Isolation & Popper Positioning (`blocked_by: []`).
- **SPEC-19-02**: Live Element Duplication Styling & Geometry Fidelity (`blocked_by: ["SPEC-19-01"]`).
- **SPEC-19-03**: Canvas Placement Isolation During Add Element Tool Mode (`blocked_by: ["SPEC-19-02"]`).
- **SPEC-19-04**: Shape Fill Color & Opacity Serialization Persistence (`blocked_by: ["SPEC-19-03"]`).
- **SPEC-19-05**: Presentation View Auto-Shrink Sync & Canvas Overflow Feedback (`blocked_by: ["SPEC-19-04"]`).

## User Stories

1. As an operator searching for fonts, I want to type into the search box without keyboard shortcuts closing the menu, and see the dropdown open directly below the trigger.
2. As a slide designer, I want duplicating a customized text or shape element to retain all font, color, shadow, and size properties.
3. As an operator adding text over a background shape, I want my click to place the new text directly on top without accidentally selecting or dragging the shape underneath.
4. As an admin styling announcement slides, I want custom shape colors to persist permanently after clicking Save.
5. As a presenter, I want clarity on how text bounding boxes scale in live presentation view so my large title text appears as intended.

## Acceptance Criteria

1. Typing in the font search box filters fonts dynamically, spacebar does not select an option, and the dropdown anchors directly below the trigger.
2. Duplicating any styled text or shape creates an exact duplicate with matching font family, size, color, shadow blur, and fill color.
3. While the Add Text or Add Rectangle tool is active, hovering over existing shapes shows a crosshair and clicking places the new element on top.
4. Saving a slide with a custom shape fill color (e.g. blue or green) persists through save, page refresh, and PPTX export.
5. Technical documentation clearly explains the 0.75 pt/px PPTX conversion and presentation shrink-to-fit behavior.
6. All automated unit tests, regression suites, and smoke tests pass cleanly.
