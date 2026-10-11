# SPEC-112-03 — Presenter Console, Slide Grid, and Display Control Localization

**Satisfies:** [UC-10, FR-16, FR-25]
**Blocked by:** ["SPEC-112-02"]
**Status:** closed

## Summary
Localize unmigrated surfaces in `PresenterOperator.tsx`, fully localize `SlideGridDialog.tsx`, and wire i18n keys for confirmation dialogs in `PresenterDisplayControl.tsx`.

## Auditable Component Scope
- `src/operator/present/PresenterOperator.tsx`
- `src/operator/present/SlideGridDialog.tsx`
- `src/operator/present/PresenterDisplayControl.tsx`

## Key Responsibilities
1. **`PresenterOperator.tsx`**:
   - Re-wire emergency reconciliation banner to use existing `t('edit.emergency.*')` keys instead of hardcoded Indonesian strings.
   - Localize stage monitor frames: "Current", "Next", "Projector blanked", "Scripture live", "End of deck".
   - Localize announcement loop indicator using interpolation: `t('presenter.stage.loopingBadge', { interval: loopInterval })` ("Looping ({interval}s)").
   - Localize slide list and filmstrip headers/chips: "Slides", "Announcement", "Song Set".
   - Localize live background override labels and notice text.
   - Localize operator notification toasts (emergency patch save/sync/discard, local image processing).
2. **`SlideGridDialog.tsx`**:
   - Import `useT()` and localize DialogTitle ("All slides") and DialogDescription with `{count}` interpolation.
   - Localize thumbnail status badges: "Now" and "Hidden".
3. **`PresenterDisplayControl.tsx`**:
   - Replace hardcoded English confirmation in `window.confirm` with a localized string when Presentation Lock is active.

## Acceptance Criteria
- Presenter Console and Slide Grid dialog render completely in the selected `ui_locale` without residual hardcoded strings.
- Global spacebar navigation and presenter panic controls remain focus-safe and fully functional.
- Room-facing routes (`/projector`, `/slideshow`) remain 100% untouched and locale-invariant.

## Comments
