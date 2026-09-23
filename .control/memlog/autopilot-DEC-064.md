---
artifact: .control/decisions/DEC-064-daily-autopilot-mandate-parser-profile-retirement-and-overflow-removal.md
---

# Autopilot Ledger — DEC-064

## Resume

- Iteration: 2
- Run branch: autopilot/DEC-064
- Stopped at: Mandate DEC-064 completed — SPEC-69 delivered through G5 Release
- Blocked: —
- Parked: —
- Next: Maintainer review and merge of PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-064 for Service Form Parser Profile Retirement and Song Overflow Removal (SPEC-69) | waiting for interactive manual dispatch | low | .control/decisions/DEC-064-daily-autopilot-mandate-parser-profile-retirement-and-overflow-removal.md |
| I-1 (SPEC-69-01) | CreateForm.tsx & EditForm.tsx | Remove residual parser profile dropdowns, states, and payload transmission; enforce default profile fallback on update; verified by physical defect injection absence guard and Go API test | keeping confusing retired parser profile UI on service forms | medium | src/operator/CreateForm.tsx, src/operator/EditForm.tsx, spa/src/pages/RunSheetPage.tsx, internal/httpapi/services.go, internal/httpapi/services_field_values_test.go, tests/smoke-spec-54.test.mjs, tests/smoke-spec-44.test.mjs |
| I-2 (SPEC-69-02) | services.go, CreateForm.tsx, EditForm.tsx | Retire macro song overflow diagnostics from intake forms, eliminate MatchSongSets in preview, serialize strict empty array JSON contract for legacy diagnostic fields, and verify with dynamic regex fixtures and physical defect injection absence guards | retaining false-positive amber warning banners for unmapped prayer hymns on intake forms | high | internal/httpapi/services.go, internal/httpapi/services_field_values_test.go, src/operator/CreateForm.tsx, src/operator/EditForm.tsx, tests/smoke-spec-54.test.mjs, tests/dynamic-field-extraction.test.mjs |
