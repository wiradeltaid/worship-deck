---
artifact: .control/decisions/DEC-060-daily-autopilot-mandate-open-specs-and-reconciliation-gaps.md
---

# Autopilot Ledger — DEC-060

## Resume

- Iteration: 1
- Run branch: autopilot/DEC-060
- Stopped at: Completed SPEC-56 (wire-dynamic-predefined-field-catalog); next is SPEC-57
- Blocked: —
- Parked: [ad-n]
- Next: SPEC-57 (node-schema-mirror-parity)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-060 for Open Specs & Reconciliation Gaps (SPEC-56 through SPEC-65) | waiting for interactive manual dispatch | low | .control/decisions/DEC-060-daily-autopilot-mandate-open-specs-and-reconciliation-gaps.md |
| I-1 (SPEC-56-01) | internal/plan/validate_artifact.go & internal/httpapi/registry.go | ValidateArtifactTemplate takes customCatalogs map to validate active admin-created predefined fields at save time | process-global accumulating map without revocation on delete | high | internal/plan/validate_artifact.go, internal/httpapi/registry.go, internal/httpapi/form_layout_test.go |
| I-1 (SPEC-56-02) | src/lib/registry/placeholder-catalog.ts & src/components/admin/ArtifactEditor.tsx | Add resetDynamicCatalogTokens to rebuild dynamic catalog from active predefined fields and call it in ArtifactEditor | one-way accumulating map without unregister on delete | medium | src/lib/registry/placeholder-catalog.ts, src/components/admin/ArtifactEditor.tsx, tests/placeholder-catalog.test.mjs |
