# 02: Presenter Guest Intent, Confirmed Room Status, and Safe Sync

**What to build:** An operator inspects a ready preview, deliberately switches a responding projector to guest, sees waiting versus confirmed attachment, and can always return to Deck without accidental on-air keyboard actions. Local and remote scripture/slide actions share one authoritative presenter transition path. Implements SPEC-101 §§2–4.

**Satisfies:** [UC-12, UC-13, FR-16, FR-19]
**Blocked by:** SPEC-101-01
**Status:** open

- [ ] Wire the broker preview/picker into existing Presenter Header conventions. Use typed presenter.guestFeed.* keys and English/Indonesian parity for every label/error/warning/status/privacy notice; preview remains visible and adjacent to manual switching controls.
- [ ] Model idle→arming→ready, ready→guest-pending→confirmed-live, pending/live→ready on Revert, ready→idle, and pending/live→Deck→idle on Disarm. On loss/error, Deck intent wins. Ready confirms preview only; Live requires matching attached telemetry.
- [ ] Switch requires selected healthy master, operator preview check, responding named projector, and unblocked launch. Explain disabled state. Revert remains accessible for pending/live/error, independent of presentationLock/busy/dialogs. Disarm first broadcasts complete Deck state, then releases/stops media.
- [ ] Add projectionOf with fail-closed Deck for missing/malformed guest projection/attempt on sync; non-sync returns null. Keep ProjectedSource shape from AD-10 and add guestAttemptId in the guest sync envelope for diagnostic correlation.
- [ ] Use one projection/attempt ref source for ALL sync producers: setIndexAndSync, currentState/request-sync, emergency-patch hydration, and emergency-patch revert. Preserve index/blank/transition/background/scripture/patches/planIdentity. Slide/remote-next and patch activity retain guest/session/attempt while pre-cueing the Deck.
- [ ] Issue fresh attempt on Switch, before operator-controlled reload/relocate, and in guest request-sync response; release/invalidate previous attempt first. Ordinary sync retains the attempt and does not restart deadlines. Deck/service/plan reset cancels pending work.
- [ ] Runtime-validate projector-media-status shape and closed reasons. Admit only current guestSessionId AND guestAttemptId while guest intent is active; ignore old same-session reports, unknown/missing IDs, stale attached and malformed reasons. Keep isProjectorMessage limited to request-sync/projector-alive for liveness and correct origin comments.
- [ ] Attach deadline is 5 seconds from attempt creation. Without matching attached, return globally to Deck, release consumer and warn. Accepted current unavailable also returns to Deck. Master loss uses the same owner transition. No automatic guest reentry.
- [ ] Owner media cleanup for confirmed handle closure/liveness lost returns intent to Deck before releasing the slot; distinguish intentional reload/relocate cleanup, which invalidates the old attempt and waits for its replacement. Do not derive a second liveness verdict or adopt a projector command.
- [ ] Enforce scripture exclusivity in the shared presenter transition/broadcast path, including remote intent, paging/mode and fallback callers. Enter guest clears scripture; explicit scripture returns to Deck with the passage in one complete sync; late superseded lookup results are ignored. Revert does not resurrect cleared scripture; blank never resets.
- [ ] Escape capture handler panics pending/live before input/grid/dialog filters, no stopPropagation, composition ignored; Deck is no-op. G is REVERT ONLY and respects editable/contentEditable, grid/dialog, composition/repeat/modifiers. Never Arm/Switch via G. Indicate lost console focus; projector remains a dumb sink.
- [ ] Probe visible preview in ready/guest with rVFC and a separate timer; >3 seconds without frame progress warns only. Hidden/unrendered/unsupported probe reports unknown, resets baseline on resume; nominal getSettings FPS is distinct from measured FPS. Cancel callbacks/timers on teardown.
- [ ] Test transition ordering (broadcast before stop), waiting/confirmed/deadline states, no-projector gating, all four full sync producers, repeated sync idempotency, old attempt unavailable after new attached, dropped initial status reconciled, same-session revert/re-switch, malformed telemetry, liveness separation, local/remote scripture and late lookup, background pre-cue, blank preservation, owner/service/plan reset, visibility/watchdog and locale parity.
- [ ] Test keyboard admission behavior and capture registration; real native select/fullscreen/focus limitations are HIL obligations. Prove no guest entry from G and missing-projection guards red at EACH covered sync producer; restore before verification.
- [ ] Create/register tests/presenter-guest-feed-controls.test.mjs in the same meaningful implementation change. Keep the complete suite/typecheck green after expanding PresentMessage. No stream/binary/DOM serialization or localStorage capture control.

## Completion evidence

Record behavioral results and mutation proofs. Operator focus/preview does not certify the physical room; preserve the pending badge and HIL obligations.
