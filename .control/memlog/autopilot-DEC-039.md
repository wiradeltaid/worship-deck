---
artifact: .control/decisions/DEC-039-autopilot-mandate-font-availability-parity-unacquired-status-reconciliation.md
---

# Autopilot Ledger — DEC-039

## Resume

- Iteration: 2
- Run branch: autopilot/DEC-039
- Stopped at: Capacity (SPEC-37-01 complete and verified green with peer review folded in, ready for SPEC-37-02)
- Blocked: —
- Parked: —
- Next: SPEC-37-02 — Global & Multi-Context Font Hydration across Operator and Projector Surfaces

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-1 (start) | mandate | Start autopilot mandate DEC-039 for SPEC-37 | waiting for interactive dispatch | low | .control/decisions/DEC-039-autopilot-mandate-font-availability-parity-unacquired-status-reconciliation.md |
| I-2 (T-37-01) | ArtifactEditor & pptx_import | Decouple unacquired badge from stale property, reconcile live element fontStatus on batch upload and template mount, and recognize pre-imported SQLite fonts during PPTX import | leaving stale false unacquired warnings on canvas and imported templates | medium | src/components/admin/ArtifactEditor.tsx, internal/httpapi/pptx_import.go, internal/httpapi/pptx_import_test.go, tests/smoke-spec-37.test.mjs |
| I-2 (peer-review) | ArtifactEditor & pptx_import | Match both family and source_typeface case-insensitively against SQLite, clean up slide/result aggregate warnings, preserve exact text-only guard pattern for T-36-Absence-Guard 4, and add end-to-end HTTP behavioral test (Terra review) | missing source_typeface matches or regression in T-36 absence guard | high | src/components/admin/ArtifactEditor.tsx, internal/httpapi/pptx_import.go, internal/httpapi/pptx_import_test.go, tests/smoke-spec-37.test.mjs |
