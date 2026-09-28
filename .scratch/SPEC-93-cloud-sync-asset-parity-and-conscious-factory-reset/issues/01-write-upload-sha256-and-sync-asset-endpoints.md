# 01: Write-Path SHA-256 Uploads & Dual-Hash Sync Endpoints

**What to build:** In `internal/httpapi/uploads.go`, `internal/httpapi/sync_assets.go`, `package.json`, and `tests/sync-asset-endpoints.test.mjs`:

1. **Write-Path Content-Addressing (`internal/httpapi/uploads.go`)**:
   - In `writeUpload(ext string, buf []byte)`:
     - Compute SHA-256 digest of `buf`: `hasher := sha256.Sum256(buf); shaHex := hex.EncodeToString(hasher[:])`.
     - Set `filename = shaHex + ext`.
     - Check if file already exists in `uploadsDir()`: if exists and non-empty, skip re-writing (content deduplication).
     - Return `filename, "/api/uploads/" + filename, nil`.
   - Maintain full backward compatibility for serving existing 32-hex legacy files via `getUpload` (which already uses `^[a-f0-9]{32,64}\.(...)$`).

2. **Discrete Dual-Hash Endpoint Validation & Filename Safety (`internal/httpapi/sync_assets.go`)**:
   - Replace `sha256Regex` with discrete validator:
     ```go
     var assetIdRegex = regexp.MustCompile(`^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{64})$`)
     ```
     Rejecting invalid lengths (e.g. 31, 33, 63, 65 chars) with HTTP 400 Bad Request.
   - In `syncAssetsCheck` (`POST /api/sync/assets/check`): validate hashes against `assetIdRegex`.
   - In `syncAssetDownload` (`GET /api/sync/assets/{hash}`): validate against `assetIdRegex`. Find file via exact basename match (`<identifier>.<allowed-ext>`), eliminating ambiguous prefix matching.
   - In `syncAssetUpload` (`POST /api/sync/assets/upload`):
     - Accept discrete 32-hex or 64-hex in `X-Content-SHA256` (or `X-Asset-Identifier`).
     - Validate `filename` parameter:
       - Must be a pure basename (reject any path separators `/`, `\`, or `..` directory traversal).
       - Filename stem without extension must match the declared identifier (e.g. stem of `34645...png` must be `34645...`).
       - Reject unallowed extensions; only save with declared valid extension.
     - For 64-character SHA-256 identifiers, rehash the received body and return HTTP 400 on checksum mismatch.
     - Atomically save under `uploadsDir()/<filename>`, ensuring exact filename parity with database references.

3. **Automated Endpoint Verification Suite (`tests/sync-asset-endpoints.test.mjs`)**:
   - Assert `POST /api/sync/assets/check` accepts discrete 32-hex and 64-hex hashes and rejects 31, 33, 63, and 65-char strings.
   - Assert `GET /api/sync/assets/{hash}` returns 32-hex legacy assets correctly with exact basename lookup.
   - Assert `POST /api/sync/assets/upload` rejects directory traversal attempts (`../`) and filename stem mismatches.
   - Assert `POST /api/sync/assets/upload` with 64-char hash rejects mismatched body bytes.
   - Assert `writeUpload` produces 64-hex SHA-256 filenames for newly uploaded content.

Satisfies `FR-40`, `UC-32`.

**Blocked by:** none

**Status:** closed

- [x] In `internal/httpapi/uploads.go`:
      - Modernize `writeUpload` to compute SHA-256 content hashes for new uploads with deduplication.
- [x] In `internal/httpapi/sync_assets.go`:
      - Accept `32..64` hex characters in check, upload, and download endpoints.
      - Preserve original extension and filename in `syncAssetUpload`.
- [x] In `package.json`:
      - Register `tests/sync-asset-endpoints.test.mjs`.
- [x] In `tests/sync-asset-endpoints.test.mjs`:
      - Implement static assertions, defect injection proofs, and endpoint contract tests.
