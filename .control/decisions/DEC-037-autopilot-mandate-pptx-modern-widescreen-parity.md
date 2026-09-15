---
type: mandate
id: DEC-037
status: applied
accepted_by: 'kodesh87 (2026-09-15)'
touches:
  - .control/memlog/autopilot-DEC-037.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-35-pptx-modern-widescreen-parity/SPEC.md
  - src/lib/artifacts/render-model.ts
  - src/lib/pptx-draw.ts
  - internal/pptximport
  - tests/artifact-render-model.test.mjs
  - tests/smoke-spec-31.test.mjs
  - tests/smoke-spec-32.test.mjs
  - tests/smoke-spec-35.test.mjs
  - package.json
supersedes: null
superseded_by: null
created: '2026-09-15'
---

# DEC-037 — Autopilot mandate for PPTX Modern 16:9 Widescreen Parity (SPEC-35)

## Decision

> The owner grants an autonomous execution mandate to implement PPTX Modern 16:9 Widescreen Parity (33.867 cm x 19.05 cm) and 1:1 Canvas Font Alignment under SPEC-35, covering:
> 1) Modern PowerPoint 16:9 widescreen dimensions (960 pt x 540 pt, PptxGenJS `LAYOUT_WIDE`) with exact dimensional constants `PPTX_SLIDE_WIDTH_IN = 960 / 72` and `PPTX_SLIDE_HEIGHT_IN = 540 / 72`, yielding `PX_TO_PT = 1.0` so authored Canvas font sizes map 1:1 numerically to PPTX font sizes;
> 2) Dynamic PPTX import scaling in Go (`internal/pptximport`) computing `slideHeightPt` and `pxToPt` from validated `p:sldSz/@cy`, adapting seamlessly to both modern 540 pt slides (`pxToPt = 1.0`) and legacy 405 pt slides (`pxToPt = 0.75`);
> 3) Character spacing (letter spacing) export parity mapping authored `letterSpacing` to DrawingML `a:rPr/@spc = round(letterSpacing * 100)`;
> 4) Dual code review (coordinator self-review + `kiro-cli` `gpt-5.6-terra` peer review), automated smoke tests in `tests/smoke-spec-35.test.mjs` with executable absence guards, and public repository cleanliness;
> carrying implementation through G5 Release in the dedicated run branch `autopilot/DEC-037`.

## Why

Operators observed a persistent numeric discrepancy where Canvas font 12 exported as 9 pt in PowerPoint and imported 12 pt text became 16 Canvas units. This occurred because previous code targeted legacy 10" x 5.625" (720x405 pt) slides with a 0.75 scaling factor rather than modern PowerPoint 13.333" x 7.5" (960x540 pt) slides which match the 960x540 reference canvas 1:1.

## Cost

Operational decisions are recorded in the autopilot ledger (`.control/memlog/autopilot-DEC-037.md`).
Architectural invariants (AD-N), Go API process boundaries (AD-30), schema limits, and public repository cleanliness remain strictly preserved.
