# SPEC-112-02 — Media Player Suite Bilingual Reconciliation

**Satisfies:** [UC-10, FR-16, FR-25]
**Blocked by:** ["SPEC-112-01"]
**Status:** closed

## Summary
Refactor all components in `src/operator/present/media-player/` to consume `useT()` from `@/lib/i18n/operator`, replacing hardcoded Indonesian strings with dual-language translation keys (`media.*`) and dynamic interpolation.

## Auditable Component Scope
- `src/operator/present/media-player/MediaDrawer.tsx`
- `src/operator/present/media-player/MediaTopBar.tsx`
- `src/operator/present/media-player/MediaStatusBadge.tsx`
- `src/operator/present/media-player/MediaUploader.tsx`
- `src/operator/present/media-player/MediaLauncherButton.tsx`
- `src/operator/present/media-player/MediaDock.tsx`
- `src/operator/present/media-player/MediaStage.tsx`

## Key Responsibilities
1. **`MediaDrawer.tsx`**:
   - Replace `"Pustaka Media"`, `"Pustaka Cloud"`, `"Media Laptop"` with `t('media.drawer.*')`.
   - Localize empty state messages, reorder/transport tooltips, delete restrictions, and projector live toggles.
   - Localize local storage header, "Tambah Media", and "Tersedia" badges.
2. **`MediaStatusBadge.tsx`**:
   - Replace 4-state labels with `t('media.badge.*')` using `{percent}` interpolation:
     - `local`: "Tersedia di lokal" / "Available locally"
     - `downloading`: `t('media.badge.downloading', { percent: Math.round(progress) })` ("Mengunduh {percent}%" / "Downloading {percent}%"), action: "Batal" / "Cancel"
     - `detached`: "File terlepas" / "File detached", action: "Sambungkan ulang" / "Reconnect"
     - `streaming-only`: "Streaming", action: "Unduh" / "Download"
3. **`MediaTopBar.tsx`**:
   - Localize panic control buttons (Play/Pause, Stop, Fade, Mute, Take Off Screen / Project Video).
   - Localize source indicator badge (`Lokal` | `Cloud` / `Local` | `Cloud`).
   - Localize idle placeholder and drawer launcher button title/label with `{count}` interpolation.
4. **`MediaUploader.tsx`, `MediaDock.tsx`, `MediaStage.tsx`, `MediaLauncherButton.tsx`**:
   - Localize file size warnings, format error messages, toast errors, and transport controls.

## Acceptance Criteria
- Toggling `ui_locale` between English and Bahasa Indonesia in Admin Settings dynamically updates all Media Drawer, Top Bar, and Status Badge labels without hardcoded residue.
- All existing SPEC-111 tests in `tests/local-media-player.test.mjs` continue to pass cleanly.

## Comments
