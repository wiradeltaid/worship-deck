# 03: Integrate Crop into Canvas and Background Gallery (WSD-W3)

**What to build:** In `src/components/admin/ArtifactEditor.tsx` and `src/components/admin/BackgroundLibraryPanel.tsx`, integrate `ImageCropDialog` into the image upload and background insertion flows. In `ArtifactEditor.tsx`, intercept custom image insertion (`insertImage`) with default `Freeform` crop and background upload (`handleUploadBackgroundFile`) with default `16:9` crop (with switchability to Freeform). In `BackgroundLibraryPanel.tsx`, intercept media library background upload (`uploadPickedFile`) with default `16:9` crop and `Max 1080p` resize profile. In all surfaces, provide "Skip Crop" to allow direct raw uploads, and dispatch cropped/resized files to `uploadImageFile(file)` without altering backend contracts. Author `tests/canvas-media-crop-integration.test.mjs` verifying modal wiring across canvas image insert, canvas background, and media gallery background, and wire additively into `package.json` preserving `--test-concurrency=1`.

**Blocked by:** `SPEC-77-01` (Client-Side Image Crop Dialog and Canvas Helper).

**Status:** closed

- [x] Read `src/components/admin/ArtifactEditor.tsx`, `src/components/admin/BackgroundLibraryPanel.tsx`, and the ImageCropDialog component first.
- [x] In `src/components/admin/ArtifactEditor.tsx`:
      - Intercept file input for "Insert Image": open `ImageCropDialog` with initial aspect `null` (Freeform) and resize `Max 1080p`.
      - Intercept file input for "Upload Background": open `ImageCropDialog` with initial aspect `16 / 9` and resize `Max 1080p`.
      - On crop complete (or skip crop): pass resulting `File` to `uploadImageFile`, add image element to canvas or update background URL, and close dialog.
- [x] In `src/components/admin/BackgroundLibraryPanel.tsx`:
      - Intercept file picker change: open `ImageCropDialog` with initial aspect `16 / 9` and resize `Max 1080p`.
      - On crop complete (or skip crop): upload file to `/api/upload`, add to media library, and close dialog.
- [x] Author `tests/canvas-media-crop-integration.test.mjs`:
      - Verify `ArtifactEditor.tsx` wires `ImageCropDialog` to image insertion and background upload handlers.
      - Verify `BackgroundLibraryPanel.tsx` wires `ImageCropDialog` to media library file picker.
      - Verify 16:9 initial aspect ratio for background contexts with Freeform switchability.
      - Verify "Skip Crop" bypasses crop processing.
- [x] Wire `node --import ./tests/register-ts-resolve.mjs --test tests/canvas-media-crop-integration.test.mjs` into `package.json` test script additively preserving `--test-concurrency=1`.
- [x] Run test suite and `npm run typecheck` to verify 100% green execution.
