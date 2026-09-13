# 02: Canvas Editor single DOM visual architecture (Option A) and 16:9 stage outline

**What to build:** Refactor the Canvas Editor workspace so it directly renders `<ArtifactSlide>` as its visual layer, overlaying Fabric.js as a transparent interaction layer with selection handles, and delineate the 16:9 stage with a crisp boundary outline and `overflow: hidden` clipping.

**Blocked by:** 01 (PPTX line spacing formula and baseline alignment)

**Status:** ready-for-agent

- [ ] In `ArtifactEditor.tsx`, mount `<ArtifactSlide>` inside the 16:9 stage container directly beneath the Fabric canvas.
- [ ] Configure the Fabric canvas with transparent background and map elements to transparent interaction proxy objects that expose standard selection outlines and drag/resize handles.
- [ ] Synchronize Fabric `object:moving` and `object:scaling` events in real time to the in-memory slide instance state so `<ArtifactSlide>` reflects position and scale changes dynamically.
- [ ] Delineate the 16:9 stage with a high-contrast border (`rgba(255, 255, 255, 0.25)`), drop shadow, and `overflow: hidden` so off-stage content is visibly clipped in the editor matching Presenter.
- [ ] Ensure `serializeCanvas` non-destructive persistence and BUG-35 idempotence remain intact.
