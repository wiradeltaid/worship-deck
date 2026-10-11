# SPEC-111-04 — Absence Guard Test Suite & Injected Defect Verification

**Satisfies:** [UC-12, FR-16]
**Blocked by:** [SPEC-111-03]
**Status:** open

## Summary
Implement automated test suite in `tests/local-media-player.test.mjs` verifying all architectural absence guards, range-stream mechanics, and reload recovery with injected defect proofs.

## Key Responsibilities
1. **Guard 1: Projector Mute Enforcement on Local Media**:
   - Assert `video.muted === true` on initial mount and after all sync updates for `source: 'local'`.
   - Proof: Injected removal of runtime mute check causes guard test failure.
2. **Guard 2: Zero Remote Upload Invariant**:
   - Assert zero network requests to `/api/upload` are dispatched when adding local media items.
   - Proof: Forcing upload dispatch on local files triggers assertion failure.
3. **Guard 3: User Gesture Permission Invariant**:
   - Assert `requestPermission` is never called automatically on mount/load without user gesture.
   - Proof: Simulating automatic `requestPermission` call on hydration triggers guard failure.
4. **Guard 4: Top Control Bar Zero-Scroll Position**:
   - Assert `MediaTopBar` renders before slide monitor elements in the DOM hierarchy and collapses to height 0 when idle.
   - Proof: Inverting container order or persisting fixed height when idle triggers layout test failure.
5. **Guard 5: Presentation Lock Panic Accessibility**:
   - Assert Pause, Fade, Mute, and Take Off Screen respond even when `presentationLock` is active from the top bar.
   - Proof: Disabling panic controls during lock triggers test failure.
6. **Guard 6: Fail-Closed Teardown on Local I/O Error**:
   - Assert local media I/O error or missing handle during projection immediately falls back to `{ kind: 'deck' }`.
   - Proof: Simulating unhandled I/O error without deck fallback triggers assertion failure.
7. **Guard 7: Service Worker 206 Range Response Parity & 416 Guard**:
   - Assert Service Worker responds with HTTP 206, `Accept-Ranges: bytes`, and accurate `Content-Range` for byte slice requests, and returns HTTP 416 for out-of-bounds ranges.
   - Proof: Omission of `Content-Range` or returning full body causes assertion failure.
8. **Guard 8: Presenter-Channel Recovery & Resync Invariant**:
   - Assert Projector `request-sync` replay receives authoritative `sync` containing `source: 'local'`, `mediaId`, and `mediaTime`, and acknowledges via `projector-media-status`.
   - Proof: Omitting media state on resync causes assertion failure.

## Acceptance Criteria
- Full test suite passes under Node test runner (`node --test tests/local-media-player.test.mjs`).
- Every absence guard proven red through defect injection before passing assertions.
