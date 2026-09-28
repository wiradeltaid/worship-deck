# 03: Sync Asset Extraction Filtering and Resilient Hydration Pipeline

**What to build:** In `src/lib/sync/client.ts`, `spa/src/pages/AdminSyncPage.tsx`, and `tests/sync-asset-resilience.test.mjs`:

1. **Precise Asset Hash Extraction (`src/lib/sync/client.ts`)**:
   - In `extractUploadHashes`:
     - Maintain strict SHA-256 (64 hex characters) asset identity per the published sync protocol.
     - Eliminate the overbroad `hex64Regex = /^[a-f0-9]{64}$/i` pattern that blindly matched layout metadata (`seed_hash`), bible translation digests (`content_hash`), and entity IDs.
     - Restrict regex extraction strictly to URI paths referencing uploaded assets: `/\/api\/uploads\/([a-f0-9]{64})\.[a-z0-9]+/gi`.
     - Explicitly verify that non-upload metadata digests (`seed_hash`, `content_hash`, UUIDs) are never returned as upload asset hashes.

2. **Resilient Asset Hydration on Pull (`spa/src/pages/AdminSyncPage.tsx`)**:
   - In `executePull`, wrap the per-asset download loop in a selective try-catch block:
     ```ts
     const skippedAssets: Array<{ hash: string; reason: string }> = [];
     for (const missingHash of localCheck.missing) {
       try {
         const assetBuffer = await downloadSyncAsset(targetUrl, missingHash, headers);
         const actualSha = await computeBufferSha256(assetBuffer);
         if (actualSha.toLowerCase() !== missingHash.toLowerCase()) {
           throw new Error(`Checksum mismatch for ${missingHash}`);
         }
         await uploadSyncAsset(window.location.origin, assetBuffer, missingHash);
       } catch (assetErr: any) {
         if (assetErr.status === 404 || assetErr.message?.includes('not found')) {
           skippedAssets.push({ hash: missingHash, reason: 'remote_not_found' });
           console.warn(`[sync] Auxiliary asset ${missingHash} not found on remote server; skipping.`);
         } else {
           throw assetErr; // Re-throw 401/403 or network errors to preserve re-auth handling
         }
       }
     }
     ```
   - If `skippedAssets.length > 0`, report partial success in the message banner:
     `"Pull completed! Applied ${applyRes.appliedTotal} updates from cloud. (${skippedAssets.length} auxiliary media items could not be found on remote server)."`
   - Ensure that core database mutations (services, hymns, layouts) are always applied even if an auxiliary media asset is missing upstream.

3. **Contract & Resilience Verification Suite (`tests/sync-asset-resilience.test.mjs`)**:
   - Test fixture using real-world `seed_hash` (`7219112486d4ca210ced3a67b57232773257279f5e942c61d49121a12c4b20f8`) and asserting `extractUploadHashes` returns 0 hashes.
   - Assert `extractUploadHashes` extracts valid SHA-256 hashes from `/api/uploads/<sha256>.png`.
   - Assert that simulated 404 errors during asset download in client pipeline populate `skippedAssets` without aborting the batch mutation push.
   - Defect injection proofs: asserting that restoring raw string matching fails extraction purity guard.

Satisfies `FR-40`, `UC-32`.

**Blocked by:** none

**Status:** closed

- [x] In `src/lib/sync/client.ts`:
      - Refine `extractUploadHashes` to extract only valid SHA-256 upload path hashes and ignore layout/seed digests.
- [x] In `spa/src/pages/AdminSyncPage.tsx`:
      - Add selective 404 exception handling and `skippedAssets` reporting during pull asset hydration.
- [x] In `package.json`:
      - Register `tests/sync-asset-resilience.test.mjs`.
- [x] In `tests/sync-asset-resilience.test.mjs`:
      - Implement extraction filter assertions and hydration resilience tests with seed_hash fixture.
