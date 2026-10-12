# SPEC-114-02 — Unified 3-Way Deletion Matrix, Cloud Playlist Hydration & Presence Decoupling

**Satisfies:** [UC-12, FR-16, FR-25]
**Blocked by:** [SPEC-114-01]
**Status:** done

## Summary
Resolve Bug #3 (dual erasure defect upon deleting local copy) by consuming the existing dual-presence model (`CloudPresence`, `LocalPresence`, `deriveAvailability()`), replacing legacy `source !== 'local'` checks with `availability`, providing an explicit 3-way deletion menu, and adding single-owner backend cloud playlist hydration on mount.

## Key Responsibilities
1. **Presence Model Alignment (`MediaDrawer.tsx`, `playlist-model.ts`)**:
   - Consume the existing `deriveAvailability()` and `mergeUnifiedPlaylistItem()` rather than reimplementing presence.
   - Replace the legacy guard `{item.source !== 'local' && (` at `MediaDrawer.tsx:672` with an `availability`-derived check.
   - Maintain the DEC-098 storage ladder and local handle integrity across presence transitions.
2. **Single-Owner Mount Hydration (`PresenterOperator.tsx`)**:
   - In `PresenterOperator.tsx` on mount, fetch `GET /api/media/playlist` to load persistent server items into `mediaStore`.
   - Merge server items with `localMediaRegistry.getMatchingMap()`, correctly establishing `synced` status for files whose SHA-256 exists in both.
3. **Explicit 3-Way Deletion Menu Workflow (`MediaDrawer.tsx`)**:
   - Clarify deletion semantics: "Hapus dari Komputer" unlinks the handle from the application's local index; it **never** deletes the user's physical file on disk.
   - For `local-only` items: display `Hapus dari Komputer` (reusing `media.drawer.deleteFromLocal`).
   - For `cloud-only` items: display `Hapus dari Cloud` (reusing `media.drawer.deleteFromCloud`).
   - For `synced` items: display three distinct actions:
     - `Hapus dari Komputer Saja` (`media.drawer.deleteFromLocalOnly`): unlinks IndexedDB handle; item transitions to `cloud-only` and remains in playlist.
     - `Hapus dari Cloud Saja` (`media.drawer.deleteFromCloudOnly`): calls `DELETE /api/media/playlist/:id`; item transitions to `local-only` and remains in playlist.
     - `Hapus Keduanya` (`media.drawer.deleteBoth`): calls `DELETE /api/media/playlist/:id?purge=true` (purges physical upload from server) and unlinks local handle; item is completely removed from playlist.
   - Preserve existing active-playback protection: disable all deletion actions when the item is active and playing or projected (`cannotDelete = isActive && (state.isPlaying || state.isProjected)`).
4. **Bilingual Localization Expansion & Zero Hardcoding (`keys.ts`, `catalogue-en.ts`, `catalogue-id.ts`)**:
   - Strictly prohibit hardcoded Indonesian or English text in JSX; all menu labels, dialogs, and tooltips must consume `useT().t(...)`.
   - Keep existing keys for single-presence items:
     - `media.drawer.deleteFromLocal` (EN: "Delete from Computer", ID: "Hapus dari Komputer")
     - `media.drawer.deleteFromCloud` (EN: "Delete from Cloud", ID: "Hapus dari Cloud")
   - Add new keys for the 3-way synced menu:
     - `media.drawer.deleteFromLocalOnly` (EN: "Delete from Computer Only", ID: "Hapus dari Komputer Saja")
     - `media.drawer.deleteFromCloudOnly` (EN: "Delete from Cloud Only", ID: "Hapus dari Cloud Saja")
     - `media.drawer.deleteBoth` (EN: "Delete Both (Computer & Cloud)", ID: "Hapus Keduanya (Komputer & Cloud)")

## Acceptance Criteria
- Adding a local file and uploading to cloud marks the item as `synced`.
- Deleting from computer only keeps the item visible in the playlist with status changed to `cloud-only` and download action available; physical source file on disk remains untouched.
- Deleting from cloud only keeps the item visible in the playlist with status changed to `local-only` and upload action available.
- Deleting both sends `DELETE ...?purge=true` and unlinks local storage, removing the item entirely from database, local index, and playlist UI.
- Reloading the page hydrates all cloud playlist items from SQLite backend without racing duplicate state writes.
- All new and existing deletion actions localize cleanly when switching between English and Indonesian, with 0 hardcoded strings.

## Comments
- Delivered in iteration I-2 of mandate DEC-100.
- Replaced legacy `source !== 'local'` guard with clean `availability`-derived 3-way deletion matrix in `MediaDrawer.tsx`.
- Implemented single-owner mount hydration in `PresenterOperator.tsx` querying `GET /api/media/playlist` and merging with `localMediaRegistry`.
- Correctly parsed backend array payload and mapped `content_url` and `duration_ms`.
- Added SHA-256 content deduplication in `addPlaylistItems` to prevent duplicate entries across reloads.
- Added full bilingual localization for 3-way deletion options in `keys.ts`, `catalogue-en.ts`, and `catalogue-id.ts`.
- Verified with 13 tests in `local-media-player.test.mjs` including runtime SHA-256 dedup tests and 3 defect injection proofs.
- Peer reviewed and ratified with SETUJU by DeepSeek Pro (`deepseekpro` via CodeBuddy CN).
