# 02: Deck Sequence viewport scroll clamp (BUG-11 residual / SPEC-13-04)

**What to build:** Ensure the Artifact Editor shell and sidebar fit within the viewport without generating window-level vertical scrollbars on standard laptop and 1080p display resolutions.

**Blocked by:** none

**Status:** open

**Done when:**
- Opening `/admin/artifacts` on standard 1080p and laptop display viewports produces zero vertical scroll on `window` / `document.body`.
- Both the Deck Sequence list (~L2009) and the canvas preview container (~L2560) remain fully contained within the viewport.
- The slide list inside Deck Sequence scrolls internally when slide count exceeds container space.

### Implementation Steps

- [ ] In `src/components/admin/ArtifactEditor.tsx`:
  - Inspect the Deck Sequence container (~L2009: `max-h-[calc(100vh-320px)] min-h-[220px]`).
  - Inspect the canvas workspace container (~L2560: `max-h-[calc(100vh-310px)]`).
- [ ] Measure total vertical chrome overhead (header, navigation bar, page titles, admin tabs, "New Slide" card). The cumulative overhead on standard viewports is approximately 360px–380px.
- [ ] Refine the height constraints:
  - Tighten Deck Sequence height to `max-h-[calc(100vh-380px)]` or employ a flex-based layout (`flex-1 min-h-0 overflow-y-auto` inside a viewport-bounded sidebar container `h-[calc(100vh-180px)]`).
  - Verify that the canvas container (`max-h-[calc(100vh-310px)]` or bounded flex container) does not overflow the viewport bottom.
- [ ] Ensure that internal scrolling on `<ul className="space-y-1.5 overflow-y-auto pr-1 flex-1 min-h-0">` activates cleanly when slide count grows, without bubbling scroll to the outer page.
- [ ] Add regression tests in `tests/artifact-editor-layout.test.mjs` verifying the height-clamping classes and viewport containment rules.
