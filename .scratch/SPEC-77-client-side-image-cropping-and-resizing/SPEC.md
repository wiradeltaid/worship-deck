# SPEC-77 — Client-Side Image Cropping and Resizing

## Problem Statement

When church operators and slide designers upload images across Worship Deck, photos taken from modern smartphones or cameras (frequently 12–24 megapixels, 4000x3000 resolution, and 10–25 MB in size) are uploaded directly in raw form without pre-crop or pre-scale adjustments:

1. **Canvas Insert & Background**: In the Canvas Artifact Editor (`/admin/artifacts`), operators uploading slide backgrounds often receive camera photos with unwanted borders or mismatched aspect ratios (e.g. 4:3 or portrait), having no way to frame the 16:9 panoramic area before upload. When inserting custom graphics, operators cannot crop out excess margins without leaving the application.
2. **Media Background Gallery**: In the background library (`/admin/backgrounds`), background assets uploaded by operators often need framing to the standard 16:9 projection aspect ratio.
3. **Predefined Service Fields (Family / Youth of the Week & Sermon Graphic)**: In the Service Form (`/services/{id}`), operators uploading photos for predefined fields such as "Family of the Week" or "Youth of the Week" (displayed in 1:1 square frames or avatars) must manually center and crop faces in third-party software, or suffer awkward off-center crops. Sermon graphics similarly benefit from an optional framing step.

Currently, uploading multi-megabyte uncropped camera photos also wastes server storage, bloats local SQLite databases and offline deck packages, and slows down slide rendering and PPTX export.

Operators need an optional, intuitive pre-upload cropping and resizing tool directly in the upload workflow across these four confirmed image entry points:
- (a) Canvas custom image insertion (`ArtifactEditor.tsx`)
- (b) Canvas background upload (`ArtifactEditor.tsx`)
- (c) Background gallery upload (`BackgroundLibraryPanel.tsx`)
- (d) Service predefined image fields (`ImageUploadField.tsx` / `DynamicFormBody.tsx`)

Other application areas are explicitly out of scope for this specification.

## Solution

1. **Architecture: Client-Side Canvas Processing (Pre-Upload Interceptor Modal)**:
   - Execute all cropping and resizing operations client-side in the browser using an HTML5 `<canvas>` before dispatching the file to `POST /api/upload`.
   - **Zero Backend Changes**: The existing Go API (`internal/httpapi/uploads.go`) continues receiving standard multipart image files (`/api/upload`) and saving to `/api/uploads/<hash>.<ext>`. No CGo, libvips, or backend image processing dependencies are introduced.
   - **Performance & Offline Reliability**: Client-side execution leverages local browser hardware acceleration, reducing large multi-megapixel camera uploads to sharp, dimensionally constrained assets before transmission, conserving local storage and keeping slide decks lightweight.

2. **Crop Engine Library: `react-easy-crop`**:
   - Install `react-easy-crop` (pinned to `^5.2.0`) as the UI cropper component.
   - Paradigm: Pan & Zoom Viewport (the crop frame stays stable while the operator drags and zooms the image underneath with mouse/touch/slider).
   - This provides the lowest error rate for non-designer church volunteers, especially for framing faces (Youth/Family 1:1) and scenery (16:9 backgrounds).
   - Zero locking peer dependencies in React 19; lightweight (~8 kB gzipped).
   - Lazy-loaded via dynamic import / `React.lazy` alongside the modal so it incurs zero overhead on initial bundle load.

3. **Reusable `ImageCropDialog` Component**:
   - Built on top of the repository's existing `@base-ui/react` dialog primitives (`src/components/ui/dialog.tsx`) and Tailwind v4.
   - **Aspect Ratio Presets**:
     - `16:9` (Slide Background / Standard)
     - `1:1` (Youth / Family / Avatar)
     - `4:3` (Legacy / Tablet)
     - `Freeform` (Unconstrained)
     - 16:9 is the default for background contexts, but the operator can freely select Freeform or other presets.
   - **Zoom Slider**: Fine-grained slider allowing 1x to 3x zoom with mouse wheel and touch-pinch support.
   - **Deterministic Resize Profiles**:
     - `Original Crop`: Native pixel resolution of the cropped rectangle (no downscaling).
     - `Max 1080p`: Bounded within 1920 × 1080 max bounding box while preserving aspect ratio. Default for backgrounds and general images.
     - `Max 800px`: Bounded within 800 × 800 max bounding box while preserving aspect ratio. Default for profile/avatar fields.
     - **No-Upscaling Invariant**: If source cropped dimensions are smaller than the profile limit, dimensions are never upscaled.
   - **Format, MIME & Transparency Policy**:
     - PNG inputs with transparency preserve alpha channel and export as `image/png` or `image/webp`.
     - Standard photographic inputs (JPEG) export as `image/jpeg` with quality `0.88`.
     - Output filename extension strictly matches the exported Blob MIME type (e.g. `cropped-<name>.png`, `cropped-<name>.jpg`).
   - **Object URL Ownership**: `ImageCropDialog` creates and strictly revokes preview object URLs upon cancel, completion, or component unmount.
   - **Action Buttons & Recovery**:
     - `Crop & Upload`: Executes canvas render, generates File, dispatches to `onComplete(file)`. Disabled during processing to prevent double-submits.
     - `Skip Crop`: Bypasses cropping and dispatches the original file directly.
     - `Cancel`: Closes dialog and resets input without uploading.
     - **Error Recovery**: If canvas processing or decoding fails, the dialog remains open with an error notice and keeps "Skip Crop / Upload Original" active so the operator is never blocked.

4. **Integration Points Across Confirmed Entry Points**:
   - **Point A (Canvas Insert Image)**: `ArtifactEditor.tsx` `insertImage` file picker opens `ImageCropDialog` (initial aspect: `Freeform`, default resize: `Max 1080p`).
   - **Point B (Canvas Background)**: `ArtifactEditor.tsx` `handleUploadBackgroundFile` opens `ImageCropDialog` (initial aspect: `16:9`, default resize: `Max 1080p`).
   - **Point C (Media Gallery Background)**: `BackgroundLibraryPanel.tsx` `uploadPickedFile` opens `ImageCropDialog` (initial aspect: `16:9`, default resize: `Max 1080p`).
   - **Point D (Service Predefined Fields)**: `ImageUploadField.tsx` accepts an explicit `cropConfig` prop:
     - For `family_of_the_week` and `youth_of_the_week`: `cropConfig={{ defaultAspect: 1, defaultResize: '800px' }}`.
     - For sermon graphic and other fields: `cropConfig={{ defaultAspect: null, defaultResize: '1080p' }}`.

5. **Automated Verification**:
   - `tests/image-crop-helper.test.mjs`: Mathematical unit tests for extracted pure calculation function `calculateTargetDimensions(source, crop, limits)` asserting correct bounds, aspect ratio preservation, and no-upscale behavior without requiring browser canvas mocks. Canvas export mocked for blob/MIME generation.
   - `tests/service-image-crop-integration.test.mjs`: Tests verifying `ImageUploadField.tsx` explicit `cropConfig` prop handling, modal trigger, and "Skip Crop" bypass.
   - `tests/canvas-media-crop-integration.test.mjs`: Tests verifying `ArtifactEditor.tsx` and `BackgroundLibraryPanel.tsx` modal wiring, 16:9 default preset, and "Skip Crop" bypass.

## User Stories

1. As a church volunteer uploading a Youth of the Week photo taken from a mobile phone, I want to easily center and zoom on their face in a 1:1 square frame before uploading, so that their avatar displays beautifully without awkward off-center cropping.
2. As a slide designer creating a 16:9 sermon background, I want an automatic 16:9 framing box when uploading a background image, so that I can capture the best panoramic part of the image without black bars.
3. As a church operator uploading an announcement flyer on a slow church Wi-Fi network, I want the pre-upload tool to resize the 15 MB phone photo to a sharp 1080p asset (~250 KB), so that the upload completes in seconds and the offline slide deck stays lightweight.
4. As an operator who already edited and cropped a graphic in external design software, I want a "Skip Crop" option to immediately upload the raw file as-is without any extra steps.
5. As an operator uploading a graphic that fails browser canvas decoding, I want the dialog to clearly show an error and offer an immediate "Upload Uncropped File" button so my work is never lost or blocked.
6. As a presenter operator, I want all cropped images to upload to the standard `/api/upload` endpoint, so that remote controls, projected screens, and PPTX exports render the exact same visual asset with zero sync divergence.
7. As a repository maintainer, I want automated unit and integration tests verifying canvas calculations, aspect ratios, and component wiring without breaking existing upload contracts.

## Implementation Decisions

- **Extracted Calculation Function (`calculateTargetDimensions`)**:
  ```ts
  export interface Dimensions {
    width: number;
    height: number;
  }
  export interface ResizeLimits {
    maxWidth?: number;
    maxHeight?: number;
  }
  export function calculateTargetDimensions(
    cropWidth: number,
    cropHeight: number,
    limits?: ResizeLimits
  ): Dimensions {
    let targetW = cropWidth;
    let targetH = cropHeight;
    const maxW = limits?.maxWidth;
    const maxH = limits?.maxHeight;
    if (maxW && targetW > maxW) {
      const scale = maxW / targetW;
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
    }
    if (maxH && targetH > maxH) {
      const scale = maxH / targetH;
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
    }
    return { width: targetW, height: targetH };
  }
  ```
  Pure function, completely decoupled from DOM or canvas, ensuring 100% testability in Node.js test runner.
- **Client-Side Canvas Processing (`getCroppedImg`)**:
  Takes image element/URL, pixel crop area, and options, draws via `ctx.drawImage` with `imageSmoothingQuality = 'high'`, exports via `canvas.toBlob`, and produces a `File` with matching extension.
- **Explicit `cropConfig` Prop on `ImageUploadField`**:
  ```ts
  export interface CropConfig {
    defaultAspect?: number | null;
    defaultResize?: 'original' | '1080p' | '800px';
  }
  ```
  Eliminates fragile regex matching on presentation labels.
- **Dependency Pinning**:
  `react-easy-crop`: `^5.2.0` in `package.json`.
- **Fail-Safe & Skip Crop**:
  The dialog explicitly includes "Skip Crop" so the operator can always bypass the modal and send the raw file.

## Testing Decisions

- Author `tests/image-crop-helper.test.mjs`:
  - Unit test `calculateTargetDimensions` across all boundary conditions:
    - 4000x3000 crop under Max 1080p -> 1440x1080 (aspect preserved, fits in 1920x1080).
    - 3840x2160 crop under Max 1080p -> 1920x1080.
    - 600x600 crop under Max 800px -> 600x600 (no upscaling).
    - Zero/invalid limits return unconstrained crop dimensions.
  - Test MIME type and extension mapping: `image/png` -> `.png`, `image/jpeg` -> `.jpg`.
- Author `tests/service-image-crop-integration.test.mjs`:
  - Verify `ImageUploadField.tsx` accepts `cropConfig` prop and renders `ImageCropDialog`.
  - Verify that Family/Youth fields in `DynamicFormBody.tsx` supply `defaultAspect: 1`.
  - Verify "Skip Crop" passes original uncropped file directly to upload handler.
- Author `tests/canvas-media-crop-integration.test.mjs`:
  - Verify `ArtifactEditor.tsx` attaches `ImageCropDialog` to image insertion and background upload handlers.
  - Verify `BackgroundLibraryPanel.tsx` attaches `ImageCropDialog` to media library file picker.
  - Verify 16:9 default preset for background contexts with Freeform switchability.
- Additively wire tests into `package.json` preserving `--test-concurrency=1`.
