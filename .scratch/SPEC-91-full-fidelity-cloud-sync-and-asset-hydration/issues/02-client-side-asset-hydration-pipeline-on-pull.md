# 02: Bidirectional Asset Discovery and Hydration Pipeline

**What to build:** In `spa/src/pages/AdminSyncPage.tsx`, `src/lib/sync/client.ts`, `package.json`, and `tests/sync-asset-hydration.test.mjs`:

1. **Universal Recursive Asset Discovery (`src/lib/sync/client.ts`)**:
   - Provide helper `extractUploadHashes(payload: unknown): string[]`:
     - Recursively traverse arbitrary objects, arrays, and JSON-encoded strings.
     - Extract all matches of `/api/uploads/([a-f0-9]{64})/i`.
     - Normalize hashes to lowercase, de-duplicate, and filter out non-hex values.

2. **Push Pipeline Asset Replication (`spa/src/pages/AdminSyncPage.tsx`)**:
   - In `executePush`:
     - Scan all local mutations (services, background images, announcement slides, templates, snapshots, layouts) via `extractUploadHashes`.
     - Call `checkSyncAssets(remoteUrl, hashes, headers)` to find missing remote assets.
     - For each missing hash, download local binary via `downloadSyncAsset(localUrl, hash)` and upload to remote via `uploadSyncAsset(remoteUrl, buffer, headers)` before submitting `pushSync`.

3. **Pull Pipeline Asset Hydration with SHA-256 Checksum Verification (`spa/src/pages/AdminSyncPage.tsx`)**:
   - In `executePull`:
     - After receiving `remoteData` from `pullSync(remoteUrl)`:
       1. Call `extractUploadHashes(remoteData.changes)` to collect all required asset hashes.
       2. Query `checkSyncAssets(localUrl, hashes)` to identify missing local assets.
       3. Concurrently download missing assets from `remoteUrl` via `downloadSyncAsset(remoteUrl, hash, headers)`.
       4. Verify downloaded buffer matches expected SHA-256 hash before committing to local `./data/uploads/` via `uploadSyncAsset(localUrl, buffer)`.
       5. Update operator UI status with hydration progress and clear failure notices if any asset fails.
       6. Apply database row mutations via `pushSyncChunked(localUrl, applyPayload)` only after asset hydration completes or explicitly records partial hydration status.

4. **Automated Guard Tests (`package.json`, `tests/sync-asset-hydration.test.mjs`)**:
   - Register `tests/sync-asset-hydration.test.mjs` in `package.json` under `"test"` and `"smoke:spec-91"`.
   - Assert bidirectional discovery and upload/download of all referenced asset types.
   - Defect injection proof: verify that corrupt bytes or failed asset download triggers test failure and does not leave broken local links.

Satisfies `FR-40`, `FR-21`.

**Blocked by:** 01

**Status:** closed

- [x] In `src/lib/sync/client.ts`:
      - Implement universal recursive `extractUploadHashes` helper.
- [x] In `spa/src/pages/AdminSyncPage.tsx`:
      - Integrate bidirectional asset discovery, push replication, and pull hydration with SHA-256 checksum verification.
- [x] In `package.json`:
      - Register `tests/sync-asset-hydration.test.mjs` in `test` and `smoke:spec-91`.
- [x] In `tests/sync-asset-hydration.test.mjs`:
      - Add integration tests with defect injection.
