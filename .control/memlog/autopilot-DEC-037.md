---
artifact: .control/decisions/DEC-037-autopilot-mandate-pptx-modern-widescreen-parity.md
---

# Autopilot Ledger — DEC-037

## Resume

- Iteration: 1 (final)
- Run branch: autopilot/DEC-037
- Stopped at: Done (mandate applied, all FR-20 tickets in SPEC-35 closed and verified green)
- Blocked: —
- Parked: —
- Next: Finish — owner merges PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-1 (start) | mandate | Start autopilot mandate DEC-037 for SPEC-35 | waiting for interactive dispatch | low | .control/decisions/DEC-037-autopilot-mandate-pptx-modern-widescreen-parity.md |
| I-1 (T-35-01) | render-model / pptx-draw | Adopt modern PPTX widescreen layout (960x540pt, LAYOUT_WIDE) with exact constants 960/72 and 540/72, setting PX_TO_PT = 1.0 | keeping legacy 720x405pt 10x5.625in layout and 0.75 ratio | medium | src/lib/artifacts/render-model.ts, src/lib/pptx-draw.ts, tests/artifact-render-model.test.mjs |
| I-1 (T-35-02) | pptximport | Derive dynamic pxToPt scale from validated p:sldSz cy slide height (modern 540pt -> 1.0, legacy 405pt -> 0.75) | hardcoded 0.75 PxToPt constant | medium | internal/pptximport/ |
| I-1 (T-35-03) | pptx-draw / tests | Implement 1:1 character spacing patching (* 100) and register smoke-spec-35 in package.json | keeping legacy * 75 formula | medium | src/lib/pptx-draw.ts, tests/smoke-spec-35.test.mjs, package.json |
| I-1 (peer-review) | pptx-draw | Filter renderable text elements and skip Image unavailable fallback shapes to prevent ordinal-shift patching corruption (Terra P1 fix) | brittle ordinal indexing of shapes | high | src/lib/pptx-draw.ts, tests/smoke-spec-35.test.mjs |



