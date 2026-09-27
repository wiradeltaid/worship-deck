# SPEC-87 — Emergency Canvas Background Image Upload & Cropping Parity

## Requirement Traceability & Scope
- **PRD**: `operator-turn`, `offline-deck`
- **Architectural Decisions**:
  - `AD-13` (Canvas State Boundary — Uncontrolled wrapper pattern)
  - `AD-16` (Service-Bound Registry Snapshot)
  - `AD-24` (Operator Theme & Chrome vs. Black Room-Facing Projector Shell)
  - `AD-29` (Projector Liveness Protocol & BroadcastChannel Isolation)
- **Use Cases**:
  - `UC-12` (Operator runs the two-screen presenter — satisfies `FR-14`, `FR-16`, `FR-19`)
- **Functional Requirements**:
  - `FR-14` (Offline Presentation Guarantee — PPTX fail-safe Plan A, in-browser presentation Plan B)
  - `FR-16` (Presenter View and Operator Control Surface)
  - `FR-19` (Auditorium Projector Output and Live Synchronization)
  - `FR-25` (The Operator interface in the Operator's language — English and Indonesian bilingual parity)
- **Components**: `presenter`
- **Touches**: `present-channel`, `artifacts`, `i18n`

---

## Problem Statement

Hand-testing of the Emergency Canvas Editor (`EmergencyCanvasDesignerModal` in `src/operator/present/PresenterOperator.tsx`) following SPEC-86 surfaced an ergonomic and feature parity inconsistency between canvas elements and slide background:

1. **Element vs. Background Upload & Cropping Parity Gap**:
   - In SPEC-86-05, elements of type `image` and `image-placeholder` gained an `Upload & Crop` button (`emergency-image-upload-button`) integrated with `ImageCropDialog`, supporting upload to `/api/upload`, Apply button race condition guards (`isUploadingImage`), and durable offline base64 Data URL fallbacks (`fileToDataUrl`).
   - However, when the operator switches to the **Background** tab (`activeTab === 'background'`), the inspector displays only a color picker and a plain text input (`data-testid="emergency-bg-image"`) for image URL (`https://... atau /assets/...`).
   - Operators making stage-side emergency background adjustments cannot directly upload or crop background images from local storage; they are forced to type or paste pre-existing asset URLs, breaking workflow symmetry.

2. **Aspect Ratio Alignment for Background Images**:
   - Slide presentation backgrounds in WorshipDeck operate on a standard 16:9 widescreen canvas (`1920×1080` / `16:9` aspect ratio).
   - While element images retain arbitrary bounding boxes based on the selected element geometry, background cropping must default to `16:9` widescreen aspect preset (`ASPECT_RATIO_PRESETS['16:9']` / `16 / 9`) in `ImageCropDialog` to guarantee full-bleed containment without letterboxing or unintended stretching.

3. **Bilingual Parity**:
   - Labels, buttons, and accessibility tooltips for background image upload and cropping must maintain 100% strict bilingual parity in English (`catalogue-en.ts`) and Indonesian (`catalogue-id.ts`) per `FR-25`, with explicit UI key binding.

---

## Architecture & Detailed Solution

### 1. Background Upload & Crop Flow in `PresenterOperator.tsx`
- **Target Context Branching**:
  - Expand crop state to track target type: `cropTargetType: 'element' | 'background'`.
  - Introduce dedicated file input (`data-testid="emergency-bg-file-input"`, `accept="image/*"`, hidden) and trigger button (`data-testid="emergency-bg-upload-button"`) in the Background inspector section.
  - The button explicitly consumes localized text: `{isUploadingImage ? t('emergency.modal.uploading') : t('emergency.modal.bgUpload')}`.
  - When the background `Upload & Crop` button is clicked, trigger the background file input. Upon file selection, set `cropTargetType = 'background'` and mount `ImageCropDialog` with `defaultAspect="16:9"`.
- **Durable Upload & Offline Data URL Fallback (Dual Persistence Paths)**:
  - In `handleCropComplete(croppedFile: File)`:
    - If `cropTargetType === 'background'`:
      - **Path A (Online Upload)**: Upload cropped file via `POST /api/upload` as multipart form data. On HTTP 200, extract returned `{ url: string }` and update draft background: `handleUpdateBackground({ image: data.url })`.
      - **Path B (Offline Fallback)**: If network upload fails, throws, or device is offline: convert cropped file to self-contained, durable base64 Data URL via `fileToDataUrl(croppedFile)` and update draft background: `handleUpdateBackground({ image: dataUrl })`.
      - **Element Isolation Guarantee**: Background crop persistence MUST NOT mutate `selectedElement` or call `handleUpdateImage`.
    - If `cropTargetType === 'element'`:
      - Maintain existing element image update flow: `handleUpdateImage(url, selectedElement?.style?.objectFit)`.
- **Race Condition Guarding & Lifecycle Cleanup**:
  - `isUploadingImage` is set to `true` upon crop confirmation and guaranteed reset to `false` in a `finally` block across both success and failure paths.
  - Cancelling the crop dialog (`onCancel`) resets `cropTargetFile = null` and leaves `isUploadingImage = false`, ensuring the Apply button (`emergency-apply-button`) is never permanently disabled.
  - While `isUploadingImage` is `true`, `emergency-apply-button` remains disabled (`disabled={isApplying || isUploadingImage}`) and displays `t('emergency.modal.uploading')`.
- **Background Removal**:
  - Retain the `Remove Background` (`emergency.modal.bgRemove`) button to clear `backgroundImage` back to `null`.

### 2. Localization & i18n
- Declare keys in `src/lib/i18n/keys.ts`:
  - `emergency.modal.bgUpload`
- Provide exact translations:
  - English (`src/lib/i18n/catalogue-en.ts`): `'emergency.modal.bgUpload': 'Upload & Crop Background'`
  - Indonesian (`src/lib/i18n/catalogue-id.ts`): `'emergency.modal.bgUpload': 'Unggah & Potong Latar'`

### 3. Automated Guard & Test Strategy
- Author `tests/emergency-canvas-bg-crop.test.mjs`:
  - **Control Presence & Key Binding**:
    - Assert that the background inspector panel renders `emergency-bg-upload-button` and `emergency-bg-file-input`.
    - Assert that `emergency-bg-upload-button` binds and displays `t('emergency.modal.bgUpload')`.
    - Assert that `emergency.modal.bgUpload` exists in both `catalogue-en.ts` and `catalogue-id.ts`.
  - **Aspect Containment**:
    - Assert that background cropping flow sets `defaultAspect="16:9"` or `16 / 9` on `ImageCropDialog`.
  - **Dual Persistence Paths & Element Isolation**:
    - Assert that successful `/api/upload` response updates `draftArtifact.layout.backgroundImage` with the returned URL.
    - Assert that offline/upload failure converts to base64 Data URL and updates `draftArtifact.layout.backgroundImage`.
    - Assert that background crop update leaves `selectedElement.imageUrl` untouched (strict isolation from element flow).
  - **Race Prevention & Error Cleanup**:
    - Assert that `emergency-apply-button` is disabled during background upload.
    - Assert that `isUploadingImage` resets to `false` in a `finally` block even when upload or Data URL conversion fails.
    - Assert that dialog cancellation clears crop target without locking the Apply button.
  - **Real-File Defect Injections**:
    1. Removing `emergency-bg-upload-button` fails the control presence guard.
    2. Stripping `16:9` default aspect from background crop fails the aspect containment guard.
    3. Stripping `t('emergency.modal.bgUpload')` binding fails the i18n guard.
    4. Removing `isUploadingImage` from `emergency-apply-button` fails the race prevention guard.

---

## Tickets

- `SPEC-87-01`: Background Image Upload & Cropping Flow in Emergency Canvas Designer Modal (`touches: [present-channel, artifacts]`)
- `SPEC-87-02`: Bilingual i18n Parity & Real-File Defect Injection Tests for Background Crop (`touches: [present-channel]`, `blocked_by: ["SPEC-87-01"]`)
