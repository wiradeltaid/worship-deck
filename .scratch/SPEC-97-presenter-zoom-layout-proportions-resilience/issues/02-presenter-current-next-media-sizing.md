# 02: Presenter Current & Next Media Sizing and Framing Alignment

**What to build:** In `src/operator/present/PresenterOperator.tsx`:

1. **Re-scope `--presenter-stage` to Current Media Container**:
   - Remove `--presenter-stage` as the basis for the entire left panel.
   - Apply `max-w-[var(--presenter-stage)]` directly to the **Current slide media container** (with clean horizontal alignment within the left panel):
     `<div className="aspect-video w-full max-w-[var(--presenter-stage)] mx-auto overflow-hidden rounded-lg border bg-black relative ...">`
   - Retain 16:9 (`aspect-video`) so the current slide never letterboxes or distorts.
   - Allow the filmstrip (`Slide filmstrip`) and slide list (`Slides`) beneath the current slide to utilize the full ~65% width of the left panel, preventing cramped text and badge truncation.

2. **Explicit Vertical Contract for High Zoom / Short Viewport**:
   - On short desktop viewports (e.g. 1920×1080 at 175% zoom ~1097×617 CSS px), page-level vertical scrolling (`div.overflow-y-auto` on the page root) is explicitly permitted.
   - Internal horizontal scrolling for the filmstrip (`overflow-x-auto [scrollbar-width:thin]`) and internal vertical scrolling for the slide list (`overflow-y-auto max-lg:max-h-[45vh] lg:max-h-[36rem]`) remain fully functional and contained.

3. **Next Slide Preview Framing & Alignment**:
   - In `<aside>`, maintain `aspect-video` and `max-w-[32rem]` for the Next slide preview frame, ensuring intentional centered/clean alignment so that no awkward dead gutters appear in the right column.

4. **Right Panel Scroll Containment**:
   - Preserve internal vertical scrolling for the Scripture and Run-Sheet tabs without page scroll displacement.

**Blocked by:** SPEC-97-01

**Status:** closed

- [x] Apply `max-w-[var(--presenter-stage)]` directly to the Current slide media container with clean alignment.
- [x] Allow filmstrip and slide list to utilize full left panel width.
- [x] Explicitly permit page-level vertical scroll on short viewports while preserving internal scroll containment.
- [x] Maintain Next slide 16:9 ratio and intentional right-panel framing.
- [x] Verify scroll containment for filmstrip, slide list, and right-panel tabs.
