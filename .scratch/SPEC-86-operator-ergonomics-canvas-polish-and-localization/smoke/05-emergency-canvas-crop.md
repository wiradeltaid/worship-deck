# Smoke Test & Ergonomic Verification: SPEC-86-05

**Target:** `PresenterOperator.tsx` Emergency Canvas Inspector Shape Guard & Image Cropping Parity  
**Author:** Coordinator  
**Verified By:** Terra Peer Review  
**Date:** 2026-09-27  

## 1. Concrete Observed Inspector Branching & Cropping Evidence

### A. Element Inspector Branching Across All Types
- **When `selectedElement.type === 'text'`**:
  - Displays `<div data-testid="inspector-text-panel">`.
  - Controls: Textarea (`data-testid="emergency-edit-textarea"`), Font family select, Font size px input, Color picker, Text alignment buttons (Left/Center/Right), Bold & Italic toggles, and Geometry (X, Y, W, H, Rotation).
  - Image URL and image upload triggers: strictly omitted from DOM.
- **When `selectedElement.type === 'shape'`**:
  - Displays `<div data-testid="inspector-shape-panel">`.
  - Controls: Fill color picker (`emergency-shape-fill`), Opacity slider (`emergency-shape-opacity`), Stroke color picker (`emergency-shape-stroke-color`), Stroke width input (`emergency-shape-stroke-width`), and Geometry (X, Y, W, H, Rotation).
  - Image URL and image upload triggers: strictly omitted from DOM.
- **When `selectedElement.type === 'line'`**:
  - Displays `<div data-testid="inspector-line-panel">`.
  - Controls: Stroke color picker (`emergency-line-color`), Stroke width input (`emergency-line-width`), Opacity slider (`emergency-line-opacity`), and Geometry (X, Y, W, H, Rotation).
  - Image URL and image upload triggers: strictly omitted from DOM.
- **When `selectedElement.type === 'image'` or `'image-placeholder'`**:
  - Displays `<div data-testid="inspector-image-panel">`.
  - Controls: Image Upload & Crop button (`emergency-image-upload-button`), Image URL input (`emergency-image-url`), Object-fit mode select (`emergency-image-fit`), Opacity slider, and Geometry (X, Y, W, H, Rotation).
  - Text typography controls: strictly omitted from DOM.

### B. Image Cropping, Upload Race Guard & Durable Data URL Flow
- Operator selects an image element and clicks `Upload & Crop`.
- Hidden file input triggers and accepts image file (`image/*`).
- `ImageCropDialog` mounts seamlessly over modal with the selected file.
- **Apply / Upload Race Elimination**:
  - While crop upload is in flight, `isUploadingImage` becomes `true`.
  - The Apply button (`data-testid="emergency-apply-button"`) is strictly disabled (`disabled={isApplying || isUploadingImage}`) and displays `Mengunggah Gambar...`, preventing premature persistence or broadcast of pre-crop artifacts.
  - `handleApplyClick` guards early return if `isUploadingImage` is active.
- **Durable Offline Resilience**:
  - If online: Form data uploads file to `POST /api/upload`, returning `{ url: "/api/uploads/c789...png" }`.
  - If disconnected or network error occurs: `fileToDataUrl` converts the cropped file into a self-contained, durable base64 `data:image/...;base64,...` URL. Unlike ephemeral session-scoped `blob:` URLs, the Data URL survives browser reloads, stores durably in IndexedDB snapshots, and transmits intact across `BroadcastChannel` to the projector window without requiring manual object URL revocation.
  - Runtime contract: `ResolvedElement` persists `imageUrl` without touching `imageRef`.

## 2. Automated Fail-Closed Guard Proofs
- Structural scanner (`tests/emergency-canvas-inspector-crop.test.mjs`) verified:
  - Strict type branching across text, shape, line, and image verified.
  - Mutual exclusivity verified: shapes and lines strictly omit image URL/upload controls.
  - Apply button race prevention (`isUploadingImage`) verified.
  - Type-safe `updateElementImage` pure function contract verified (rejects non-image mutations).
  - Durable `fileToDataUrl` base64 conversion verified.
  - Finite rotation geometry sanitization verified (`[-90, 45] -> [270, 45]`).
  - Real-file defect injection proofs with automatic `try/finally` byte-identical restoration:
    1. Injecting image controls into shape panel -> FAILS (`inspector-shape-panel must NOT contain image controls`)
    2. Removing upload button from image panel -> FAILS (`inspector-image-panel must contain emergency-image-upload-button`)
    3. Injecting image controls into line panel -> FAILS (`inspector-line-panel must NOT contain image controls`)
    4. Stripping ImageCropDialog -> FAILS (`missing ImageCropDialog integration`)
    5. Removing isUploadingImage from Apply button -> FAILS (`emergency-apply-button must be disabled during image upload`)

## 3. Concrete Verification & Execution Records

### A. Targeted Node Test Suite Execution
- **Command**: `node --import ./tests/register-ts-resolve.mjs --test tests/emergency-canvas-inspector-crop.test.mjs`
- **Exit Code**: `0`
- **Timestamp**: `2026-09-27T16:55:00Z`
- **Captured Output**:
```
✔ SPEC-86-05: EmergencyCanvasDesignerModal element inspector branching and image cropping integration (3.1272ms)
✔ SPEC-86-05: updateElementImage updates imageUrl on artifact element without creating imageRef (0.2334ms)
✔ SPEC-86-05: updateElementImage enforces type safety: rejects mutating non-image elements (0.1571ms)
✔ SPEC-86-05: fileToDataUrl converts Blob/File into durable base64 Data URL for offline resilience (0.3636ms)
✔ SPEC-86-05: updateElementGeometry updates rotation and clamps finite values (0.233ms)
✔ SPEC-86-05: Real-file defect injection — injecting image controls into shape panel fails guard (2.9435ms)
✔ SPEC-86-05: Real-file defect injection — removing upload button from image panel fails guard (3.3422ms)
✔ SPEC-86-05: Real-file defect injection — injecting image controls into line panel fails guard (3.5365ms)
✔ SPEC-86-05: Real-file defect injection — stripping ImageCropDialog fails integration guard (2.7402ms)
✔ SPEC-86-05: Real-file defect injection — removing isUploadingImage from Apply button disabled check fails race guard (3.2537ms)
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 179.3386
```

### B. TypeScript Static Validation
- **Command**: `npm run typecheck`
- **Exit Code**: `0`
- **Timestamp**: `2026-09-27T16:55:20Z`
- **Captured Output**:
```
> worship-deck@0.1.0 typecheck
> tsc --noEmit
```

### C. Linked Artifacts
- Source component: `src/operator/present/PresenterOperator.tsx` (EmergencyCanvasDesignerModal)
- Library: `src/lib/emergency-canvas.ts`
- Image cropper: `src/components/media/ImageCropDialog.tsx`
- Test specification: `tests/emergency-canvas-inspector-crop.test.mjs`
- Specification ticket: `.scratch/SPEC-86-operator-ergonomics-canvas-polish-and-localization/issues/05-emergency-canvas-inspector-crop.md`
