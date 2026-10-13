# SPEC-117-04 — Remote Local Computer Media Playlist Manifest Mirroring, Multi-Source Availability & Remote Cueing

**Satisfies:** [UC-12, UC-29, FR-35]
**Blocked by:** ["SPEC-117-03"]
**Status:** open

## Summary
Mirror the host workstation's complete media playlist manifest (including local computer tracks stored in host IndexedDB) to connected mobile remote consoles via SSE. Display both cloud and computer songs in the remote media drawer with appropriate source badges, and enable remote selection and cueing of computer songs on the host machine without requiring local file downloads on mobile.

## Key Responsibilities
1. **Contracting Playlist Manifest Telemetry (`src/lib/presenter-remote-client.ts`)**:
   - Define `PlaylistItemSummary`:
     ```typescript
     export interface PlaylistItemSummary {
       id: string;
       name: string;
       type: 'audio' | 'video';
       source: 'cloud' | 'local';
       duration: number;
       orderKey?: number;
     }
     ```
   - Extend `RemoteControlSessionState['media']`:
     ```typescript
     playlistManifest?: PlaylistItemSummary[];
     ```
2. **Host-Side Manifest Telemetry Emission (`src/operator/present/PresenterOperator.tsx`)**:
   - In `PresenterOperator.tsx` (host mode), when `mediaStore` updates or when a remote client connects, derive `playlistManifest` from `mediaStore.getSnapshot().items` and broadcast it via `remoteSessionRef.current?.broadcastState({ media: { ...snap, playlistManifest } })`.
3. **Remote Playlist Hydration, Deduplication & Manifest Integration (`src/operator/present/PresenterOperator.tsx`, `MediaDrawer.tsx`)**:
   - **Authoritative Manifest Merge Rule**: On remote mode, when `playlistManifest` arrives via SSE (or controlled state), it serves as authoritative SSOT for playlist items.
   - **Deduplication by `id`**:
     - Remote merges manifest entries into `mediaStore.items`: items already hydrated from initial `GET /api/media/playlist` with matching `id` are updated with the manifest's authoritative ordering and metadata.
     - New local computer items (`source: 'local'`) from the manifest are appended into `mediaStore.items` with `url: ''` (placeholder URL).
     - Items removed on host are purged from remote `mediaStore.items`.
     - Sorting preserves `orderKey` / list index from the host manifest.
   - **Telemetry-Only UX for Active Local Tracks**:
     - When a local computer song (`source: 'local'`, `url: ''`) is active, `MediaControlBar` renders the song title, duration, time counters, and scrubbar strictly based on mirrored telemetry (`currentTime`, `duration`, `isPlaying`) received from the host via SSE.
     - Remote does not attempt local audio element playback, blob fetching, or network requests for local tracks, strictly honoring AD-24 surface isolation.
   - In `MediaDrawer.tsx`: render computer items with the `[COMPUTER]` / `HardDrive` badge alongside cloud items with the `[CLOUD]` / `Cloud` badge.
   - When a remote operator clicks a computer item, dispatch `media-select-item` with the item's `id` to the host workstation.
4. **Authoritative Host Execution (`presenter-remote-client.ts`, `PresenterOperator.tsx`)**:
   - When host receives `media-select-item` for a local computer song, select the track in `mediaStore` and load the local file handle/blob into `mediaEngine`, broadcasting active playback state back to remote.

## Acceptance Criteria
- When a host workstation has local songs imported from the computer, the paired mobile remote console displays all local songs in the Media Drawer alongside cloud songs.
- Deduplication prevents duplicate playlist rows between initial cloud hydration and arriving host manifest.
- Local songs are clearly designated with the `Computer` / `HardDrive` indicator badge.
- Clicking a computer song from the remote mobile drawer selects and cues the song on the host workstation.
- When a local song is active, remote MediaControlBar renders playback status and time counters in telemetry mode without local audio playback errors.
- Mobile device never downloads or buffers the raw media file, preserving battery and mobile data bandwidth while strictly enforcing AD-24 surface isolation.
- Automated tests in `tests/presenter-media-player.test.mjs` and `tests/remote-presenting-client.test.mjs` pass cleanly.
