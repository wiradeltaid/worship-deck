---
type: decision
id: DEC-098
status: applied
accepted_by: 'DEC-097'
touches:
  - src/operator/present/media-player/storage-ladder.ts
  - tests/local-media-player.test.mjs
  - .scratch/SPEC-111-direct-local-media-playback-and-top-dock-ergonomics/
supersedes: null
superseded_by: null
created: '2026-10-11'
---

# DEC-098 — Storage Ladder, WebView2 File System Access, and Service Worker Stream Resolution for Local Media Playback

## Context

In sanctuary operations, church operators frequently bring USB flash drives or external drives containing background music (MP3/WAV) or testimony/announcement videos (MP4/WebM) 500 MB – 1 GB shortly before service begins.
SPEC-110 required mandatory remote upload to the VPS backend, failing completely if sanctuary internet is offline or slow.

SPEC-111 introduces direct local media playback, a conscious offline downloader, and a persistent two-tab media library.
To ensure robustness across Google Chrome, Microsoft Edge, and the packaged desktop application (`WorshipDeck.exe` running on Microsoft Edge WebView2), a capability spike was conducted to establish:
1) Platform directory picker support and persistence;
2) Service Worker media streaming and handle resolution;
3) Storage hierarchy and fallback behavior.

## Decision

1. **Storage Ladder Hierarchy**:
   - **Tier 1 (Primary)**: File System Access API (`window.showDirectoryPicker()`). The operator selects their sanctuary media folder once (e.g. `D:\WorshipDeck\Media`), and the directory handle is stored in IndexedDB (`local-handles`).
   - **Tier 2 (Automated Sandbox Fallback)**: Origin Private File System (`navigator.storage.getDirectory()` / OPFS). Activated when `showDirectoryPicker()` is unavailable (unsupported browser or sandboxed execution) or denied by operator policy. The UI labels this honestly as *"Penyimpanan internal aplikasi"* without fake folder navigation.
   - **Tier 3 (Ephemeral Fallback)**: In-Memory / Blob URL routing. Used when both disk persistence tiers are inaccessible or during emergency single-file selection via `showOpenFilePicker()` / `<input type="file">`.
   - **Prohibition**: `<a download>` is strictly prohibited as a media storage mechanism (it pollutes the user's personal Downloads directory and offers no stream integrity control).

2. **Durable Storage Invariant**:
   - The application explicitly calls `navigator.storage.persist()` on initial local setup to protect IndexedDB metadata and OPFS storage from browser storage eviction policies under disk pressure.

3. **Service Worker Handle & Stream Resolution**:
   - Service Worker contexts cannot reliably query OS permission dialogs across restarts for stored `FileSystemHandle` instances.
   - Therefore, the Service Worker virtual streamer (`/local-media/<sha256>`) delegates byte stream resolution to the active presenter client window via `MessageChannel` / `clients.matchAll()` or pre-registered in-memory `ReadableStream` / `Blob` references.
   - This ensures continuous, uninterrupted video and audio playback even when handles require foreground session re-affirmation.

4. **Audio Routing Invariant**:
   - The operator console window is the sole audio source (routing to the sanctuary audio mixer). The congregation projector window is strictly muted (`muted = true`, volume 0) to eliminate HDMI sound loop feedback.

## Why

This decision provides a rock-solid, zero-configuration local-first media playback pipeline that works offline in sanctuary conditions while maintaining compatibility across browser and desktop WebView2 runtimes.

## Cost if wrong

Choosing a single storage mechanism would fail in environments without File System Access API support (e.g. non-Chromium browsers or restricted WebView2 profiles), while relying on Service Workers for ambient handle access would cause silent playback stalls upon permission expiry.
