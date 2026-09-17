# SPEC-38-02 — Line & Unfilled Shape Elements, Schema Validation, and Property Inspector

**What to build:**
Introduce first-class `line` and unfilled (outline) `shape` elements into the canvas authoring workflow, with updated schema validation in Go and TypeScript, toolbar creation tools, interactive Fabric canvas rendering, context menu support, and property panel controls for stroke color and thickness.

**Blocked by:** 01-canvas-session-undo-redo-history-and-controls

**Status:** ready-for-agent

- [ ] Extend data models and types:
  - In `src/lib/registry/types.ts`:
    - Add `'line'` to `CanvasElementType`: `'text' | 'image' | 'image-placeholder' | 'shape' | 'line'`.
    - Add `strokeColor?: string` and `strokeWidth?: number` to `ShapeStyle`.
  - In `src/lib/artifacts/runtime-contract.ts`:
    - Add `strokeColor?: string` and `strokeWidth?: number` to `ResolvedStyle`.
- [ ] Extend server and client validation:
  - In `internal/plan/validate_artifact.go` and `src/lib/registry/validate.ts`:
    - Add `'strokeColor'` and `'strokeWidth'` to `allowedStyleKeys`.
    - Allow `typ == "line"` in `parseElement`.
    - **Line geometry validation rule:** For `typ == "line"`, validate `w > 0` and `h >= 0` (allowing `h == 0` for horizontal lines, and `h > 0` for bounding boxes). For `text`, `shape`, `image`, retain strictly positive `h > 0`.
    - Validate `strokeColor` as valid hex color format.
    - Validate `strokeWidth` as positive finite number (1..50 px).
- [ ] Fabric.js rendering and shared serialization in `src/lib/registry/canvas-utils.ts`:
  - In `elementToFabricObject`:
    - Construct `fabric.Line` for `line` elements (`[0, 0, widthPx, heightPx]`) with `stroke: strokeColor || '#FFFFFF'` and `strokeWidth: strokeWidthPx || 2`, setting `perPixelTargetFind: false`.
    - Construct `fabric.Rect` for unfilled shapes with `fill: 'transparent'`, `stroke: strokeColor || '#FFFFFF'`, and `strokeWidth: strokeWidthPx || 2`, setting `perPixelTargetFind: false`.
  - In `serializeCanvas`:
    - Persist `strokeColor` and `strokeWidth` for both `type: 'shape'` and `type: 'line'`.
    - Persist `fillColor` as `'transparent'` (or omit) for unfilled shapes.
- [ ] Toolbar creation tools in `ArtifactEditor.tsx`:
  - Expand `drawingTool` state to support `'line'` and `'rect-outline'`.
  - Add "Line" button with `Minus` icon in Toolbar Row 1.
  - Add "Outline Shape" button with outline `Square` icon in Toolbar Row 1.
  - Support drag-to-draw rubberband preview and click-to-insert with cascade offset.
- [ ] Right-click context menu and duplicate parity:
  - Ensure right-clicking on lines or anywhere inside transparent outline shapes triggers `handleContextMenuTrigger`.
  - Support Bring Forward, Send Backward, Bring to Front, Send to Back, Duplicate, and Delete.
  - Update `handleDuplicateSelected` to support duplicating `line` and outline `shape` elements while preserving stroke attributes.
- [ ] Element properties inspector (Toolbar Row 2):
  - When `line` is selected: display `LINE` badge, Line Color picker (`strokeColor`), and Thickness input/slider (`strokeWidth`).
  - When unfilled shape is selected: display `SHAPE (OUTLINE)` badge, Outline Color picker (`strokeColor`), Outline Thickness (`strokeWidth`), and Opacity.
- [ ] Add unit tests in `tests/smoke-spec-38.test.mjs` verifying TypeScript and Go schema acceptance/rejection (testing valid values, `h: 0` for lines, and rejecting invalid negative stroke widths), and verifying selection hit-testing for thin lines and transparent center of outline shapes.
