# SPEC-31-03 — Artifact Editor Integration

**Status:** closed
**Blocked by:** 02

## What to build

In `src/components/admin/ArtifactEditor.tsx`, add the "Import PPTX" workflow and control for administrators.

1. **Toolbar Import Control**: Add an "Import PPTX" button in the Artifact Editor header alongside the template creation and kind controls, visible when viewing or editing authored templates.
2. **File Selection**: Clicking "Import PPTX" triggers an accessible hidden file input with `accept=".pptx"`.
3. **Upload & Progress State**:
   - On file selection, show loading/progress indicator and disable duplicate submissions.
   - Send `multipart/form-data` with `file` to `/api/admin/artifacts/import-pptx`.
4. **Success & Error Handling**:
   - On `201`, display a success toast (e.g. "Imported N slides successfully"), refresh the template list, select the first imported template, and ensure `isDirty: false` with the server's `updatedAt` token.
   - On error, display server error toast, leave existing editor state intact, and keep pre-import selection.

## Acceptance criteria

- Artifact Editor exposes "Import PPTX" button.
- Selecting a `.pptx` file uploads to `/api/admin/artifacts/import-pptx`.
- On success, template list reloads, first imported template is mounted cleanly with `isDirty: false`, and success toast appears.
- On failure, user is notified with error toast and current template is not lost or corrupted.
- UI prevents concurrent/duplicate uploads while an import is in flight.
