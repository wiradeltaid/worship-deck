# SPEC-118 — Presenter Layout Stability across Viewports, Tablet Media Bar Ergonomics, and Remote Connection Resilience

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-10` (presenter-authority BroadcastChannel, state-not-instruction, idempotent-on-the-wire) — Host workstation executes physical output; remote client acts strictly as intent transmitter and telemetry receiver.
  - `AD-24` (Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It) — Remote console isolates chrome state; zero room-facing output on remote client.
  - `AD-29` (The Projector Reports Its Own Liveness and Nothing Else, and One Predicate Decides It) — The projector liveness predicate is strictly between presenting host and physical screen; remote client observes host status without altering evaluator.
  - `AD-37` (Remote Control Pairing, Single Controller, and Intent Relay) — Strict authenticated single-controller pairing with durable token-based resume semantics.
  - `DEC-101` (Persistent Video Projection, Slide Fallback, and Local Storage Transport Preferences)
  - `DEC-102` (Unified Remote Presenter Console & QR Code Instant Pairing)
  - `DEC-103` (Target-Authority Remote Presenter Console Architecture)
  - `DEC-104` (Mobile Media Bar Ergonomics, Header Layout Harmony, and Remote Synchronization)
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser) — Presenter console controls and visual hierarchy across viewport sizes.
  - `FR-25` (Display the Operator interface in the Operator's language) — Bilingual localization integrity.
  - `FR-35` (Remote Presenter Control) — Robust, authenticated remote controlling via SSE stream, heartbeat tolerance, and reconnect resilience.
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
  - `UC-29` (Remote Presenter Control: Mobile/Secondary Controller Pairing, Slide Advance, and State Mirroring)
- **Components**: `presenter`
- **Touches**: `present-channel`, `remote-control`

---

## 1. Problem Statement & Motivation

During hands-on field testing on physical devices (smartphones, iPad Mini / 768px–1024px tablets, and desktop workstations), four critical layout stability and connectivity issues were identified:

1. **Tablet / iPad Mini Media Control Bar Compressed into 1 Row (`Item #1`)**:
   - `MediaControlBar.tsx` currently transitions from 2 rows to 1 row at Tailwind's `md:` breakpoint (`min-width: 768px`).
   - Tablets such as iPad Mini (portrait: 744px/768px, landscape: 1024px) trigger desktop 1-row mode.
   - On viewports between 768px and 1279px, 14 controls take ~580px, compressing the title and seekbar into an unusable sliver (< 180px).
   - Solution: Elevate the 2-row layout breakpoint to `xl:` (`min-width: 1280px`). The entire band from 320px up to 1279px (all phones and tablets) renders in a touch-friendly 2-row layout with a full-width scrubbar, while viewports >= 1280px flatten cleanly into a single row.

2. **Presenter Header Actions Pushed Excessively to the Left during Guest Live (`Item #2`)**:
   - In `PresenterOperator.tsx`, the top-right header controls are wrapped inside `presenter-header-actions` (`flex flex-col items-end gap-2`).
   - Row 3 houses `PresenterGuestFeedControl.tsx`. In `idle` state, it measures ~300px.
   - Upon transitioning to `confirmed-live`, the live pill, revert action button, and disarm toggle expand Row 3 to ~585px.
   - Because `items-end` anchors rows to the right edge and the container stretches to the widest row, Row 3's expansion pushes Row 1 and Row 2 leftward by ~285px. On compact screens (< 1024px), this triggers an unsightly multi-row flex-wrap staircase.
   - Solution: Decouple Row 3 geometry from upper action toolbars, enforce bounded width constraints, and prevent cross-row width coupling without altering any button UX, labels, or interaction semantics.

3. **Cumulative Layout Shift (CLS) from Dynamic Header Warnings & Action Toggles (`Item #3`)**:
   - Buttons and alert banners in the presenter header currently cause visual jumps when warnings appear or when buttons are toggled.
   - Specifically, `projectorPromptOpen` (`projector-reopen-prompt`) and `projectorBlocked` are inserted directly into the header flex layout as sibling elements, pushing adjacent controls down or sideways.
   - The user noted: "The buttons themselves are already correct and functional; do NOT alter their purpose or UX. Fix the erratic shifting across mobile, tablet, and desktop viewports."
   - Solution: Relocate alert prompts into a dedicated notification strip outside the primary toolbar flexbox, reserve fixed dimensions for toggles (e.g. presentation lock), and anchor action clusters to prevent layout twitching.

4. **Remote Connection Drops & Reconnection Resilience with Same Code (`Item #4`)**:
   - Operators report that mobile remote connections frequently drop during service ("sering putus-putus").
   - When connection drops (e.g., temporary hall Wi-Fi flutter, screen lock, or browser backgrounding), the pairing code is invalidated because the server burns `r.code` upon first claim, returning `400 Bad Request` on re-claim.
   - Furthermore, `StreamFreshnessWindow` (15s) aggressively drops SSE streams on brief Wi-Fi latency spikes.
   - Architecture Decision (advisory review fold-in):
     - **Token-Based Resume (`pairingToken`)**: Preserve strict code-burning security (`AD-37`). When a remote client claims a PIN, the server generates an opaque 32-byte hex `session_token` returned to the remote client and stored in `sessionStorage`.
     - Reconnecting remote clients supply `session_token` via `POST /api/present/{id}/remote/resume` or SSE query param to seamlessly re-establish their stream without burning a new PIN.
     - **Single-Controller Invariant**: If a host generates and pairs a new code with another device, the previous `session_token` is invalidated (`role-lost`). But transient disconnects from the legitimate controller resume instantly.
     - **Heartbeat Grace Tuning**: Adjust `StreamFreshnessWindow` from 15s to **30s** (tolerating 3-4 consecutive ping intervals of 7.5s), absorbing hall Wi-Fi jitter while maintaining timely dead-remote detection.

---

## 2. Technical Architecture & Ticket Breakdown

### SPEC-118-01: Responsive Media Control Bar Breakpoint Expansion for Tablet & Compact Viewports
- **Target**: `src/operator/present/media-player/MediaControlBar.tsx`, `tests/presenter-media-player.test.mjs`
- **Scope**:
  - Replace `md:` breakpoint with `xl:` across layout container classes (`w-full h-auto xl:h-13 py-2 xl:py-0 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2 xl:gap-3`).
  - Update Row 1 and Row 2 `md:contents` to `xl:contents`, with order modifiers `xl:order-1` through `xl:order-4`.
  - Explicit viewport coverage: Viewports < 1280px (including iPad Mini 744px/768px portrait, 1024px landscape, and 10" tablets) render in 2 spacious rows with a full-width scrubbar. Viewports >= 1280px flatten to single-row bar (`h-13`).
- **Touches**: `present-channel`

### SPEC-118-02: Zero-CLS Presenter Header Layout Stabilization and Guest Live Bounded Geometry
- **Target**: `src/operator/present/PresenterOperator.tsx`, `src/operator/present/PresenterGuestFeedControl.tsx`, `tests/presenter-guest-feed-controls.test.mjs`
- **Scope**:
  - Decouple Row 3 (`presenter-header-row-3`) from the vertical flexbox containing Row 1 and Row 2, preventing horizontal expansion of Guest Feed from shifting upper toolbars.
  - Apply bounded max-width and min-height constraints to `PresenterGuestFeedControl`.
  - Preserve all existing button purposes, labels, testids, and interaction semantics exactly as designed.
  - Zero layout shift: activating Guest Live (`confirmed-live`) does not push upper buttons leftward.
- **Touches**: `present-channel`

### SPEC-118-03: Header Alert & Prompt Isolation (Zero-Shift Banner Placement across Viewports)
- **Target**: `src/operator/present/PresenterOperator.tsx`, `tests/presenter-header-two-row-layout.test.mjs`
- **Scope**:
  - Relocate conditional alert banners (`projector-reopen-prompt`, `congregationScreenBlocked` notice) out of the main header toolbar flexbox into a dedicated notification strip immediately beneath the header (`border-b bg-amber-500/10`).
  - Reserve fixed dimensions for action buttons (e.g. presentation lock toggle fixed width) to eliminate horizontal jitter on toggle.
  - Multi-viewport stability across mobile (< 640px), tablet (768px–1024px), and desktop (>= 1280px).
- **Touches**: `present-channel`

### SPEC-118-04: Resilient Remote Pairing Connection, Reconnect Retention, and Heartbeat Jitter Tolerance
- **Target**: `internal/httpapi/remote.go`, `src/lib/presenter-remote-client.ts`, `src/operator/present/RemoteOperator.tsx`, `tests/remote-control-go-http.test.mjs`, `tests/remote-presenting-client.test.mjs`
- **Scope**:
  - In `remote.go`: issue a secure, opaque `session_token` upon successful claim of the 6-digit PIN. Support re-binding via `POST /api/present/{id}/remote/resume` using `session_token`.
  - Maintain one-time-burn posture for the 6-digit PIN to prevent unauthorized snooping, while allowing legitimate controllers to resume uninterrupted.
  - Single-controller enforcement: Generating a new pair on host revokes prior tokens (`role-lost`).
  - Tune `StreamFreshnessWindow` from 15s to 30s to absorb transient Wi-Fi drops.
  - In `presenter-remote-client.ts`: persist `session_token` in `sessionStorage` and implement automatic exponential backoff reconnects without resetting the UI to the PIN entry screen.
- **Touches**: `remote-control`, `present-channel`
