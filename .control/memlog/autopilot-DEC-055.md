---
artifact: .control/decisions/DEC-055-daily-autopilot-mandate-layout-ssot-field-regex-sandbox-and-canvas-rotation-parity.md
---

# Autopilot Ledger — DEC-055

## Resume

- Iteration: 1 (In Progress)
- Run branch: autopilot/DEC-055
- Stopped at: Finished SPEC-54-03; moving to SPEC-54-04
- Blocked: —
- Parked: [ad-n]
- Next: SPEC-54-04 Canvas Rotation Center-Origin Alignment & Real-Time Sync

## Smoke Test Results (FR-11, FR-20, FR-21, FR-32)

| FR | Title | Proof of Done | Result |
|---|---|---|---|
| FR-11 | Form Layout SSOT & Dynamic Hydration | SSOT layout without dual editor; photo deletion persistence | PASS |
| FR-20 | Canvas Element Center-Origin Rotation | Rotation handle centering and live rotation dragging sync | PENDING |
| FR-21 | Canvas Object Real-Time Transform Parity | Real-time visual transform updates on rotation | PENDING |
| FR-32 | In-Workspace Regex Sandbox & Optimistic Layout AJAX | Inline regexes, live test area, and non-jarring layout updates | PASS |

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-055 for Layout SSOT, Rundown Regex Sandbox Integration, Photo Deletion Persistence, and Canvas Rotation Parity (SPEC-54) | waiting for interactive manual dispatch | low | .control/decisions/DEC-055-daily-autopilot-mandate-layout-ssot-field-regex-sandbox-and-canvas-rotation-parity.md |
| I-1 (SPEC-54-01) | src/operator/DynamicFormBody.tsx & EditForm.tsx | Establish FormLayoutAdminPanel as layout SSOT, remove duplicate in-place layout editor, add Preserved Historical Fields compatibility, and clean obsolete song set slots from seeder | in-place layout customization and frozen snapshot layouts | high | src/operator/DynamicFormBody.tsx, src/operator/EditForm.tsx, src/lib/form-layout.ts, internal/db/form_layout.go, src/lib/db/index.ts, tests/smoke-spec-54.test.mjs |
| I-1 (SPEC-54-02) | src/operator/EditForm.tsx & internal/httpapi/services.go | Implement per-key merge precedence and explicit undefined check preventing photo resurrection while preserving legacy fields | bulk field checks and falsy boolean image URL checks | high | src/operator/EditForm.tsx, internal/httpapi/services.go, internal/httpapi/services_field_values_test.go, tests/smoke-spec-54.test.mjs |
| I-1 (SPEC-54-03) | src/components/admin/RegistryAdmin.tsx & FormLayoutAdminPanel.tsx | Retire redundant parsing tab, embed ParserProfilesPanel under Layout & Fields, add production-parity rundown test area, and optimistic AJAX | separated rundown parsing tab and full-page loading re-mounts | high | src/components/admin/RegistryAdmin.tsx, src/components/admin/FormLayoutAdminPanel.tsx, tests/smoke-spec-54.test.mjs |
