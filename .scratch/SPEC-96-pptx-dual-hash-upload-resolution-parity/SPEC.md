# SPEC-96 — PPTX Generator Dual-Hash Upload Resolution and Embedding Parity

## Requirement Traceability & Scope
- **PRD**: `offline-deck`
- **Architectural Decisions**:
  - `AD-1` (Primary Sabbath Guarantee: Offline PPTX)
  - `AD-30` (Process Roles: Go API, React SPA, On-Demand PPTX Worker)
  - `DEC-080` (Dual-Mode Asset Identity Protocol and Conscious Factory Reset Confirmation)
- **Functional Requirements**:
  - `FR-14` (Export PPTX Presentation)
  - `FR-10` (Delete Service — Orphaned Upload Cleanup)
- **Use Cases**:
  - `UC-18` (Download Offline Presentation Deck — Satisfies `FR-14`)
  - `UC-7` (Delete Service — Satisfies `FR-10`)
- **Components**: `hub`
- **Touches**: `uploads`, `pptx`, `services`

---

## Problem Statement

During hand-testing on the development deployment (`presenter-dev.bic.my.id`) for Sabbath service 2026-10-03 (Service ID 10), operators discovered that newly uploaded images for **Sermon Poster**, **Family of the Week**, and **Youth of the Week** did not appear in the exported `.pptx` presentation file, rendering fallback text ("Image unavailable") or blank boxes instead.

Investigation revealed:
1. **Root Cause — SPEC-93 Uploads Write-Path Modernization Incomplete in Node PPTX Worker**:
   - In SPEC-93 (`DEC-080`), backend file uploads in `internal/httpapi/uploads.go` were modernized from 32-hex random names to 64-hex content-addressed SHA-256 hashes (`hasher := sha256.Sum256(buf)` -> `<64-hex>.<ext>`).
   - While `internal/plan/media.go`, `internal/httpapi/uploads.go`, and `src/lib/sync/client.ts` were updated to support dual-hash discrete identifiers (`(?:[a-f0-9]{32}|[a-f0-9]{64})`), the Node.js utility `src/lib/uploads.ts` was overlooked and left locked to 32-hex:
     ```ts
     const LOCAL_UPLOAD_REF =
       /^\/api\/uploads\/([a-f0-9]{32}\.(?:jpe?g|png|gif|webp))$/i;
     ```
2. **Failure of File Path Resolution during PPTX Draw**:
   - When an operator downloads the presentation (`GET /api/services/{id}/pptx`), Go invokes the Node.js PPTX worker (`src/lib/pptx-draw.ts`).
   - The worker calls `isLocalUploadRef(ref)` and `resolveLocalUploadFsPath(ref)` from `src/lib/uploads.ts` to locate and embed the file bytes from `data/uploads/` (or `UPLOADS_DIR`).
   - Because the regex rejects 64-hex SHA-256 filenames, `isLocalUploadRef` returns `false` and `resolveLocalUploadFsPath` returns `null`.
   - The worker logs `[pptx] image could not be embedded, rendering fallback box: /api/uploads/...` and calls `addImageUnavailable(slide, box)`.
3. **Consumer & Cleanup Failures Across Node Boundary**:
   - `src/lib/images.ts`: `isSafeImageUrl` relies on `isLocalUploadRef(ref)`, rejecting 64-hex local uploads.
   - `src/lib/slide-plan.ts`: `computePlanContext` acceptance gate checks `isSafeImageUrl(media.sermonGraphicUrl)`, nullifying sermon, family, and youth photos if rejected.
   - `src/lib/registry/asset-safety.ts`: `isRegistryImageRef` rejects 64-hex local uploads.
   - `src/lib/services/queries.ts`: `resolveLocalUploadFsPath` fails to resolve 64-hex files when unlinking orphaned uploads upon service deletion (`UC-7` / `FR-10`), leaving orphaned files on disk.

---

## Solution Architecture & Core Invariants

1. **Discrete Dual-Hash Pattern Alignment (`src/lib/uploads.ts`)**:
   - Update `LOCAL_UPLOAD_REF` in `src/lib/uploads.ts` to enforce discrete 32 or 64 hex characters:
     ```ts
     export const LOCAL_UPLOAD_REF =
       /^\/api\/uploads\/((?:[a-f0-9]{32}|[a-f0-9]{64})\.(?:jpe?g|png|gif|webp))$/i;
     ```
   - Update `localUploadFilename(ref)` to return the captured `<hash>.<ext>` string safely.
   - Ensure `resolveLocalUploadFsPath(ref)` correctly maps `/api/uploads/<64-hex>.<ext>` to the local uploads directory.
   - Retain strict discrete length enforcement: lengths between 33 and 63 hex chars MUST be rejected. Retain strict `path.relative` containment guarding against directory traversal (`..`, `\`).

2. **Consumer Path Parity (`src/lib/images.ts`, `src/lib/registry/asset-safety.ts`, `src/lib/services/queries.ts`)**:
   - `src/lib/images.ts`: Update comment/policy so `isSafeImageUrl` documents and accepts discrete 32 or 64 hex characters.
   - `src/lib/registry/asset-safety.ts`: Confirm `isRegistryImageRef` returns `true` for 64-hex uploads.
   - `src/lib/services/queries.ts`: Verify `resolveLocalUploadFsPath` resolves 64-hex upload paths for unlinking orphaned files upon service deletion (`UC-7` / `FR-10`).
   - `src/components/ImageFieldPreview.tsx`: Document that client preview is a non-authoritative UX display check, not a second security gate.

3. **PPTX Worker Embedding & Slide Plan Verification**:
   - In `src/lib/slide-plan.ts`, verify that `computePlanContext` acceptance gate preserves `sermonGraphicUrl`, `familyPhotoUrl`, `youthPhotoUrl`, and announcement inserts with 64-hex SHA-256 upload URLs and generates the respective artifact slide nodes.
   - In `src/lib/pptx-draw.ts`, verify that `embedPlanImages` and `resolveImageData` locate 64-hex SHA-256 local files from disk, read their bytes, and embed them into `slide.addImage({ data: ... })` without falling back to `addImageUnavailable`.
   - Provide a minimal deterministic fixture-driven test for `generatePptxFromPlan` verifying image media part embedding without ambient database dependence.

4. **Test Suite Registration (`package.json`)**:
   - Register both test files in `package.json` under `"test"` and add `"smoke:spec-96"` / `"test:smoke-spec-96"` scripts.

---

## Non-Goals
- Altering the Go write-path or upload hashing algorithm (SHA-256 content-addressing remains canonical per `DEC-080`).
- Re-encoding or migrating existing 32-hex files stored on disk (dual-hash backward compatibility must remain intact).
- Modifying Inno Setup or desktop packaging binaries.
