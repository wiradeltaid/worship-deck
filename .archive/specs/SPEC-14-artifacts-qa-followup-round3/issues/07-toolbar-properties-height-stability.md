# 07: Toolbar properties bar height stability on selection (BUG-25 / LAINNYA 1)

**What to build:** Lock the vertical height of the Element Properties toolbar row above the canvas in `ArtifactEditor.tsx` so that selecting an element (and populating its font, color, alignment, shadow, and geometry controls) does not expand the toolbar container or push the canvas downward.

**Blocked by:** none

**Status:** open

**Done when:**
- The Element Properties toolbar retains an identical vertical height between unselected state (`Properties (None)`), text selected state (`Properties (Text)`), and shape selected state (`Properties (Shape)`).
- Selecting, switching, or deselecting canvas elements produces zero vertical layout shift on the canvas container below.
- Controls remain accessible and clickable without line-wrapping expanding the container height.

### Implementation Steps

- [ ] In `src/components/admin/ArtifactEditor.tsx` (~L2407), the properties toolbar container is defined as:
  `<div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-background border border-border text-xs min-h-[44px]">`
- [ ] Observe that when `selectedElementIds.length === 0`, only one line of placeholder text renders (`min-h-[44px]`).
- [ ] When an element is selected, 10+ controls render. Under `flex-wrap`, on viewports under ~1200px or when properties fill the row, the controls wrap onto a second line, growing the height to 80px+ and causing the canvas below to visibly shift downward.
- [ ] Stabilize the toolbar:
  - Replace `flex-wrap` with `flex-nowrap overflow-x-auto` or lock the container to a fixed height (e.g. `h-11` or `min-h-[44px] max-h-[44px]`).
  - Align all controls to standard `h-7` or `h-8` with consistent padding.
  - Ensure the container height remains exactly identical between the unselected state (`Properties (None)`) and the active selected state (`Properties (Text)` / `Properties (Shape)`).
- [ ] Add regression tests in `tests/artifact-editor-layout.test.mjs` verifying that the properties toolbar container has a fixed/locked height constraint that does not vary between idle and selected states.
