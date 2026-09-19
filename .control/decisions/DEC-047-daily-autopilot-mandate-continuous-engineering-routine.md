---
type: mandate
id: DEC-047
status: applied
accepted_by: 'kodesh87 (2026-09-19)'
touches:
  - .control/memlog/autopilot-DEC-047.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - internal/db/bootstrap.go
  - internal/db/migrate.go
  - internal/db/schema.sql
  - internal/db/form_layout.go
  - internal/db/form_layout_test.go
  - internal/db/migrate_service_field_values.go
  - internal/httpapi/context.go
  - internal/httpapi/server.go
  - internal/httpapi/services.go
  - internal/httpapi/form_layout.go
  - internal/httpapi/form_layout_test.go
  - internal/httpapi/services_field_values_test.go
  - internal/plan/hydrate.go
  - internal/plan/plan.go
  - internal/plan/snapshot.go
  - internal/plan/types.go
  - internal/plan/validate_artifact.go
  - internal/plan/hydrate_dynamic_test.go
  - internal/parse/parser.go
  - internal/parse/dynamic_extraction_test.go
  - src/lib/db/index.ts
  - src/lib/parser.ts
  - src/lib/parser-rules.ts
  - src/lib/registry/placeholder-catalog.ts
  - src/operator/DynamicFormBody.tsx
  - src/operator/CreateForm.tsx
  - src/operator/EditForm.tsx
  - spa/src/pages/RunSheetPage.tsx
  - src/components/admin/FormLayoutAdminPanel.tsx
  - src/components/admin/RegistryAdmin.tsx
  - tests/smoke-spec-46.test.mjs
  - package.json
supersedes: null
superseded_by: null
created: '2026-09-19'
---

# DEC-047 — Daily Autopilot mandate for continuous engineering routine and delivery (SPEC-46)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-047:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-cli chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`go test ./cmd/... ./internal/...` and `npm test`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-047.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-047`.

## Why

To allow unattended continuous execution of engineering tickets and backlog releases (SPEC-46 configurable form layout and predefined fields) with high fidelity and strict verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work or make unwanted architectural shifts if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
