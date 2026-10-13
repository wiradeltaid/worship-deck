# SPEC-118-03 — Header Alert & Prompt Isolation (Zero-Shift Banner Placement across Viewports)

**Satisfies:** [UC-12, FR-16, FR-25]
**Blocked by:** ["SPEC-118-02"]
**Status:** closed

## Summary
Audit and stabilize all buttons and notification banners in the presenter header (`PresenterOperator.tsx`). Eliminate erratic layout shifts that occur when alerts, warnings, or prompts appear (e.g. `projector-reopen-prompt`, `congregationScreenBlocked`, or status banners). Preserve all existing button functions, UX, and testids without moving or altering button designs, while isolating prompt banners into a dedicated notification slot.

## Key Responsibilities
1. **Prompt Banner Relocation (`src/operator/present/PresenterOperator.tsx`)**:
   - Currently, `projector-reopen-prompt` and `projectorBlocked` are rendered as flex children (`basis-full`) directly inside the main `<header>` container alongside title and action buttons.
   - When a prompt appears or dismisses, it violently shifts flex sibling alignment, pushing toolbar buttons downward or wrapping them unexpectedly.
   - Relocate alert prompts into a dedicated notification strip immediately beneath the header (`border-b bg-amber-500/10`), isolating it from the toolbar flex calculation.
2. **Stable Button Sizing & Toolbars**:
   - Review all header buttons (`All slides`, `Display Target`, `Remote Code`, `Offline badge`, `Lock toggle`, `Emergency edit`, `Run sheet`):
     - Ensure each button has fixed or predictable dimensions (e.g. `h-8`).
     - Toggling `Lock` between Locked and Unlocked must not alter button width or cause adjacent buttons to jiggle.
     - Liveness status badge in `PresenterDisplayControl` must not resize dynamically in a way that shifts neighboring triggers.
3. **Multi-Viewport Consistency**:
   - Verify layout stability on mobile (< 640px), tablet (768px–1024px), and desktop (1280px–1920px).
   - Dismissing or opening alert prompts must result in zero horizontal displacement of toolbar controls.

## Acceptance Criteria
- Triggering `projector-reopen-prompt` or `congregationScreenBlocked` does not deform, wrap, or horizontally displace presenter toolbar buttons.
- Toggling presentation lock between locked and unlocked causes zero layout shift to adjacent buttons.
- All existing buttons remain identical in visual design, labels, testids, and functionality.
- Tests in `tests/presenter-header-two-row-layout.test.mjs` and `tests/theme-chrome.test.mjs` pass cleanly.
