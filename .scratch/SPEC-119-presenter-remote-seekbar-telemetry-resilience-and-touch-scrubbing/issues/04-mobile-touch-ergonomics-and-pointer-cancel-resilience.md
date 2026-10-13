# SPEC-119-04 — Mobile Touch Ergonomics, Pointer Cancel Resilience & Smooth Scrubbing

**Satisfies:** [UC-12, UC-29, FR-16, FR-35]
**Blocked by:** ["SPEC-119-03"]
**Status:** open

## Summary
Harden touchscreen scrubbing interactions on mobile phones and tablets in `MediaControlBar.tsx`. Prevent vertical touch scrolling gestures from canceling horizontal scrub operations (`pointercancel`), and attach idempotent pointer/touch release handlers so the seekbar never freezes mid-drag on mobile devices.

## Key Responsibilities
1. **Touch Gesture Containment (`src/operator/present/media-player/MediaControlBar.tsx`)**:
   - Add `touch-action: none` (`touch-none`) to the range slider input element class list so that touchscreen drags are strictly interpreted as slider scrubbing rather than page scroll gestures.
2. **Idempotent Pointer Cancel and Touch Release Resilience**:
   - Create a single idempotent `finalizeSeek(val)` helper guarded by `if (!isSeekingRef.current) return;` to prevent duplicate commits across multi-event touch cycles.
   - Attach `onPointerCancel={handleSeekPointerUp}`, `onTouchEnd`, and `onTouchCancel` event bindings.
   - Implement `setPointerCapture` on pointer down and handle `onLostPointerCapture` for mobile browser engine resilience.
3. **Ergonomic State Safety**:
   - Ensure `isSeekingRef.current` is always cleared when a gesture ends, preventing frozen seekbars ("kadang berhenti").

## Acceptance Criteria
- Scrubbing on mobile touchscreens (smartphones and tablets) does not freeze or lock up when dragging horizontally.
- Pointer cancellation safely commits or recovers without requiring an accidental blur.
- Idempotent finalization prevents duplicate commit intents on touch devices.
- Automated tests in `tests/presenter-media-player.test.mjs` verify touch event bindings and `touch-none` styling with defect injection.
