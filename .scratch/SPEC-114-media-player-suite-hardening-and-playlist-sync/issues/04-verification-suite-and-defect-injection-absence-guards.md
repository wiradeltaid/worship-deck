# SPEC-114-04 — Comprehensive Verification Suite & Defect Injection Absence Guards

**Satisfies:** [UC-12, FR-16, FR-25]
**Blocked by:** [SPEC-114-03]
**Status:** done

## Summary
Implement unit, integration, and executable defect injection absence guards covering playback state sync, 3-way deletion, shuffle/repeat transitions, sanctuary audio-only invariants, and header button cleanup across `tests/local-media-player.test.mjs`, `tests/presenter-media-player.test.mjs`, and `tests/bilingual-i18n-parity.test.mjs`.

## Key Responsibilities
1. **Play/Pause & Projection Synchronization Tests (`tests/local-media-player.test.mjs`)**:
   - Verify `handleTogglePlayItem` switches between play and pause without desync.
   - Verify switching projected video while playing maintains local element play state and avoids 2s heartbeat drift resets.
   - Verify cued video sent to screen while paused remains at frame 0 without initiating rewind loops.
2. **3-Way Deletion Matrix & Presence Tests (`tests/local-media-player.test.mjs`)**:
   - Verify deleting from computer only leaves cloud record intact with `cloud-only` availability.
   - Verify deleting from cloud only leaves local IndexedDB record intact with `local-only` availability.
   - Verify deleting both calls `DELETE ...?purge=true` and unlinks local handle, removing record from both layers.
3. **Shuffle, Repeat & Sanctuary Invariant Tests (`tests/local-media-player.test.mjs`)**:
   - Verify deterministic shuffle via `resolveNextPlaylistItem` with injected RNG.
   - Verify `repeatMode: 'one'` takes strict precedence over shuffle.
   - **Absence Guard**: Verify that `resolveNextPlaylistItem` never selects a video track for auto-advance, preventing sanctuary screen surprise projection.
4. **Header Cleanup & Absence Guards (`tests/presenter-media-player.test.mjs`)**:
   - Static scan verifying `<MediaLauncherButton>` is absent from `PresenterOperator.tsx` header row 2.
   - Defect injection proof demonstrating that re-introducing the launcher button in header row 2 fails the guard.
5. **Localization Parity & Hardcoding Absence Guards (`tests/bilingual-i18n-parity.test.mjs`)**:
   - Verify 100% bidirectional parity across all new keys in `keys.ts`, `catalogue-en.ts`, and `catalogue-id.ts`.
   - Structural scan verifying `MediaControlBar.tsx` and `MediaDrawer.tsx` contain ZERO raw string literals and consume `useT()` exclusively.
   - Real-file defect injection proofs: injecting a hardcoded Indonesian string in `MediaControlBar.tsx` or a missing key in `catalogue-en.ts` fails the test suite.

## Acceptance Criteria
- All newly added tests in `local-media-player.test.mjs`, `presenter-media-player.test.mjs`, and `bilingual-i18n-parity.test.mjs` pass cleanly.
- Defect injection proofs prove red when mutations are applied and return cleanly to green.
- Full local suite passes 100% with zero regressions.
- Absolute zero hardcoded UI strings; language toggle seamlessly switches all labels between English and Indonesian.

## Comments
- Delivered in iteration I-4 of mandate DEC-100.
- Added strict bilingual i18n parity test across all 10 SPEC-114 keys with real-file defect injection in `tests/bilingual-i18n-parity.test.mjs`.
- Added header redundant launcher absence guard asserting removal of `<MediaLauncherButton>` and dead subscription state with real-file defect injection in `tests/presenter-media-player.test.mjs`.
- Verified all 45 smoke tests pass, all 22 bilingual parity tests pass, and public repository guard passes.
- Peer reviewed and ratified with SETUJU by DeepSeek Pro (`deepseekpro` via CodeBuddy CN).
