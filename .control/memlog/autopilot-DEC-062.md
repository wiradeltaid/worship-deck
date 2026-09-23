---
artifact: .control/decisions/DEC-062-daily-autopilot-mandate-presenter-raw-rundown-and-field-regex.md
---

# Autopilot Ledger — DEC-062

## Resume

- Iteration: 1
- Run branch: autopilot/DEC-062
- Stopped at: Mandate DEC-062 completed — SPEC-67 delivered through G5 Release
- Blocked: —
- Parked: —
- Next: Maintainer review and merge of PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-062 for Presenter Raw Rundown Display & Dynamic Field Regex Consolidation (SPEC-67) | waiting for interactive manual dispatch | low | .control/decisions/DEC-062-daily-autopilot-mandate-presenter-raw-rundown-and-field-regex.md |
| I-1 (SPEC-67-01) | PresenterOperator.tsx & PresentPage.tsx | Render raw rundown text directly with formatPresenterRunSheet model projection, drop obsolete runSheetItems prop, add presenter.noRundownText localization | keeping fragile line-by-line item parser mapping in presenter | high | src/operator/present/PresenterOperator.tsx, src/operator/present/presenter-model.ts, spa/src/pages/PresentPage.tsx, src/lib/i18n/*, tests/presenter-raw-rundown.test.mjs |
| I-1 (SPEC-67-02) | parser & services HTTP API | Consolidate form intake onto dynamic predefined field regex suggestions without silent overwrites, verified via Go HTTP endpoint | allowing dual-parser drift and unmapped custom service fields | medium | internal/httpapi/services_field_values_test.go, tests/dynamic-field-extraction.test.mjs, .scratch/SPEC-67-presenter-raw-rundown-and-field-regex-consolidation/smoke/smoke-spec-67.test.mjs |

