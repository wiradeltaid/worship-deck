---
title: 'Go GET pptx assembles the plan and execs the worker'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_revision: '7030c26'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '.how/hub/04-components/LC-16-slide-plan.md'
  - '.how/_platform/inventory-api.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** FR-14’s download still runs in Next: SQLite + planner + PptxGenJS in one Node process.

**Approach:** Go `GET /api/services/{id}/pptx` loads the Service (and AD-16 freeze if present) from SQLite, assembles the slide plan in Go, execs `workers/pptx/draw.mjs` with that plan, returns the OpenXML attachment. Content-Type and filename stay as as-built.

## Boundaries & Constraints

**Always:** Plan assembly in the Go process (`AD-7`, `AD-30`). Worker receives a finished plan. Same session gate as other `/api/services` paths. Invalid id `400`, missing/unparsed service `404`, corrupt parsed JSON `500` generic.

**Block If:** Node child calls `getDb` or `buildSlidePlan`. Inventory number change. Dual writers on `DB_PATH`.

**Never:** `PLAN_ENGINE=node` live API. Congregation names in tests — invent them.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Signed-in, parsed service | `GET /api/services/{id}/pptx` | `200` PPTX, `Content-Disposition` attachment | Worker failure → `500` |
| Bad id | non-integer | `400` | — |
| No row / no parsed_data | — | `404` | — |
| Anonymous | no cookie | `401` | — |

</intent-contract>

## Code Map

- `internal/plan` — port of `buildSlidePlan` + hydrate + lyrics split + hymn buckets
- `internal/pptx` — exec worker
- `cmd/api` / HTTP mux — GET pptx
- `tests/pptx-go-http.test.mjs`
- `.github/workflows/test.yml` — `go test ./...`

## Tasks & Acceptance

- A Service seeded via Node `getDb` then served only by Go downloads a PPTX whose welcome date and verse-reading citation match the rundown (FR-14).
- Worker process exits; its imports still exclude SQLite.

## Spec Change Log

## Review Triage Log
