---
artifact: .control/decisions/DEC-037-autopilot-mandate-pptx-modern-widescreen-parity.md
---

# Autopilot Ledger — DEC-037

## Resume

- Iteration: 1
- Run branch: autopilot/DEC-037
- Stopped at: In progress
- Blocked: —
- Parked: —
- Next: SPEC-35-03 — Character Spacing Parity, Conformance Suite, and Absence Guards

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-1 (start) | mandate | Start autopilot mandate DEC-037 for SPEC-35 | waiting for interactive dispatch | low | .control/decisions/DEC-037-autopilot-mandate-pptx-modern-widescreen-parity.md |
| I-1 (T-35-01) | render-model / pptx-draw | Adopt modern PPTX widescreen layout (960x540pt, LAYOUT_WIDE) with exact constants 960/72 and 540/72, setting PX_TO_PT = 1.0 | keeping legacy 720x405pt 10x5.625in layout and 0.75 ratio | medium | src/lib/artifacts/render-model.ts, src/lib/pptx-draw.ts, tests/artifact-render-model.test.mjs |
| I-1 (T-35-02) | pptximport | Derive dynamic pxToPt scale from validated p:sldSz cy slide height (modern 540pt -> 1.0, legacy 405pt -> 0.75) | hardcoded 0.75 PxToPt constant | medium | internal/pptximport/ |


