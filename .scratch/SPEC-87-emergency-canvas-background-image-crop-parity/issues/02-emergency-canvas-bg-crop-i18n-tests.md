# 02: Bilingual i18n Parity & Real-File Defect Injection Tests for Background Crop

**What to build:** Add bilingual localization keys and automated structural unit/regression tests for background image upload and cropping in the Emergency Canvas Editor:

1. Localization & Bilingual Parity:
   - In `src/lib/i18n/keys.ts`, declare `emergency.modal.bgUpload`.
   - In `src/lib/i18n/catalogue-en.ts`, add:
     - `'emergency.modal.bgUpload': 'Upload & Crop Background'`
   - In `src/lib/i18n/catalogue-id.ts`, add:
     - `'emergency.modal.bgUpload': 'Unggah & Potong Latar'`

2. Automated Test Suite (`tests/emergency-canvas-bg-crop.test.mjs`):
   - **Control Presence & Key Binding**:
     - Assert that `EmergencyCanvasDesignerModal` Background panel renders `data-testid="emergency-bg-upload-button"` and `data-testid="emergency-bg-file-input"`.
     - Assert that `emergency-bg-upload-button` consumes `t('emergency.modal.bgUpload')`.
     - Assert that `emergency.modal.bgUpload` exists in both `catalogue-en.ts` and `catalogue-id.ts`.
   - **Aspect Containment**:
     - Assert that background cropping flow specifies `defaultAspect="16:9"` or numerical `16 / 9` for `ImageCropDialog`.
   - **Dual Persistence Paths & Element Isolation**:
     - Assert that successful `/api/upload` response updates `draftArtifact.layout.backgroundImage` with returned URL.
     - Assert that failed/offline upload converts to base64 Data URL and updates `draftArtifact.layout.backgroundImage`.
     - Assert that background crop update leaves `selectedElement.imageUrl` untouched (element flow isolation).
   - **Race Prevention & Error Cleanup**:
     - Assert that `emergency-apply-button` is guarded by `isUploadingImage`.
     - Assert that `isUploadingImage` resets to `false` in a `finally` block on success and error.
     - Assert that cancellation cleans up crop target without leaving Apply button locked.
   - **Real-File Defect Injections**:
     - Implement real-file defect injection proofs with automatic `try/finally` byte-identical restoration:
       1. Removing `emergency-bg-upload-button` fails the background upload guard.
       2. Stripping `16:9` default aspect fails the aspect containment guard.
       3. Stripping `t('emergency.modal.bgUpload')` key binding fails the i18n binding guard.
       4. Removing `isUploadingImage` from the Apply button fails the race prevention guard.

Satisfies `FR-16`, `FR-25`, and `UC-12`.

**Blocked by:** `SPEC-87-01`

**Status:** closed

- [x] In `src/lib/i18n/keys.ts`, `src/lib/i18n/catalogue-en.ts`, and `src/lib/i18n/catalogue-id.ts`:
      - Add `emergency.modal.bgUpload` key and translations in English and Indonesian.
- [x] In `tests/emergency-canvas-bg-crop.test.mjs`:
      - Write automated tests verifying background upload button presence, `t('emergency.modal.bgUpload')` binding, 16:9 aspect containment, dual persistence paths (online URL and offline Data URL), element isolation, and race prevention.
      - Implement real-file defect injection proofs.
- [x] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/emergency-canvas-bg-crop.test.mjs` and `npm run typecheck`.
