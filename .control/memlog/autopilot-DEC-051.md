---
artifact: .control/decisions/DEC-051-daily-autopilot-mandate-unified-schedule-workspace-full-architecture.md
---

# Autopilot Ledger — DEC-051

## Resume

- Iteration: 1 (In progress)
- Run branch: autopilot/DEC-051
- Stopped at: Delivered SPEC-50-01 and SPEC-50-02; next is SPEC-50-03
- Blocked: —
- Parked: [ad-n]
- Next: Implement SPEC-50-03 (In-Workspace Remote Control Pairing & Live Presenter Unification)

## Smoke Test Results (FR-11, FR-20, FR-21, FR-29, FR-30, FR-32, FR-44)

| FR | Title | Proof of Done | Result |
|---|---|---|---|
| FR-11 | Preset & Schedule Separation | Mode toggle, master preset CRUD with dynamic active service usage check guard | PASS |
| FR-20 | Reusable Master Libraries | Song Sets, Announcements, and Canvas Templates master catalog | PASS |
| FR-21 | Predefined Fields Registry | Global tokens registry with custom layout binding per preset | PASS |
| FR-32 | In-Workspace Remote Control | Expiring token, pairing QR code/PIN, and projector liveness safe gate | PENDING |
| FR-44 | Desktop Offline Sync | Sync status indicator, push/pull triggers, and atomic aggregate resolver | PENDING |

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-051 for Unified Schedule Workspace Full Architecture (SPEC-50) | waiting for interactive manual dispatch | low | .control/decisions/DEC-051-daily-autopilot-mandate-unified-schedule-workspace-full-architecture.md |
| I-1 (SPEC-50-01) | src/operator/workspace & spa/src | Implement workspace mode switcher, master preset CRUD with dependency check guard, local instance override isolation, explicit schedule persistence, and history drawer | keeping presets monolithic and unversioned | high | src/operator/workspace/types.ts, MockupMasterPresetDrawer.tsx, MockupScheduleHistoryDrawer.tsx, spa/src/pages/WorkspaceMockupPage.tsx, tests/smoke-spec-50.test.mjs |
| I-1 (peer-review-01) | src/operator/workspace & tests | Apply Terra review fixes: separate instanceItems and masterBlueprintItems, derive dynamic activeServicesCount from scheduledServices, enforce valid state machine transitions with isValidPresetTransition, wire full items snapshot on save/open, and add behavioral absence guard defect injection proofs | unverified UI interactions and state coupling defects | high | src/operator/workspace/types.ts, MockupMasterPresetDrawer.tsx, MockupScheduleHistoryDrawer.tsx, spa/src/pages/WorkspaceMockupPage.tsx, tests/smoke-spec-50.test.mjs |
| I-1 (SPEC-50-02) | src/operator/workspace & spa/src | Implement Master Song Sets, Master Announcement Sets, Predefined Fields Registry drawer, and Canvas Designer "Simpan sebagai Tipe Slide Baru" | isolated weekly ad-hoc slide configurations without reusable master records | high | src/operator/workspace/types.ts, MockupMasterLibrariesDrawer.tsx, MockupCanvasDesignerModal.tsx, MockupEditor.tsx, spa/src/pages/WorkspaceMockupPage.tsx, tests/smoke-spec-50.test.mjs |
| I-1 (peer-review-02) | src/operator/workspace & tests | Apply Terra review fixes: wire real write actions to master libraries, deep clone flyers at announcement selection boundary, enforce strict token grammar with isValidTokenKey, synchronize drawer activeTab via useEffect, and add behavioral tests and real-file defect injection proofs | disconnected mock actions and loose token syntax | high | src/operator/workspace/types.ts, MockupMasterLibrariesDrawer.tsx, MockupCanvasDesignerModal.tsx, MockupEditor.tsx, spa/src/pages/WorkspaceMockupPage.tsx, tests/smoke-spec-50.test.mjs |
