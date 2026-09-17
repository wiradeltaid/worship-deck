# SPEC-32-03 — Tracking and Weight Parity

**Status:** open
**Blocked by:** SPEC-32-02

## What to build

Carry typography values through all rendering and authoring layers:

1. Render numeric `fontWeight` directly in DOM and Fabric. Use source `pptxTypeface` only for PPTX output, and clear it when family, weight, or style changes in the editor.
2. Render every finite `letterSpacing` value in DOM, including `0`; use the canonical unscaled font size for Fabric `charSpacing = letterSpacing / fontSize * 1000`; and preserve it through Fabric serialization and scaling.
3. Add a 0.5 px letter-spacing numeric toolbar control that displays imported finite values without silently clamping them.
4. Post-process generated PPTX OOXML deterministically, setting `a:rPr/@spc = round(letterSpacing * 75)` only on runs belonging to the mapped artifact element. Do not rely on an undocumented PptxGenJS character-spacing option or broad XML replacement.

## Acceptance criteria

- DOM, Fabric, editor state, projector, and presenter preserve positive, zero, and negative tracking.
- Immediate import/export returns each tested integral `spc`, including `1` and `-1`, exactly; absent/zero spacing emits no `spc`.
- A 300/900 imported face is not reduced to 400/700, and any relevant author edit invalidates its source typeface override.
- Tests prove the run-to-element association and all specified conversion/round-trip cases.
