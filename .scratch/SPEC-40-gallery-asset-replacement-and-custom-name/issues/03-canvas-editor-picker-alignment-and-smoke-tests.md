# SPEC-40-03 — Canvas Editor Picker Alignment and End-to-End Smoke Tests

**What to build:**
Reconcile category filters and custom name display in `ArtifactEditor.tsx`'s "Choose from Gallery" dialog (`General`, `Background`, `Announcement`), and author comprehensive end-to-end smoke tests verifying in-place asset replacement, category migration, custom name editing, atomicity, and cache revalidation.

**Blocked by:** 02-gallery-input-ergonomics-category-badging-and-replace-ui

**Status:** ready-for-agent

- [ ] Align Gallery Picker in Canvas Editor (`src/components/admin/ArtifactEditor.tsx`):
  - Update `galleryCategoryFilter` options from `['all', 'flyer', 'background', 'general']` to `['all', 'general', 'background', 'announcement']`.
  - Update category filter tab buttons to display "General", "Background", "Announcement".
  - Render asset custom `name` (with fallback to `Media #<id>`) in the gallery picker thumbnail grid so slide authors can visually identify assets by their custom title.
- [ ] End-to-End Conformance & Smoke Tests (`tests/smoke-spec-40.test.mjs`):
  - **Category Reconciliation Test:** Ensure `'announcement'` is returned by `GET /api/admin/media-library` and incoming `'flyer'` payloads are normalized to `'announcement'`.
  - **Custom Name Persistence Test:** Verify creating and patching media items persists `name` in DB and returns it in JSON; verify unsupplied name stores `""` and falls back to `Media #<id>` in UI.
  - **In-Place Image Replacement Invariant Test:**
    - Create a test image in the gallery (`id: X`, `url: /api/uploads/<hash>.png`).
    - Bind an artifact template slide image element to `url: /api/uploads/<hash>.png`.
    - Upload replacement image bytes via `POST /api/admin/media-library/X/replace` with valid `updatedAt`.
    - Assert that record `id` and `url` path remain 100% byte-for-byte identical.
    - Assert that the slide template payload remains completely unmodified, yet fetching `/api/uploads/<hash>.png` returns the new image bytes.
    - Assert that `Cache-Control` header returns `no-cache, must-revalidate`.
  - **Atomic Failure & Concurrency Test:**
    - Test that an invalid upload or corrupt payload fails safely and leaves original image file bytes untouched on disk.
    - Test that submitting a stale `updatedAt` on replace returns `409 Conflict`.
  - **Absence Guard:**
    - Inject negative-control mutation (e.g. disabling in-place atomic rename or omitting category normalization) and verify test suite fails, then restore.
