# SPEC-111-05 — Service Worker Virtual Streamer /local-media/:sha256 & Channel Sync

**Satisfies:** [UC-12, FR-16]
**Blocked by:** ["SPEC-111-04"]
**Status:** open

## Summary
Implement a client-side Service Worker virtual streamer serving HTTP 206 Partial Content range requests for local media across Presenter and Projector windows, with handle access bound to spike outcomes and strict controller verification.

## Key Responsibilities
1. **Service Worker Virtual Streamer**:
   - Service Worker registered at root scope (`<public/media-sw.js>`).
   - Handle-access implementation bound to Ticket 01 spike outcome: read directly from IndexedDB if supported in worker scope, or via `MessageChannel` port transfer from the client page.
   - Intercept same-origin `fetch` requests strictly matching `/local-media/:sha256`.
   - Pass through all non-media routes untouched.
   - Serve byte slices from `file.slice(rangeStart, rangeEnd)` with `HTTP 206 Partial Content`, `Content-Range`, `Content-Length`, `Accept-Ranges: bytes`, and accurate `Content-Type`.
   - Return `HTTP 416 Range Not Satisfiable` for out-of-bounds ranges (`start >= file.size`).
2. **`present-channel.ts` Wire Protocol**:
   - Extend `ProjectedSource`:
     ```ts
     | {
         kind: 'media';
         mediaId: string;
         mediaUrl: string;       // cloud: "/api/media/:id/content"; local: "/local-media/:sha256"
         source: 'local' | 'cloud';
         isPlaying: boolean;
         mediaTime: number;
         at: number;
         revision: number;
       }
     ```
   - Replay authoritative state on `request-sync`.
   - Projector reports `projector-media-status` (`attached` | `unavailable`, with closed reasons: `'sw-unregistered'`, `'controller-missing'`, `'handle-missing'`, `'io-error'`, `'decode-error'`).
3. **Mute Invariant**:
   - Operator laptop audio output (headphone jack / USB interface connected to church sound system mixer) is the sole congregation-audible channel.
   - Projector window video (`ProjectedMediaLayer.tsx`) strictly enforced as `muted = true` upon mount and on every sync update.

## Acceptance Criteria
- Local video scrubbing and seeking in projector window responds instantly via HTTP 206 without buffer delays.
- Projector video remains 100% muted under all playback conditions.
- Service Worker intercepts only the `/local-media/` namespace and passes all other network requests directly to server.
