# SPEC-111-06 — Two-Tab MediaDrawer UI, 4-State Badge Contract, and Manual Local Import

**Satisfies:** [UC-12, FR-16]
**Blocked by:** ["SPEC-111-05"]
**Status:** open

## Summary
Implement the two-tab layout in `MediaDrawer.tsx` (Pustaka Cloud vs Media Laptop), the accessible 4-state status badge contract without emojis, and manual local file import.

## Key Responsibilities
1. **Two-Tab Structure (`MediaDrawer.tsx`)**:
   - Tab 1: `Pustaka Cloud` (default) displaying cloud media items fetched from `GET /api/media/playlist`.
   - Tab 2: `Media Laptop` displaying all offline-ready local media items (downloaded files and manual imports).
2. **Accessible 4-State Badge Contract**:
   - Strictly avoid emojis; render accessible SVG icons from icon registry alongside visible text labels:
     - `streaming-only`: "Streaming" (neutral token), action `[Unduh]`.
     - `downloading`: "Mengunduh N%" (info token), `role="progressbar"`, action `[Batal]`.
     - `local`: "Tersedia di lokal" (success token), badge only.
     - `detached`: "File terlepas" (warning token), action `[Sambungkan ulang]`.
   - `Sambungkan ulang` triggers `requestPermission` on the directory handle in one user gesture, restoring all files in that folder.
3. **Manual Local Import**:
   - Provide "Tambah Media Lokal" button on `Media Laptop` tab using `window.showOpenFilePicker`.
   - Hash imported files in the Web Worker; if SHA-256 matches a Cloud item, automatically link and transition badge to `local`.

## Acceptance Criteria
- Clicking between `Pustaka Cloud` and `Media Laptop` tabs preserves scroll position and playback state.
- Badges render accessible SVG icons and text labels without emoji characters.
- Manual local file import accurately links matching cloud items without uploading bytes.
