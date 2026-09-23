---
artifact: .control/decisions/DEC-060-daily-autopilot-mandate-open-specs-and-reconciliation-gaps.md
---

# Autopilot Ledger — DEC-060

## Resume

- Iteration: 10
- Run branch: autopilot/DEC-060 (PR #101)
- Stopped at: Mandate DEC-060 completed — all 10 specs (SPEC-56 through SPEC-65) delivered through G5 Release
- Blocked: —
- Parked: —
- Next: Maintainer review and merge of PR #101

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
| I-6 (SPEC-61-01) | internal/httpapi/sync.go | Wrap syncPush body in http.MaxBytesReader(w, r.Body, 50<<20) and distinguish *http.MaxBytesError with specific 400 error message | unbounded sync push request payload capacity on server | high | internal/httpapi/sync.go, internal/httpapi/sync_test.go |
| I-6 (SPEC-61-02) | src/lib/sync/client.ts & spa/src/pages/AdminSyncPage.tsx | Add pushSyncChunked with deterministic chunk mutation_ids, dependency ordering, oversized-record isolation, and switch AdminSyncPage | client push failing outright on local datasets exceeding 50MB cap | high | src/lib/sync/client.ts, spa/src/pages/AdminSyncPage.tsx, tests/sync-client-chunking.test.mjs, package.json |
| I-7 (SPEC-62-01) | internal/httpapi/fonts.go & internal/httpapi/server.go | Add DELETE /api/admin/fonts/{id} refusing 409 if live templates reference font and unlinking asset file post-commit | missing delete endpoint preventing cleanup of uploaded font faces and disk files | low | internal/httpapi/fonts.go, internal/httpapi/server.go, internal/httpapi/fonts_delete_test.go |
| I-8 (SPEC-63-01) | src/operator/CreateForm.tsx & src/operator/EditForm.tsx | Render error/warning banner with Retry button on layout fetch failure, preserving existing snapshot on EditForm | silently swallowing layout fetch failures leaving operator with unexplained fallback | low | src/operator/CreateForm.tsx, src/operator/EditForm.tsx, src/lib/i18n/, tests/form-layout-fetch-error.test.mjs, package.json |
| I-9 (SPEC-64-01) | scripts/build-desktop.mjs & installer/worship-deck.iss | Sourced Inno Setup MyAppVersion via /D from package.json with fail-closed #ifndef check in ISS and file-version check in release.yml | silently shipping Windows installer with stale version metadata on release | low | scripts/build-desktop.mjs, installer/worship-deck.iss, .github/workflows/release.yml, tests/installer-version-sync.test.mjs, package.json |
| I-10 (SPEC-65-01) | src/lib/presenter-remote-client.ts & internal/httpapi/remote.go | Add GET /api/present/{id}/remote/pair grant check and direct stream reconnect on EventSource onerror with generation guard and backoff | forcing operator to re-pair on temporary network blips or losing session when grant is still valid | high | src/lib/presenter-remote-client.ts, internal/httpapi/remote.go, internal/httpapi/server.go, src/operator/present/RemoteOperator.tsx, tests/remote-reconnect.test.mjs |
