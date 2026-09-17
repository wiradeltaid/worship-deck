---
title: 'Sync Artifact onto a service-bound snapshot'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_revision: '3b8c3ac'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '.what/registry/04-usecases/UC-16-sync-artifact.md'
  - '.how/registry/SDD-registry.md'
  - '.how/_platform/ARCHITECTURE-SPINE.md'
warnings: []
deferred:
  - 'AD-22 override table does not exist in as-built code; the clone copies validated live payloads (the rendered structure) rather than a separate override table.'
---

<intent-contract>

## Intent

**Problem:** FR-21's second half is missing: there is no durable per-Service freeze, so a live Registry edit shifts every existing Service, and Sync Artifact has nowhere to write.

**Approach:** Add `service_registry_snapshots` through startup DDL, clone on Service create, close AD-16's pre-existing-Service exception by cloning every existing Service in the AD-21 1→2 transition (OQ-C: yes), and ship Admin-only `POST /api/services/[id]/sync-artifact` with the Service `updated_at` precondition. `buildSlidePlan` for a persisted Service reads that freeze. Preview (no Service) still reads the live registry.

## Boundaries & Constraints

**Always:** Hub Service route, not a Registry route (OQ-B). `requireAdminSession` in-route plus proxy matcher assertion. Clone validates under AD-15; omit-and-log corrupt live rows (OQ-32). Do not alter entered weekly fields. Do not clone announcement membership. No `slot`/`kind` column on the snapshot. No new LC.

**Block If:** A requirement needs an Operator Sync control, a Registry-path Sync, `announcement_items.service_id` NOT NULL (OQ-D: not this wave), or a create-template verb.

**Never:** Edit `.what/`, `.how/`, or an applied DEC- from this story file's implementation notes; corpus landing is Phase 4. Congregation data in a tracked file.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Create | POST `/api/services` succeeds | Snapshot rows match the live valid registry; `registry_snapshot_at` is set | Create failure does not leave a Service without a snapshot |
| Live edit | Admin deletes a live template after create | That Service's plan still includes the frozen id until Sync | — |
| Sync | Admin POST `/api/services/[id]/sync-artifact` with `updated_at` | Snapshot replaced; parsed weekly fields unchanged | 403 Operator; 409 stale; 404 missing; 400 missing token |
| Corrupt live row | A live payload will not parse | Sync omits it and logs id+reason; does not freeze it | HTTP still 200 for the rest of the clone |
| Pre-existing | Service rows with `registry_snapshot_at` NULL at version 1 | Startup clones them and stamps `data_version` 2 | — |

## Design Notes

- OQ-B path: `POST /api/services/[id]/sync-artifact` (Hub LC-2). Land in Hub contracts at wave close.
- OQ-C: close the exception in this wave via AD-21 transition 1→2.
- OQ-D: leave `announcement_items.service_id` nullable; scoped writes already set it.
- OQ-F: Sync control on `/services/[id]` for Admin only.

</intent-contract>
