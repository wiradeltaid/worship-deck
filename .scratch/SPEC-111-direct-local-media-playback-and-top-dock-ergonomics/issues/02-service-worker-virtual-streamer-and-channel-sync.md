# SPEC-111-02 — Service Worker Virtual Media Streamer & Cross-Window Channel Sync

**Satisfies:** [UC-12, FR-16]
**Blocked by:** [SPEC-111-01]
**Status:** open

## Summary
Implement a client-side Service Worker virtual streamer (Option B) providing HTTP 206 Partial Content range requests for local media across Presenter and Projector windows without remote server upload, with robust presenter-channel recovery contracts.

## Key Responsibilities
1. **Service Worker Virtual Streamer**:
   - Register Service Worker at SPA scope (`<public/media-sw.js>` or integrated entrypoint).
   - Ensure presenter checks `navigator.serviceWorker.ready` before broadcasting media sync.
   - Intercept same-origin `fetch` requests matching `/local-media/:id`.
   - Read `FileSystemFileHandle` directly from IndexedDB `worship-deck-media` (`local-handles` store) so Service Worker wakeups after browser idle termination do not depend on volatile memory maps.
   - Robust byte-range parsing: handle single `bytes=start-end`, open-ended `bytes=start-`, and suffix `bytes=-suffix`.
   - Return `HTTP 416 Range Not Satisfiable` with `Content-Range: bytes */size` if `start >= file.size`.
   - Return `HTTP 206 Partial Content` with `Content-Range`, `Content-Length`, `Accept-Ranges: bytes`, and accurate `Content-Type`.
2. **`present-channel.ts` Wire Protocol & Recovery**:
   - Extend `ProjectedSource`:
     ```ts
     | {
         kind: 'media';
         mediaId: string;
         mediaUrl: string;       // cloud: "/api/uploads/..."; local: "/local-media/:id"
         source: 'local' | 'cloud';
         isPlaying: boolean;
         mediaTime: number;
         at: number;
         revision: number;
       }
     ```
   - Support `request-sync` replay with authoritative `sync` message containing `planIdentity`, `at`, and `revision`.
   - Extend `ProjectorMediaStatusMessage` acknowledgment with closed reason codes: `'sw-unregistered'`, `'handle-missing'`, `'io-error'`, `'decode-error'`.
   - Fail-closed fallback to `{ kind: 'deck' }` if source is invalid or unready.
3. **Audio Routing & Projector Video Integration (`ProjectedMediaLayer.tsx`)**:
   - Operator laptop audio output (headphone jack / USB interface connected to church sound system mixer) is the sole audible channel for BGM and video audio.
   - Projector window video (`ProjectedMediaLayer.tsx`) is strictly enforced as `muted = true` upon mount and on every state sync update to eliminate HDMI audio loop feedback.
   - Clock drift sync and fail-closed fallback to `{ kind: 'deck' }` on file read error.

## Acceptance Criteria
- Video seeking/scrubbing on local files operates with instant response via HTTP 206 range requests.
- Zero server upload: zero bytes are transmitted to remote servers when projecting local files.
- Projector window video remains strictly muted under all playback conditions.
- Resync on reload: Projector reconnects cleanly and resumes playback state without orphan video.
- Service Worker registration works identically in web browser mode and WebView2 desktop executable mode.
