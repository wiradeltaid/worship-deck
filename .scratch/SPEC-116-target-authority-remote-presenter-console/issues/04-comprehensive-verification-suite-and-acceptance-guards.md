# SPEC-116-04 — Comprehensive Verification Suite, Regression Guards, and Bilingual Localization Parity

**Satisfies:** [UC-12, UC-29, FR-16, FR-25, FR-35]
**Blocked by:** ["SPEC-116-03"]
**Status:** open

## Summary
Implement automated unit and behavioral verification tests for scripture remote intent routing, remote read-only playlist hydration, remote drawer track selection, remote audio fade out, guest capture remote telemetry, projector reopen/refocus protocol, and ensure 1:1 bilingual dictionary parity with executable defect-injection proofs.

## Key Responsibilities
1. **Scripture & Media Remote Intent Tests (`tests/remote-presenting-client.test.mjs`, `tests/remote-control-go-http.test.mjs`, `tests/presenter-media-player.test.mjs`)**:
   - Verify `pushScripture()`, `clearScripture()`, page change, `media-set-volume`, and `media-set-mute` dispatch valid intents from remote console.
   - Verify `applyRemoteIntent` executes scripture, volume adjustments, mute toggling, and media drawer selection on host.
   - Verify Go API validates and broadcasts new guest capture, volume, mute, and reopen intent types, returning 401 for unauthenticated and 409 for unpaired callers.
2. **Guest Capture & Projector Reopen Tests (`tests/presenter-guest-feed-controls.test.mjs`, `tests/remote-screen.test.mjs`)**:
   - Verify host capture status mirrors accurately to remote clients over SSE without local device prompts.
   - Verify projector refocus and host reopen banner behavior.
3. **Surface Isolation Invariant Guards (`tests/remote-screen.test.mjs`, `tests/presenter-media-player.test.mjs`)**:
   - Verify remote device never opens BroadcastChannel, never plays local audio, and never calls `navigator.mediaDevices.getUserMedia`.
   - Verify `MediaDrawer` in remote mode suppresses mutative actions (upload/delete/reorder).
4. **Absence & Defect Injection Proofs (`tests/bilingual-i18n-parity.test.mjs`, `tests/acceptance-fr35-remote.test.mjs`)**:
   - Inject un-routed scripture intents or missing localization keys to verify guards fail closed.
   - Verify full browser acceptance flow across pairing, scripture push, media control, and disconnect resilience.

## Acceptance Criteria
- All tests in `tests/remote-presenting-client.test.mjs`, `tests/remote-control-go-http.test.mjs`, and `tests/remote-screen.test.mjs` pass cleanly.
- Defect injection tests prove that failing to route scripture intents or exposing mutative buttons on remote fails the guard.
- 100% bilingual dictionary parity across all new keys in English and Indonesian catalogues.
- Full test suite (`npm test`, `go test ./...`) passes with exit code 0.
