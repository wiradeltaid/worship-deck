---
artifact: .control/decisions/DEC-060-daily-autopilot-mandate-open-specs-and-reconciliation-gaps.md
---

# Autopilot Ledger — DEC-060

## Resume

- Iteration: 5
- Run branch: autopilot/DEC-060
- Stopped at: Completed SPEC-60 (hymns-404-unregistered-book-code); next is SPEC-61
- Blocked: —
- Parked: [ad-n]
- Next: SPEC-61 (manual-sync-push-body-cap-and-chunking)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-060 for Open Specs & Reconciliation Gaps (SPEC-56 through SPEC-65) | waiting for interactive manual dispatch | low | .control/decisions/DEC-060-daily-autopilot-mandate-open-specs-and-reconciliation-gaps.md |
| I-1 (SPEC-56-01) | internal/plan/validate_artifact.go & internal/httpapi/registry.go | ValidateArtifactTemplate takes customCatalogs map to validate active admin-created predefined fields at save time | process-global accumulating map without revocation on delete | high | internal/plan/validate_artifact.go, internal/httpapi/registry.go, internal/httpapi/form_layout_test.go |
| I-1 (SPEC-56-02) | src/lib/registry/placeholder-catalog.ts & src/components/admin/ArtifactEditor.tsx | Add resetDynamicCatalogTokens to rebuild dynamic catalog from active predefined fields and call it in ArtifactEditor | one-way accumulating map without unregister on delete | medium | src/lib/registry/placeholder-catalog.ts, src/components/admin/ArtifactEditor.tsx, tests/placeholder-catalog.test.mjs |
| I-2 (SPEC-57-01) | src/lib/db/index.ts | Replace hand-written CREATE TABLE statements with reading and executing canonical internal/db/schema.sql | hand-maintaining a drifting second copy of DDL in Node | high | src/lib/db/index.ts |
| I-2 (SPEC-57-02) | tests/schema-parity.test.mjs | Add schema parity guard test comparing live PRAGMA introspection against schema.sql across tables, columns, indexes, and FKs with defect injection proofs | silent schema drift between Go and Node test environments | high | tests/schema-parity.test.mjs, package.json |
| I-3 (SPEC-58-01) | internal/httpapi/services.go | Collect candidate uploads from images_payload and service_field_values before delete, check 8 reference tables, and unlink unreferenced files after commit | leaving orphaned photos and files in UPLOADS_DIR after Service delete | high | internal/httpapi/services.go, internal/plan/media.go, internal/httpapi/services_delete_uploads_test.go |
| I-4 (SPEC-59-01) | internal/db/bootstrap.go & internal/plan/snapshot.go | Clone announcement slides into service_announcement_set_slides at freeze and read from it when ServiceIsRegistryFrozen is true | live announcement edits leaking into already-reviewed and frozen Services | high | internal/db/schema.sql, internal/db/bootstrap.go, internal/httpapi/registry.go, internal/plan/snapshot.go |
| I-4 (SPEC-59-02) | internal/plan/snapshot_announcement_freeze_guard_test.go | Add guard test proving frozen Service preserves pre-edit slides and marker identity, Sync pulls changes, and zero-slide freeze holds | regressions leaking live announcement content into frozen services | high | internal/plan/snapshot_announcement_freeze_guard_test.go |
| I-5 (SPEC-60-01) | internal/httpapi/hymns.go & internal/db/bootstrap.go | Return 404 "Song book not found" when book_code is explicitly provided but not found in song_books | returning 200 with empty array making typo or missing book indistinguishable from 0 hymns | low | internal/httpapi/hymns.go, internal/db/bootstrap.go, internal/httpapi/hymns_book_test.go, tests/hymns-api.test.mjs |
