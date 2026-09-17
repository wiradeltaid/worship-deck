# Ticket SPEC-20-03 — Stable 16:9 Stage Viewport for Non-Canvas Slides

**Status:** ready-for-agent

## Component
`registry` (`src/components/admin/ArtifactEditor.tsx`)

## Dependencies
`blocked_by: ["SPEC-20-02"]`

## Problem
During QA of SPEC-19 on `presenter-dev.bic.my.id`:
1. When selecting a song set entry or announcement set marker in the Deck Sequence list, the right column hides the canvas (`!isEditable`) and renders a `rounded-2xl border-dashed p-6` banner without an aspect-ratio container.
2. Because the layout uses CSS Grid (`lg:grid-cols-[330px_minmax(0,1fr)]`) where the left sidebar (`aside`) height derives from the grid row height (`lg:h-0 lg:min-h-full`), the absence of the ~750px canvas stage causes the row height to collapse drastically down to the content height of the banner (~180px), causing jarring UI jumping and scrollbar inconsistencies.
3. Operators note that previous attempts to fix this by setting fixed window/screen heights created double window scrollbars.

## Requirements
1. In `src/components/admin/ArtifactEditor.tsx`:
   - Ensure the right column always maintains the identical 16:9 stage viewport footprint (`aspect-video`) whether the slide is editable (`isEditable === true`) or non-editable (`isEditable === false`).
   - When `!isEditable`:
     - Render a structured 16:9 Stage Placeholder Card (`aspect-video rounded-xl border border-border bg-card flex flex-col items-center justify-center p-8 text-center shadow-sm relative overflow-hidden`).
     - Inside the placeholder card, display:
       - An appropriate badge/icon indicating the slide kind (`[Song Set]` or `[Announcement Set]`).
       - A clear, styled notice explaining that dynamic slides (song lyrics, announcements) are rendered from their respective registries and follow the service design theme.
       - A link or button to navigate to the relevant editor if applicable (e.g. Song Catalog).
   - Ensure the outer grid container and sidebar do not collapse when switching between editable general slides and non-editable song sets / markers.
   - Do NOT use hardcoded `h-screen` or fixed pixel heights that cause viewport overflow or double scrollbars. The 16:9 `aspect-video` container naturally scales with column width and provides rock-solid height stability.

## Acceptance Criteria
- Switching between general canvas slides and song set / announcement marker slides in Deck Sequence preserves a stable left sidebar height without vertical jumping or collapsing.
- When a song set or announcement marker is selected, an `aspect-video` placeholder card renders with clear context and guidance.
- No secondary window scrollbars are introduced across desktop and laptop viewport widths.
- Automated tests in `tests/smoke-spec-20.test.mjs` verify layout consistency and aspect-video stage presence.
