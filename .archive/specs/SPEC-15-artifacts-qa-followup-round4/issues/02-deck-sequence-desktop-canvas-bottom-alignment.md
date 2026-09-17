# Ticket SPEC-15-02 — Deck Sequence Desktop Bottom Alignment with Canvas Edge (`BUG-11` residual)

**Status:** done

## Description

In SPEC-14, the Deck Sequence card was clamped to `max-h-[calc(100vh-380px)] min-h-[220px]` to eliminate window-level scrollbars on laptop displays.
While page scrolling is now completely eliminated, the Deck Sequence container shrinks too small on desktop displays instead of stretching to align its bottom edge with the bottom edge of the canvas.
Because the elements from the page header down to the canvas do not shrink, the bottom boundary of the Deck Sequence card should align with the bottom edge of the canvas.

## Root Cause

In `ArtifactEditor.tsx`:
- The Deck Sequence container hardcodes `max-h-[calc(100vh-380px)] min-h-[220px]`.
- The right column's canvas container has `max-h-[calc(100vh-310px)] min-h-[320px] aspect-video`.
- On desktop screens (`lg:grid-cols-[330px_minmax(0,1fr)]`), the left sidebar `<aside className="space-y-4">` has no flex column structure that ties its overall height to the canvas height, causing the Deck Sequence card to stop significantly higher than the canvas bottom edge.

## Proposed Solution

1. In `src/components/admin/ArtifactEditor.tsx`:
   - Update the desktop grid/flex layout: make the left `<aside>` a `flex flex-col` in desktop mode (`lg:flex lg:flex-col`) that spans the height of the main editor area.
   - Configure the Deck Sequence container to use `flex-1 min-h-0` (or dynamically calculate height based on the canvas bottom offset, e.g. `lg:max-h-[calc(100vh-310px)] max-h-[calc(100vh-380px)]` or matching the right column bottom boundary).
   - Ensure the internal slide list `<ul className="overflow-y-auto ...">` retains `flex-1 min-h-0` so that scrolling remains strictly internal.
   - Ensure the bottom edge of the Deck Sequence card aligns visually with the bottom edge of the canvas on desktop viewports (`lg:`), while mobile/tablet displays do not regress or introduce window-level scrollbars.
2. In `tests/artifact-editor-layout.test.mjs`:
   - **Crucial Test Guard Update**: The existing test for SPEC-14 asserts `code.includes('flex flex-col max-h-[calc(100vh-380px)]')`. When updating the classes to align with the canvas 310px constraint (e.g. `calc(100vh-310px)` or desktop responsive class), update this test assertion accordingly so CI passes cleanly without failing on the old 380px string literal.

## Acceptance Criteria

- On desktop viewports (1080p and higher, `lg:` breakpoint), the bottom edge of the Deck Sequence card visually aligns with the bottom edge of the canvas.
- Mobile and tablet viewports remain responsive and free of page-level or window-level scrollbars.
- Slide items inside Deck Sequence scroll smoothly via internal `overflow-y-auto`.
- Layout test in `tests/artifact-editor-layout.test.mjs` is updated and passes, verifying alignment and containment.
