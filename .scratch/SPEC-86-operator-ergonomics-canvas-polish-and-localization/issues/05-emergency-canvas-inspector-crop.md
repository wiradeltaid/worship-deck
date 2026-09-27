# 05: Emergency Canvas Inspector Shape Guard & Image Cropping Parity

**What to build:** In `src/operator/present/PresenterOperator.tsx`, refine the element inspector in `EmergencyCanvasDesignerModal` to eliminate invalid properties on shapes/lines, and provide full image upload and cropping parity for images and placeholders:
1. Strict Type-Specific Element Inspector Branching:
   - In `EmergencyCanvasDesignerModal`, branch the inspector panels explicitly by `selectedElement.type`:
     - **For `type === 'shape'`**:
       - Render ONLY shape properties: Fill Color picker (`style.fillColor`), Opacity slider (`style.opacity`), Geometry inputs (`x`, `y`, `w`, `h`), and Rotation angle.
       - Strictly suppress/omit Image URL input, Image Upload button, and Object-Fit (`contain`/`cover`/`fill`) dropdown.
     - **For `type === 'line'`**:
       - Render line stroke color, opacity, stroke width, Geometry inputs (`x`, `y`, `w`, `h`), and Rotation angle.
       - Strictly suppress/omit Image URL input and Image Upload button.
     - **For `type === 'image'` and `type === 'image-placeholder'`**:
       - Provide Image Upload with integrated cropping, manual Image URL input, Object-Fit selector (`contain` vs `cover`), Geometry inputs (`x`, `y`, `w`, `h`), and Rotation angle.
       - Strictly suppress text typography inputs.
     - **For `type === 'text'`**:
       - Render text content textarea, font family, font size, text color, alignment, Geometry inputs (`x`, `y`, `w`, `h`), and Rotation angle.
2. Durable Image Upload & Cropping Flow:
   - Integrate `src/components/media/ImageCropDialog.tsx`:
     - When operator clicks "Upload & Crop", trigger hidden file input (`accept="image/*"`).
     - When file is selected: open `ImageCropDialog` passing the selected file.
     - Upon crop confirmation (`onConfirm(croppedFile: File)`):
       - If online: upload file via `POST /api/upload` as multipart form data. Extract the returned `{ url: string }` and update `selectedElement.imageUrl` via `handleUpdateImage(url, objectFit)`. Note: `ResolvedElement` persists `imageUrl`, NOT authoring-time `imageRef`.
       - If offline (network fetch throws or 5xx): generate resilient local `URL.createObjectURL(croppedFile)` and update `selectedElement.imageUrl`.
       - Handle loading/uploading spinner and cancellation cleanly without state corruption.
3. Write automated unit and regression tests in `tests/emergency-canvas-inspector-crop.test.mjs` verifying:
   - Inspector branches correctly across all element types (`text`, `shape`, `line`, `image`, `image-placeholder`).
   - Selecting a `shape` or `line` element strictly omits image URL inputs and upload triggers.
   - Selecting an `image` or `image-placeholder` element provides image upload/crop triggers and object-fit controls.
   - Crop confirmation updates `imageUrl` on the draft artifact without touching `imageRef`.
   - Absence/injection test proving that rendering image controls for shape elements fails the inspector guard assertion.

Satisfies `FR-16`, `FR-19`, and `UC-12`.

**Blocked by:** `SPEC-86-04`

**Status:** open

- [ ] Read `src/operator/present/PresenterOperator.tsx`, `src/lib/emergency-canvas.ts`, and `src/components/media/ImageCropDialog.tsx`.
- [ ] In `src/operator/present/PresenterOperator.tsx`:
      - Guard inspector panels strictly by `selectedElement.type` (`text`, `shape`, `line`, `image`, `image-placeholder`).
      - Suppress image URL and upload controls for shape and line elements.
      - Wire `ImageCropDialog` to crop and upload image files, updating `imageUrl` on `draftArtifact`.
- [ ] In `tests/emergency-canvas-inspector-crop.test.mjs`:
      - Test shape and line element inspector omits image properties.
      - Test image and image-placeholder element inspector provides image upload/crop triggers.
      - Test image crop flow updates `imageUrl` on `draftArtifact`.
      - Inject defect and prove absence guard fails.
- [ ] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/emergency-canvas-inspector-crop.test.mjs` and `npm run typecheck`.
