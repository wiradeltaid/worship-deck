# SPEC-122 — Mobile Media Control Bar Three-Row Layout and Phone Seekbar Resilience

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-10` (presenter-authority BroadcastChannel, state-not-instruction, idempotent-on-the-wire) — Host workstation remains authority; remote mobile controller receives telemetry and transmits intents.
  - `AD-24` (Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It) — Remote and presenter mobile chrome layout is isolated to operator viewport.
  - `AD-37` (Remote Control Pairing, Single Controller, and Intent Relay) — Mobile controller controls presentation media intents.
  - `DEC-104` (Mobile Media Bar Ergonomics, Header Layout Harmony, and Remote Synchronization) — Touch-friendly media controls across viewports.
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser) — Presenter console controls and visual hierarchy across viewport sizes.
  - `FR-35` (Remote Presenter Control) — Responsive, accessible mobile remote controller UI.
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
  - `UC-29` (Remote Presenter Control: Mobile/Secondary Controller Pairing, Slide Advance, and State Mirroring)
- **Components**: `presenter`
- **Touches**: `present-channel`, `remote-control`
- **Shared Surface Note**: `RemoteOperator.tsx` directly renders `<PresenterOperator mode="remote" ... />`, which in turn mounts `MediaControlBar.tsx`. Therefore, mobile remote controllers running on smartphones directly inherit and benefit from this layout resilience.

---

## 1. Problem Statement & Motivation

During hands-on field testing on mobile smartphone screens (viewport width 360px–412px, such as iPhone and Android devices), a critical layout compression defect was identified in `MediaControlBar.tsx`:

1. **Phone Seekbar Crushed into Zero-Width Dot Thumb**:
   - In `MediaControlBar.tsx`, viewports `< xl` (`< 1280px`) are partitioned into 2 rows: `media-control-bar-row-1` (Metadata, Seekbar, Drawer Launcher) and `media-control-bar-row-2` (Panic Controls, Projector Toggle).
   - On tablet screens (768px–1024px, e.g. iPad), Row 1 has ~768px, comfortably fitting metadata (~200px), drawer launcher (~95px), and leaving > 400px for the seekbar.
   - On smartphone screens (360px–412px), the container width after horizontal padding (`px-4` and `px-3`) is only ~304px–356px.
   - Because Track Metadata (`activeItem.name` with `max-w-[9rem]` + icon + source badge `[LOCAL]` / `[CLOUD]`) takes ~180px–200px, the Playlist Drawer Launcher button takes ~95px (`shrink-0`), and time labels take ~50px (`shrink-0`), all non-seekbar elements demand ~345px.
   - Consequently, `<input type="range" className="w-full">` is compressed into **0 width**, completely extinguishing the seekbar track line and leaving only the circular slider thumb dot floating between the title and drawer button.

2. **Evaluation of Proposed Solutions**:
   - **Alternative A: Horizontal Swipe on Row 1 (`overflow-x-auto`) — REJECTED**:
     Allowing Row 1 to scroll horizontally pushes essential interface components (song title or playlist drawer launcher button) offscreen, creating visual clipping and poor discoverability. Furthermore, even with `touch-none` on the input element, horizontal swiping creates UX friction and ambiguity when dragging the slider thumb near row boundaries.
   - **Alternative B: Responsive Three-Row Layout on Phone (`< sm`) — ACCEPTED**:
     On narrow mobile screens (`< sm` / `< 640px`), decompose the controls into 3 dedicated visual rows:
     - **Visual Row 1 (Track Header & Drawer)**: Track metadata on the left (`flex-1 min-w-0 truncate`) and Playlist Drawer Launcher on the right (`shrink-0`).
     - **Visual Row 2 (Full-Width Seekbar)**: Current time `0:00` (`shrink-0`), dedicated seekbar track (`flex-1 min-w-[120px]`), and total duration `3:45` (`shrink-0`). The seekbar receives all remaining row width and is guaranteed never to collapse to zero.
     - **Visual Row 3 (Playback & Projector Controls)**: Panic transport group with existing horizontal overflow scroll, plus the Projector toggle button anchored for immediate access.
     - **Tablet Preservation (`sm:` to `< xl`, e.g. 640px–1279px)**: Visual Rows 1 and 2 automatically coalesce into a single horizontal row (`sm:flex-row` / `sm:contents`), preserving the established 2-row layout on tablets.
     - **Desktop Preservation (`xl:`, >= 1280px)**: Retains the established 1-row layout (`xl:contents` / `xl:h-13`) without regression.
     - **Console Height Absorption**: The mobile presenter shell uses `h-auto` for the media dock, cleanly absorbing the single extra row (~28px) without horizontal or vertical clipping.

---

## 2. Technical Architecture & Invariant Specifications

### 2.1 DOM Contract & Responsive Hierarchy
In `src/operator/present/media-player/MediaControlBar.tsx`:
1. **Mobile Phone (< 640px / `< sm`) — 3 Visual Rows**:
   - Root container renders `flex flex-col gap-2 h-auto`.
   - **`data-testid="media-control-bar-row-1"`**:
     - Configured as `flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2.5 w-full min-w-0 xl:contents`.
     - Covers **Visual Rows 1 and 2** on phones:
       - **Sub-row 1a (Header Info)**: `<div className="flex items-center justify-between gap-2 w-full min-w-0 sm:contents">` holding Track metadata (`flex items-center gap-1.5 min-w-0 max-w-full sm:max-w-[12rem]`) and Playlist Drawer button (`data-testid="media-control-bar-drawer"`, `shrink-0`).
       - **Sub-row 1b (`data-testid="media-control-bar-seekbar"`)**: Dedicated seekbar container `<div data-testid="media-control-bar-seekbar" className="flex items-center gap-2 w-full min-w-0 sm:flex-1">` holding `formatTime(displayTime)` (`shrink-0`), `<input type="range" className="h-1.5 w-full flex-1 min-w-[120px] cursor-pointer ...">`, and `formatTime(duration)` (`shrink-0`).
   - **`data-testid="media-control-bar-row-2"`**:
     - Covers **Visual Row 3** on phones.
     - Holds the panic transport group with `overflow-x-auto no-scrollbar` (Prev, Play/Pause, Next, Stop, Fade, Mute, Volume, Shuffle, Repeat) and the Projector toggle button (`data-testid="media-control-bar-project"`).
2. **Tablet (640px–1279px / `sm:` to `< xl`) — 2 Visual Rows**:
   - `media-control-bar-row-1` switches to horizontal alignment (`sm:flex-row` / `sm:contents`):
     - Metadata aligns to the left (`sm:order-1 sm:shrink-0`).
     - Seekbar (`media-control-bar-seekbar`) occupies the middle flex space (`sm:order-2 sm:flex-1`).
     - Drawer launcher button aligns to the right (`sm:order-3 sm:shrink-0`).
   - `media-control-bar-row-2` forms Visual Row 2. Total visual rows: **2 rows**.
3. **Desktop (>= 1280px / `xl:`) — 1 Visual Row**:
   - `xl:contents` flattens both row containers into direct children of the root flexbox (`xl:flex-row xl:h-13`), preserving desktop ordering and zero layout shift.

### 2.2 Sizing Invariants & Functional Non-Regression
- **Nonzero Seekbar Width Invariant**: The seekbar range input MUST carry `w-full flex-1 min-w-[120px]`, guaranteeing an active scrubbing track across all supported phone viewport widths (tested at 360px, 375px, 390px, and 412px).
- **Empty State Behavior**: When no media item is cued (`activeItem === null`), the empty placeholder message renders gracefully, and the seekbar track is not mounted.
- **Seek Logic & Reconciliation Preservation**: All underlying seek event handlers (`handleSeekChange`, `handleSeekPointerDown`, `handleSeekPointerUp`, `commitSeek`), pointer capture logic, touch listeners, and remote seek reconciliation window (1000ms grace window in lines 394–420) remain strictly untouched.
- **Test ID Continuity**: The DOM contract strictly preserves:
  - `data-testid="media-control-bar"`
  - `data-testid="media-control-bar-row-1"`
  - `data-testid="media-control-bar-row-2"`
  - `data-testid="media-control-bar-seekbar"` (new explicit child identifier)
  - `data-testid="media-control-bar-drawer"`
  - `data-testid="media-control-bar-play"`
  - `data-testid="media-control-bar-project"`

### 2.3 Automated Testing & Defect Injection Strategy
In `tests/presenter-media-player.test.mjs`:
1. **Structural Invariant Verification**:
   - Verify `data-testid="media-control-bar-seekbar"` exists as a dedicated element.
   - Verify responsive flex direction on `media-control-bar-row-1` (`flex-col sm:flex-row`).
   - Verify seekbar container carries `w-full` for mobile and `sm:flex-1` for tablet coalescing.
   - Verify existing desktop flattening rules (`xl:contents`, `xl:h-13`) remain intact.
2. **Defect Injection Proofs (Red-to-Green)**:
   - *Mutation 1 (Missing Mobile Sub-Row)*: Replacing `flex-col sm:flex-row` with single-row `flex-row` must trigger an assertion failure.
   - *Mutation 2 (Missing Dedicated Seekbar Container)*: Removing `data-testid="media-control-bar-seekbar"` must trigger an assertion failure.
   - *Mutation 3 (Missing Tablet Coalescing)*: Removing `sm:flex-1` from the seekbar container must trigger an assertion failure.

---

## 3. Auditable Scope & File Inventory

- `src/operator/present/media-player/MediaControlBar.tsx` — Responsive 3-row layout restructuring for mobile viewports `< sm`.
- `tests/presenter-media-player.test.mjs` — Verification test suite and defect injection guards for mobile 3-row layout and phone seekbar resilience.
