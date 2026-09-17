# Ticket SPEC-16-01 — Deck Sequence Desktop Height Containment and Canvas Bottom Boundary (`BUG-11` residual)

**Status:** ready

## Description

In SPEC-15-02, the class `lg:max-h-none` was added to the Deck Sequence card to allow it to expand on desktop displays.
However, in manual QA Round 5, this caused a significant layout regression:
Inside the CSS grid layout (`grid lg:grid-cols-[330px_minmax(0,1fr)] min-h-[580px]`), the grid row height is unconstrained. Removing `max-h` via `lg:max-h-none` caused the Deck Sequence container to expand to fit all slide cards in full height (e.g. 1000px+).
Because it expanded completely:
1. Deck Sequence had no internal scrollbar.
2. Deck Sequence extended far past the bottom edge of the canvas card.
3. The entire browser window gained a long vertical scrollbar, severely degrading usability on desktop displays.

## Root Cause

In `src/components/admin/ArtifactEditor.tsx`:
```tsx
<div className="rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-sm flex flex-col flex-1 min-h-[220px] max-h-[calc(100vh-380px)] lg:max-h-none">
```
`lg:max-h-none` removes the vertical boundary entirely on desktop viewports. Because neither the parent `<aside>` nor the grid has a fixed pixel or viewport-bounded height, the container stretches to fit its children rather than clamping and scrolling internally.

## Proposed Solution (Single Primary Approach)

1. **Targeted Replacement in `src/components/admin/ArtifactEditor.tsx`**:
   - Replace `lg:max-h-none` directly with `lg:max-h-[calc(100vh-270px)]` on the Deck Sequence card:
     ```tsx
     <div className="rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-sm flex flex-col flex-1 min-h-[220px] max-h-[calc(100vh-380px)] lg:max-h-[calc(100vh-270px)]">
     ```
   - **Mathematical Offset Explanation**:
     - Right Column (Canvas): Canvas shell has `max-h-[calc(100vh-310px)] min-h-[320px]`. Above the canvas container sit the slide title header card (~58px), the properties toolbar (~44px), and vertical layout gaps (~24px). Total canvas bottom baseline lands around `calc(100vh - 120px)`.
     - Left Column (Sidebar): Above Deck Sequence sits the "New Slide" card (~130px) plus `lg:gap-4` (16px).
     - By clamping Deck Sequence to `lg:max-h-[calc(100vh-270px)]`, the bottom boundary of the Deck Sequence card aligns closely with the bottom edge of the canvas shell on 1080p desktop viewports without overshooting.
   - Retain `ul className="space-y-1.5 overflow-y-auto pr-1 flex-1 min-h-0"` so that slide overflow is strictly contained and scrolls internally.

2. **Crucial Test Update in `tests/artifact-editor-layout.test.mjs` (REPLACE, DO NOT JUST ADD)**:
   - **Warning for Implementer**: In `tests/artifact-editor-layout.test.mjs` (lines 64-66), there is an existing positive assertion from SPEC-15-02:
     ```javascript
     assert.ok(
       asideBlock.includes('flex flex-col flex-1 min-h-[220px] max-h-[calc(100vh-380px)] lg:max-h-none'),
       'Deck Sequence card inside aside must carry flex flex-col flex-1 min-h-[220px] max-h-[calc(100vh-380px)] lg:max-h-none'
     );
     ```
   - This assertion **MUST BE REPLACED** with the new bounded height assertion:
     ```javascript
     assert.ok(
       asideBlock.includes('flex flex-col flex-1 min-h-[220px] max-h-[calc(100vh-380px)] lg:max-h-[calc(100vh-270px)]'),
       'Deck Sequence card inside aside must carry bounded desktop height lg:max-h-[calc(100vh-270px)]'
     );
     assert.ok(
       !asideBlock.includes('lg:max-h-none'),
       'Deck Sequence card must NOT carry lg:max-h-none (absence guard to prevent unconstrained desktop expansion)'
     );
     ```
   - If `lg:max-h-none` is simply removed from the component without replacing this assertion, the test suite will fail on the old assertion string.

## Acceptance Criteria

- Deck Sequence never exceeds the bottom boundary of the canvas container on desktop viewports (1080p, 1440p, or smaller screens).
- When slide items exceed the available container height, Deck Sequence scrolls internally via `overflow-y-auto`.
- The browser window does not display a vertical page scrollbar due to Deck Sequence expansion.
- The outdated assertion in `tests/artifact-editor-layout.test.mjs` is cleanly updated and passes, along with the negative absence guard proof.
