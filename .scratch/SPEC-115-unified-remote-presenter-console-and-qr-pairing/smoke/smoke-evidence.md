# Smoke Test Evidence — SPEC-115: Unified Remote Presenter Console and QR Pairing

**Date:** 2026-10-12
**Scope:** SPEC-115 (`SPEC-115-01`, `SPEC-115-02`, `SPEC-115-03`, `SPEC-115-04`)
**Command:** `npm run smoke:spec-115`
**Suites:** `tests/remote-presenting-client.test.mjs`, `tests/remote-screen.test.mjs`, `tests/presenter-media-player.test.mjs`, `tests/bilingual-i18n-parity.test.mjs`

## Test Results

- Total tests: 68
- Passing: 68
- Failing: 0
- Suites: 4
- Duration: ~2.1s

## Verifications Covered

1. **SPEC-115-01 (Zero-Friction QR Pairing & URL Hygiene)**:
   - Self-contained zero-dependency QR Code generator (ISO/IEC 18004 Byte mode, EC Level M).
   - High-contrast SVG QR Code modal with PIN display and copy link button.
   - Universal `/remote` route auto-resolving active service.
   - `history.replaceState` stripping `?code=...` while preserving history state and URL hash.
   - Bilingual dictionary parity across all 14 remote copy keys.
2. **SPEC-115-02 (Unified Dual-Mode Console Shell & Surface Isolation)**:
   - Presenter console parameterized by `mode?: 'host' | 'remote'`.
   - Audio mute invariant: `mutedOverride` forces `baseVol = 0`, media elements muted, and engine blocks post-mount unmute / volume changes.
   - Projector bypass: `openPresentChannel`, liveness polling, and display controls omitted in remote mode.
   - Hardware capture bypass: `CaptureBroker` and guest feed controller omitted in remote mode.
   - Persistence isolation: `MediaDrawer`, playlist hydration, and emergency patches omitted in remote mode.
3. **SPEC-115-03 (Full-Surface Remote Intent Telemetry & Media Control)**:
   - Whitelist of 9 media transport intents in Go backend (`internal/httpapi/remote.go`).
   - Strict payload validation (finite non-negative seek time, trimmed non-empty item ID).
   - Non-authoritative intent dispatching on `MediaControlBar` carrying `planIdentity`.
   - Host-authority execution and bidirectional SSE mirroring of playhead, playing state, and projection status.
   - Immediate full state snapshot broadcast upon remote pairing connection.
4. **SPEC-115-04 (Executable Defect Injection Proofs)**:
   - Injecting un-isolated projector channel, audio mute bypass, or hardware capture fails isolation scan.
   - Injecting un-isolated Emergency Edit or MediaDrawer fails guard.
   - Injecting missing remote key declaration in `catalogue-en.ts` fails bilingual parity guard.
   - Injecting raw un-localized string in QR modal fails raw string guard.
   - Negative seek or omitted handler fails intent validation.
