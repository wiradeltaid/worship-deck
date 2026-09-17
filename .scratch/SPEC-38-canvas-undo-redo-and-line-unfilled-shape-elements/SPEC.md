# SPEC-38 — Canvas Session Undo / Redo History and Line & Unfilled Shape Elements

> **Status:** open
> **Release:** canvas-undo-redo-and-line-unfilled-shape-elements
> **Component:** registry, presenter, pptx
> **Touches:** artifacts, pptx
> **Depends on:** SPEC-37

## Problem Statement

Operators and church administrators designing slide templates in Artifact Editor currently face two creative and operational limitations:

1. **No Undo/Redo Recovery during Slide Editing:**
   When adjusting element layouts, moving text boxes, or tweaking colors and typography, any mistaken movement, accidental deletion, or unwanted style change cannot be undone. Operators must either manually reconstruct the previous state or discard all unsaved edits via "Discard Changes", losing all intermediate progress. Furthermore, there are no visual indicators or keyboard shortcuts for undo and redo history.

2. **Limited Element Primitives (Absence of Line and Outline Shapes):**
   The slide canvas only supports text boxes, filled shapes (solid background rectangle), and pictures. Operators frequently need divider lines (e.g. separating scripture verses from references, or header titles from body text) and bordered/unfilled shapes (e.g. frames or decorative container outlines without a solid fill that obscures background graphics). Currently, creating an outline requires workarounds or importing static image assets, which bloat storage and cannot be styled or resized dynamically.

## Solution

1. **Session-Scoped Undo and Redo History Stack:**
   Provide robust, discrete undo and redo stacks in `ArtifactEditor.tsx`:
   - Every layout-altering user action (element insertion, deletion, duplicate, geometry transform/move, text content commit, style property adjustment, layer reordering, and background changes) pushes a complete state snapshot onto an in-memory undo stack.
   - Dedicated toolbar buttons for Undo (Lucide `Undo2`) and Redo (Lucide `Redo2`) reflect real-time history availability: disabled when their respective stacks are empty, and enabled when actions are available.
   - Standard keyboard shortcuts (`Ctrl+Z` / `Cmd+Z` for Undo, `Ctrl+Y` / `Ctrl+Shift+Z` / `Cmd+Shift+Z` for Redo) work seamlessly, guarded against native text input (`<input>`, `<textarea>`) and Fabric active text edit mode (`(obj as any).isEditing`).
   - **Slide & Reset Boundary Isolation:** Whenever the operator switches to another slide (in Deck Sequence, Song Sets, or Announcement Sets), loads a new template, or triggers `handleReset` ("Discard Changes"), the undo and redo stacks are immediately cleared, preventing cross-slide or post-discard history corruption.
   - **Restoration Guarding:** An `isRestoringHistoryRef` flag suppresses canvas mutation listeners (`object:modified`, `object:added`, `object:removed`) during snapshot restoration, preventing infinite history recording loops and unintended dirty-state thrashing.

2. **Line and Unfilled (Outline) Shape Elements with 100% Multi-Surface Parity:**
   Introduce two new first-class visual element capabilities:
   - **`line`**: A horizontal or vector divider line with customizable line color (`strokeColor`) and thickness (`strokeWidth`).
   - **`shape` (unfilled / outline)**: A rectangular container with transparent fill, customizable outline color (`strokeColor`), and outline thickness (`strokeWidth`).
   - Add dedicated toolbar creation tools (drag-to-draw rubberband and click-to-insert cascade).
   - Provide comprehensive element property panel controls for line color/thickness and shape outline color/thickness.
   - Full right-click context menu support (Bring to Front, Bring Forward, Send Backward, Send to Back, Duplicate, Delete) with `perPixelTargetFind: false` ensuring transparent shape centers and thin lines remain readily clickable.
   - Unified stroke-width unit conversion across coordinate spaces: 960×540 Fabric canvas pixels, CSS responsive scaling in Presenter view (`ArtifactSlide.tsx`), and typographic points ($strokeWidth \times 0.75\text{ pt}$) with opacity transparency in PPTX export (`src/lib/pptx-draw.ts`).

## User Stories

1. As a church administrator, I want to click an Undo button or press `Ctrl+Z` after accidentally dragging or resizing an element, so that the element immediately returns to its prior position and size.
2. As a church administrator, I want to click a Redo button or press `Ctrl+Y` / `Ctrl+Shift+Z` after undoing an action, so that I can re-apply the change without having to recreate it manually.
3. As a church administrator, I want the Undo button to be visibly disabled when there are no previous actions to revert, so that I clearly know when I have reached the initial state.
4. As a church administrator, I want the Redo button to be visibly disabled when no undone actions exist, so that I do not attempt to redo past the frontier of changes.
5. As a church administrator, I want the undo and redo history stacks to reset automatically when I switch to a different slide in the sidebar or click "Discard Changes", so that undo operations from one slide never corrupt another slide or resurrect discarded edits.
6. As a church administrator, I want keyboard shortcuts for undo/redo to be disabled while I am typing inside text input fields or actively editing text within a textbox, so that native text cursor operations are not hijacked.
7. As a church administrator, I want to add a `line` element to a slide from the toolbar, so that I can visually separate sections such as worship titles, sermon themes, and scripture references.
8. As a church administrator, I want to customize a line's thickness and color from the element properties panel, so that it matches our church branding and slide aesthetics.
9. As a church administrator, I want to add an unfilled (outline) shape element from the toolbar, so that I can place clean decorative border frames around text boxes without blocking background pictures.
10. As a church administrator, I want to adjust an outline shape's stroke thickness and color in the properties panel, so that the border looks crisp and proportionate.
11. As a church administrator, I want to click anywhere inside a transparent outline shape or on a thin line to select it and right-click it for layer ordering (Bring Forward, Send Backward, Bring to Front, Send to Back), duplicate, or delete.
12. As a church administrator, I want line and outline shape elements to save cleanly to the database without schema validation errors, so that my template designs persist permanently.
13. As a church operator, I want line and outline shape elements to scale responsively and render identically on the live projection screen (`ArtifactSlide.tsx`), so that the congregation sees the exact layout designed in the editor regardless of screen resolution.
14. As a church operator, I want line and outline shape elements to export as native PowerPoint vector shapes with accurate line point thickness and opacity in PPTX downloads, so that offline presentations preserve 100% visual fidelity in Microsoft PowerPoint.

## Implementation Decisions

1. **Session-Scoped Undo/Redo Engine in `ArtifactEditor.tsx`**:
   - Snapshot model captures full mutable canvas state:
     ```ts
     type CanvasHistorySnapshot = {
       elements: CanvasElement[];
       addedElements: Map<string, CanvasElement>;
       addedPlaceholders: Map<string, PlaceholderDefinition>;
       backgroundColor: string;
       backgroundImage?: string;
       isDirty: boolean;
     };
     ```
   - Pre-mutation capture discipline:
     - On transform start (`mouse:down` on canvas target or `before:transform`), record the baseline state if not already captured, so that `object:modified` captures the transition from pre-transform to post-transform.
     - On discrete actions (insert, delete, duplicate, layer reorder, background change, property commit), push current baseline to `undoStackRef.current` and empty `redoStackRef.current`.
   - Re-hydration and loop suppression:
     - When executing `handleUndo()` or `handleRedo()`, set `isRestoringHistoryRef.current = true`.
     - Re-apply snapshot elements into `addedElementsRef.current`, `addedPlaceholdersRef.current`, `setLiveElements`, and update Fabric canvas objects via `elementToFabricObject`.
     - Finally, reset `isRestoringHistoryRef.current = false` after `canvas.requestRenderAll()`.
   - Keyboard listener guards:
     - Intercept `Ctrl+Z` / `Cmd+Z` and `Ctrl+Y` / `Ctrl+Shift+Z` / `Cmd+Shift+Z` on window keydown.
     - Check:
       ```ts
       const activeTag = (document.activeElement?.tagName || '').toLowerCase();
       const isInputFocused = activeTag === 'input' || activeTag === 'textarea';
       const isFabricEditing = fabricCanvasRef.current?.getActiveObjects().some((o) => (o as any).isEditing);
       if (isInputFocused || isFabricEditing) return;
       ```
   - Stack boundary resets:
     - Clear `undoStack` and `redoStack` in:
       1. Slide switch / template load (`selectedId` change)
       2. Discard changes (`handleReset`)
       3. Post-save reconciliation (saving updates the baseline; undo stack can either clear or mark `isDirty` relative to saved baseline).

2. **Line Geometry Contract & Schema Validation**:
   - In `src/lib/registry/types.ts`:
     - Add `'line'` to `CanvasElementType`:
       ```ts
       export type CanvasElementType = 'text' | 'image' | 'image-placeholder' | 'shape' | 'line';
       ```
     - Add stroke properties to `ShapeStyle`:
       ```ts
       export type ShapeStyle = {
         fillColor?: string;
         strokeColor?: string;
         strokeWidth?: number;
         opacity?: number;
       };
       ```
   - In `src/lib/artifacts/runtime-contract.ts`:
     - Add `strokeColor?: string; strokeWidth?: number;` to `ResolvedStyle`.
   - In `internal/plan/validate_artifact.go` and `src/lib/registry/validate.ts`:
     - Add `'strokeColor'` and `'strokeWidth'` to `allowedStyleKeys`.
     - In `parseElement`: allow `typ == "line"`.
     - **Line geometry validation rule**: For `typ == "line"`, require `w > 0` and `h >= 0` (where `h == 0` denotes a pure horizontal line across width `w`, or `h > 0` denotes height of line bounding box). For `text`, `shape`, `image`, retain strict `h > 0`.
     - In `parseStyle`: validate `strokeColor` against `hexColor` regex (or empty/none) and `strokeWidth` as positive finite number (1..50 px).

3. **Fabric Canvas Interaction & Shared Serialization**:
   - In `src/lib/registry/canvas-utils.ts`:
     - In `elementToFabricObject`:
       - If `element.type === 'line'`: construct `fabric.Line([0, 0, widthPx, heightPx], { stroke: strokeColor || '#FFFFFF', strokeWidth: strokeWidthPx || 2, strokeLineCap: 'round', selectable: true, evented: true, perPixelTargetFind: false })`.
       - If `element.type === 'shape'`: if `style.fillColor === 'transparent'` or `!style.fillColor`, construct `fabric.Rect({ fill: 'transparent', stroke: strokeColor || '#FFFFFF', strokeWidth: strokeWidthPx || 2, selectable: true, evented: true, perPixelTargetFind: false })`.
     - In `serializeCanvas`:
       - Persist `strokeColor` and `strokeWidth` for both `type: 'shape'` and `type: 'line'`.
       - Persist `fillColor` as `'transparent'` (or omit) for unfilled shapes.
   - In `ArtifactEditor.tsx`:
     - Expand `drawingTool` state: `'text' | 'rect' | 'line' | 'rect-outline' | null`.
     - Add Toolbar Row 1 buttons:
       - Line tool (`Minus` icon, title "Line")
       - Outline Shape tool (`Square` outline icon, title "Outline Shape")
       - Undo button (`Undo2` icon, `disabled={!canUndo}`)
       - Redo button (`Redo2` icon, `disabled={!canRedo}`)
     - Update `handleDuplicateSelected` to support duplicating `line` and outline `shape` elements with full style preservation.

4. **Inspector Controls & Context Menu**:
   - In Toolbar Row 2 (Element Properties):
     - When a `line` is selected: display `LINE` badge, Line Color picker (`strokeColor`), and Thickness input/slider (`strokeWidth` 1..20 px).
     - When an unfilled outline shape is selected: display `SHAPE (OUTLINE)` badge, Outline Color picker (`strokeColor`), Outline Thickness (`strokeWidth` 1..20 px), and Opacity slider.
   - Context Menu (`handleContextMenuTrigger`):
     - Ensure right-clicking directly on a line or anywhere inside an unfilled shape selects the object and triggers context menu actions: Bring Forward, Send Backward, Bring to Front, Send to Back, Duplicate, Delete.

5. **Presenter & PPTX Export Parity with Shared Unit Conversion**:
   - In `src/lib/artifacts/render-model.ts`:
     - Add unified stroke conversion helper:
       ```ts
       export function toPptxStrokeWidth(strokeWidthPx: number = 2): number {
         return Number((strokeWidthPx * 0.75).toFixed(2));
       }
       ```
   - In `src/components/artifacts/ArtifactSlide.tsx`:
     - Render `line` elements using SVG `<line x1="0" y1="50%" x2="100%" y2="50%" />` within an absolute container scaled by container geometry, or responsive border.
     - Render unfilled `shape` elements with `border: `${strokeWidthCss} solid ${strokeColor}`` and `backgroundColor: fillColor || 'transparent'`.
   - In `src/lib/pptx-draw.ts`:
     - For `line`: add PPTX native line shape (`pptx.shapes.LINE`) with `{ line: { color: strokeColor, width: toPptxStrokeWidth(strokeWidth), transparency: outlineTransparency } }`.
     - For `shape`: add PPTX rectangle shape (`pptx.shapes.RECTANGLE`) with `{ fill: fillColor && fillColor !== 'transparent' ? { color: fillColor } : { type: 'none' }, line: strokeColor ? { color: strokeColor, width: toPptxStrokeWidth(strokeWidth), transparency: outlineTransparency } : undefined }`.

## Testing Decisions

1. **Undo / Redo Tests (`tests/smoke-spec-38.test.mjs`)**:
   - Test snapshot creation and undo/redo transitions for element addition, movement, property edit, and deletion.
   - Test disabled button states (`canUndo === false` at initial baseline, `canRedo === false` at tip).
   - Test slide change and `handleReset` clearing both undo and redo stacks.
   - Test keyboard shortcut listener suppression while in text input or Fabric text edit mode.

2. **Line & Unfilled Shape Tests (`tests/smoke-spec-38.test.mjs`)**:
   - Validate TypeScript and Go schema acceptance for `line` (including `h: 0`), `strokeColor`, and `strokeWidth`.
   - Validate rejection of negative stroke width or invalid hex colors.
   - Assert `elementToFabricObject` builds proper line and outline rect objects with `perPixelTargetFind: false`.
   - Assert `serializeCanvas` retains `strokeColor` and `strokeWidth`.
   - Assert `ArtifactSlide.tsx` and `pptx-draw.ts` emit corresponding SVG/CSS and PPTX DrawingML without errors.
   - Absence guard with defect injection verifying that removing `line` or `strokeWidth` validation fails tests.

## Out of Scope

- Curved Bezier pen tool drawing (freehand lines) — lines are rectilinear geometric dividers.
- Multi-slide global undo (undoing across slide switches) — undo/redo is strictly isolated to the active slide editing session as specified by the owner.
- Complex polygon / multi-point shapes (stars, triangles, arrows) — geometric shapes remain rectangular outlines and straight divider lines.

## Further Notes

- The default stroke width for new lines and outlines is 2px, and default stroke color `#FFFFFF` (or matching theme contrast).
- Hit-testing for outline rectangles uses `perPixelTargetFind: false` so operators can click anywhere inside the bounding box to select it.
