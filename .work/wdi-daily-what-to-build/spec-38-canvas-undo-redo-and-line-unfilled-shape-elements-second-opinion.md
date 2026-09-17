# Second Opinion Request — SPEC-38 (canvas-undo-redo-and-line-unfilled-shape-elements)

## 1. Drafted artifacts to review

- Spec: `.scratch/SPEC-38-canvas-undo-redo-and-line-unfilled-shape-elements/SPEC.md`
- Tickets:
  - `.scratch/SPEC-38-canvas-undo-redo-and-line-unfilled-shape-elements/issues/01-canvas-session-undo-redo-history-and-controls.md`
  - `.scratch/SPEC-38-canvas-undo-redo-and-line-unfilled-shape-elements/issues/02-line-and-unfilled-shape-elements-and-properties.md`
  - `.scratch/SPEC-38-canvas-undo-redo-and-line-unfilled-shape-elements/issues/03-presenter-and-pptx-export-parity-and-verification.md`
- Registry row: `.control/registry/specs.yaml` (`id: SPEC-38`)

These were authored just now by `wdi-build`'s Phase 1 (open the spec) and Phase 2 (`to-spec` + `to-tickets`),
dispatched from `wdi-daily-what-to-build`. **No application code has been written.** This run stops here —
it does not implement, ship, open a PR, or close the spec. That is deliberate, not an oversight to flag.

## 2. Original raw owner notes (verbatim, unedited)

> buatkan fitur undo,redo, yang berlaku selama sesi berubahan, begitu udah pindah slide, undo redo di reset. berlaku tombol undo disabled, redo disabledd jika tidak ada lagi movenya. Pastikan aman jangan menabrak coding lainnya.
> 
> Dan tambahkan element line, biar tambah selain text, shape filled, picture. Sekaligus tambah shape unfilled (just outline), maka ada 2: line (dengan ukuraan serta warna), shape unfileld (dengan ukuran outline serta warna). jangan menabrak coding lainnya (maksudnya merusak), tambahkan juga element properties dan klik kanan soal delete, ordering, dll.

## 3. Standing mandate

If this draft touches the architecture spine, an SRS, an SDD, or a SPEC, you're authorized to run
`wdi-review` on it yourself and edit the document directly to apply its stamp — no need to ask first, that
permission is already given for this dispatch.

Note for `terra` (kiro-cli): You do not have a native Skill tool. To perform a review, open and read
`.claude/skills/wdi-review/SKILL.md` as plain instructions rather than invoking a skill by name.

## 4. What to look at specifically

You have no memory of the conversation that produced this — everything you need is above and in the repo.
A few things worth your independent judgment, not because I want you to rubber-stamp them:

1. **Undo / Redo Architecture & Lifecycle Safety**:
   - The owner specifically requires that undo/redo history is session-scoped per slide: *"begitu udah pindah slide, undo redo di reset"*.
   - Check whether `ArtifactEditor.tsx`'s slide switching mechanisms (e.g. clicking another slide in Deck Sequence sidebar, changing song set slides, switching announcement set slides) and template resetting (`handleReset`) are all accounted for in the spec and ticket 01.
   - Check the snapshot granularity: whether taking snapshots on discrete actions (end of move `object:modified`, element insert, delete, duplicate, property commit) is sufficient, and whether keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y` / `Ctrl+Shift+Z`) properly avoid stealing native keystrokes when typing in text inputs or textareas.
   - Verify that re-applying an undo or redo snapshot will not cause dirty-flag infinite loops or crash with Fabric object listeners.

2. **Line and Unfilled (Outline) Shape Modeling**:
   - The owner asks for:
     - `line` with thickness (`strokeWidth`) and color (`strokeColor`).
     - `shape unfilled` (just outline) with outline thickness (`strokeWidth`) and color (`strokeColor`).
   - Check whether introducing `line` into `CanvasElementType` and adding `strokeColor` + `strokeWidth` to `allowedStyleKeys` in `internal/plan/validate_artifact.go` and `src/lib/registry/validate.ts` is the cleanest design without breaking existing text, filled shapes, and images.
   - In Fabric.js, transparent shapes can sometimes have hit-testing issues (clicking through the transparent center). Check that ticket 02 specifies `perPixelTargetFind: false` or appropriate hit-test configuration so transparent shapes and thin lines can be selected and context-menu clicked easily.

3. **Property Panel and Right-Click Context Menu Parity**:
   - Ensure the Element Properties panel (Toolbar Row 2 in `ArtifactEditor.tsx`) accurately renders dedicated inspector controls for both `line` (line color, stroke width) and `shape (outline)` (stroke color, stroke width, opacity).
   - Ensure right-click context menu (`handleContextMenuTrigger`) works identically for line and unfilled shape elements: Delete, Bring Forward, Send Backward, Bring to Front, Send to Back, Duplicate.

4. **Multi-Surface Parity (Fabric Canvas vs. Presenter vs. PPTX)**:
   - Check ticket 03 for `ArtifactSlide.tsx` (live web presenter view) and `src/lib/pptx-draw.ts` (PowerPoint export):
     - Does `ArtifactSlide.tsx` render lines (via SVG or CSS borders) and unfilled shapes (via transparent div with border) with 100% geometric parity?
     - Does `pptx-draw.ts` properly translate lines (`pptx.shapes.LINE`) and transparent outlined shapes (`pptx.shapes.RECTANGLE` with `fill: { type: 'none' }`) into native DrawingML vector shapes?

5. **Granularity and Ticket Slicing**:
   - Review whether the three tickets (01: Undo/Redo Engine, 02: Line & Outline Shape Modeling + Canvas + Properties, 03: Presenter & PPTX Parity + Test Suite) form valid tracer bullets, and whether any blocking edge or acceptance criterion is missing or ambiguous.

Please review the drafted spec and tickets against the owner's notes, provide constructive feedback, objections, or improvements, and apply the review stamp if approved.
