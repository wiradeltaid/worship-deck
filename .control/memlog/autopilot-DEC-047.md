---
artifact: .control/decisions/DEC-047-daily-autopilot-mandate-continuous-engineering-routine.md
---

# Autopilot Ledger — DEC-047

## Resume

- Iteration: 1 (Final)
- Run branch: autopilot/DEC-047
- Stopped at: Done (Mandate DEC-047 closed: all 6 tickets of SPEC-46 delivered, tested, verified green, and peer reviewed by Terra)
- Blocked: —
- Parked: —
- Next: Ready for maintainer final review and PR merge to main

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-047 for continuous engineering routine (SPEC-46) | waiting for interactive dispatch | low | .control/decisions/DEC-047-daily-autopilot-mandate-continuous-engineering-routine.md |
| I-1 (SPEC-46-01) | internal/db & internal/httpapi | Implement relational form layout tables, adaptive seeder, and admin mutation APIs | hardcoded form cards and fixed field schema | high | internal/db/form_layout.go, internal/httpapi/form_layout.go |
| I-1 (SPEC-46-02) | internal/db & internal/httpapi | Implement service field values persistence, backfill migration, and layout snapshots | losing custom liturgical values across service edits | high | internal/db/migrate_service_field_values.go, internal/httpapi/services.go |
| I-1 (SPEC-46-03) | internal/plan | Implement dynamic canvas token hydration and DEC-004 S5 graceful fallback | restricting canvas tokens to hardcoded catalog whitelist | high | internal/plan/hydrate.go, internal/plan/plan.go, internal/plan/snapshot.go |
| I-1 (SPEC-46-04) | internal/parse & src/lib | Extend rundown parser in Go and TS for dynamic field regexes and per-entry song sets | complex hardcoded cascades for non-date fields | medium | internal/parse/parser.go, src/lib/parser.ts, src/lib/parser-rules.ts |
| I-1 (SPEC-46-05) | src/operator | Author DynamicFormBody with specialized renderers, in-place customization, and preserve top shell | rigid static card JSX in CreateForm & EditForm | high | src/operator/DynamicFormBody.tsx, src/operator/CreateForm.tsx, src/operator/EditForm.tsx |
| I-1 (SPEC-46-06) | src/components/admin & tests | Author FormLayoutAdminPanel, sandbox, and comprehensive smoke-spec-46 test suite | separate or missing layout management oversight | medium | src/components/admin/FormLayoutAdminPanel.tsx, src/components/admin/RegistryAdmin.tsx, tests/smoke-spec-46.test.mjs |
| I-1 (peer-review) | multiple | Apply Terra peer review fixes: immutable variable_name, slot 1-4 validation, S5 required fix, in-place slot addition, and proposal precedence | subtle schema drift and proposal overwriting manual edits | high | internal/httpapi/form_layout.go, internal/plan/hydrate.go, src/operator/DynamicFormBody.tsx, src/operator/CreateForm.tsx, src/operator/EditForm.tsx, tests/smoke-spec-46.test.mjs |
| I-1 (finish) | closeout | Mark SPEC-46 closed, DEC-047 applied, cancel loop cron job 234bdba8 | unclosed mandate/spec or dangling loop job | low | .control/registry/specs.yaml, .control/registry/decisions.yaml, .control/memlog/autopilot-DEC-047.md |
