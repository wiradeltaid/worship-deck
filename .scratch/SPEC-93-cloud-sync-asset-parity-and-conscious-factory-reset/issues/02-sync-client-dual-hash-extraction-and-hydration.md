# 02: Sync Client Dual-Hash Extraction & Asset Reference Model

**What to build:** In `src/lib/sync/client.ts`, `package.json`, and `tests/sync-client-dual-hash.test.mjs`:

1. **Discrete Dual-Hash Upload Path Extraction (`src/lib/sync/client.ts`)**:
   - Update `extractUploadHashes` to recognize both 32-hex legacy tokens and 64-hex content digests.
   - Refine regex to match both `/api/uploads/` and `/uploads/` with discrete length validation:
     ```ts
     const uploadPathRegex = /(?:\/api)?\/uploads\/((?:[a-f0-9]{32}|[a-f0-9]{64}))\.([a-z0-9]+)/gi;
     ```
   - Provide helper or export `extractUploadAssetRefs(payload)` returning structured asset references:
     `Array<{ hash: string, filename: string, extension: string }>`
     so callers have the exact filename and extension for downstream transfer.
   - Strictly exclude metadata digests:
     - `seed_hash` (e.g. `7219112486d4ca...` in `song_set_layouts`)
     - `content_hash` in bible translations
     - Entity UUIDs (`[0-9a-f]{8}-[0-9a-f]{4}-...`)
     - Ambiguous hex strings of non-discrete length (31, 33, 63, 65 chars)

2. **Sync Client Asset Helper Updates (`src/lib/sync/client.ts`)**:
   - Update `checkSyncAssets` to forward array of discrete 32-hex or 64-hex hashes.
   - In `uploadSyncAsset`, ensure `filename` parameter is forwarded to `/api/sync/assets/upload?filename=${encodeURIComponent(filename)}` so backend stores the exact filename.
   - In `downloadSyncAsset`, forward discrete 32-hex or 64-hex hash identifier in URL path.

3. **Automated Extraction Guard Suite (`tests/sync-client-dual-hash.test.mjs`)**:
   - Assert `extractUploadHashes` extracts:
     - `/api/uploads/34645da1a600f8824686c0ae7104bc1d.png` (32-hex)
     - `/uploads/c30a2f96e172ee46173398f9dca001d5.png` (32-hex, legacy path)
     - `/api/uploads/5c6834af7d25ed672b3bb5a07ef66bdb1a87efdb311e2ea4eae8ef6b961d1e56.png` (64-hex SHA-256)
   - Assert `extractUploadHashes` returns 0 hashes for realistic payload containing `seed_hash` (`7219112486...`), `content_hash`, and strings with 31, 33, 63, or 65 hex characters.
   - Provide defect injection proof: removing 32-hex support triggers guard failure.

Satisfies `FR-40`, `UC-32`.

**Blocked by:** SPEC-93-01

**Status:** open

- [ ] In `src/lib/sync/client.ts`:
      - Broaden `uploadPathRegex` to accept `32..64` hex characters with both `/api/uploads/` and `/uploads/` prefixes.
      - Add asset reference extraction with filename and extension metadata.
- [ ] In `package.json`:
      - Register `tests/sync-client-dual-hash.test.mjs`.
- [ ] In `tests/sync-client-dual-hash.test.mjs`:
      - Implement extraction tests with real production fixtures and defect injection proofs.
