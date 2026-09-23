---
type: course-correction
id: DEC-058
status: applied
accepted_by: "kodesh87 (2026-09-22)"
touches:
  - .how/_platform/ARCHITECTURE-SPINE.md
  - .control/registry/decisions.yaml
supersedes: AD-19, AD-32
superseded_by: null
created: '2026-09-22'
---

# DEC-058 — A Predefined Field key is Admin-authored data, not a code-plus-tests change

## Decision

> **A Predefined Field's key (`variable_name`) is created, renamed, and removed by an Admin from
> the Registry, and requires no code change and no deploy.** This decision **supersedes AD-19 in
> part — its closed-catalog-vocabulary clause, as applied to the Predefined Field Catalog only**:
> *"extending the vocabulary — a fifth slot, a fourth kind — is a code-plus-tests change."* It also
> **supersedes AD-32's confirming line in part**: *"AD-19's closed-catalog-vocabulary principle is
> untouched — a new Predefined Field key is still a code change; only the binding shape (element vs.
> token) is superseded."* That second sentence no longer holds for Predefined Fields. Every other
> clause of AD-19 stands unqualified: `general`'s own closed and non-editable treatment, the
> `base_type` enumeration's closed set, and the Song Set / Announcement identities' own treatment
> under AD-31 are all untouched — this decision reaches the Predefined Field Catalog and nothing
> else AD-19 named.

## Why

Wave SPEC-46 shipped a `predefined_fields` table and a full CRUD surface
(`POST`/`DELETE /api/admin/predefined-fields`, `POST .../seed-defaults`) that accepts any
`variable_name` matching `/^[a-z][a-z0-9_]{1,63}$/` from an authenticated Admin — no code path
restricts it to a fixed set. This is deliberate, requested, and tested (SPEC-46's tickets are all
`component: hub`, `satisfies: UC-5`), not an accident: congregations vary in what weekly fields
their liturgy needs (a Baptism note, a Communion reminder, a guest-speaker bio), and the previous
code-list shape meant every such difference was a deploy. `wdi-reconcile` → `wdi-blueprint` surfaced
the contradiction between AD-19/AD-32's still-standing text and this shipped, admin-facing
capability while backfilling the FR this feature never had (`operator-turn` FR-37). Owner confirmed
by ruling, 2026-09-22: dynamic Admin-authored Predefined Fields is exactly the wanted shape.

## Cost, accepted

- **A congregation can create a Predefined Field key that collides in spirit with a Song Set or
  Announcement identity**, since the two are validated independently. Nothing enforces cross-catalog
  uniqueness of the human-readable label, only `variable_name` uniqueness within each catalog
  (`song_set_entries.variable_name UNIQUE`, `predefined_fields.variable_name UNIQUE` — two tables,
  two constraints, never checked against each other). This was already the shape for Song Set
  entries versus `general` and is not a new hazard this decision introduces, but it now applies to
  a second, Admin-growable catalog instead of one.
- **The Predefined Field Catalog is no longer something a reader can enumerate from the code alone.**
  AD-19's "closed and complete" property let a reader trust the catalog was whatever the code
  declared; from this decision on, the catalog is whatever the `predefined_fields` table holds, and
  reading the code only shows the field *types* (`text` / `text_area` / `image`) and validation
  rules, never the actual keys in use at a given congregation.
- **Not yet closed — the artifact validator and the canvas editor's warning still read the old
  static 17-key list, not this table.** A newly Admin-created **text** field works end to end
  (`internal/plan/plan.go`'s substitution loop is catalog-agnostic), but a newly Admin-created
  **image** field is hard-rejected by `internal/plan/validate_artifact.go` when placed on a template,
  and the canvas editor falsely flags any admin-created field — text or image — as an "unknown
  token" (the dynamic-registration functions SPEC-46 wrote for exactly this, `registerDynamicCatalogToken(s)`,
  are never called anywhere in the codebase). Tracked as **SPEC-56** (`wire-dynamic-predefined-field-catalog`),
  opened the same day this decision was recorded.

## Trace

- Supersedes in part: **AD-19**'s closed-catalog-vocabulary clause and **AD-32**'s confirming line,
  both restricted to the Predefined Field Catalog, in `.how/_platform/ARCHITECTURE-SPINE.md`.
- Confirmed already shipped, not newly authorized: SPEC-46 (`.archive/specs/SPEC-46-configurable-form-layout-and-predefined-fields/`), `internal/httpapi/form_layout.go:753` (`createOrUpdatePredefinedField`).
- Untouched and still binding: AD-19's treatment of `general`, the `base_type` enumeration, and
  (per AD-31) the Song Set / Announcement identities; AD-32's token-binding-shape supersession of
  AD-19 (still current, only its confirming line about code-change cost is retired).
- Backfills the promise `operator-turn` FR-37 (Admin configures the Hub form's fields and their
  grouping, not a code change) makes explicit.
- Owner ruled 2026-09-22, in response to `wdi-blueprint`'s finding while backfilling the UC
  catalogue for SPEC-46.
