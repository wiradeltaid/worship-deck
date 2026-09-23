---
artifact: .control/decisions/DEC-064-daily-autopilot-mandate-parser-profile-retirement-and-overflow-removal.md
---

# Autopilot Ledger — DEC-064

## Resume

- Iteration: 1
- Run branch: autopilot/DEC-064
- Stopped at: SPEC-69-01 completed
- Blocked: —
- Parked: —
- Next: SPEC-69-02

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-064 for Service Form Parser Profile Retirement and Song Overflow Removal (SPEC-69) | waiting for interactive manual dispatch | low | .control/decisions/DEC-064-daily-autopilot-mandate-parser-profile-retirement-and-overflow-removal.md |
| I-1 (SPEC-69-01) | CreateForm.tsx & EditForm.tsx | Remove residual parser profile dropdowns, states, and payload transmission; enforce default profile fallback on update; verified by physical defect injection absence guard and Go API test | keeping confusing retired parser profile UI on service forms | medium | src/operator/CreateForm.tsx, src/operator/EditForm.tsx, spa/src/pages/RunSheetPage.tsx, internal/httpapi/services.go, internal/httpapi/services_field_values_test.go, tests/smoke-spec-54.test.mjs, tests/smoke-spec-44.test.mjs |
