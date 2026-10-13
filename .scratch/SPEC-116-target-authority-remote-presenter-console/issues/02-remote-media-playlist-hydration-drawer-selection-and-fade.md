# SPEC-116-02 — Remote Read-Only Media Playlist Hydration, Media Drawer Track Selection, Discrete Up/Down Reordering, Remote Volume Control, and Audio Fade-Out

**Satisfies:** [UC-12, UC-29, FR-35]
**Blocked by:** ["SPEC-116-01"]
**Status:** open

## Summary
Enable read-only media playlist hydration on remote clients via `GET /api/media/playlist`, activate transport controls and seekbars in `MediaControlBar.tsx`, restore `MediaDrawer` opening on remote with destructive button suppression, enable track selection via `media-select-item` remote intent, enable discrete track reordering via `ChevronUp` and `ChevronDown` arrow buttons using `media-reorder-item` intent, lift the remote gate on the Fade Out button, and enable remote volume slider and mute toggle via `media-set-volume` and `media-set-mute` remote intents with bidirectional volume/mute SSE state mirroring.

## Key Responsibilities
1. **Read-Only Playlist Hydration on Remote (`PresenterOperator.tsx`)**:
   - In `PresenterOperator.tsx`, allow `fetch('/api/media/playlist')` on remote mode while strictly bypassing `localMediaRegistry.hydrate()`.
   - Dispatch `store.dispatch({ type: 'SET_ITEMS', items: mergedItems })` so `mediaStore.items` is populated on remote devices.
   - When host mirrors active media state over SSE, `activeItem` resolves correctly, setting `isCued = true` and enabling transport buttons on mobile.
2. **Media Drawer Access with Mutation Isolation & Discrete Reordering (`PresenterOperator.tsx`, `MediaDrawer.tsx`, `internal/httpapi/remote.go`, `presenter-remote-client.ts`)**:
   - In `PresenterOperator.tsx`, set `onOpenDrawer={() => setMediaDrawerOpen(true)}` even when `mode === 'remote'`, and mount `<MediaDrawer>` on remote mode with `isRemote={mode === 'remote'}`.
   - In `MediaDrawer.tsx`, accept `isRemote?: boolean`:
     - Hide file upload inputs, delete buttons, and direct file imports when `isRemote` is true.
     - Allow clicking a playlist track to dispatch `onRemoteMediaIntent({ type: 'media-select-item', id: item.id, planIdentity })`.
     - Keep `ChevronUp` and `ChevronDown` arrow buttons active on remote mode. When clicked, dispatch `onRemoteMediaIntent({ type: 'media-reorder-item', id: item.id, direction: 'up' | 'down', planIdentity })`.
   - In `internal/httpapi/remote.go`: add `media-reorder-item` to `allowedIntentTypes`, validating `id` string and `direction` ("up" | "down").
   - In `presenter-remote-client.ts`: add `media-reorder-item` intent and delegate on host to `mediaStore.dispatch({ type: 'MOVE_ITEM', fromIndex, toIndex })`.
3. **Remote Volume Slider, Mute Toggle, and Fade Out (`MediaControlBar.tsx`, `internal/httpapi/remote.go`, `presenter-remote-client.ts`, `PresenterOperator.tsx`)**:
   - Add `media-set-volume` (validating float 0.0 to 1.0) and `media-set-mute` (validating boolean) to Go backend whitelist `allowedIntentTypes`.
   - Add `{ type: 'media-set-volume'; volume: number; planIdentity: string }` and `{ type: 'media-set-mute'; muted: boolean; planIdentity: string }` to `PresenterRemoteIntent`.
   - In `MediaControlBar.tsx`, remove `|| isRemote` from `media-control-bar-fade`, `media-control-bar-mute`, and `media-control-bar-volume`.
   - In `handleToggleMute`: if `onRemoteMediaIntent`, dispatch `{ type: 'media-set-mute', muted: !state.isMuted, planIdentity }`.
   - In `handleVolumeChange`: if `onRemoteMediaIntent`, dispatch `{ type: 'media-set-volume', volume: newVolume, planIdentity }`.
   - On Host: `applyRemoteIntent` delegates to `mediaEngine.setVolume(volume)` and `mediaEngine.setMuted(muted)`, updating `mediaStore`.
   - Extend `RemoteControlSessionState['media']` with `volume?: number; isMuted?: boolean` so host mirrors active volume and mute state back to remote clients via SSE.

## Acceptance Criteria
- When paired on mobile, the media control bar displays the active track name, duration, and cued status instead of "No media loaded".
- Media transport buttons (`Play`, `Prev`, `Next`, `Stop`, `Project Video`, `Fade`, `Mute`, `Volume`) are enabled on the mobile remote console.
- Clicking the Media button opens the Media Drawer on mobile, showing the playlist items without file upload or delete buttons.
- Clicking a song in the remote drawer selects and cues the track on the host workstation.
- Clicking the `▲` (Up) or `▼` (Down) arrow button next to a track in the remote drawer moves the track up or down in the playlist on the host workstation.
- Adjusting the volume slider or clicking Mute on mobile dispatches `media-set-volume` / `media-set-mute` to the host PC, adjusting host software volume without unmuting the local phone speaker.
- Clicking Fade Out on mobile initiates audio attenuation on the host PC.
