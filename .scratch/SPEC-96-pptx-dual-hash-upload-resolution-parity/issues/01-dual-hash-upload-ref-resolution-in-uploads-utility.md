# 01: Dual-Hash Upload Reference Resolution in Uploads Utility, Asset Safety, and Service Cleanup

**What to build:** In `src/lib/uploads.ts`, `src/lib/images.ts`, `src/lib/registry/asset-safety.ts`, `src/lib/services/queries.ts`, `package.json`, and `tests/upload-dual-hash-resolution.test.mjs`:

1. **Discrete Dual-Hash Regex Update (`src/lib/uploads.ts`)**:
   - Update `LOCAL_UPLOAD_REF` to support both 32-hex legacy tokens and 64-hex SHA-256 digests:
     ```ts
     export const LOCAL_UPLOAD_REF =
       /^\/api\/uploads\/((?:[a-f0-9]{32}|[a-f0-9]{64})\.(?:jpe?g|png|gif|webp))$/i;
     ```
   - Verify `localUploadFilename(ref)` properly extracts group 1 as `<hash>.<ext>`.
   - Verify `resolveLocalUploadFsPath(ref)` resolves valid paths under `getUploadsDir()` for both 32-hex and 64-hex filenames while continuing to prevent directory traversal (`..`, `\`).

2. **Downstream Consumer & Cleanup Alignment**:
   - `src/lib/images.ts`: Update comments/docs to record discrete 32 or 64 hex character acceptance (`(?:[a-f0-9]{32}|[a-f0-9]{64})`).
   - `src/lib/registry/asset-safety.ts`: Confirm `isRegistryImageRef(ref)` accepts 64-hex local uploads.
   - `src/lib/services/queries.ts`: Ensure `resolveLocalUploadFsPath` resolves 64-hex upload paths for unlinking orphaned files upon service deletion (`UC-7` / `FR-10`).
   - `src/components/ImageFieldPreview.tsx`: Document that client preview is a non-authoritative UX display check, not a second security gate.

3. **Standard Suite Registration (`package.json`)**:
   - Register `tests/upload-dual-hash-resolution.test.mjs` into `package.json` under `"test"` and create `"smoke:spec-96"` / `"test:smoke-spec-96"`.

4. **Unit & Contract Tests (`tests/upload-dual-hash-resolution.test.mjs`)**:
   - Assert `isLocalUploadRef` returns `true` for 32-hex and 64-hex paths with `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`.
   - Assert `isLocalUploadRef` returns `false` for invalid lengths (31, 33, 63, 65 hex characters), unsupported extensions, or path traversal attempts.
   - Assert `resolveLocalUploadFsPath` resolves expected filesystem paths on disk for both 32-hex and 64-hex references.
   - Assert `isRegistryImageRef` and `isSafeImageUrl` accept 64-hex local upload URLs.
   - Assert orphaned upload cleanup query logic resolves 64-hex filenames for unlinking.

**Blocked by:** none

**Status:** closed

- [x] Update `LOCAL_UPLOAD_REF` in `src/lib/uploads.ts` to discrete dual-hash pattern `(?:[a-f0-9]{32}|[a-f0-9]{64})`.
- [x] Verify `localUploadFilename` and `resolveLocalUploadFsPath` with both 32-hex and 64-hex filenames.
- [x] Align `asset-safety.ts`, `images.ts`, and `queries.ts` orphaned cleanup to 64-hex upload references.
- [x] Register test file in `package.json` script suite.
- [x] Add contract and unit tests in `tests/upload-dual-hash-resolution.test.mjs`.
