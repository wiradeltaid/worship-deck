# SPEC-116-02 — Remote Read-Only Media Playlist Hydration, Media Drawer Track Selection, and Remote Audio Fade-Out

**Satisfies:** [UC-12, UC-29, FR-35]
**Blocked by:** ["SPEC-116-01"]
**Status:** open

## Summary
Enable read-only media playlist hydration on remote clients via `GET /api/media/playlist`, activate transport controls and seekbars in `MediaControlBar.tsx`, restore `MediaDrawer` opening on remote with destructive button suppression, enable track selection via `media-select-item` remote intent, and lift the remote gate specifically on the Fade Out button while keeping sound-desk volume controls host-managed.

## Key Responsibilities
1. **Read-Only Playlist Hydration on Remote (`PresenterOperator.tsx`)**:
   - In `PresenterOperator.tsx`, allow `fetch('/api/media/playlist')` on remote mode while strictly bypassing `localMediaRegistry.hydrate()`.
   - Dispatch `store.dispatch({ type: 'SET_ITEMS', items: mergedItems })` so `mediaStore.items` is populated on remote devices.
   - When host mirrors active media state over SSE, `activeItem` resolves correctly, setting `isCued = true` and enabling transport buttons on mobile.
2. **Media Drawer Access with Mutation Isolation (`PresenterOperator.tsx`, `MediaDrawer.tsx`)**:
   - In `PresenterOperator.tsx`, set `onOpenDrawer={() => setMediaDrawerOpen(true)}` even when `mode === 'remote'`, and mount `<MediaDrawer>` on remote mode with `isRemote={mode === 'remote'}`.
   - In `MediaDrawer.tsx`, accept `isRemote?: boolean`:
     - Hide file upload inputs, delete buttons, and drag-and-drop ordering when `isRemote` is true.
     - Allow clicking a playlist track to dispatch `onRemoteMediaIntent({ type: 'media-select-item', id: item.id, planIdentity })`.
3. **Selective Transport Gate Un-Gating (`MediaControlBar.tsx`)**:
   - Remove `|| isRemote` exclusively from the `media-control-bar-fade` button.
   - Keep volume sliders and local mute toggles disabled on remote mode (`disabled={... || isRemote}`) as physical audio volume and mute are sound-desk responsibilities.

## Acceptance Criteria
- When paired on mobile, the media control bar displays the active track name, duration, and cued status instead of "No media loaded".
- Media transport buttons (`Play`, `Prev`, `Next`, `Stop`, `Project Video`, `Fade`) are enabled on the mobile remote console.
- Clicking the Media button opens the Media Drawer on mobile, showing the playlist items without file upload or delete buttons.
- Clicking a song in the remote drawer selects and cues the track on the host workstation.
- Clicking Fade Out on mobile initiates audio attenuation on the host PC.
