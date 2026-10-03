# 01: Scripture Clear Button Repositioning & Ergonomics

**What to build:** In `src/operator/present/PresenterOperator.tsx`:

1. **Remove Clear Button from Header Row 1**:
   - Remove the orphaned `t('presenter.clearScripture')` button from `presenter-header-row-1` (`PresenterOperator.tsx:1760-1770`).
   - Retain `blankScreen` and `liveTransition` controls cleanly in header row 1 without layout regression.

2. **Place Clear Scripture Next to Push Button**:
   - In the right sidebar Scripture section (`data-slot="presenter-scripture-panel"`), relocate the Clear Scripture button directly to the right of the `[Push to congregation screen]` button.
   - Wrap both buttons in a responsive button cluster container with `data-testid="presenter-scripture-actions"`.
   - Configure clear button styling and behavior:
     - Label: `t('presenter.clearScripture')`.
     - Variant: `variant="outline"`.
     - Size: matching `size="sm"`.
     - Availability: Always enabled and clickable as an emergency idempotent clear action, allowing operators to instantly dismiss any active or stuck scripture overlay.
     - On click: triggers `setScriptureOverlay(null)` and broadcasts `type: 'clear-scripture'` with `planIdentity: planIdentityRef.current`.

3. **Bilingual i18n & Test Attributes**:
   - Verify English and Indonesian translation keys in `src/lib/i18n/catalogue-en.ts` and `src/lib/i18n/catalogue-id.ts`.
   - Add `data-testid="presenter-push-scripture-button"` to the Push button.
   - Add `data-testid="presenter-clear-scripture-button"` to the Clear button.
   - Add regression tests in `tests/scripture-controls-ergonomics.test.mjs`.

**Blocked by:** none

**Status:** open

- [ ] Remove Clear Scripture button from `presenter-header-row-1`.
- [ ] Render Clear Scripture button adjacent to Push button in Scripture panel with `data-testid="presenter-scripture-actions"`.
- [ ] Connect clear action to state reset and idempotent BroadcastChannel broadcast.
- [ ] Verify test IDs and responsive layout.
