# SPEC-111-01 — Local Media Registry & File System Access Handle Persistence in IndexedDB

**Satisfies:** [UC-12, FR-16]
**Blocked by:** none
**Status:** open

## Summary
Implement client-side local media handle persistence and global playlist storage in IndexedDB using the File System Access API for Chromium browsers and WebView2 desktop environments.

## Key Responsibilities
1. **`local-media-registry.ts`**:
   - Manage IndexedDB database `worship-deck-media` with stores `local-handles` and `global-playlist`.
   - Store `FileSystemFileHandle` along with metadata (`fileName`, `size`, `lastModified`, `mimeType`).
   - Implement `queryPermission({ mode: 'read' })` on mount and explicit `requestPermission({ mode: 'read' })` tied strictly to user click gestures.
   - Graceful stale handle handling: catch `NotFoundError` on missing files/flash drives, transition item to `missing-handle` status without deleting the playlist entry, and provide a re-link handler.
   - Graceful degradation: in unsupported non-Chromium browsers, surface informative status without crashing.
2. **`playlist-model.ts`**:
   - Extend `PlaylistItem`:
     - `source: 'local' | 'cloud'`
     - `handleRefId?: string`
     - `availability?: 'ready' | 'permission-required' | 'missing-handle' | 'unsupported'`
   - Preserve pure functional playlist operations (`add`, `remove`, `reorder`, `select`).
3. **`media-store.ts`**:
   - Hydrate playlist on mount from IndexedDB global playlist record (`worship-deck-global-media-playlist`).
   - Write-through mutations (`ADD_ITEMS`, `REMOVE_ITEM`, `MOVE_ITEM`) to IndexedDB.

## Acceptance Criteria
- Local media handles persist across tab reloads in IndexedDB.
- `requestPermission` is never invoked automatically on page load without a user gesture.
- Missing or unplugged USB files transition to `missing-handle` without corrupting playlist ordering.
- Non-Chromium browsers gracefully fall back with an informative message.
