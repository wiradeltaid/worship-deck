# SPEC-113-02 — Unified MediaControlBar Layout, Zero Layout Shift, and Ergonomics

**Satisfies:** [UC-12, FR-16, FR-25]
**Blocked by:** ["SPEC-113-01"]
**Status:** open

## Summary
Retire `MediaTopBar.tsx` and legacy bottom dock `MediaDock.tsx`, replacing them with a unified `MediaControlBar` mounted between header controls and slide monitors, constrained to `max-w-[96rem] mx-auto px-4`.

## Key Responsibilities
1. **Component Consolidation & Removal**:
   - Retire existing `MediaTopBar.tsx` and legacy `MediaDock.tsx`.
   - Implement new component `MediaControlBar` under media-player module, preserving the full seekbar and volume capabilities preferred from `MediaDock`.
2. **Fixed Slot Mounting & Zero Layout Shift**:
   - Mount in `PresenterOperator.tsx` directly below `presenter-header-row-3` and above `presenter-main-layout`, before emergency reconciliation banner.
   - Constrain width with `mx-auto w-full max-w-[96rem] px-4 pt-3`.
   - Always rendered with fixed height `h-13` (~52px) in dimmed/disabled state when idle (`opacity-60`); never returns null.
   - Update `--presenter-stage` CSS calculation in `STAGE_VARS` (`calc((100dvh - 33.5rem) * 16 / 9)`).
3. **Ergonomic Control Layout**:
   - Left panic group: `[Play/Pause] [Stop] [Fade] [Mute] [Volume Slider w-24]`.
   - Center group: `[Media Type Icon] [Track Name] [Current / Total Time] [Seekbar]`.
   - Right group: Bidirectional Projector Toggle (`KE LAYAR` / `TARIK LAYAR`) for video (disabled for audio with tooltip) + `[≡ Pustaka (count)]`.
   - Ensure all interactive elements apply `onMouseDown={(e) => e.preventDefault()}` for spacebar focus safety.
4. **Full Localization Prerequisite**:
   - Relies on SPEC-112 i18n interpolation and dictionary expansion; all labels and tooltips consume `useT()`.

## Acceptance Criteria
- `MediaControlBar` renders in a fixed ~52px slot between header and slide monitors, matching the stage grid boundaries.
- Volume slider sits directly next to Mute button.
- Video projection toggle supports both `KE LAYAR` and `TARIK LAYAR` states.
- Spacebar continues to advance presentation slides when media controls are clicked.

## Comments
