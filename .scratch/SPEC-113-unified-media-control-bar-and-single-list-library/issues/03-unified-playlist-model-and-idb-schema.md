# SPEC-113-03 — Unified Single-List Playlist Model, DEC-098 Storage Ladder, and IDB Schema

**Satisfies:** [UC-12, FR-16]
**Blocked by:** ["SPEC-113-02"]
**Status:** closed

## Summary
Refactor `playlist-model.ts` to merge cloud and local state by `sha256` join key, maintain DEC-098 storage ladder preservation, implement pure availability derivation, and upgrade IndexedDB storage to persist file handles and fractional order keys.

## Key Responsibilities
1. **Unified Playlist Data Model (`playlist-model.ts`)**:
   - Merge `CloudPresence` (`id`, `storageKey`, `orderKey`) and `LocalPresence` (`storageKind`, `stale`) under `UnifiedPlaylistItem` joined by `sha256`.
   - Title/Metadata resolution policy: When an item exists in both cloud and local, server `name` and `orderKey` are authoritative for catalog display; local handle is retained for offline stream routing. Cloud `id` acts as discriminator if multiple cloud items share byte equality.
   - Implement pure derivation function `deriveAvailability(item, transfers)` returning `'cloud-only' | 'local-only' | 'synced'`.
2. **Preservation of DEC-098 Storage Ladder (`local-media-registry.ts`)**:
   - Retain full 3-tier storage ladder fallback: File System Access Directory Picker -> OPFS -> in-memory fallback.
   - Upgrade IDB to version 2 to store `FileSystemFileHandle` instead of stale `File` snapshots, enabling persistent handle verification upon page reloads.
   - Store local fractional `orderKey` so local-only media items persist order across reloads.
   - Accurate staleness detection: compare stored record metadata against live file handle attributes (`getFile()` size and lastModified).
3. **Lazy URL Resolution**:
   - Avoid creating persistent blob URLs on import; resolve lazily via `playback-router.ts` on cue and revoke with `revokeObjectURL` on item change.

## Acceptance Criteria
- Playlist items sharing the same `sha256` merge into a single `synced` row.
- Local media items maintain custom sort order and file handles across page reloads.
- DEC-098 storage ladder (Directory Picker, OPFS, in-memory) remains intact.
- Staleness accurately flags detached files when moved or modified on disk.

## Comments
