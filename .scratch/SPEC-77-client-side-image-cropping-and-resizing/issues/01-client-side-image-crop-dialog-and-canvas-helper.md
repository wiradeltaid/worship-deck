# 01: Client-Side Image Crop Dialog and Canvas Helper (WSD-W1)

**What to build:** Add `react-easy-crop` dependency (pinned to `^5.2.0`) and author client-side crop and resize engine `lib/images/crop-image.ts` along with a reusable, lazy-loadable modal component `components/media/ImageCropDialog.tsx`. Extract pure calculation function `calculateTargetDimensions(cropWidth, cropHeight, limits)` ensuring mathematical scaling without upscaling. Implement `getCroppedImg(imageSrc, pixelCrop, options)` using HTML5 `<canvas>` to draw the cropped region, scale within specified maximum bounds (`Max 1080p`, `Max 800px`, or `Original`) with `imageSmoothingQuality = 'high'`, preserve PNG transparency, map extension to exported MIME type, and return a `File` ready for `POST /api/upload`. The `ImageCropDialog` modal (built with `@base-ui/react` dialog and Tailwind v4) provides an interactive Pan & Zoom viewport, aspect ratio selector (16:9, 1:1, 4:3, Freeform), zoom slider (1x–3x), resize profile selector, "Crop & Upload" action with double-submit prevention, "Skip Crop" action (passes raw file directly), "Cancel" action, and clear failure recovery offering raw file upload if canvas processing fails. `ImageCropDialog` strictly manages and revokes object URLs. Author `tests/image-crop-helper.test.mjs` verifying pure dimension math, no-upscale behavior, and MIME/extension mapping, and wire additively into `package.json` preserving `--test-concurrency=1`.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `package.json` and `src/components/ui/dialog.tsx` first.
- [x] Add `react-easy-crop: "^5.2.0"` dependency to `package.json`.
- [x] Author `lib/images/crop-image.ts` (under `src/lib/images/`):
      - Implement and export pure function `calculateTargetDimensions(cropWidth: number, cropHeight: number, limits?: ResizeLimits): Dimensions`.
      - Implement `getCroppedImg(imageSrc: string, pixelCrop: CropArea, options?: ResizeOptions): Promise<File>`.
      - Preserve PNG alpha channel when exporting transparent PNGs (`image/png` or `image/webp`).
      - Export JPEGs with quality `0.88`.
      - Ensure exported filename extension matches the Blob MIME type (`cropped-<name>.jpg`, `cropped-<name>.png`).
- [x] Author `components/media/ImageCropDialog.tsx` (under `src/components/media/`):
      - Implement interactive dialog with `Cropper` from `react-easy-crop`.
      - Provide segmented aspect ratio controls: `16:9` (Slide), `1:1` (Avatar), `4:3` (Standard), and `null` (Freeform).
      - Provide zoom slider with fine step control (1x to 3x).
      - Provide resize profile selector (`Original`, `Max 1080p`, `Max 800px`).
      - Provide "Crop & Apply" button (triggers `getCroppedImg`, disabled while busy).
      - Provide "Skip Crop" button (passes original `File` directly without canvas execution).
      - Provide "Cancel" button (aborts and closes).
      - Manage and revoke object URLs on cancel, completion, and unmount.
      - Error recovery: if canvas processing throws or `toBlob()` returns null, show an error banner while keeping "Skip Crop / Upload As-Is" active.
- [x] Author `tests/image-crop-helper.test.mjs`:
      - Unit test `calculateTargetDimensions` across all boundary conditions: 4000x3000 to 16:9 (1440x1080), 3840x2160 to Max 1080p (1920x1080), 600x600 under Max 800px (no upscaling, stays 600x600).
      - Unit test MIME type and extension mapping.
- [x] Wire `node --import ./tests/register-ts-resolve.mjs --test tests/image-crop-helper.test.mjs` into `package.json` test script additively preserving `--test-concurrency=1`.
- [x] Run test suite and `npm run typecheck` to verify 100% green execution.
