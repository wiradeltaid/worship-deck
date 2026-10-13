# Smoke Evidence — SPEC-118

Date: 2026-10-13
Mandate: DEC-105
Branch: autopilot/DEC-105

## Test Results

### 1. SPEC-118-01: Responsive Media Control Bar Breakpoint Expansion for Tablet & Compact Viewports (FR-16, FR-35, UC-12, UC-29)
- **Status:** PASS
- **Command:** `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/presenter-media-player.test.mjs`
- **Evidence:** 19/19 tests green. Breakpoint elevated to `xl:` (1280px). Viewports < 1280px (smartphones 380px–450px, iPad Mini 744px/768px portrait, 1024px landscape, and compact tablets up to 1279px) render in touch-friendly 2-row layout with full-width scrubbar. Viewports >= 1280px flatten to desktop single-row bar (`h-13`).
- **Defect Injection:** Mutation with `md:` instead of `xl:` triggers all 9 scanner findings.

### 2. SPEC-118-02: Zero-CLS Presenter Header Layout Stabilization and Guest Live Bounded Geometry (FR-16, FR-25, UC-12, UC-29)
- **Status:** PASS
- **Command:** `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/presenter-guest-feed-controls.test.mjs`
- **Evidence:** 37/37 tests green. Row 3 bounded to `max-w-full sm:max-w-[420px]`. Device dropdown trigger compacted during active guest presentation (`max-w-[120px]`). Action buttons and badges reinforced with `shrink-0`. Switching between idle, ready, and confirmed-live causes zero layout shift on upper action toolbars (Row 1 & Row 2).
- **Defect Injection:** Mutation removing bounded max-width triggers scanner findings.

### 3. SPEC-118-03: Header Alert & Prompt Isolation (Zero-Shift Banner Placement across Viewports) (FR-16, FR-25, UC-12)
- **Status:** PASS
- **Command:** `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/presenter-header-two-row-layout.test.mjs`
- **Evidence:** 8/8 tests green. Alert banners (`projector-reopen-prompt`, `congregationScreenBlocked`, lost liveness, role-lost) relocated out of `<header>` flexbox into dedicated notification slot beneath `<header>` (`presenter-header-notification-strip`). Presentation lock toggle button dimensionally stabilized with `min-w-[76px] sm:min-w-[84px] justify-center`, preventing button jiggle on toggle.
- **Defect Injection:** Mutation placing alerts back into `<header>` or removing min-width triggers guard findings.

### 4. SPEC-118-04: Resilient Remote Pairing Connection, Reconnect Retention, and Heartbeat Jitter Tolerance (FR-35, UC-29)
- **Status:** PASS
- **Command:** `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/remote-control-go-http.test.mjs tests/remote-presenting-client.test.mjs`
- **Evidence:** 10/10 tests green in `remote-control-go-http.test.mjs` (including test 10: token-based resume, session token re-binding, and revocation). 31/31 tests green in `remote-presenting-client.test.mjs`. StreamFreshnessWindow tuned to 30s. Token-based session resumption (`session_token`) stored in `sessionStorage` and transparently re-establishes connection on transient Wi-Fi drops without needing a new PIN. Single-controller invariant (AD-37) strictly maintained on host re-pairing and termination.

### 5. Unified Test Suite Execution
- `go test ./...`: 100% PASS
- `npm run typecheck`: 0 errors
- `npm run build`: Vite build clean
- `npm run smoke:spec-118`: 145/145 tests PASS
- `validate.py --generate --baseline`: GREEN (0 findings, 100% promise progress, 847/847 RTM rows green)
