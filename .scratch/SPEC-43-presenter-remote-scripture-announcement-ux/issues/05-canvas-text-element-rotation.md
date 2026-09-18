# 05: Canvas Text Element Rotation Engine and Editor Controls

**What to build:**
Enable rotation capability on text elements across all language boundaries (Go plan types, TypeScript registry and runtime models), expose interactive rotation controls and property inputs in `ArtifactEditor.tsx`, and support 2D rotation in CSS slide renderers and PPTX export without disrupting existing unrotated elements.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Extend `CanvasElement` and `ResolvedElement` schemas in both TypeScript (`src/lib/registry/types.ts`, `src/lib/artifacts/runtime-contract.ts`) and Go (`internal/plan/types.go`) with optional `rotation?: number` / `Rotation int` (degrees in range [0, 360), default 0 / undefined).
- [ ] Registry validation (`src/lib/registry/validate.ts`) accepts and validates `rotation` on text elements.
- [ ] Fabric canvas unlocks rotation handles on text objects (`lockRotation: false`), syncing object angle directly with element rotation state.
- [ ] Artifact Editor property panel includes a rotation control (number input / reset button) for selected text elements.
- [ ] `ArtifactSlide.tsx` and `SlideView.tsx` render rotated elements via CSS `transform: rotate(...)` with `transform-origin: center center`.
- [ ] PPTX export generator (`src/lib/pptx-draw.ts`) applies rotation to exported PowerPoint text shapes via `pptxgen.TextPropsOptions.rotate`.
- [ ] Existing slides without rotation default to 0 / undefined and render with byte-for-byte fidelity and zero layout shift.
