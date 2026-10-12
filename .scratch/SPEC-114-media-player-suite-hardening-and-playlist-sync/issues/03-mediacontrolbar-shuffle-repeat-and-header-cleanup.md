# SPEC-114-03 — MediaControlBar Ergonomics: Shuffle, 3-State Repeat & Header Redundant Button Cleanup

**Satisfies:** [UC-12, FR-16, FR-25]
**Blocked by:** [SPEC-114-02]
**Status:** done

## Summary
Add Shuffle toggle and 3-state Repeat modes to `MediaControlBar.tsx`, integrate playback auto-advance logic in `MediaStage.tsx` with sanctuary-screen audio-only invariants, and clean up the redundant `<MediaLauncherButton>` from `PresenterOperator.tsx` header row 2.

## Key Responsibilities
1. **Shuffle & 3-State Repeat UI Controls (`MediaControlBar.tsx`)**:
   - Place Shuffle and Repeat buttons in the left control cluster adjacent to the Volume Slider and Panic controls.
   - **Shuffle Button**: Toggle between On and Off with `<Shuffle />` icon. Renders active primary styling when enabled.
   - **Repeat Button**: Cycle across `off` -> `all` -> `one` -> `off`. Renders `<Repeat />` (for `all`), `<Repeat1 />` (for `one`), or muted `<Repeat />` (for `off`) with informative tooltips.
2. **State & Store Integration (`playlist-model.ts`, `media-store.ts`)**:
   - Add `shuffle: boolean` (default `false`) and `repeatMode: 'off' | 'all' | 'one'` (default `'off'`) to `PlaylistState`.
   - Add actions `SET_SHUFFLE` and `SET_REPEAT_MODE` to `MediaStoreAction`.
3. **Playback Auto-Advance Engine & Invariant Rules (`MediaStage.tsx`, `playlist-model.ts`)**:
   - Create pure helper `resolveNextPlaylistItem(state: PlaylistState, rng?: () => number): PlaylistItem | null` in `playlist-model.ts`.
   - **Sanctuary Screen Invariant**: Auto-advance strictly selects **audio tracks only**. It must **never** auto-advance into a video track (preserving AD-24 sanctuary protection).
   - **Precedence Hierarchy**:
     - **Repeat-One Wins**: If `repeatMode === 'one'`, repeat the current track from 0s regardless of shuffle state.
     - **Repeat-All + Shuffle**: Traverses random unplayed audio tracks; upon exhausting audio items, resets shuffle history and loops.
     - **Repeat-All (Sequential)**: Advances sequentially; upon reaching the end, wraps to item 0 if audio.
     - **Repeat-Off**: Halts playback upon reaching the end of the playlist or after playing all tracks in shuffle.
4. **Header Cleanup (`PresenterOperator.tsx`)**:
   - Remove `<MediaLauncherButton>` from `PresenterOperator.tsx` header row 2 (leaving `MediaControlBar`'s integrated `[≡ Pustaka (N)]` button as the single canonical launcher).
   - Remove unused imports, props, and state bindings.
5. **Localization Expansion & Zero Hardcoding (`keys.ts`, `catalogue-en.ts`, `catalogue-id.ts`)**:
   - Strictly prohibit hardcoded Indonesian or English text in JSX; all button labels, tooltips, and aria-labels must consume `useT().t(...)`.
   - Add localization keys for Shuffle:
     - `media.controlBar.shuffleLabel` (EN: "Shuffle", ID: "Acak")
     - `media.controlBar.shuffleOn` (EN: "Shuffle: On", ID: "Acak: Aktif")
     - `media.controlBar.shuffleOff` (EN: "Shuffle: Off", ID: "Acak: Nonaktif")
   - Add localization keys for Repeat:
     - `media.controlBar.repeatLabel` (EN: "Repeat", ID: "Ulang")
     - `media.controlBar.repeatOff` (EN: "Repeat: Off", ID: "Ulang: Nonaktif")
     - `media.controlBar.repeatAll` (EN: "Repeat: All Tracks", ID: "Ulang: Semua Lagu")
     - `media.controlBar.repeatOne` (EN: "Repeat: Current Track", ID: "Ulang: Satu Lagu")

## Acceptance Criteria
- Shuffle toggle button cleanly switches shuffle mode on and off in MediaControlBar.
- Repeat button cycles cleanly across off, repeat all, and repeat one with distinct visual icons and tooltips.
- Track finishing playback with `repeat === 'one'` automatically replays the same track.
- Track finishing playback with `repeat === 'all'` loops the playlist upon reaching the end.
- Auto-advance never auto-plays into a video track (preserves sanctuary screen protection).
- Presenter console header row 2 no longer renders the redundant Media button next to Emergency Edit.
- All new Shuffle and Repeat buttons and tooltips render cleanly in English and Indonesian without raw hardcoded text.

## Comments
- Delivered in iteration I-3 of mandate DEC-100.
- Integrated Shuffle toggle and 3-state Repeat modes directly in MediaControlBar.
- Added pure helper `resolveNextPlaylistItem` strictly enforcing AD-24 sanctuary screen protection (video tracks never auto-advance; advance strictly selects audio only).
- Unified playback auto-advance and repeat-one replay in `MediaStage.tsx` through `engine` without timers.
- Cleanly removed redundant `<MediaLauncherButton>` and dead state (`mediaItemCount`, `mediaIsPlaying`, and dead subscription effect) from `PresenterOperator.tsx`.
- Verified green with 14 tests in `local-media-player.test.mjs`, 6 tests in `presenter-media-player.test.mjs`, and 2 defect injection absence proofs.
- Peer reviewed and ratified with SETUJU by DeepSeek Pro (`deepseekpro` via CodeBuddy CN).
