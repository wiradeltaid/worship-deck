# SPEC-80 — Image Crop Aspect Ratio Presets and Original/Custom Aspect Handling

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Use Cases**: `UC-14` (Template layout & image customization in Canvas Artifacts), `UC-1` (Service Form image intake)
- **Functional Requirements**: `FR-1` (Canvas artifact design & image embedding), `FR-2` (Service predefined fields intake)

## Problem Statement

During hand-testing of the client-side image cropping tool (`ImageCropDialog.tsx` introduced in SPEC-77), usability defects and typographical gaps were identified:

1. **Misleading "Freeform" Behavior & The 4:3 Fallback Bug**:
   - In `src/components/media/ImageCropDialog.tsx`, selecting the "Freeform" preset set `selectedAspect = null`.
   - The dialog passed `aspect={selectedAspect ?? undefined}` to `Cropper` from `react-easy-crop`.
   - Because `react-easy-crop` internally defines `defaultProps = { aspect: 4 / 3 }`, passing `undefined` caused the library to silently fall back to an enforced **4:3 aspect ratio**.
   - Furthermore, `react-easy-crop` operates strictly under the **Pan & Zoom Viewport** paradigm (the crop window is fixed in the center, and the operator drags/pans and zooms the image underneath it). It does not provide interactive corner or edge drag handles to stretch or reshape the crop box on screen.
   - The label "Freeform" led operators to search for non-existent corner resize handles ("gak ada cara memperbesar handler area cropnya - bagaimana cara pakainya").

2. **Missing Common Church Presentation & Publication Ratios**:
   - Church slide design and service preparation involve materials beyond standard 16:9 widescreen, 4:3 legacy, and 1:1 avatars:
     - **3:4**: Portrait presentations, vertical lyrics, and tablet displays.
     - **2:3**: Standard church hymnal, songbook, and novel book covers (or standard 4×6 photo prints).
     - **9:16**: Vertical smartphone screen, Instagram Stories, and mobile announcement banners.
     - **A4 (1:1.414 / 210:297)**: Church bulletin inserts, printable program flyers, and order of service documents.
     - **Original / Asli**: The unconstrained native proportions of the uploaded image (`naturalWidth / naturalHeight`), enabling the operator to pan and zoom within the picture's true aspect ratio without forced cropping.
     - **Custom Ratio**: Ability to specify an arbitrary W:H ratio for non-standard slide frames.

## Solution

1. **Expanded Aspect Ratio Presets**:
   - Update `ASPECT_RATIO_PRESETS` in `src/components/media/ImageCropDialog.tsx` with clear, organized categories:
     - `Original` (`naturalWidth / naturalHeight`): Matches the source image's exact dimensions, ensuring zero forced cropping.
     - `16:9` (`16 / 9`): Slide Widescreen / Background.
     - `4:3` (`4 / 3`): Standard Presentation.
     - `1:1` (`1`): Square / Avatar / Profile.
     - `3:4` (`3 / 4`): Portrait Tablet / Slide Vertikal.
     - `2:3` (`2 / 3`): Book Cover / Novel / 4×6 Photo.
     - `9:16` (`9 / 16`): Vertical Mobile / Story / Banner.
     - `A4` (`210 / 297` ≈ `0.707`): Flyer / Dokumen Cetak.
     - `Custom`: Interactive W:H ratio input.

2. **Backward-Compatibility & Migration Contract for `null` Callers**:
   - Callers passing `defaultAspect: null` (such as `ArtifactEditor.tsx` image insertion and `DynamicFormBody.tsx` general image fields) explicitly map to the **Original Ratio** preset (`'original'`).
   - The crop frame opens matching the uploaded image's exact source proportions (`naturalWidth / naturalHeight`), eliminating the legacy silent 4:3 crop box.
   - **Distinction between Aspect "Original" and Resize "Original"**:
     - **Aspect "Original Ratio"**: The crop window adopts the source image's aspect ratio. "Crop & Upload" renders and encodes the cropped/scaled canvas. To bypass all canvas processing and preserve the raw file bit-for-bit, operators use **"Skip Crop"**.
     - **Resize "Original Size"**: Bypasses max bounding-box downscaling (no 1080p or 800px limit), exporting the cropped area at full native pixel resolution.

3. **Finite Custom Ratio (W : H) Validation**:
   - When the `Custom` preset is selected, render a compact two-input field `[ W ] : [ H ]`.
   - Contract: Only finite positive numbers (`w > 0 && h > 0`) are accepted.
   - If inputs are invalid, non-numeric, zero, or negative, disable the "Crop & Upload" action and display an inline error hint (`"Masukkan rasio positif yang valid"`).
   - Valid inputs clamp the resulting aspect ratio between `0.1` and `10.0` to prevent extreme layout distortion.

4. **Operator Guidance & Guaranteed Controls**:
   - Render an explicit interaction note below the crop viewport:
     *"Geser gambar untuk mengatur posisi, gunakan slider zoom untuk memperbesar/memperkecil."*
   - This directly educates non-designer church volunteers on the Pan & Zoom paradigm and eliminates confusion regarding drag handles.

5. **Automated Verification**:
   - Author `tests/crop-aspect-presets.test.mjs` asserting:
     - Pure aspect resolver correctly resolves all preset IDs (16:9, 1:1, 4:3, 3:4, 2:3, 9:16, A4, Original, Custom).
     - `Original` aspect correctly resolves to `naturalWidth / naturalHeight`.
     - Custom ratio input enforces positive finite validation, rejects zero/negative/NaN, and clamps boundaries safely.
     - Legacy `defaultAspect: null` maps strictly to `'original'`.
     - Source absence guard ensuring `ImageCropDialog.tsx` does not pass `undefined` aspect or expose misleading Freeform fallback to 4:3.
     - Source presence guard verifying the pan/zoom guidance hint is rendered.

## User Stories

1. As a service coordinator uploading a book cover photo, I want to select the 2:3 ratio preset so that the crop box perfectly frames a book cover without guesswork.
2. As a slide designer creating a vertical announcement banner, I want to select 9:16 or 3:4 so that the graphic fits vertical mobile and tablet display layouts.
3. As a church volunteer uploading a church bulletin flyer, I want to select the A4 preset so that printable flyers fit standard A4 paper proportions.
4. As an operator uploading an image with custom dimensions, I want the "Original" preset to frame the exact dimensions of the original image without forcing a 4:3 or 16:9 crop.
5. As an operator using the crop tool for the first time, I want an on-screen hint explaining how to pan and zoom, so that I immediately understand how to position my photo.
6. As a repository maintainer, I want automated unit tests verifying that all aspect ratios are mathematically sound and prevent regressions to the 4:3 fallback bug.
