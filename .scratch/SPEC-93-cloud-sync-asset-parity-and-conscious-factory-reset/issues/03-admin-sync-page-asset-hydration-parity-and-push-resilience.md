# 03: Admin Sync Page Asset Hydration Parity & Push Resilience

**What to build:** In `spa/src/pages/AdminSyncPage.tsx`, `package.json`, and `tests/admin-sync-asset-parity.test.mjs`:

1. **Pull Asset Hydration Parity (`spa/src/pages/AdminSyncPage.tsx`)**:
   - In `executePull`:
     - Extract asset references from `remoteData.changes` using `extractUploadHashes` / `extractUploadAssetRefs`.
     - In the asset download loop:
       ```ts
       for (const missingHash of localCheck.missing) {
         try {
           const assetBuffer = await downloadSyncAsset(targetUrl, missingHash, headers);
           if (missingHash.length === 64) {
             const actualSha = await computeBufferSha256(assetBuffer);
             if (actualSha.toLowerCase() !== missingHash.toLowerCase()) {
               throw new Error(`Checksum mismatch for ${missingHash}`);
             }
           } else {
             if (!assetBuffer || assetBuffer.byteLength === 0) {
               throw new Error(`Empty asset buffer for legacy asset ${missingHash}`);
             }
           }
           const ref = assetRefMap.get(missingHash);
           const filename = ref?.filename || `${missingHash}.png`;
           await uploadSyncAsset(window.location.origin, assetBuffer, missingHash, filename);
         } catch (assetErr: any) {
           if (assetErr.status === 404 || assetErr.message?.includes('not found')) {
             skippedAssets.push({ hash: missingHash, reason: 'remote_not_found' });
             console.warn(`[sync] Auxiliary media asset ${missingHash} not found on remote server; skipping.`);
             continue;
           }
           throw assetErr;
         }
       }
       ```
     - Ensures 32-hex legacy files are saved under their exact filename so database references never 404 locally.

2. **Push Asset Hydration Resilience (`spa/src/pages/AdminSyncPage.tsx`)**:
   - In `executePush`:
     - Extract asset references from `pullRes.changes` (local changes).
     - Check remote missing assets via `checkSyncAssets(targetUrl, hashes, headers)`.
     - For each missing asset:
       - Download locally from `downloadSyncAsset(window.location.origin, missingHash)`.
       - Verify buffer/checksum using the same dual-mode branch (SHA-256 for 64-hex, buffer size for 32-hex).
       - Upload to remote with original filename: `uploadSyncAsset(targetUrl, assetBuffer, missingHash, filename, headers)`.
       - Wrap individual uploads in bounded error handling: log skipped auxiliary assets if non-critical network failure occurs, rather than unconditionally aborting the entire database push.

3. **Outcome Fidelity & Status Reporting (`spa/src/pages/AdminSyncPage.tsx`)**:
   - If any referenced asset fails download or upload:
     - Mark sync status as `degraded` / `incomplete` in the UI message banner:
       `"Sync completed with missing assets: applied ${applyRes.appliedTotal} entity changes, but ${skippedAssets.length} media assets could not be downloaded."`
     - Provide a direct "Retry Missing Assets" action button.
     - Never report a green "Sync completed successfully!" when referenced media is missing, ensuring operator awareness.

4. **Automated Verification Suite (`tests/admin-sync-asset-parity.test.mjs`)**:
   - Behavioral simulation asserting that pulling a payload with 32-hex assets (`34645da1a600f8824686c0ae7104bc1d.png`) completes without throwing checksum mismatch.
   - Assert that pulled legacy files are physically available on disk under their exact referenced filename (`data/uploads/<token>.<ext>`).
   - Behavioral simulation asserting that pushing local 32-hex assets transfers binary files with exact filenames and stems.
   - Guard proof asserting that missing remote assets are recorded in `skippedAssets`, flagged as degraded/incomplete in UI status, and provide retry capability.

Satisfies `FR-40`, `UC-32`.

**Blocked by:** SPEC-93-02

**Status:** open

- [ ] In `spa/src/pages/AdminSyncPage.tsx`:
      - Implement dual-mode checksum verification in `executePull`.
      - Forward exact filename with extension to `uploadSyncAsset`.
      - Implement resilient push asset hydration in `executePush`.
- [ ] In `package.json`:
      - Register `tests/admin-sync-asset-parity.test.mjs`.
- [ ] In `tests/admin-sync-asset-parity.test.mjs`:
      - Implement behavioral simulation tests for dual-mode hydration in pull and push.
