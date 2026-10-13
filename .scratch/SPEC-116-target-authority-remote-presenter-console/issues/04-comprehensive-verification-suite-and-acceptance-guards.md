# SPEC-116-04 — Comprehensive Verification Suite, Regression Guards, and Bilingual Localization Parity

**Satisfies:** [UC-12, UC-29, FR-16, FR-25, FR-35]
**Blocked by:** ["SPEC-116-03"]
**Status:** done

## Summary
Implement automated unit and behavioral verification tests for scripture remote intent routing, remote read-only playlist hydration, remote drawer track selection, remote audio fade out, guest capture remote telemetry, projector reopen/refocus protocol, and ensure 1:1 bilingual dictionary parity with executable defect-injection proofs.

## Key Responsibilities
1. **Scripture & Media Remote Intent Tests (`tests/remote-presenting-client.test.mjs`, `tests/remote-control-go-http.test.mjs`, `tests/presenter-media-player.test.mjs`)**:
   - Verify `pushScripture()`, `clearScripture()`, page change, `media-set-volume`, `media-set-mute`, and `media-reorder-item` dispatch valid intents from remote console.
   - Verify `applyRemoteIntent` executes scripture, volume adjustments, mute toggling, track reordering, and media drawer selection on host.
   - Verify Go API validates and broadcasts new guest capture, volume, mute, track reorder, and reopen intent types, returning 401 for unauthenticated and 409 for unpaired callers.
2. **Guest Capture & Projector Reopen Tests (`tests/presenter-guest-feed-controls.test.mjs`, `tests/remote-screen.test.mjs`)**:
   - Verify host capture status mirrors accurately to remote clients over SSE without local device prompts.
   - Verify projector refocus and host reopen banner behavior.
3. **Surface Isolation Invariant Guards (`tests/remote-screen.test.mjs`, `tests/presenter-media-player.test.mjs`)**:
   - Verify remote device never opens BroadcastChannel, never plays local audio, and never calls `navigator.mediaDevices.getUserMedia`.
   - Verify `MediaDrawer` in remote mode suppresses mutative file actions (upload/delete/import).
4. **Absence & Defect Injection Proofs (`tests/bilingual-i18n-parity.test.mjs`, `tests/acceptance-fr35-remote.test.mjs`)**:
   - Inject un-routed scripture intents or missing localization keys to verify guards fail closed.
   - Verify full browser acceptance flow across pairing, scripture push, media control, and disconnect resilience.

## Acceptance Criteria
- All tests in `tests/remote-presenting-client.test.mjs`, `tests/remote-control-go-http.test.mjs`, and `tests/remote-screen.test.mjs` pass cleanly.
- Defect injection tests prove that failing to route scripture intents or exposing mutative buttons on remote fails the guard.
- 100% bilingual dictionary parity across all new keys in English and Indonesian catalogues.
- Full test suite (`npm test`, `go test ./...`) passes with exit code 0.

## Comments
- Implemented and verified comprehensive unit, regression, and defect injection test suites across `tests/remote-presenting-client.test.mjs`, `tests/remote-screen.test.mjs`, `tests/presenter-media-player.test.mjs`, `tests/presenter-guest-feed-controls.test.mjs`, `tests/remote-control-go-http.test.mjs`, and `tests/bilingual-i18n-parity.test.mjs`.
- Added script `smoke:spec-116` in `package.json` covering all 121 scoped tests.
- Established 1:1 bilingual localization parity for all SPEC-116 keys in `keys.ts`, `catalogue-en.ts`, and `catalogue-id.ts` with real-file defect injection proofs.
- Verified FR-35 browser acceptance tests in `tests/acceptance-fr35-remote.test.mjs`.
- Created smoke evidence report at `.scratch/SPEC-116-target-authority-remote-presenter-console/smoke/smoke-evidence.md`.
- Full suite green: `npm run smoke:spec-116` (121/121 pass), `go test ./...` (100% pass), `npm run typecheck` (0 errors), `npm run build` (clean build), `public-repo-guard.test.mjs` (5/5 pass), `git diff --check` (clean).
