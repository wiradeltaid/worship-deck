---
artifact: .control/decisions/DEC-060-daily-autopilot-mandate-open-specs-and-reconciliation-gaps.md
---

# Autopilot Ledger — DEC-060

## Resume

- Iteration: 3
- Run branch: autopilot/DEC-060
- Stopped at: Completed SPEC-58 (delete-service-unlinks-uploads); next is SPEC-59
- Blocked: —
- Parked: [ad-n]
- Next: SPEC-59 (announcement-set-freeze-snapshot)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-060 for Open Specs & Reconciliation Gaps (SPEC-56 through SPEC-65) | waiting for interactive manual dispatch | low | .control/decisions/DEC-060-daily-autopilot-mandate-open-specs-and-reconciliation-gaps.md |
| I-1 (SPEC-56-01) | internal/plan/validate_artifact.go & internal/httpapi/registry.go | ValidateArtifactTemplate takes customCatalogs map to validate active admin-created predefined fields at save time | process-global accumulating map without revocation on delete | high | internal/plan/validate_artifact.go, internal/httpapi/registry.go, internal/httpapi/form_layout_test.go |
| I-1 (SPEC-56-02) | src/lib/registry/placeholder-catalog.ts & src/components/admin/ArtifactEditor.tsx | Add resetDynamicCatalogTokens to rebuild dynamic catalog from active predefined fields and call it in ArtifactEditor | one-way accumulating map without unregister on delete | medium | src/lib/registry/placeholder-catalog.ts, src/components/admin/ArtifactEditor.tsx, tests/placeholder-catalog.test.mjs |
| I-2 (SPEC-57-01) | src/lib/db/index.ts | Replace hand-written CREATE TABLE statements with reading and executing canonical internal/db/schema.sql | hand-maintaining a drifting second copy of DDL in Node | high | src/lib/db/index.ts |
| I-2 (SPEC-57-02) | tests/schema-parity.test.mjs | Add schema parity guard test comparing live PRAGMA introspection against schema.sql across tables, columns, indexes, and FKs with defect injection proofs | silent schema drift between Go and Node test environments | high | tests/schema-parity.test.mjs, package.json |
| I-3 (SPEC-58-01) | internal/httpapi/services.go | Collect candidate uploads from images_payload and service_field_values before delete, check 8 reference tables, and unlink unreferenced files after commit | leaving orphaned photos and files in UPLOADS_DIR after Service delete | high | internal/httpapi/services.go, internal/plan/media.go, internal/httpapi/services_delete_uploads_test.go |
