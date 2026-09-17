# Issue 02 — Canvas Engine Modernization: Textbox, Image, and Background

**Status:** done

## Summary
Satisfies UC-14 (FR-20, FR-30, AD-38). Modernize the Fabric.js canvas editor in `src/components/admin/ArtifactEditor.tsx`:
1. Use `fabric.Textbox` instead of `fabric.FabricText` to support native double-click inline text editing, font styling, and word wrapping without external textareas.
2. Render image elements using real visual images (`fabric.FabricImage`) instead of gray placeholder rectangles.
3. Add a direct "Change Background" trigger to the canvas workspace.

## Implementation Details
- In `src/components/admin/ArtifactEditor.tsx`, replace `fabric.FabricText` with `fabric.Textbox`.
- In `elementToFabricObject`, load images via `fabric.FabricImage.fromURL(...)` for `element.type === 'image'`.
- Add background selection callback and canvas layer refresh.

## Tests
- `tests/canvas-dirty-guard.test.mjs`
- `tests/artifact-preview.test.mjs`
