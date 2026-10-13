# SPEC-117-02 — Presenter Header Layout Harmony, Compact Guest Feed Controls, and Remote View Consolidation

**Satisfies:** [UC-12, UC-29, FR-16, FR-25]
**Blocked by:** ["SPEC-117-01"]
**Status:** closed

## Summary
Harmonize the presenter header layout in `PresenterOperator.tsx` and streamline `PresenterGuestFeedControl.tsx` to eliminate staggered staircase wrapping, orphan button rows on mobile remote view, and layout explosion when guest video projection is active (`Image #2`).

## Key Responsibilities
1. **Header Action Consolidation on Remote Mode (`src/operator/present/PresenterOperator.tsx`)**:
   - Refactor `presenter-header-actions` to prevent multi-row fragmentation when host-only buttons are hidden.
   - On `mode === 'remote'`, consolidate session actions (`[Request Congregation Screen Reopen]`, `[Unlock Service]`, and `[All slides]`) into a single, cohesive, flat flex toolbar (`flex items-center gap-2`).
   - Eliminate the separate external wrapper around `remote-request-reopen-projector-button` that previously caused it to wrap into an unaligned right position.
2. **Streamlined Guest Live Status Strip (`src/operator/present/PresenterGuestFeedControl.tsx`)**:
   - When `uiState === 'confirmed-live'`, compact the guest feed controls on remote consoles:
     - Suppress the redundant read-only device picker dropdown when live.
     - Hide the secondary `[Disarm Capture]` button while live (as `[Revert to Deck (Esc)]` already provides authoritative deck reversion).
     - Render a streamlined, high-contrast status pill: `[Guest Live]` alongside the high-priority `[Revert to Deck (Esc)]` action button.
   - Maintain full desktop host device selection when `mode !== 'remote'` and `uiState !== 'confirmed-live'`.
3. **Zero Layout Shift (CLS Prevention)**:
   - Ensure header height and button alignment remain predictable and visually anchored regardless of whether guest feed is `idle`, `ready`, or `confirmed-live`.

## Acceptance Criteria
- On remote console view, upper action buttons (`Request Reopen`, `Unlock Service`, `All slides`) render in a single horizontal row without orphan vertical breaks.
- Transitioning to `Guest Live` does not create staggered vertical steps or deform adjacent header controls.
- Clicking `Revert to Deck (Esc)` immediately reverts the projection state and restores standard presentation controls.
- Bilingual localization labels and testids remain intact across all buttons.
- Automated tests in `tests/presenter-guest-feed-controls.test.mjs` and `tests/remote-screen.test.mjs` pass cleanly.
