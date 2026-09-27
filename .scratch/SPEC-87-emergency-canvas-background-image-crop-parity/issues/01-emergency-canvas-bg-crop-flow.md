# 01: Background Image Upload & Cropping Flow in Emergency Canvas Designer Modal

**What to build:** In `src/operator/present/PresenterOperator.tsx`, implement background image upload and cropping parity within `EmergencyCanvasDesignerModal`:

1. Target Context Branching for Image Cropping:
   - Expand file choice and cropping state to track target context:
     - Track whether the pending crop applies to an element (`'element'`) or the slide background (`'background'`).
   - Add a hidden file input (`data-testid="emergency-bg-file-input"`, `accept="image/*"`) and an `Upload & Crop` button (`data-testid="emergency-bg-upload-button"`) in the Background inspector section (`activeTab === 'background'`).
   - The button explicitly consumes localized text: `{isUploadingImage ? t('emergency.modal.uploading') : t('emergency.modal.bgUpload')}`.
   - When clicked, trigger the background file input. When an image file is chosen, set crop target type to `'background'` and mount `ImageCropDialog` with `defaultAspect="16:9"` (16:9 widescreen canvas default).

2. Durable Background Image Upload & Offline Data URL Fallback (Dual Persistence):
   - In `handleCropComplete(croppedFile: File)`:
     - If the target is `'background'`:
       - **Online Path**: Upload cropped file via `POST /api/upload` as multipart form data. Extract the returned `{ url: string }` and update draft background: `handleUpdateBackground({ image: data.url })`.
       - **Offline Fallback Path**: If offline or network error occurs: convert cropped file to durable base64 Data URL via `fileToDataUrl(croppedFile)` and update draft background: `handleUpdateBackground({ image: dataUrl })`.
       - **Element Isolation**: Ensure `selectedElement` and `handleUpdateImage` are not called.
     - If the target is `'element'`: maintain existing element image update flow: `handleUpdateImage(url, selectedElement?.style?.objectFit)`.

3. Race Condition Guarding & Lifecycle Cleanup:
   - Set `isUploadingImage = true` during background image upload/processing, and guarantee reset to `false` in a `finally` block on both success and error paths.
   - Cancelling the crop dialog (`onCancel`) resets `cropTargetFile = null` and leaves `isUploadingImage = false`, ensuring `emergency-apply-button` is never permanently disabled.
   - Guard `handleApplyClick` and ensure `emergency-apply-button` is disabled (`disabled={isApplying || isUploadingImage}`) and displays upload state (`t('emergency.modal.uploading')`), preventing race conditions or incomplete broadcasts.
   - Retain the remove background button to clear `backgroundImage` to `null`.

Satisfies `FR-14`, `FR-16`, `FR-19`, and `UC-12`.

**Blocked by:** none

**Status:** open

- [ ] In `src/operator/present/PresenterOperator.tsx`:
      - Add crop target context tracking (`'element'` vs `'background'`).
      - Add file input and `Upload & Crop` button (`emergency-bg-upload-button`) in Background inspector panel binding `t('emergency.modal.bgUpload')`.
      - Configure `ImageCropDialog` with `defaultAspect="16:9"` for background cropping.
      - Handle background crop completion with dual persistence (online `/api/upload` + offline Data URL) while strictly isolating `selectedElement`.
      - Ensure `isUploadingImage` race guard disables Apply button during background upload and resets in `finally` block.
      - Ensure dialog cancellation resets crop target without locking the Apply button.
- [ ] In `tests/emergency-canvas-bg-crop.test.mjs`:
      - Verify `emergency-bg-upload-button` triggers background file selection and 16:9 cropping flow.
