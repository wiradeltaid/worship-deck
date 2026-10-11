# SPEC-111 — Direct Local Media Playback, Service Worker Streaming, and Top Control Bar Ergonomics

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-23` (Transition Style Is One Value, Described Once, Consumed Identically) — governs media transition timing and enter/exit easing.
  - `AD-24` (Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It) — Room display renders exclusively media content; operator chrome is never projected.
  - `AD-10` (presenter-authority BroadcastChannel, state-not-instruction, idempotent-on-the-wire) — governs presenter-authored `ProjectedSource.kind: 'media'` with `source: 'local' | 'cloud'`.
  - `AD-29` (The Projector Reports Its Own Liveness and Nothing Else, and One Predicate Decides It) — projector reports media status acknowledgment and error reasons.
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser) — Presenter console maintains single authority over media projection and slide controls. Local media playback and projection extends FR-16 per maintainer directive.
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync) — Extended to include local media playlist persistence, client-side Service Worker video projection, and top-bar panic controls.
- **Components**: `presenter`
- **Touches**: `operator-present`, `projector-client`, `present-channel`

---

## 1. Problem Statement & User Need

In sanctuary operations, church operators frequently bring flash drives or local hard drives containing background music (MP3/WAV) or testimony/announcement videos (MP4/WebM) 500 MB – 1 GB shortly before service begins.

SPEC-110 introduced an in-console media player, but suffered from critical operational limitations identified during hand testing:
1. **Mandatory Remote Upload**: Media files were forcibly uploaded to the VPS backend via `POST /api/upload`. For 500 MB – 1 GB files, this consumes significant time, burns internet bandwidth, and fails completely if sanctuary internet is offline or slow.
2. **Ephemeral In-Memory Playlist**: Playlists were wiped upon tab reload, forcing re-selection every service.
3. **Bottom Dock Ergonomic Hazard (Scroll Issue)**: The media dock was placed at the bottom of the page container. When the slide list or rundown is long, the dock was pushed down below the fold, forcing operators to scroll to the bottom of the page to reach transport or panic controls.

---

## 2. Core Architectural & UX Decisions

### 2.1 Persistensi Pointer Berkas Lokal: File System Access API & IndexedDB
- **Handle Storage, Not Binary Data**: Local files are selected using `window.showOpenFilePicker({ multiple: true })`. The resulting `FileSystemFileHandle` objects are persisted in IndexedDB (`worship-deck-media` database, `local-handles` store). No large video/audio binary is saved to `localStorage` or browser storage.
- **Global Shared Playlist**: Per maintainer directive, the playlist is stored under a global key (`worship-deck-global-media-playlist`), decoupled from individual `serviceId`, providing a shared media library across all worship services.
- **Permission Lifecycle (User Gesture Invariant)**: On application load, `handle.queryPermission({ mode: 'read' })` runs in the background. If status is `'prompt'`, UI displays badge `[LOKAL · Klik untuk izinkan]`. Calling `handle.requestPermission({ mode: 'read' })` is strictly attached to an operator click event to satisfy browser security constraints.
- **Stale Handle & Relink Policy**: If a USB drive is unplugged or file is moved, `handle.getFile()` throws `NotFoundError`. The item transitions to `missing-handle` with badge `[LOKAL · Colok Flashdisk]` without being deleted from the playlist. A "Hubungkan Ulang" button allows re-selecting the file and updating the handle under the same ID.
- **Platform Matrix**: Supported in Chromium-family browsers (Google Chrome, Microsoft Edge) and Windows WebView2 desktop executable. Non-Chromium browsers fall back gracefully with a message indicating local handle persistence requires Chrome, Edge, or the desktop app.

### 2.2 Proyeksi Video Lokal Lintas Window: Service Worker HTTP 206 Range Streamer (Opsi B)
- **Zero RAM Duplication / Zero OOM**: Literal `postMessage` Blob transfer (Opsi A) is rejected because cloning 500 MB – 1 GB blobs across windows duplicates RAM and risks browser process OOM crashes.
- **Virtual Media Streamer**: A client-side Service Worker intercepts same-origin requests to `/local-media/:id` and serves `HTTP 206 Partial Content` with `Accept-Ranges: bytes` using `file.slice(rangeStart, rangeEnd)`.
- **Termination-Proof Handle Resolution**: Because Service Worker shares origin with the application, the Service Worker reads `FileSystemFileHandle` directly from the same IndexedDB database (`worship-deck-media`), eliminating race conditions on worker termination/restart.
- **Robust Range Support**: Handles single `bytes=start-end`, open-ended `bytes=start-`, and suffix `bytes=-suffix` ranges. Returns `HTTP 416 Range Not Satisfiable` with `Content-Range: bytes */size` if `start >= file.size`.
- **Audio Routing Invariant**: The operator laptop audio output (headphone jack / USB audio interface connected to the sanctuary sound system mixer) is the **sole congregation-audible channel** for both audio BGM and projected video. The projector window video (`ProjectedMediaLayer.tsx`) is **strictly enforced as `muted = true`** upon mount and on every sync update to eliminate HDMI audio loop feedback. Panic controls (Fade Out ~3s linear attenuation, Mute, Volume, Pause) operate directly on this operator console audio engine.

### 2.3 Pemindahan Kontrol Media: Top Control Bar di Atas Slide Monitor
- **Zero-Scroll Eye-Level Layout**: Per maintainer directive, the media dock is removed from the bottom of the page and repositioned as a horizontal bar (`MediaTopBar`) directly below the header cluster (under `presenter-header-row-3`) and directly above the Current Slide and Next Slide monitors in `PresenterOperator.tsx`.
- **Dynamic Collapse**: Height is 0 when no media is loaded/active. When media is loaded, it expands to height ~40–44px.
- **Full Panic Control Group**: Play/Pause, Fade Out (~3s linear attenuation with auto-pause and volume restore), Mute, and Take Off Screen remain immediately accessible in 1 click even during Presentation Lock, with `onMouseDown={(e) => e.preventDefault()}` to preserve global `Space` slide navigation.

### 2.4 Presenter Channel Recovery & Liveness Protocol
- **State on the Wire (`AD-10`)**: `ProjectedSource.kind: 'media'` with `source: 'local' | 'cloud'` travels with `planIdentity`, `at`, and `revision`.
- **Resync on Reload**: When the projector tab reloads or reconnects, it sends `request-sync`. Presenter replies with authoritative `sync` including current `mediaId`, `mediaTime`, and `isPlaying`.
- **Projector Status Acknowledgment (`AD-29`)**: Projector reports `projector-media-status` message (`attached` | `unavailable`, with closed reasons: `'sw-unregistered'`, `'handle-missing'`, `'io-error'`, `'decode-error'`). Fail-closed fallback to `{ kind: 'deck' }` is enforced on unmount or I/O error.

### 2.4 Pembedaan Sumber Media Visual (`[LOKAL]` vs `[CLOUD]`)
- Every item in `MediaDrawer.tsx` displays an unmistakable badge: `[LOKAL]` (with drive/file status) vs `[CLOUD]` (stored on VPS server).

---

## 3. Storage & Resilience Architecture

```
Presenter Console (Operator)
  ├─ User adds local file via showOpenFilePicker()
  ├─ Save FileSystemFileHandle to IndexedDB ('local-handles')
  ├─ Register handle to Service Worker (via MessageChannel)
  ├─ Broadcast sync to Projector: { kind: 'media', mediaUrl: '/local-media/:id', source: 'local' }
  └─ MediaTopBar (below header, above slides) controls play/fade/mute

Projector Window (Congregation Screen)
  ├─ Receives BroadcastChannel message
  ├─ Loads <video src="/local-media/:id" muted>
  └─ Service Worker intercepts and streams file.slice() with HTTP 206 Partial Content
```

- **Fail-Closed Flashdisk Unplug Guard**: If the local file handle fails during playback, the media engine immediately halts, displays an operator toast, and automatically sends `{ kind: 'deck' }` to the projector, ensuring the sanctuary screen cleanly returns to the active slide without hanging.

---

## 4. Component Architecture & File Layout

- `<src/operator/present/media-player/local-media-registry.ts>`: IndexedDB handle storage, global playlist persistence, and permission lifecycle.
- `<public/media-sw.js>` (or integrated Vite Service Worker): Intercepts `/local-media/:id` and serves 206 Partial Content range slices.
- `<src/operator/present/media-player/MediaTopBar.tsx>`: Relocated horizontal control bar mounted between header and slide monitors.
- `src/operator/present/media-player/MediaDrawer.tsx`: Updated with local file picker, `[LOKAL]` / `[CLOUD]` badges, and permission prompts.
- `src/operator/present/media-player/playlist-model.ts`: Extended with `MediaSource = 'local' | 'cloud'` and local availability statuses.
- `src/lib/present-channel.ts`: Extended wire protocol supporting `source: 'local' | 'cloud'`.
- `tests/local-media-player.test.mjs`: Comprehensive guard test suite verifying zero remote upload, mute invariant, top dock positioning, and fail-closed unplug safety.

---

## 5. Ticket Breakdown

1. **`SPEC-111-01`**: Local Media Registry & File System Access Handle Persistence in IndexedDB
2. **`SPEC-111-02`**: Service Worker Virtual Media Streamer (Option B) for Web & Desktop Range Streaming
3. **`SPEC-111-03`**: Top Media Control Bar Relocation Above Slide Monitors & Drawer Local Picker UI
4. **`SPEC-111-04`**: Absence Guard Test Suite & Injected Defect Verification
