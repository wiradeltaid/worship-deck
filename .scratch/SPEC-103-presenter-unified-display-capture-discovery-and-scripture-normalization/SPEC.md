# SPEC-103 — Presenter Unified Display Selection, Guest Capture Discovery, Fullscreen Navigation, and Scripture Comma Normalization

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-24` (Room-Facing Screens Never Show Operator Controls; Operator Console Ergonomics)
  - `AD-29` (Presenter-Projector Cross-Window Liveness Handshake and Sync)
  - `AD-36` (Scripture & Hymn Offline Corpus Integrity)
- **Functional Requirements**:
  - `FR-14` (Offline Readiness Indicator & Resilience — cross-component with services warming)
  - `FR-16` (Two-Screen Presenter View in the Browser)
  - `FR-19` (Auditorium Projector Output and Live Synchronization)
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
  - `UC-13` (On-Demand Verse Lookup)
- **Components**: `presenter`
- **Touches**: `present-channel`, `scripture`, `services`

---

## Problem Statement

During live testing and rehearsal of WorshipDeck dev (`https://presenter-dev.bic.my.id`), operators identified four operational and usability issues:

1. **Hardware Video Capture Device Not Discovered & Crash on Chevron Click**:
   - In `PresenterGuestFeedControl.tsx`, connected UVC/HDMI video capture devices are not listed; the UI consistently shows `"No video capture device"`.
   - **Root Cause**: `CaptureBroker.enumerateDevices()` is implemented but never called upon component mount, dropdown opening, or initial controller creation. Furthermore, selecting a device in the dropdown immediately calls `arm()` (triggering `getUserMedia()`) rather than separating device selection (`selectDevice()`) from explicit arming.
   - When clicking the chevron trigger on `No video capture device`, the screen abruptly blackouts because `<DropdownMenuLabel>` is rendered directly under `<DropdownMenuContent>` without an enclosing `<DropdownMenuGroup>`, throwing Base UI's `MenuGroupContext is missing` exception.
   - Component placement: Guest feed controls currently reside in Header Row 2, whereas presentation operators expect core projection sources in Header Row 1 alongside `All slides` and display controls.

2. **Offline Degradation Due to Comma-Separated Scripture Reference (`Hebrews 1:1, 2, NKJV`)**:
   - Service 10 displays `Degraded: 1 scripture failed` in `OfflineReadinessBadge`.
   - **Root Cause**: The service rundown contains `Hebrews 1:1, 2, NKJV` (a comma precedes `NKJV`). The existing regex strips `NKJV` but leaves a trailing comma (`Hebrews 1:1, 2,`). Go's `parseVerseSpan` attempts to convert `"2,"` to integer, failing with HTTP 404, which causes browser offline auto-warming to mark the scripture as failed.

3. **Inability to Navigate Slides when Projector Window Has Focus**:
   - When the congregation projector window is focused (e.g. after entering fullscreen via F11), keyboard shortcuts (`Space`, `ArrowRight`, `ArrowLeft`, `PageDown`, `PageUp`) do nothing.
   - **Root Cause**: `ProjectorClient.tsx` only listens for `F11`. All slide navigation key listeners reside in `PresenterOperator.tsx`. When the operator interacts with the projector window, keyboard focus belongs to `ProjectorClient`.

4. **Congregation Display Split Button, Focus, and Close Lifecycle Ambiguities**:
   - Operators can accidentally launch to an unintended screen when clicking the primary split button directly instead of choosing from the dropdown. Operators require that clicking the button always opens the target selection dropdown.
   - When clicking to focus an existing projector window, the window is sometimes closed and reopened or reloaded. In `PresenterOperator.tsx`, if liveness heartbeat is transiently `lost` (e.g. background tab throttling), `openProjector` overwrites `existing.location.href`.
   - The `Close Projector` menu item is disabled or unclickable when `presentationLock` is active or if liveness is not strictly `live`, even when the window handle is clearly open.

---

## Solution Architecture & Invariants

### 1. Capture Device Discovery, Menu Grouping & Header Row 1 Alignment
- In `src/operator/present/presenter-guest-feed-controller.ts`:
  - Expose safe, idempotent `enumerateDevices(): Promise<CaptureDeviceOption[]>`. Constructor does NOT perform unhandled async I/O. Any rejected promise is caught and projected into `errorMessage` without transitioning state to armed or erroring the page.
  - Expose `selectDevice(deviceId: string): void` that invokes `this.broker.selectDevice(deviceId)`.
- In `src/operator/present/PresenterGuestFeedControl.tsx`:
  - Enclose `<DropdownMenuLabel>` inside `<DropdownMenuGroup>` to satisfy Base UI `MenuGroupContext`.
  - Trigger `controller.enumerateDevices()` on mount and when dropdown opens (`onOpenChange(true)`).
  - Update device radio selection to call `controller.selectDevice(value)` without calling `getUserMedia()`; media stream is requested only when operator explicitly clicks **Arm**.
- In `src/operator/present/PresenterOperator.tsx`:
  - Move `<PresenterGuestFeedControl />` from `presenter-header-row-2` to `presenter-header-row-1`, adjacent to `All slides`, `PresenterDisplayControl`, and `Remote Code`.

### 2. Scripture Comma Suffix Normalization & Trailing Punctuation Sanitization
- In `internal/scripture/match.go` (`stripTranslationSuffix`):
  - Strip translation suffix with comma or whitespace separator: `/(?:\s*,\s*|\s+)(KJV|NKJV|TB|NIV|ESV|BIMK|AYT)\s*$/i`.
  - Then trim space, then strip any trailing punctuation `[,;.]+`, then trim space again.
  - Ensure `parseVerseSpan` receives clean verse spans without trailing commas (e.g. `"Hebrews 1:1, 2, NKJV"` -> `"Hebrews 1:1, 2"`).
- In `src/lib/offline/service-snapshot.ts` (`sanitizeScriptureRef`):
  - Apply the identical sequence: strip suffix with comma/whitespace, trim, strip trailing punctuation `s = s.replace(/[,;.]+$/, '').trim()`.
  - Ensure references normalize cleanly, achieving HTTP 200 OK and allowing auto-warming to reach `Offline Ready` with matching canonical cache keys.

### 3. Projector Fullscreen Keyboard Navigation Bridge
- In `src/lib/present-channel.ts`:
  - Add `{ type: 'nav-next'; serviceId: string; planIdentity: string }` and `{ type: 'nav-prev'; serviceId: string; planIdentity: string }` to `PresentMessage`.
  - Keep navigation intent distinct from `isProjectorMessage()` (it is operator intent forwarded from projector, NOT a liveness heartbeat ack).
- In `src/projected/ProjectorClient.tsx`:
  - Register window `keydown` listener for `Space`, `ArrowRight`, `PageDown` (next) and `ArrowLeft`, `PageUp` (prev).
  - Guard: ignore events with modifiers (`ctrlKey`, `metaKey`, `altKey`) or on editable targets.
  - Broadcast navigation message carrying `serviceId` and current `planIdentity`.
- In `src/operator/present/PresenterOperator.tsx`:
  - In channel listener, validate `msg.planIdentity === planIdentityRef.current` and `msg.serviceId === serviceId`.
  - Read fresh state via refs (`activeSlidesRef`, `indexRef`, `manualNavigateRef`) to prevent stale closure bugs.
  - Respect boundary limits (index stays unchanged at deck start and end).

### 4. Unified Display Dropdown, Clean Focus, Reopen Recovery, and Safe Close
- In `src/operator/present/PresenterDisplayControl.tsx`:
  - Replace split-button with a single unified `DropdownMenuTrigger` button. Clicking the button opens the target selection dropdown.
  - Selecting a target (`Screen 1`, `Screen 2`, `Window Mode`) immediately launches/relocates to that target across all states (`none`, `live`, `lost`).
  - Add explicit `hasOpenProjector` (or `projectorWindowKnown`) prop passed from `PresenterOperator`.
  - When `hasOpenProjector` is true, render `Focus Screen` (calls pure `existing.focus()` without URL rewrite) and `Close Projector`.
  - When `liveness === 'lost'`, render `Reopen / Recover Screen` which explicitly invokes `openProjector()` to reattach frozen windows per AD-29 and `tests/projector-liveness.test.mjs`.
  - When `presentationLock` is active, `Close Projector` prompts `window.confirm` for operator confirmation rather than disabling the item.
