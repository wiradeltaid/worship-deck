# 01: CaptureBroker Device Selection, Operator Preview, and Bounded Lifecycle

**What to build:** An operator can deliberately select and arm a video-only capture input, inspect its preview, cancel or disarm safely, and retry without retaining old capture requests or projector clones. Implements SPEC-101 §§1 and 4; this operator-only slice does not put guest content on air.

**Satisfies:** [UC-12, FR-16]
**Blocked by:** none
**Status:** closed

- [x] Before feature work, remove future SPEC-101 test paths and smoke aliases from package.json, remove the duplicate smoke:spec-100 key if present, and establish a verified baseline. Do not claim all tests green solely from that cleanup.
- [x] Add a meaningful test-script registration guard that detects duplicate JSON keys and every nonexistent test path in package scripts. Observe it fail for each injected defect, restore it, then register this real test in the same implementation change.
- [x] Separate secure-context/API checks; enumerate only videoinput with localized labels; refresh labels after permission/devicechange. Device selection is explicit; a stale ID never silently becomes the default webcam. Map the typed errors specified in SPEC.
- [x] Arm requests selected deviceId, audio:false, and ideal 1080p60. No capture on mount/device selection. Coalesce repeat Arm; cancel invalidates generation; stop all tracks from late resolutions; no second outstanding permission request.
- [x] A visible muted/playsInline preview has positive dimensions and readyState >=2 within 5 seconds AFTER getUserMedia resolves. Failure/timeout detaches and stops media, cancels callbacks/timers and releases the hardware. Permission waiting stays distinct from frame readiness.
- [x] Generate a fresh guestSessionId per Arm generation, retain it across warm ready/Deck/guest, invalidate on Disarm/loss/owner teardown. Broker snapshots expose negotiated settings separately from measured/unknown frame health.
- [x] Expose a narrowly typed same-origin acquireProjectorConsumer(guestSessionId, guestAttemptId): { stream, release }. Session AND current operator-issued attempt must match; ready/live master required. Publish/invalidate active attempt locally under operator authority.
- [x] Keep ONE projector clone slot. Acquire replaces/stops the old slot. Idempotent release removes only its own slot and stops only its tracks; old cleanup cannot stop a replacement. No unbounded Set.
- [x] Operator teardown stops master/consumer even without child cleanup; poll confirmed closure/AD-29 lost through the existing owner evaluator. Cleanup covers route/service/plan change, unmount/pagehide, cancelled permission and failed acquire/preview. Stop is not treated as an ended event.
- [x] Implement clock/video/mediaDevices seams usable by node:test; demonstrate device selection→preview→disarm as this ticket's verifiable outcome. Do not add server media routes or persist capture control.
- [x] Behavioral tests cover enum/labels/typed errors, stale replug IDs, pending cancel/late resolve, arm double-click, readiness success/timeout cleanup, no audio tracks, old session/attempt rejection, clone replacement, double release, old release after replacement, disarm/owner teardown and retry.
- [x] Register tests/capture-broker-device-enumeration.test.mjs and tests/test-script-registration.test.mjs only when they exist with meaningful assertions. Prove no-auto-arm/no-audio guards red for every form they claim to forbid, restore, then run scoped tests/public guard. Full baseline verification precedes any CI-triggering push.

## Completion evidence

- Built `src/lib/capture-broker.ts` with explicit device enumeration, typed errors, `audio: false` 1080p60 capture constraints, generation invalidation, 5-second preview readiness timeout, single projector consumer slot with identity-bound release, and comprehensive testing seams.
- Added i18n keys for guest capture in English and Indonesian catalogues (`src/lib/i18n/keys.ts`, `src/lib/i18n/catalogue-en.ts`, `src/lib/i18n/catalogue-id.ts`) verified clean by `tests/i18n.test.mjs`.
- Implemented and verified `tests/test-script-registration.test.mjs`: detects duplicate JSON keys and nonexistent script test paths; verified defect-injection proofs fail and pass cleanly.
- Implemented and verified `tests/capture-broker-device-enumeration.test.mjs`: all 12 behavioral and guard-proof tests pass cleanly (12 passed, 0 failed).
- Public repo guard verified: `tests/public-repo-guard.test.mjs` passed (5 passed, 0 failed).
- Registered `tests/test-script-registration.test.mjs` and `tests/capture-broker-device-enumeration.test.mjs` in `package.json` test script.

