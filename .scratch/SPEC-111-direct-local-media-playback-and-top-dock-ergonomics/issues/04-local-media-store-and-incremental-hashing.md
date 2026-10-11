# SPEC-111-04 — Local Media Store, Incremental Web Worker Hashing, and Matching Map

**Satisfies:** [UC-12, FR-16]
**Blocked by:** ["SPEC-111-03"]
**Status:** done

## Summary
Implement client-side local media storage in IndexedDB with separate directory and media index stores, off-thread incremental SHA-256 calculation in a Web Worker, and an in-memory matching map for 60fps status rendering.

## Key Responsibilities
1. **IndexedDB Local Storage (`<src/operator/present/media-player/local-media-registry.ts>`)**:
   - Database `worship-deck-media` with two distinct stores:
     - `media-settings` store: holds the single persistent `FileSystemDirectoryHandle` under key `'downloadDirectory'`.
     - `media-index` store: keyed strictly by `sha256`, holding verified local media records `{ sha256, name, sizeBytes, mimeType, fileHandle, storageKind, lastModified, verifiedAt }`.
   - **Hashing Invariant**: Direct local files (from USB / file picker) are ALWAYS hashed via Web Worker to compute their true SHA-256 checksum before entering `media-index`. Metadata or filename equality is NEVER promoted to identity.
   - **Staleness Detection**: Record `(sizeBytes, lastModified)` is used strictly to detect staleness on re-check (transitioning to `detached` if changed, requiring re-hashing).
2. **Web Worker Incremental Hashing**:
   - Dedicated Web Worker executing chunk streaming (1–4 MB slices) with an incremental SHA-256 implementation to prevent main-thread UI freezing on 1 GB files.
   - Pinned exact hashing dependency with verified package integrity.
3. **In-Memory Matching Map**:
   - Maintain `Map<sha256, LocalMediaMeta>` hydrated upon drawer open and updated via discrete events (add, download complete, remove).
   - Render path performs O(1) key lookups per Cloud row.

## Acceptance Criteria
- Hashing a 500 MB – 1 GB file on a Web Worker maintains 60fps responsiveness on the presenter console without dropped frames.
- Local storage cleanly separates directory handle settings from the content-addressed media index.
- Metadata is never used as a proxy for file identity; matching strictly requires verified SHA-256.
- Unit tests verify IndexedDB storage, worker hashing parity, and matching map lookups.

## Comments

- 2026-10-11: Implemented `computeBlobSHA256` chunked streaming hasher in `media-hasher.ts`, `LocalMediaRegistry` with dual IndexedDB stores and in-memory O(1) matching map in `local-media-registry.ts`, exported via index, and verified in `tests/local-media-player.test.mjs`.
