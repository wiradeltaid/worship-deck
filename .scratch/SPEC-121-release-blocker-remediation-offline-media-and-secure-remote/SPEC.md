# SPEC-121 — Production Release Blocker Remediation: Offline Media Playback, Secure QR Mobile Pairing, Backend Security Boundaries, and Telemetry Monotonicity

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-10` (presenter-authority BroadcastChannel, state-not-instruction, idempotent-on-the-wire) — The presenting host workstation remains the sole publisher on BroadcastChannel; remote intents translate to presenter-authority broadcasts on the host machine.
  - `AD-24` (Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It) — Remote console isolates chrome state; zero room-facing projector output on remote client.
  - `AD-29` (The Projector Reports Its Own Liveness and Nothing Else, and One Predicate Decides It) — The projector liveness predicate is strictly between presenting host and physical screen; remote client observes host status and never alters the liveness evaluator.
  - `AD-37` (Remote Control Pairing, Single Controller, and Intent Relay) — Strict authenticated single-use pairing and remote intent routing.
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser) — Presenter console controls and resilient local-first playback.
  - `FR-35` (Remote Presenter Control) — Robust, authenticated remote controlling via SSE stream and intent dispatching. Reconciled: primary operator signs in at host workstation; secondary mobile devices claim a cryptographically scoped capability token without inheriting admin account credentials.
  - `FR-25` (Display the Operator interface in the Operator's language) — Full bilingual localization via `useT()`.
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
  - `UC-29` (Remote Presenter Control: Mobile/Secondary Controller Pairing, Slide Advance, and State Mirroring)
- **Components**: `presenter`, `hub`
- **Touches**: `media-player`, `remote-control`, `httpapi`, `gate`, `present-channel`, `projected`
- **Audit Provenance**: Synthesized from joint steering consensus of **Sol Codex** (`GPT-6.1-Sol`) and **Opus** (`Claude Opus 5.5`) in `.work/shell-out/audit-release/07-sol-codex-sintesa/` and `08-opus-sintesa/`, evaluating independent audit findings from `deepseekpro`, `glm53`, `sonnet`, and `terra-codex`.

---

## 1. Problem Statement & Motivation

During the collaborative multi-model release audit for the pending `v0.2.0` distribution, a unanimous **NO-GO / BLOCKER** verdict was returned across four critical subsystems:

1. **Offline Media Playback Disconnect & Startup Drop**:
   - In `PresenterOperator.tsx:587`, `fetch('/api/media/playlist')` is called prior to local item assembly. When offline, the `catch` block aborts, dropping all locally cached/IndexedDB media from the playlist.
   - Virtual streaming via `media-sw.js` and `virtual-streamer.ts` was not wired into `MediaStage.tsx`, which attempted playback from cloud/server URLs instead of local byte-range resolvers.
   - An IndexedDB version mismatch existed between `media-sw.js` (opening v1) and `local-media-registry.ts` (opening v2).

2. **Mobile QR Pairing Barrier & Presentation Hijacking Vulnerabilities**:
   - Mobile smartphones scanning the presenter QR code were blocked with HTTP 401 or blank screens because the route `/remote`, `postRemoteClaim`, `getRemoteStream`, and `postRemoteIntent` unconditionally required an active operator session cookie (`sess := sessionFrom(r)`).
   - In `internal/httpapi/remote.go`, `getRemoteStream` allowed arbitrary authenticated sessions to claim `?role=presenter` without possessing pairing credentials, hijacking the stream and evicting the legitimate presenter.
   - Any authenticated session could issue `DELETE /api/present/:id/remote/pair` to DoS active pairing without role verification.
   - The unauthenticated claim endpoint lacked rate-limiting, exposing the 6-digit PIN to guessing attacks.

3. **Backend Security Boundaries & StorageKey Validation**:
   - `internal/httpapi/server.go` lacked Host header validation and fail-closed Origin verification on gated state-changing routes, exposing church LAN hosts to DNS rebinding and cross-site request forgery.
   - `internal/httpapi/media_playlist.go` lacked strict canonical 64-hex SHA-256 regex enforcement on `storageKey` and filesystem directory containment checks.

4. **Telemetry Jitter, Audio Leak, and Bilingual Parity Residue**:
   - Remote seekbar scrubbing lacked monotonic sequence numbers (`seq`), permitting delayed SSE packets on jittery church Wi-Fi to revert optimistic slider state (*rubber-banding*).
   - Reconnecting remote clients did not receive an immediate full-state snapshot.
   - Projector video mute enforcement in `ProjectedMediaLayer.tsx` declared `muted` and `playsInline` in JSX but lacked `defaultMuted`, leaving potential for edge-case DOM state desynchronization.
   - Unlocalized Indonesian and English raw strings remained in presenter canvas inspection menus.

---

## 2. Technical Architecture & Invariant Specifications

### 2.1 Offline Media Playback Resolution & Resilient Startup (`SPEC-121-01`)
- **Independent Local Hydration**:
  - `PresenterOperator.tsx` MUST assemble and display locally registered media items from IndexedDB (`localMediaRegistry.getRecords()`) independently of and prior to network requests.
  - If `fetch('/api/media/playlist')` fails (network unreachable/offline), local items MUST remain mounted and playable in the Media Drawer.
- **Local Playback Routing**:
  - `MediaStage.tsx`, `playlist-model.ts`, and `ProjectedMediaLayer.tsx` MUST resolve local items through the local byte-range stream URL (`/local-media/<sha256>`) or standard localhost Range 206 streaming endpoint (`/api/media/<id>/content`).
- **IndexedDB & Service Worker Parity**:
  - `media-sw.js` and `local-media-registry.ts` MUST share identical database version constants (`DB_VERSION = 2`) and object store names (`INDEX_STORE = 'media-index'`).
  - `media-sw.js` MUST handle both `record.fileHandle` (Blob/FileSystemFileHandle) and fallback memory representations.

### 2.2 Isolated Mobile QR Pairing Gateway (`SPEC-121-02`)
- **Unauthenticated QR Bootstrap & Handler Refactoring**:
  - Exclude `/remote` and `POST /api/present/:id/remote/claim` from strict session cookie gating in `internal/gate/gate.go`.
  - In `spa/src/App.tsx`, `PresentGate` MUST permit unauthenticated access to `/remote` when a valid claim code or remote session token is present.
  - Refactor `postRemoteClaim`, `getRemoteStream`, `postRemoteResume`, and `postRemoteIntent` in `internal/httpapi/remote.go` to accept an unauthenticated `remote_session_token` as a valid capability credential without requiring an operator cookie session (`sessionFrom(r)`).
- **Abuse Resistance & Ephemeral Pairing Exchange**:
  - Implement per-service and per-IP claim rate limiting on `POST /claim` (maximum 5 failed attempts per service per minute).
  - Claiming a valid 6-digit PIN within its 120s TTL issues a dedicated, cryptographically random `remote_session_token`.
  - The smartphone remote client uses this token for subsequent SSE stream connections (`GET /api/present/:id/remote/stream?token=...`) and intent dispatching (`POST /api/present/:id/remote/intent`).
  - Remote session authority is strictly restricted to presentation intents (`slide`, `media`, `scripture`, `blank`). It possesses ZERO authority over admin APIs, service CRUD, or user accounts.
- **Presenter Role & Pairing Lease Invariant**:
  - In `internal/httpapi/remote.go`, `getRemoteStream` MUST reject `?role=presenter` unless the caller is the proven `presenterUID` established during `POST /pair`.
  - `DELETE /api/present/:id/remote/pair` MUST strictly verify that the caller is the active `presenterUID` or an authenticated administrator.

### 2.3 Backend Security Boundaries & StorageKey Validation (`SPEC-121-03`)
- **Host & Fail-Closed Origin Validation**:
  - In `internal/httpapi/server.go`, validate `Host` headers against trusted loopback and configured local host patterns.
  - On all state-changing HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`), enforce fail-closed `Origin` or `Referer` validation against allowed hosts, preventing cross-site triggering from untrusted browser contexts.
- **StorageKey & Filesystem Containment**:
  - In `internal/httpapi/media_playlist.go`, enforce canonical 64-hex SHA-256 regex `^[a-f0-9]{64}\.[a-z0-9]+$` on incoming `storageKey` (strictly lowercase hex).
  - Ensure all resolved file paths remain strictly contained within `uploadsDir`, rejecting path traversal.

### 2.4 Monotonic Telemetry, Full Snapshot, JSX Mute & Bilingual Parity (`SPEC-121-04`)
- **Monotonic Telemetry Sequence & Epoch Reset**:
  - Include monotonically increasing `seq`, `sessionEpoch`, and server timestamps on host `broadcastState` payloads.
  - Remote client rejects state updates with older `seq` while an optimistic seek hold is pending, eliminating rubber-banding.
  - Define explicit epoch reset semantics on host server restart or presenter session handover.
- **Immediate Reconnect Snapshot**:
  - Upon SSE stream connection or reconnection, host immediately dispatches an unthrottled full presentation state snapshot.
- **Static JSX Mute Invariant**:
  - In `ProjectedMediaLayer.tsx`, `<video>` elements MUST declare `defaultMuted` alongside `muted` and `playsInline` props in JSX in addition to imperative DOM guards.
- **Bilingual i18n Parity**:
  - Migrate all remaining raw UI strings in `PresenterOperator.tsx` to `I18N_KEYS`, updating `catalogue-en.ts` and `catalogue-id.ts` with complete test guard coverage in `tests/bilingual-i18n-parity.test.mjs`.

---

## 3. Auditable Scope & File Inventory

- `src/operator/present/PresenterOperator.tsx` — Local media hydration resilience, remote pairing modal updates, unlocalized string cleanup.
- `src/operator/present/media-player/MediaStage.tsx` — Local playback URL resolution.
- `src/operator/present/media-player/playlist-model.ts` — Storage ladder fallback and local item resolution.
- `src/operator/present/media-player/virtual-streamer.ts` — Range request streaming bridge.
- `public/media-sw.js` — IndexedDB v2 schema parity and blob reader support.
- `src/lib/presenter-remote-client.ts` — Token-based remote auth and monotonic seq filtering.
- `spa/src/App.tsx`, `spa/src/pages/RemotePage.tsx` — Unauthenticated `/remote` route handling and token hygiene.
- `internal/gate/gate.go` — Exemption of `/remote` and `/api/present/:id/remote/claim`.
- `internal/httpapi/remote.go` — Remote session claim verification, presenter stream hijacking fix, un-pair DoS prevention, rate limiting.
- `internal/httpapi/server.go` — Host/Origin header validation middleware.
- `internal/httpapi/media_playlist.go` — StorageKey 64-hex regex and path traversal guards.
- `src/projected/media/ProjectedMediaLayer.tsx` — Static JSX `defaultMuted` prop.
- `src/lib/i18n/keys.ts`, `catalogue-en.ts`, `catalogue-id.ts` — Complete bilingual key mappings.
- `tests/presenter-media-player.test.mjs`, `tests/remote-control-go-http.test.mjs`, `tests/remote-presenting-client.test.mjs`, `tests/bilingual-i18n-parity.test.mjs` — Automated verification suite and defect injection tests.
