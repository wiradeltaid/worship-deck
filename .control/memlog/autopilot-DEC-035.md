---
artifact: .control/decisions/DEC-035-autopilot-mandate-pptx-typography-fidelity-and-font-acquisition.md
---

# Autopilot Ledger — DEC-035

## Resume

- Iteration: 1
- Run branch: autopilot/DEC-035 (PR open: no)
- Stopped at: Done (all SPEC-33 tickets closed and verified green)
- Blocked: —
- Parked: —
- Next: Finish (cycle-end verification, draft PR, and final report)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-1 (start) | mandate | Start autopilot mandate DEC-035 for SPEC-33 | waiting for interactive dispatch | low | .control/decisions/DEC-035-autopilot-mandate-pptx-typography-fidelity-and-font-acquisition.md |
| I-1 (T-33-01) | font-catalog | Decouple system fonts from embeddable web fonts with isFontExportReady suppressing false Arial fallback warnings for Google Fonts | keeping confusing warning icons on valid exportable fonts | low | src/lib/registry/font-catalog.ts, src/components/admin/ArtifactEditor.tsx |
| I-1 (T-33-02) | canvas-utils | Scale letterSpacing proportionally in applyFabricTextFit fitsAt probe preserving single-line wrap fidelity for BANDUNG INTERNATIONAL COMMUNITY | ignoring tracking in layout probes | medium | src/lib/registry/canvas-utils.ts |
| I-1 (T-33-03) | pptximport / httpapi | Add fontStatus cross-language contract and implement authenticated font upload route POST /api/admin/fonts with SFNT name parsing | silent fallback without acquisition capability | medium | internal/httpapi/fonts.go, internal/pptximport/parser.go |
| I-1 (T-33-04) | ArtifactEditor / tests | Hydrate dynamic font faces with recalculation and enforce absence guards with defect injection | trusting unverified client hydration reports | low | src/components/admin/ArtifactEditor.tsx, tests/smoke-spec-33.test.mjs |

