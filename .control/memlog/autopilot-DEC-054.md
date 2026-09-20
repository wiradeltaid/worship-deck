---
artifact: .control/decisions/DEC-054-daily-autopilot-mandate-form-card-slot-reorder-and-presenter-parity.md
---

# Autopilot Ledger — DEC-054

## Resume

- Iteration: 1 (Done)
- Run branch: autopilot/DEC-054
- Stopped at: Delivered all 4 tickets of SPEC-53 through G5 Release; mandate applied
- Blocked: —
- Parked: [ad-n]
- Next: Open Pull Request to development_branch (main)

## Smoke Test Results (FR-11, FR-15, FR-16, FR-32)

| FR | Title | Proof of Done | Result |
|---|---|---|---|
| FR-11 | Form Card Groupings Sequential Reordering | Reordering card groups and order keys normalization | PASS |
| FR-15 | Presenter Slide Transition Parity | Smooth text transition & crossfade visual parity | PASS |
| FR-16 | Projector Visual Presentation Parity | Dual-screen projector visual parity and animations | PASS |
| FR-32 | In-Workspace Remote & Navigation Parity | Navigation chrome labels and intra/cross-card slot reordering | PASS |

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-054 for Form Card Slot Reorder and Presenter Transition Parity (SPEC-53) | waiting for interactive manual dispatch | low | .control/decisions/DEC-054-daily-autopilot-mandate-form-card-slot-reorder-and-presenter-parity.md |
| I-1 (SPEC-53-01) | src/components/Header.tsx | Update /new navigation link to 'New Workspace Mockup' with active aria-current state | generic 'Workspace' button causing operator confusion | low | src/components/Header.tsx |
| I-1 (SPEC-53-02) | FormLayoutAdminPanel & DynamicFormBody & Go backend | Enforce full layout membership validation on reorderFormGroupings and map all cards to contiguous 1..N sort orders | partial 2-item swap corrupting unmentioned cards to bottom of list | high | src/components/admin/FormLayoutAdminPanel.tsx, src/operator/DynamicFormBody.tsx, internal/httpapi/form_layout.go |
| I-1 (SPEC-53-03) | FormLayoutAdminPanel & Go backend | Implement intra-card slot reordering (1..M) and atomic cross-card slot transfer with source gap closure | rigid slots locked in cards and manual recreation workarounds | high | src/components/admin/FormLayoutAdminPanel.tsx, internal/httpapi/form_layout.go, internal/httpapi/server.go |
| I-1 (SPEC-53-04) | src/lib/transitions.ts & ArtifactSlide.tsx | Smooth crossfade with outgoing opacity 1->0 and explicit slide-instance identity keys | lingering text ghosting and text layout flicker across slide changes | high | src/lib/transitions.ts, src/components/artifacts/ArtifactSlide.tsx, src/components/SlideView.tsx, tests/smoke-spec-53.test.mjs |
| I-1 (peer-review) | peer review | Dispatch peer review to Composer after Terra request limit reached; verified all tests green | skipping peer review | low | tests/smoke-spec-53.test.mjs |
| I-1 (finish) | mandate | Raise DEC-054 mandate to applied; all 4 tickets of SPEC-53 complete | keeping mandate open | low | .control/registry/decisions.yaml, .control/decisions/DEC-054-daily-autopilot-mandate-form-card-slot-reorder-and-presenter-parity.md |
