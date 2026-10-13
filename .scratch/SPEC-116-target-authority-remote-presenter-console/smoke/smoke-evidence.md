# Smoke Test Evidence — SPEC-116: Target-Authority Remote Presenter Architecture

**Date:** 2026-10-13
**Scope:** SPEC-116 (`SPEC-116-01`, `SPEC-116-02`, `SPEC-116-03`, `SPEC-116-04`)
**Command:** `npm run smoke:spec-116`
**Suites:**
- `tests/remote-presenting-client.test.mjs`
- `tests/remote-screen.test.mjs`
- `tests/presenter-media-player.test.mjs`
- `tests/presenter-guest-feed-controls.test.mjs`
- `tests/remote-control-go-http.test.mjs`
- `tests/bilingual-i18n-parity.test.mjs`

## Test Results

- Total tests: 121
- Passing: 121
- Failing: 0
- Suites: 6
- Duration: ~6.5s

## Verifications Covered

1. **SPEC-116-01 (Push Scripture Remote Intent, Chunk Pagination Sync, and Rundown Plumbing)**:
   - Remote scripture intent dispatching in `pushScripture()`, `handlePageChange()`, and `handleModeChange()`.
   - Bidirectional SSE state mirroring of scripture overlay (`RemoteControlSessionState['scripture']`) preserving full passage verses.
   - Paging round-trip test preserving page index parity across chunk changes.
   - Service `raw_payload` rundown sheet plumbing through `RemotePage.tsx` and `RemoteOperator.tsx`.
   - Executable defect injection proof for scripture dispatching and rundown forwarding.
2. **SPEC-116-02 (Remote Read-Only Playlist Hydration, MediaDrawer Isolation, Reordering, and Volume)**:
   - Read-only playlist hydration on remote mode via `GET /api/media/playlist` with `localMediaRegistry.hydrate()` bypass, populating `mediaStore.items` and setting `isCued = true`.
   - `MediaDrawer` opening on remote with mutation isolation (suppressing file uploads, imports, and deletion menus).
   - Track selection and discrete up/down reordering via `ChevronUp` / `ChevronDown` arrow buttons (`media-reorder-item`).
   - Remote software volume control (`media-set-volume`) and mute toggle (`media-set-mute`) with host-side application and SSE mirroring.
   - Mobile volume slider visibility preserved (`flex w-20 sm:w-24`).
   - Go backend whitelist validation for `media-reorder-item`, `media-set-volume`, and `media-set-mute`.
3. **SPEC-116-03 (Guest HDMI Capture Telemetry and Projector Reopen Protocol)**:
   - Go backend whitelist validation for `guest-arm`, `guest-disarm`, `guest-project` (boolean validation), and `request-reopen-projector`.
   - Concrete union telemetry contract (`GuestFeedUiState`, `ProjectedSource`, `FrameHealthStatus`) in `RemoteControlSessionState['guestFeed']`.
   - Header Row 3 Guest Feed controls mounted on remote without triggering local `getUserMedia`.
   - Zero-popup projector refocus when open, and prominent 1-click CTA banner (`[Buka Proyektor Sekarang]`) on host when closed.
   - Liveness-blind remote surface preserving AD-29 purity.
4. **SPEC-116-04 (Comprehensive Verification, Defect Injection Proofs, and Bilingual Parity)**:
   - 100% bilingual dictionary parity across all SPEC-116 keys in English and Indonesian catalogues.
   - Real-file defect injection proofs for missing keys and missing intent routes.
   - Full regression suite (`npm test`, `go test ./...`, `npm run build`, `public-repo-guard.test.mjs`) passing cleanly.
