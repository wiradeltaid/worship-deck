# Issue SPEC-55-02 — Unified Event Handler Synchronization and Release-Jump Elimination

**Status:** open  
**Spec:** SPEC-55  
**Component:** registry  
**Satisfies:** [UC-14, FR-20, FR-21]  
**Blocked by:** [SPEC-55-01]  
**Touches:** [artifacts]  

## Description

Unify live canvas event handlers in `src/components/admin/ArtifactEditor.tsx` using the shared `centerPxToTopLeftPct` helper, and eliminate the post-release element jump in `onObjectModified`.

## Key Changes

1. **Eliminate Post-Release Jump in `onObjectModified`:**
   - In `ArtifactEditor.tsx` (around lines 1380–1405), replace `x: pxToPct(left, CANVAS_WIDTH), y: pxToPct(top, CANVAS_HEIGHT)` with `centerPxToTopLeftPct(left, top, w, h)`.
   - Ensure that when a shape, image, text, or line element is modified (dropped after drag, resized, or scaled), its persisted top-left coordinate `x` and `y` are correctly derived from its center, preventing visual jumping upon mouse release.
   - For non-unit scales, compute unrotated scaled dimensions `w = member.width * scaleX` and `h = currentBaseH * scaleY` before converting center to top-left.
2. **Harmonize Live-Drag Handlers:**
   - In `onObjectMoving`, `onObjectScaling`, `onObjectResizing`, and `onObjectRotating`, replace inline ad-hoc `left - w / 2` math with `centerPxToTopLeftPct`.
   - Ensure visual elements follow cursor movement smoothly during active dragging, scaling, and rotation without detaching.
3. **Harmonize `serializeCanvas`:**
   - Use `centerPxToTopLeftPct` unconditionally in `serializeCanvas` for clean, drift-free template saving.

## Verification & Tests

- Automated test verifying a full move -> modified cycle: starting from `(x, y)`, moving the Fabric center, and triggering `object:modified` preserves exact coordinate parity between Fabric center and visual DOM element (delta $\le 0.05\%$).
- Behavioral test asserting that coordinates in `liveElements` before mouse release (at the end of `onObjectMoving`) and after mouse release (`onObjectModified`) are identical with zero jump.
