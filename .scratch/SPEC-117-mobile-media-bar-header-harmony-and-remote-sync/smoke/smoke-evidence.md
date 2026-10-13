# Smoke Test Evidence — SPEC-117: Mobile Media Bar Ergonomics, Header Layout Harmony, Bidirectional Presentation Telemetry, and Remote Local Media Manifest

**Date:** 2026-10-13
**Scope:** SPEC-117 (`SPEC-117-01`, `SPEC-117-02`, `SPEC-117-03`, `SPEC-117-04`)
**Command:** `npm run smoke:spec-117`
**Suites:**
- `tests/remote-presenting-client.test.mjs`
- `tests/remote-screen.test.mjs`
- `tests/presenter-media-player.test.mjs`
- `tests/presenter-guest-feed-controls.test.mjs`
- `tests/remote-control-go-http.test.mjs`
- `tests/bilingual-i18n-parity.test.mjs`

## Test Results

- Total tests: 130
- Passing: 130
- Failing: 0
- Suites: 6
- Duration: ~6.4s

## Verifications Covered

1. **SPEC-117-01 (Responsive 2-Row MediaControlBar Layout and Mobile Touch Ergonomics)**:
   - Responsive container restructuring using `flex flex-col md:flex-row h-auto md:h-13 py-2 md:py-0`.
   - Dedicated Row 1 housing track metadata, full-width scrubbable seekbar, and drawer launcher button.
   - Dedicated Row 2 organizing transport controls (`SkipBack`, `Play`/`Pause`, `SkipForward`, `Square`, `TrendingDown`), volume slider, mode toggles (`Shuffle`, `Repeat`), and `Project Video` button.
   - Desktop flattening via `md:contents` preserving single horizontal row (`h-13`) without layout shift.
   - Mobile touch target minimum sizing (`min-w-[40px]` on Play/Pause).
2. **SPEC-117-02 (Presenter Header Layout Harmony & Streamlined Compact Guest Controls)**:
   - Header action consolidation on remote mode in Row 1 (`[Request Congregation Screen Reopen]`, `[All slides]`, `[Unlock/Lock Service]`).
   - Elimination of displaced external projector reopen button sibling from presenter header.
   - Streamlined compact guest feed controls on live capture: suppression of redundant read-only device picker dropdown and secondary Disarm button when `isRemote && uiState === 'confirmed-live'`.
   - High-contrast live badge and high-priority `[Revert to Deck (Esc)]` action preserved.
3. **SPEC-117-03 (Bidirectional Presentation Telemetry Synchronization over SSE)**:
   - Host-side real-time broadcast of slide index (`setIndexAndSync`), blank screen (`setBlankAndSync`), slide transition (`setTransitionAndSync`), background overrides (`setBackgroundAndSync`), and presentation lock (`presentation-lock-toggle`).
   - Extended `RemoteControlSessionState` contract declaring `presentationLock?: boolean`.
   - Remote consumption in `RemoteOperator.tsx` via `handleStateUpdate` and `controlledState`.
   - Echo-guard invariant strictly verified: remote state application updates local React state without re-dispatching intent loopbacks.
4. **SPEC-117-04 (Remote Local Media Playlist Manifest Mirroring & Unified Cueing)**:
   - Definition of `PlaylistItemSummary` interface and `playlistManifest` in `RemoteControlSessionState['media']`.
   - Host-side playlist manifest broadcast on `mediaStore` updates and initial remote connection.
   - Remote `SYNC_MANIFEST` action in `mediaStore` with authoritative deduplication: local computer tracks added with `url: ''`, existing tracks updated, and pruned tracks removed.
   - Telemetry-only UX for active local computer songs: zero network downloads or blob requests on mobile device, strictly enforcing AD-24 surface isolation.
   - Remote drawer cueing via `media-select-item` intent dispatching and host-side execution.
