# SPEC-110-04 — Guard Test Suite & Absence Invariant Verification

**Satisfies:** [UC-12, UC-28, FR-16, FR-33]
**Blocked by:** [SPEC-110-03]
**Status:** closed

## Summary
Build automated test suite in `tests/presenter-media-player.test.mjs` verifying all eight mandatory architectural absence guards with injected defect proofs.

## Key Responsibilities
1. **Guard 1: Projector Mute Enforcement**:
   - Assert `video.muted === true` on initial mount and after all sync updates.
   - Proof: Injected removal of runtime mute check causes guard test failure.
2. **Guard 2: Drawer Mount Independence**:
   - Assert media element does not pause or re-mount upon drawer open/close.
   - Proof: Rendering stage inside drawer causes playback interruption failure.
3. **Guard 3: Projection State Teardown**:
   - Assert changing items or `ended` event sets projection back to `kind: 'deck'`.
   - Proof: Forcing projection persistence into subsequent track causes assertion failure.
4. **Guard 4: Presentation Lock Panic Accessibility**:
   - Assert Pause, Fade, Mute, and Take Off Screen respond even when `presentationLock` is active.
   - Proof: Disabling panic controls during lock triggers test failure.
5. **Guard 5: Drift & Clock Calculation**:
   - Pure unit tests for `expectedTime(mediaTime, at, now)` and drift compensation boundary logic.
6. **Guard 6: Guest/Media Projection Exclusivity**:
   - Assert `kind: 'guest'` and `kind: 'media'` never both resolve true on projector; activating one tears down the other.
   - Proof: Payload asserting both renders exactly one `z-30` layer.
7. **Guard 7: Projector Resync Safety**:
   - Assert `request-sync` answered with no matching in-memory media state falls back cleanly to `{ kind: 'deck' }`.
   - Proof: Reconnect with empty media state does not render broken video element.
8. **Guard 8: Fade Cancellation & Volume Restoration**:
   - Assert stopping or switching tracks mid-fade cancels attenuation and restores volume.
   - Proof: Retaining attenuation timer across track switch causes volume deficit failure.

## Acceptance Criteria
- Full test suite passes under Node test runner (`node --test tests/presenter-media-player.test.mjs`).
- Every absence guard proven red through defect injection before final passing assertion.
