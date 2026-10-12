# SPEC-115 — Unified Presenter Remote Console: Full UI/UX Mirroring, QR Code Instant Pairing, and Surface-Isolated Remote Intent Telemetry

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-10` (presenter-authority BroadcastChannel, state-not-instruction, idempotent-on-the-wire) — The presenting host workstation remains the sole publisher on BroadcastChannel; remote intents translate to presenter-authority broadcasts on the host machine.
  - `AD-24` (Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It) — Remote console isolates chrome state; zero room-facing projector output on remote client.
  - `AD-29` (The Projector Reports Its Own Liveness and Nothing Else, and One Predicate Decides It) — The projector liveness predicate is strictly between presenting host and physical screen; remote client observes host status and never alters the liveness evaluator.
  - `AD-37` (Remote Control Pairing, Single Controller, and Intent Relay) — Strict authenticated single-use pairing and remote intent routing.
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser) — Complete presenter console layout and live navigation parity on remote client.
  - `FR-35` (Remote Presenter Control) — Robust, authenticated remote controlling via SSE stream and intent dispatching.
  - `FR-25` (Display the Operator interface in the Operator's language) — Full bilingual localization via `useT()`.
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
  - `UC-29` (Remote Presenter Control: Mobile/Secondary Controller Pairing, Slide Advance, and State Mirroring)
- **Components**: `presenter`
- **Touches**: `present-channel`, `remote`

---

## 1. Problem Statement & Motivation

During church service operations, the current remote control experience (`/services/:id/remote`) presents two substantial friction points:

1. **UX/UI Fragmentation & Feature Lag**:
   - The current `RemoteOperator.tsx` is an isolated, cut-down mobile view with only two slide preview boxes and basic Next/Prev buttons.
   - Modern presentation tools developed on the main console (Media Control Bar, Single-List Library, Video Projection toggle, Shuffle/Repeat, Scripture Autocomplete, Live Transition Selectors) are absent on the remote controller.
   - Operators using secondary devices (laptops, iPads/tablets, smartphones) must learn an entirely different interface, and cannot control media or advanced presentation workflows remotely.
   - However, durable editing features (service modifications, emergency slide text editing) belong strictly to the host AV console and must not be mutated remotely.

2. **Cumbersome URL Entry & Pairing Friction**:
   - The operator currently has to manually type or copy a long URL containing the internal service ID (`/services/42/remote`), open it, and manually type a 6-digit numeric pairing PIN.
   - There is no instant camera QR-scan pairing, no auto-claim token in URL, and no universal `/remote` entry point.

---

## 2. Technical Architecture & Boundary Invariants

### 2.1 Zero-Friction QR Pairing, Token Lifecycle & URL Hygiene
- **Host Pairing Display**:
  - In `PresenterOperator.tsx`, the header remote button displays a dialog modal with:
    1. A high-contrast scannable **QR Code** encoding: `${window.location.origin}/remote?service=${serviceId}&code=${pairingCode}`.
    2. A "Salin Tautan" (*Copy Link*) button that copies the direct pairing URL with auto-claim query parameters to clipboard.
    3. The traditional 6-digit PIN as a manual fallback.
- **Universal `/remote` Route & URL Hygiene**:
  - A clean, top-level route in `spa/src/App.tsx`: `/remote`.
  - When opened with query parameters `?service=:id&code=:code`, automatically claims pairing and mounts the console without any manual typing.
  - **Token Consumption & URL Hygiene**: Upon successful claim, the client calls `window.history.replaceState({}, '', '/remote')` (or `/services/:id/remote`), cleanly stripping the single-use `code` token from the browser address bar to prevent token leakage in history, bookmarks, or accidental link sharing.
  - **Pairing Lifecycle & Single Controller Model (AD-37)**:
    - Retains deliberate authenticated model: 60s code expiry, single-use token consumption.
    - Rejects replay attempts, expired codes, and mismatched service IDs with opaque 400.
    - Enforces single active remote controller per service: secondary claim against an active pairing returns 409 Conflict.
    - If host presenter disconnects, remote state immediately drops to `role-lost` or `disconnected`.

### 2.2 Dual-Mode Console Architecture & Surface Isolation Guards (`PresenterOperator.tsx`)
- Unify presenter console under a single canonical component hierarchy, parameterized by `mode: 'host' | 'remote'`:
  - **Host Mode**: The primary workstation running in the AV booth or pulpit. Holds local `BroadcastChannel` to physical projector, outputs live audio/video to church sound system, handles local webcam/capture card devices, and persists offline caches.
  - **Remote Mode**: The remote controlling client (phone, tablet, or second laptop).
    - **Audio Output Isolation**: All local audio elements (`mediaAudioRef`, `mediaVideoRef`) are strictly muted with volume locked to 0. Audio plays exclusively on the target host machine.
    - **Display Isolation**: Local `BroadcastChannel` projector connections are suppressed. The remote client never opens or controls local display monitors, and never alters the host-projector AD-29 liveness evaluator.
    - **Hardware Capture Isolation**: UVC capture device enumeration (`navigator.mediaDevices.enumerateDevices`) and permission prompts (`getUserMedia`) are bypassed and disabled on the remote client.
    - **No-Cache Persistence Isolation**: No Cache API or IndexedDB writes are performed on the remote client.
    - **Read-Through Visual Preview**: Slide ASTs, thumbnail images, and scripture lookup (KJV/TB) are fetched transiently in read-through mode solely for visual rendering on the remote screen, without local disk persistence.
    - **Durable Mutation Boundary**: Persistent editing surfaces (Emergency Edit modal save actions, Run Sheet structure modifications, layout/service changes) are disabled or hidden in remote mode. The remote console possesses live operational control (slides, transport, cueing, blanking, scripture overlay), but zero durable editing authority.

### 2.3 Full-Surface Remote Intent Telemetry & Mirrored State Schema
- **Authority Model**:
  - Host workstation remains the sole author of presentation and media element state.
  - Remote actions generate non-authoritative intents sent via `POST /api/present/:id/remote/intent`.
- **Media Remote Intent Schema**:
  - Extend `PresenterRemoteIntent` and backend `allowedIntentTypes`:
    - `media-play`: triggers `mediaEngine.play()`.
    - `media-pause`: triggers `mediaEngine.pause()`.
    - `media-stop`: triggers `mediaEngine.stop()`.
    - `media-fade`: triggers `mediaEngine.fade()`.
    - `media-seek`: carries `timeSeconds: number` and invokes `mediaEngine.seek(time)`.
    - `media-toggle-project`: toggles `SET_PROJECTED`.
    - `media-select-item`: carries `id: string` and invokes `SELECT_ITEM`.
    - `media-toggle-shuffle`: toggles `SET_SHUFFLE`.
    - `media-cycle-repeat`: cycles `SET_REPEAT_MODE`.
- **Validation & Monotonicity**:
  - Backend strictly validates payload types (whitelisted intent type, positive numeric time, string ID).
  - Intents carry `planIdentity` and revision numbers; mismatched plan identity is rejected fail-closed.
- **Host-to-Remote State Mirroring**:
  - Host mirrors active playback state (track ID, isPlaying, isProjected, currentTime, duration, shuffle, repeatMode) back to remote client over SSE for real-time playhead alignment.

---

## 3. Auditable Scope & File Inventory

- `spa/src/App.tsx`, `spa/src/pages/RemotePage.tsx` — Universal `/remote` route and URL auto-claim token parsing with `replaceState` cleanup.
- `src/operator/present/PresenterOperator.tsx` — Dual-mode (`host` vs `remote`) architecture, QR code modal, durable mutation boundaries, and remote media intent execution.
- `src/operator/present/RemoteOperator.tsx` — Migration to unified console architecture.
- `src/lib/presenter-remote-client.ts` — Extended intent types, media intent schema, and auto-claim connection logic.
- `internal/httpapi/remote.go` — Backend intent type whitelist and media state relay.
- `src/lib/i18n/keys.ts`, `catalogue-en.ts`, `catalogue-id.ts` — Bilingual localization for QR modal and remote console copy.
- `tests/remote-screen.test.mjs`, `tests/remote-presenting-client.test.mjs`, `tests/bilingual-i18n-parity.test.mjs` — Test verification and executable absence guards.

---

## 4. Linear Ticket Structure

1. **`SPEC-115-01`**: *Zero-Friction Remote Pairing: Scannable QR Modal, Auto-Claim Token URL, and Generic `/remote` Route*
2. **`SPEC-115-02`**: *Unified Presenter Surface Dual-Mode Architecture & Surface Isolation Guards*
3. **`SPEC-115-03`**: *Full-Surface Remote Intent Telemetry & Bidirectional Media/Slide Control*
4. **`SPEC-115-04`**: *Comprehensive Verification Suite, Pairing Guards, and Defect Injection Proofs*
