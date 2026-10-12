---
type: decision
id: DEC-101
status: applied
accepted_by: 'kodesh87 (2026-10-12)'
touches:
  - src/operator/present/media-player/MediaStage.tsx
  - src/operator/present/media-player/MediaControlBar.tsx
  - src/operator/present/media-player/MediaDrawer.tsx
  - src/operator/present/media-player/playlist-model.ts
  - src/operator/present/PresenterOperator.tsx
  - tests/local-media-player.test.mjs
  - .how/presenter/SDD-presenter.md
  - .how/presenter/02-contracts/02-present-channel.md
supersedes: null
superseded_by: null
created: '2026-10-12'
---

# DEC-101 — Persistent Video Projection with Slide Fallback, Browser-Local Playback Preferences, and List Removal Semantics

## Context

In sanctuary presentation operations, operators regularly alternate between hymn/scripture slides and media items (pre-service background music, intro videos, pastoral announcements, and sermon testimonies).
During interactive testing of the media player suite (Turn 3–12), several operational frictions emerged:
1. **Projection De-arming on Track Advance**: When video projection was armed, auto-advancing to the next playlist item or manually selecting a track immediately disarmed video projection (`isProjected = false`), forcing the operator to re-arm projection manually for every video.
2. **Audio Playback Under Armed Projection**: Operators who arm video projection before playing background music saw projection fail or deactivate because audio elements have no video surface to project to the sanctuary display.
3. **Ephemeral Transport Preferences**: Shuffle and Repeat toggles were stored only in ephemeral component state, resetting upon browser reload, and advance logic was artificially restricted to audio only rather than treating the media playlist uniformly.
4. **Local Deletion Semantics & File System Sandbox**: Volunteers were confused by the label *"Remove from computer"*, fearing that local files in their personal folders would be physically deleted from disk, when in reality the browser only unlinks IndexedDB file handle pointers. Furthermore, deleting an active track caused `MEDIA_ERR_4: MEDIA_ELEMENT_ERROR: Empty src attribute` due to `.load()` calls on empty source URLs.

## Decision

1. **Persistent Video Projection & Automatic Slide Fallback**:
   - `Project Video` acts as a deliberate persistent projection intent switch on the presenter console.
   - Once armed by the operator, `isProjected` remains persistently `true` across track auto-advances and playlist selections.
   - When playing audio while video projection is armed, the system automatically falls back to streaming the slide deck to the sanctuary screen, displaying a `Live (Slide)` / `Tayang (Slide)` indicator on the control bar.
   - When a video begins playback, the sanctuary screen immediately returns to video projection without requiring operator intervention.
   - Video projection turns off only when explicitly disarmed by the operator via the control button (*Take Off* / *Turunkan*).

2. **Local Storage Persistence for Transport Preferences**:
   - Operator transport preferences are persisted in browser `localStorage` under `MEDIA_SHUFFLE_STORAGE_KEY` (`worship-deck:media-shuffle`) and `MEDIA_REPEAT_STORAGE_KEY` (`worship-deck:media-repeat`).
   - Preferences survive page reloads, tab navigation, and presenter session renewals.

3. **Unified All-Media Transport Advance & Native Loop**:
   - Shuffle and Repeat modes apply uniformly to all media types (both audio and video).
   - In Repeat One mode, native `<audio loop>` and `<video loop>` DOM attributes are bound, eliminating inter-loop latency and desynchronization drift.

4. **Playlist Removal Semantics & Copywriting**:
   - Physical media files on disk are never altered or deleted by the browser.
   - To reflect reality accurately, deletion copy is updated from *"Remove from computer"* to *"Remove from list"* / *"Hapus dari daftar"*.

5. **Drawer Filter Dropdown & Status Icon Cluster**:
   - The media filter bar is unified into a `<Select>` dropdown (`All`, `Cloud Only`, `Computer Only`, `Synced (Both)`).
   - Status indicators (`Cloud`, `Computer`, `Synced`) are positioned immediately to the left of the `...` More Menu, with the `[SEND / LIVE]` badge preceding the status icon.

6. **HTMLMediaElement Error Suppression**:
   - `MediaStage.tsx` guards against calling `.load()` on empty source URLs, explicitly unsets `src` via `removeAttribute('src')` during playlist teardown, and suppresses synthetic error events during element unmount.

## Why

This decision provides a seamless, zero-distraction presentation experience for volunteer operators. The sanctuary congregation never sees black or broken screens during audio transitions, preferences are remembered across services, and volunteer operators are not alarmed by ambiguous file deletion warnings.

## Cost

When video projection is armed, the operator must remember to click *Take Off* / *Turunkan* if they wish to project slides permanently during video playback.
