---
artifact: .control/decisions/DEC-051-daily-autopilot-mandate-unified-schedule-workspace-full-architecture.md
---

# Autopilot Ledger — DEC-051

## Resume

- Iteration: 1 (In progress)
- Run branch: autopilot/DEC-051
- Stopped at: Delivered SPEC-50-01 (Master Preset Lifecycle & Schedule Persistence Architecture); next is SPEC-50-02
- Blocked: —
- Parked: [ad-n]
- Next: Implement SPEC-50-02 (Reusable Master Libraries & Predefined Fields Registry)

## Smoke Test Results (FR-11, FR-20, FR-21, FR-29, FR-30, FR-32, FR-44)

| FR | Title | Proof of Done | Result |
|---|---|---|---|
| FR-11 | Preset & Schedule Separation | Mode toggle, master preset CRUD with dynamic active service usage check guard | PASS |
| FR-20 | Reusable Master Libraries | Song Sets, Announcements, and Canvas Templates master catalog | PENDING |
| FR-21 | Predefined Fields Registry | Global tokens registry with custom layout binding per preset | PENDING |
| FR-32 | In-Workspace Remote Control | Expiring token, pairing QR code/PIN, and projector liveness safe gate | PENDING |
| FR-44 | Desktop Offline Sync | Sync status indicator, push/pull triggers, and atomic aggregate resolver | PENDING |

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-051 for Unified Schedule Workspace Full Architecture (SPEC-50) | waiting for interactive manual dispatch | low | .control/decisions/DEC-051-daily-autopilot-mandate-unified-schedule-workspace-full-architecture.md |
| I-1 (SPEC-50-01) | src/operator/workspace & spa/src | Implement workspace mode switcher, master preset CRUD with dependency check guard, local instance override isolation, explicit schedule persistence, and history drawer | keeping presets monolithic and unversioned | high | src/operator/workspace/types.ts, MockupMasterPresetDrawer.tsx, MockupScheduleHistoryDrawer.tsx, spa/src/pages/WorkspaceMockupPage.tsx, tests/smoke-spec-50.test.mjs |
| I-1 (peer-review) | src/operator/workspace & tests | Apply Terra review fixes: separate instanceItems and masterBlueprintItems, derive dynamic activeServicesCount from scheduledServices, enforce valid state machine transitions with isValidPresetTransition, wire full items snapshot on save/open, and add behavioral absence guard defect injection proofs | unverified UI interactions and state coupling defects | high | src/operator/workspace/types.ts, MockupMasterPresetDrawer.tsx, MockupScheduleHistoryDrawer.tsx, spa/src/pages/WorkspaceMockupPage.tsx, tests/smoke-spec-50.test.mjs |
