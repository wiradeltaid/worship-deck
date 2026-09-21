---
artifact: .control/decisions/DEC-056-daily-autopilot-mandate-canvas-center-origin-geometry-parity.md
---

# Autopilot Ledger — DEC-056

## Resume

- Iteration: 1 (Done)
- Run branch: autopilot/DEC-056
- Stopped at: Delivered all 4 tickets of SPEC-55 through G5 Release; mandate applied
- Blocked: —
- Parked: [ad-n]
- Next: Open Pull Request to development_branch (main)

## Smoke Test Results (FR-20, FR-21)

| FR | Title | Proof of Done | Result |
|---|---|---|---|
| FR-20 | Canvas Element Center-Origin Rotation | Unified center-origin conversion and elimination of release jump | PASS |
| FR-21 | Canvas Object Real-Time Transform Parity | Real-time moving, scaling, and rotating parity with clip-path alignment | PASS |

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-056 for Canvas Center-Origin Geometry Parity & Release Jump Elimination (SPEC-55) | waiting for interactive manual dispatch | low | .control/decisions/DEC-056-daily-autopilot-mandate-canvas-center-origin-geometry-parity.md |
| I-1 (SPEC-55-01) | src/lib/registry/canvas-utils.ts | Add shared bidirectional geometry helpers (centerPxToTopLeftPct, topLeftPctToCenterPx, getScaledDimensions) and align all Fabric constructors to center origin | ad-hoc component math and unaligned text constructor origins | high | src/lib/registry/canvas-utils.ts, tests/smoke-spec-55.test.mjs |
| I-1 (SPEC-55-02) | src/components/admin/ArtifactEditor.tsx | Route onObjectModified, onObjectMoving, onObjectScaling, and onObjectResizing through centerPxToTopLeftPct to eliminate release jump | raw center coordinate assignment in onObjectModified causing +w/2, +h/2 jumps | high | src/components/admin/ArtifactEditor.tsx, tests/smoke-spec-55.test.mjs |
| I-1 (SPEC-55-03) | src/components/admin/ArtifactEditor.tsx & src/lib/registry/canvas-utils.ts | Align copy/duplicate fallbacks with topLeftPctToCenterPx, compensate rotated text height expansion with -deltaY * sin(theta), and center clipPath rects | top-left raw fallback drift and horizontal sign flip jumping rotated text on auto-expand | high | src/components/admin/ArtifactEditor.tsx, src/lib/registry/canvas-utils.ts, tests/smoke-spec-55.test.mjs |
| I-1 (SPEC-55-04) | tests/smoke-spec-55.test.mjs | Harden regression suite with realistic browser-parity MockTextbox, universal constructor checks, 5-angle top-edge anchoring, and defect injection | silent headless test false-passes and untested rotated text expansion | high | tests/smoke-spec-55.test.mjs, package.json |
| I-1 (finish) | mandate | Raise DEC-056 mandate to applied; all 4 tickets of SPEC-55 complete | keeping mandate open | low | .control/registry/decisions.yaml, .control/decisions/DEC-056-daily-autopilot-mandate-canvas-center-origin-geometry-parity.md |
