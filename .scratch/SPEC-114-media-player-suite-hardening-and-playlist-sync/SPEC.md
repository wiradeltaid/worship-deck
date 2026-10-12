# SPEC-114 — Media Player Suite Hardening: Dual-Door Sync, Unified 3-Way Deletion Matrix, Shuffle/Repeat, and Header Cleanup

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-24` (Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It) — Room display renders exclusively media content; operator chrome is never projected; video auto-advance to sanctuary screen is strictly forbidden without manual operator intent.
  - `AD-10` (presenter-authority BroadcastChannel, state-not-instruction, idempotent-on-the-wire) — Presenter authoring of `ProjectedSource.kind: 'media'` with identity binding.
  - `AD-29` (The Projector Reports Its Own Liveness and Nothing Else, and One Predicate Decides It) — Projector reports media status acknowledgment and error reasons.
  - `DEC-098` (Storage Ladder WebView2 File System Access, OPFS, and Service Worker Stream Resolution) — 3-tier storage ladder preservation.
  - WDI Coding Playbook 07 § 4 (Pemisahan Bahasa Antarmuka / UI Chrome vs Konten Bisnis).
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser) — Presenter console maintains single authority over media projection and slide controls.
  - `FR-25` (Display the Operator interface in the Operator's language) — Full bilingual localization via `useT()`.
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync) — Transport bar, single-list library, seek synchronization, and audio-video projection.
- **Components**: `presenter`
- **Touches**: `present-channel`, `uploads`

---

## 1. Problem Statement & Motivation

Hand-testing of the unified media control bar and single-list library delivered in SPEC-113 uncovered three distinct functional bugs and two ergonomic deficiencies:

1. **Bug #1 — Media Drawer Play/Pause Toggle Failure**:
   - *Reproduction*: Clicking Play on a track from `MediaDrawer.tsx` starts playback, but clicking the resulting Pause icon fails to pause.
   - *Root Cause*: `handlePlayItem` in `MediaDrawer.tsx` unconditionally dispatches `SELECT_ITEM` and calls `engine.play()`. It lacks logic to evaluate whether the target item is currently active and playing to trigger `engine.pause()`.

2. **Bug #2 — Projection Switching Desynchronization & Projector Loop**:
   - *Reproduction*: Playing Track A, then clicking Send (`KE LAYAR`) on Video B in `MediaDrawer.tsx` causes Video B to appear on the congregation screen and attempt playback, but Video B does not play locally and loops continuously over the first 1–3 seconds until the operator clicks Play/Pause on Video B.
   - *Root Cause*:
     - When `SELECT_ITEM` switches to Video B, `selectPlaylistItem` resets `currentTime: 0` but retains `state.isPlaying = true`.
     - In `MediaStage.tsx`, Video B's `<video>` source is updated and `.load()` is invoked, but `.play()` is never called.
     - Audio A is paused, leaving `<video>` in an unplayed DOM state at `currentTime = 0`.
     - `PresenterOperator.tsx` broadcasts `projection: { isPlaying: true, mediaTime: 0 }`. The projector starts playback.
     - Every 2 seconds, the PresenterOperator heartbeat reads local DOM time (`currentTime = 0`) and emits `mediaTime: 0, isPlaying: true`.
     - The projector receives `mediaTime: 0`, detects clock drift > 0.5s from its local ~2s position, and resets its playhead back to 0s, creating an infinite 1–3s reset loop.

3. **Bug #3 — Asymmetric Deletion & Dual Erasure Defect**:
   - *Reproduction*: Importing a track from computer (`Tambah Media`), clicking `Unggah ke Cloud`, then clicking `Hapus dari Komputer` causes both local and cloud copies to disappear.
   - *Root Cause*:
     - Although the dual-presence model (`CloudPresence`, `LocalPresence`, `deriveAvailability()`, `mergeUnifiedPlaylistItem()`) was established in SPEC-113, `MediaDrawer.tsx:672` retains a legacy check `{item.source !== 'local' && (` which suppresses the `Hapus dari Cloud` option for any item whose origin was local.
     - `MediaDrawer.tsx` does not hydrate backend playlist entries via `GET /api/media/playlist` on mount (it only calls `POST` on upload).
     - When the operator unlinks the local handle from IndexedDB, the only client-side record of the item is cleared, causing the item to disappear completely from the UI even though the cloud database row still exists.
     - The operator requires a clear, explicit 3-way deletion model: delete from computer only (unlink local index, preserving physical disk file), delete from cloud only (unlink database row), or delete both (purge cloud file and unlink local handle).

4. **Feature Request — Shuffle & Repeat Controls in `MediaControlBar`**:
   - The operator needs standard playlist transport modes directly on `MediaControlBar.tsx`:
     - Shuffle toggle (On / Off).
     - Repeat mode cycling (Off -> All -> One -> Off).
   - Invariants: Repeat-one strictly overrides shuffle. Audio auto-advance must never auto-play into video tracks (protecting the sanctuary screen per `AD-24`).

5. **UI Cleanup — Removal of Redundant Top-Right Media Launcher Button**:
   - In `PresenterOperator.tsx` header row 2 (adjacent to `Edit Darurat` and `Run Sheet`), `<MediaLauncherButton>` is redundant now that `MediaControlBar.tsx` integrates the canonical `[≡ Pustaka (N)]` button. It must be cleanly removed.

---

## 2. Technical Architecture & Boundary Invariants

### 2.1 Media Playback State Synchronization & Handover Ownership
- **Drawer Play/Pause Toggle**: `handleTogglePlayItem(id: string)` in `MediaDrawer.tsx`:
  - If `state.activeId === id && state.isPlaying`, invoke `engine.pause()` and dispatch `SET_PLAYING: false`.
  - Otherwise, dispatch `SELECT_ITEM: id`, and invoke `engine.play()`.
- **Authoritative Handover in `MediaStage.tsx`**:
  - `MediaStage.tsx` is the single authoritative controller of HTML media element state.
  - When the active item changes while `state.isPlaying` is true, `MediaStage.tsx` must trigger `.play()` on the newly loaded media element (video or audio) after `.load()`, ensuring local DOM playback immediately starts and local `currentTime` advances in lockstep with the projector.
  - If media was paused when sent to screen, `state.isPlaying` remains `false`, projecting a paused frame 0 on the sanctuary screen without initiating heartbeat drift resets.

### 2.2 Unified Presence Matrix & 3-Way Deletion Workflow
- **Presence Facets**: Consumes the orthogonal presence model in `playlist-model.ts`:
  - `hasCloud`: backed by backend SQLite record and accessible URL.
  - `hasLocal`: backed by active IndexedDB record in `localMediaRegistry`.
- **Single-Owner Mount Hydration**:
  - `PresenterOperator.tsx` (the root presenter controller) fetches `GET /api/media/playlist` on mount and merges with `localMediaRegistry.getMatchingMap()`, preventing race conditions.
- **Explicit Deletion Actions**:
  - `availability === 'local-only'`: show `Hapus dari Komputer` (unlinks local handle from app index; does NOT delete physical file from computer disk).
  - `availability === 'cloud-only'`: show `Hapus dari Cloud` (calls `DELETE /api/media/playlist/:id` unlink).
  - `availability === 'synced'`: show three distinct actions:
    1. `Hapus dari Komputer Saja`: unlinks IndexedDB handle; item transitions to `cloud-only` in the playlist.
    2. `Hapus dari Cloud Saja`: sends `DELETE /api/media/playlist/:id`; item transitions to `local-only` in the playlist.
    3. `Hapus Keduanya`: sends `DELETE /api/media/playlist/:id?purge=true` (purges physical upload from server) and unlinks local handle; item is completely removed from playlist.
  - Active playback protection: Deletion actions are disabled when the item is actively playing or projected (`cannotDelete = isActive && (state.isPlaying || state.isProjected)`).

### 2.3 Shuffle & 3-State Repeat Transport Modes
- **State Model**: Extend `PlaylistState` with:
  - `shuffle: boolean` (default `false`).
  - `repeatMode: 'off' | 'all' | 'one'` (default `'off'`).
- **MediaControlBar UI**:
  - Shuffle button: toggles `shuffle`. Shows active primary styling when enabled.
  - Repeat button: cycles `off` -> `all` -> `one` -> `off`. Renders `<Repeat />` (for `all`), `<Repeat1 />` (for `one`), or muted `<Repeat />` (for `off`).
- **Auto-Advance Logic & Precedence (`handleEnded`)**:
  - **Repeat-One Wins**: If `repeatMode === 'one'`, seek to 0 and re-play current item immediately (bypassing shuffle).
  - **Audio-Only Invariant**: Auto-advance (both sequential and shuffle) **only selects audio tracks**. It never auto-advances into a video track (preserving AD-24 sanctuary protection).
  - **Shuffle Selection**: Pure helper `resolveNextPlaylistItem(state, rng?)` in `playlist-model.ts` selects a random unplayed audio track. When all audio tracks have been played, if `repeatMode === 'all'`, resets the shuffle history and loops.
  - **Repeat-Off**: Halts playback upon reaching the end of the playlist.

### 2.4 Header Cleanup
- Remove `<MediaLauncherButton>` from `PresenterOperator.tsx` header row 2.
- Clean up unused imports, props, and associated state variables where appropriate.

### 2.5 Mandatory Bilingual i18n & Zero Hardcoding Invariant (WDI Playbook 07 § 4)
- **Strict Prohibition of Raw Hardcoded Text**: Under `.constitution/project/codebase-conventions-guide.md`, NO user-visible text (buttons, labels, tooltips, dialogs, menu items) may be hardcoded in Indonesian or English directly within JSX.
- **`useT()` Consumption**: Every piece of UI copy in `MediaControlBar.tsx`, `MediaDrawer.tsx`, and `PresenterOperator.tsx` MUST be resolved dynamically via `t(key, params)` from `useT()`.
- **Bidirectional 100% Dictionary Parity**: All new keys must exist in `keys.ts`, `catalogue-en.ts`, and `catalogue-id.ts`:
  | Key | English (`catalogue-en.ts`) | Indonesian (`catalogue-id.ts`) | Usage |
  |---|---|---|---|
  | `media.drawer.deleteFromLocal` | `Delete from Computer` | `Hapus dari Komputer` | Local-only action |
  | `media.drawer.deleteFromCloud` | `Delete from Cloud` | `Hapus dari Cloud` | Cloud-only action |
  | `media.drawer.deleteFromLocalOnly` | `Delete from Computer Only` | `Hapus dari Komputer Saja` | Synced 3-way option |
  | `media.drawer.deleteFromCloudOnly` | `Delete from Cloud Only` | `Hapus dari Cloud Saja` | Synced 3-way option |
  | `media.drawer.deleteBoth` | `Delete Both (Computer & Cloud)` | `Hapus Keduanya (Komputer & Cloud)` | Synced 3-way option |
  | `media.controlBar.shuffleLabel` | `Shuffle` | `Acak` | Shuffle button label |
  | `media.controlBar.shuffleOn` | `Shuffle: On` | `Acak: Aktif` | Shuffle active tooltip |
  | `media.controlBar.shuffleOff` | `Shuffle: Off` | `Acak: Nonaktif` | Shuffle inactive tooltip |
  | `media.controlBar.repeatLabel` | `Repeat` | `Ulang` | Repeat button label |
  | `media.controlBar.repeatOff` | `Repeat: Off` | `Ulang: Nonaktif` | Repeat off tooltip |
  | `media.controlBar.repeatAll` | `Repeat: All Tracks` | `Ulang: Semua Lagu` | Repeat all tooltip |
  | `media.controlBar.repeatOne` | `Repeat: Current Track` | `Ulang: Satu Lagu` | Repeat one tooltip |
- **Enforcement & Absence Guard**: `tests/bilingual-i18n-parity.test.mjs` must scan all modified components to assert 0 raw string literals and verify clean English/Indonesian rendering upon locale toggle.

---

## 3. Auditable Scope & File Inventory

- `src/operator/present/media-player/MediaDrawer.tsx` — Play/pause toggle, send-to-screen playback handover, 3-way deletion menu.
- `src/operator/present/media-player/MediaControlBar.tsx` — Shuffle and 3-state repeat UI buttons and indicators.
- `src/operator/present/media-player/MediaStage.tsx` — Media element play state synchronization and `handleEnded` auto-advance with shuffle/repeat.
- `src/operator/present/media-player/playlist-model.ts` — Shuffle and repeat helper functions, `resolveNextPlaylistItem`.
- `src/operator/present/media-player/media-store.ts` — Actions for `SET_SHUFFLE` and `SET_REPEAT_MODE`.
- `src/operator/present/PresenterOperator.tsx` — Mount hydration and removal of redundant `MediaLauncherButton`.
- `src/lib/i18n/keys.ts`, `catalogue-en.ts`, `catalogue-id.ts` — Localization keys for shuffle, repeat, and 3-way deletion options.
- `tests/local-media-player.test.mjs`, `tests/presenter-media-player.test.mjs`, `tests/bilingual-i18n-parity.test.mjs` — Test verification and executable absence guards.

---

## 4. Linear Ticket Structure

1. **`SPEC-114-01`**: *Media Playback State Sync & Projector Desync Fix*
2. **`SPEC-114-02`**: *Unified 3-Way Deletion Matrix, Cloud Playlist Hydration & Presence Decoupling*
3. **`SPEC-114-03`**: *MediaControlBar Ergonomics: Shuffle, 3-State Repeat & Header Redundant Button Cleanup*
4. **`SPEC-114-04`**: *Comprehensive Verification Suite & Defect Injection Absence Guards*
