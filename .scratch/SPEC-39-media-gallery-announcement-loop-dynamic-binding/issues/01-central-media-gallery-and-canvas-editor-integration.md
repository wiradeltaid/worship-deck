# SPEC-39-01 — Central Media Gallery Bucket and Canvas Editor Integration

**What to build:**
Provide a central Media Gallery system for church visual assets (flyers, banners, logos, and background images) in Registry Admin, accompanied by categorized backend endpoints, and integrate an "Insert Image from Gallery" action and visual background picker into `ArtifactEditor.tsx` so operators can reuse images across slides by reference without duplicate file uploads.

**Blocked by:** None (can start immediately)

**Status:** open

- [ ] Extend server-side media library endpoints in `internal/httpapi/`:
  - Support category query filtering: `?category=flyer|background|all`.
  - Maintain 100% backward compatibility for existing background library calls.
  - Deletion lifecycle: delete database row metadata; retain physical upload files in `data/uploads/` to guarantee historical deck stability.
  - Safe missing file handling: if an image file is unreadable, return 404 cleanly without crashing.
- [ ] Implement Media Gallery panel in `src/components/admin/`:
  - Provide a visual thumbnail grid with image previews, category filter pills (`All`, `Flyers`, `Backgrounds`), asset upload, and delete confirmation.
  - Embed the Media Gallery as a primary tab in `RegistryAdmin.tsx`.
- [ ] Integrate Gallery Picker into `ArtifactEditor.tsx`:
  - Update Image tool in Toolbar Row 1: allow operators to either "Upload New Image" from local disk or "Choose from Gallery".
  - Insert image elements onto the canvas referencing the canonical gallery image URL without uploading duplicate files.
  - Enhance the slide background dialog to browse and select backgrounds from the gallery with instant visual feedback.
  - In `canvas-utils.ts` and `ArtifactSlide.tsx`: render a safe placeholder box if an image URL fails to load.
- [ ] Conformance & Smoke Tests:
  - Add tests in `tests/smoke-spec-39.test.mjs` verifying media library API responses, category filtering, canvas serialization with shared gallery asset URLs, and missing-asset graceful fallback.
  - Absence guard verifying that removing gallery URL serialization fails tests.
