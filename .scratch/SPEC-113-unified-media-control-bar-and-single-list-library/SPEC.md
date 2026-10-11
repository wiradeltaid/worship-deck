# SPEC-113 — Unified Media Control Bar, Single-List Library, and Projector Sync Hardening

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-24` (Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It) — Room display renders exclusively media content; operator chrome is never projected.
  - `AD-10` (presenter-authority BroadcastChannel, state-not-instruction, idempotent-on-the-wire) — Presenter authoring of `ProjectedSource.kind: 'media'` with identity binding.
  - `AD-29` (The Projector Reports Its Own Liveness and Nothing Else, and One Predicate Decides It) — Projector reports media status acknowledgment and error reasons.
  - `DEC-098` (Storage Ladder WebView2 File System Access, OPFS, and Service Worker Stream Resolution) — 3-tier storage ladder preservation.
  - WDI Coding Playbook 07 § 4 (Pemisahan Bahasa Antarmuka / UI Chrome vs Konten Bisnis).
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser) — Presenter console maintains single authority over media projection and slide controls.
  - `FR-25` (Display the Operator interface in the Operator's language) — Full bilingual localization via `useT()`, replacing "Laptop" with "Komputer" in media library domain.
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync) — Transport bar, single-list library, seek synchronization, and audio-video projection.
- **Components**: `presenter`
- **Touches**: `operator-present`, `media-player`, `present-channel`

---

## 1. Problem Statement & Motivation

Field testing and code inspection of SPEC-110 and SPEC-111 revealed critical ergonomic flaws and technical synchronization defects:

1. **Fragmented Controls & Suboptimal Positioning**:
   - `MediaTopBar` (top 44px bar) was cramped and lacked seekbar ergonomics.
   - `MediaDock` (bottom dock) floated at the very bottom of the viewport, separated from presentation monitors.
   - Volume controls were positioned at the far right edge instead of next to the mute toggle.
   - The projector control lacked an active `KE LAYAR` invocation trigger when media was cued but not yet projected.
2. **Confusing Two-Tab Drawer UX**:
   - The two-tab layout (Pustaka Cloud vs Media Laptop) fragmented operator workflow.
   - Operators could not easily see what was stored locally vs what was in cloud.
   - Deletion rules were asymmetric and confusing (cloud items could be unlinked, but local items lacked clear delete options).
   - "Tambah Media" was trapped inside the local tab with no 2-step cloud upload action.
   - Terminology used "Laptop" for local storage, which is inappropriate for church desktop multimedia booths.
3. **Severe Technical Defects**:
   - **Seekbar Broadcast Failure**: `PresenterOperator.tsx` diffing omitted `currentTime`, causing projector video to freeze while local audio seeked.
   - **Slide Navigation Video Drop Hazard**: `setIndexAndSync` projection must strictly mirror active media state across slide transitions.
   - **Audio-Video State Dropping**: Switching between audio and video elements dropped volume and mute configurations; fade out corrupted stored volume to zero.
   - **Video Scaling**: Missing explicit `w-full h-full` constraint in `ProjectedMediaLayer.tsx` caused lower-resolution videos to render unstretched at natural sizes.
   - **Hidden Element Throttling**: `<video>` inside `MediaStage.tsx` used `display: none`, triggering browser audio decoding throttling.

---

## 2. Technical Architecture & Invariants

### 2.1 Unified MediaControlBar Layout
- Positioned in a fixed slot between header transport controls (`presenter-header-row-3`) and slide monitors (`Current Slide` / `Next Slide`), placed before the conditional emergency reconciliation banner.
- Max-width constrained to `max-w-[96rem] mx-auto px-4` to match stage monitor grid boundaries.
- Fixed height `h-13` (~52px) with zero layout shift; rendered disabled/dimmed when idle (`opacity-60`), never unmounted. `--presenter-stage` CSS calculation updated accordingly.
- Ergonomic button grouping:
  `[Play/Pause] [Stop] [Fade] [Mute] [Volume Slider] | [Media Info & Seekbar] | [KE LAYAR / TARIK LAYAR] [≡ Pustaka (count)]`
- Bidirectional projector button for video: `KE LAYAR` (when off-screen) and `TARIK LAYAR` (when live on-screen); disabled with informative tooltip for audio items.

### 2.2 Unified Single-List Library (`MediaDrawer`)
- Replaces two tabs with a single unified playlist table joined by `sha256`.
- 4-way segmented filter: `Semua (All)`, `Hanya Cloud (Cloud Only)`, `Hanya Komputer (Computer Only)`, `Keduanya (Synced)`.
- Compact 14px status icons with tooltips (`Cloud`, `HardDrive`, `Synced`, `Progress Ring`, `Unlink`).
- Single entry door: `Tambah Media` (imports local file from Komputer into local index).
- Two-step cloud workflow: explicit `Unggah ke Cloud` item action.
- Cloud items show `Unduh ke Komputer` action.
- Distinct deletion actions: `Hapus dari Cloud` (server playlist row deletion) and `Hapus dari Komputer` (local index handle unlinking).
- Terminology updated from "Laptop" to "Komputer" strictly within the media library and storage domain (leaving physical laptop monitor mentions in `displayTarget` untouched).

### 2.3 Synchronization & Video Player Hardening
- **Lightweight Media Clock Broadcast**: Broadcasts `mediaTime`, timestamp `at`, monotonic `revision`, and `planIdentity` on seek commit (`onPointerUp`, `onKeyUp`), 150ms trailing debounce during scrub, and 2-second heartbeat during active projection.
- **Projection State Retention**: `projectionRef.current` mirrors active media projection state to ensure slide navigation does not drop projected video.
- **Audio/Volume State Handover**: Re-applying `isMuted` and base volume upon switching active elements in `MediaStage.tsx`; decoupling fade attenuation from base volume store.
- **Video Sizing & Compositing**: `ProjectedMediaLayer.tsx` applies `absolute inset-0 w-full h-full object-contain` on `<video>` inside black container; `MediaStage.tsx` replaces `display: none` with `absolute h-px w-px opacity-0 pointer-events-none`.

---

## 3. Linear Ticket Structure

1. **`SPEC-113-01`**: *Projector Media Synchronization, Clock Contract, and Video Rendering Bug Fixes*
2. **`SPEC-113-02`**: *Unified MediaControlBar Layout, Zero Layout Shift, and Ergonomics*
3. **`SPEC-113-03`**: *Unified Single-List Playlist Model, DEC-098 Storage Ladder, and IDB Schema*
4. **`SPEC-113-04`**: *Unified Media Drawer UI, 4-Way Segmented Filter, and Dual Action Workflows*
