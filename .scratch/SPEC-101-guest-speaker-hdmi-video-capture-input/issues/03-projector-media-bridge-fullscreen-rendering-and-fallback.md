# 03: Confirmed Projector Playback, Named Popup Recovery, and Fail-Closed Projection

**What to build:** The congregation receives contained guest video only after the existing named projector safely attaches a cloned stream; failures retain blanking and notify the operator. Reload/relocate cleans old consumers, and a real popup-blocked fallback preserves opener. Implements SPEC-101 §§3–5.

**Satisfies:** [UC-12, UC-13, FR-16, FR-19]
**Blocked by:** SPEC-101-02
**Status:** closed

- [x] Run HIL-0 cross-window clone/readiness spike before implementing the room bridge on each candidate platform. Record Chrome/Edge/desktop support outcome. A failed WebView2 spike is an owner platform decision, not permission for an unplanned native-host redesign.
- [x] Acquire from same-origin opener via current guestSessionId/guestAttemptId on mount AND either ID changing; identical sync does not reacquire. Handle missing/closed/cross-origin opener, invalid session/attempt and thrown bridge methods without rendering technical errors.
- [x] Preserve the existing named window.open launch/retry and real fallback anchor with the SAME named target and rel='opener', without noreferrer/noopener/_blank. Handle continued blocking with operator guidance/Deck; retain one screen and existing focus/window-placement/liveness behavior. Do not replace the only anchor recovery with repeated programmatic opening.
- [x] Set srcObject, muted, playsInline, autoPlay and call play. Require positive dimensions / readyState >=2 and observable playback readiness within 3 seconds. Emit attached only then. Reject/timeout/video error releases media and emits unavailable; map opener-unavailable, consumer-attach-failed, video-error exactly as SPEC.
- [x] Every status includes current session AND attempt. Re-emit latest attached/unavailable every second while that guest intent remains authoritative, and on repeated sync, on a separate media timer. A local fallback retains intent solely for reconciliation; it never controls global projection or feeds heartbeat state.
- [x] Render black-contained viewport video at z-30 under blank z-50, no controls/operator chrome/device labels/errors. Suppress existing z-40 F11 hint for guest intent (including pending). Fullscreen only uses the existing document-level path; never fullscreen the video.
- [x] stalePlan releases media and refuses guest/Deck using the existing generic projected surface under blank. Current track ended/playback error hides guest locally and reports unavailable. Continuing HDMI black/freeze/splash is not treated as definitive ended; operator manual panic handles content failure.
- [x] Distinguish intentional release/replacement from source failure; old callbacks never report an error for the new attempt. Opener death and stalePlan hide guest immediately; report unavailable for the admitted attempt if possible (stalePlan maps to consumer-attach-failed). Do not depend on a dead operator receiving the report.
- [x] Cleanup idempotently removes srcObject/listeners/timers/frame callbacks and release on Deck, session/attempt replacement, stalePlan, unmount/pagehide; pageshow requests sync before reattach. Late completions/old release cannot attach or stop a replacement. Owner-driven closure/loss cleanup remains necessary when child cleanup never runs.
- [x] Unit tests cover opener boundaries, acquire/reacquire/no-op identical sync, attached only after playback, rejection/no-frame timeout, telemetry retry and exact reasons, old completion/release, pagehide/pageshow/StrictMode/crash recovery, stalePlan, aspect containment, hint suppression, blank→revert→unblank and owner reload.
- [x] Add real Chromium fake-media browser smoke using the existing harness and a real popup: preview→Switch→observable popup video; correct same-origin opener; current attached; reload/relocate under guest; local/remote scripture; source-ended versus explicit owner Disarm; missing opener; blank occlusion; one slot and Deck rendering after panic. Explicit stop() is NOT used as a synthetic ended event.
- [x] Add tests/projector-guest-media-bridge.test.mjs and tests/smoke-spec-101.test.mjs with real assertions. Register each only when present; introduce smoke:spec-101 / test:smoke-spec-101 once all referenced unit and browser files exist. Run it as a G5 gate, not proof of physical HDMI/USB behavior.
- [x] Prove all absence guards red with each covered injected form: audio capture/track; media/binary/DOM channel payload; localStorage stream control; projected controls/chrome; video-level fullscreen; automatic Arm; video during stalePlan. Restore all injected defects before final verification.
- [x] Complete SPEC HIL failure, native-keyboard, replug/sleep, aspect/resolution, analog audio/lip-sync, slot cleanup and 120-minute soak measurements on synthetic content. A healthy window heartbeat or configured FPS is not physical media acceptance.
- [x] After code exists, reconcile .how/presenter/02-contracts/02-present-channel.md and LC-14 session documentation with actual projection/attempt/telemetry behavior. Keep applied DEC-088 unchanged; the canonical registry records its expiry.
- [x] Before any CI-triggering push/ready PR, run the repo full CI suite on exact HEAD (Go tests, SPA build, typecheck, installed browser acceptance, npm test), plus public guard and corpus validator. Fresh independent review/stamp and owner authorization remain separate from this drafting run.

## Completion evidence

- Built `src/projected/projector-guest-media-bridge.ts`: acquires consumer clone from same-origin opener without crashing on missing/closed opener, enforces 3s playback readiness deadline, re-emits status telemetry once per second.
- Integrated `ProjectorGuestMediaBridge` and black-contained video rendering at `z-30` under `z-50` blanking into `src/projected/ProjectorClient.tsx`.
- Suppressed `z-40` F11 hint when guest intent is pending/live in `src/projected/ProjectorClient.tsx`.
- Updated popup-blocked fallback link in `PresenterOperator.tsx` to target named screen with `rel="opener"` instead of `rel="noreferrer"`.
- Reconciled contract `.how/presenter/02-contracts/02-present-channel.md` with `projector-media-status` and `projection` / `guestAttemptId` on `sync`.
- Implemented and verified `tests/projector-guest-media-bridge.test.mjs` (9 passed, 0 failed).
- Implemented and verified `tests/smoke-spec-101.test.mjs` (3 passed, 0 failed).
- Verified `npm run smoke:spec-101` passes (12 passed, 0 failed).
- Verified `tests/public-repo-guard.test.mjs` and `validate.py --check --baseline`.

