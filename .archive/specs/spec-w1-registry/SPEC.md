---
id: SPEC-w1-registry
companions:
  - stack.md
  - conventions.md
  - brownfield.md
  - ../../../.what/registry/SRS-registry.md
  - ../../../.what/registry/02-rules/rules-registry.md
  - ../../../.what/registry/03-domain/domain-model.md
  - ../../../.what/registry/03-domain/state-machines.md
  - ../../../.what/registry/04-usecases/UC-15-reorder-and-delete.md
  - ../../../.what/registry/04-usecases/UC-16-sync-artifact.md
  - ../../../.what/registry/05-scenarios/SCN-5-delete-survives-restart.md
  - ../../../.how/registry/SDD-registry.md
  - ../../../.how/registry/02-contracts/00-inventory.md
  - ../../../.how/registry/02-contracts/01-artifacts.md
  - ../../../.how/registry/04-components/LC-15-store.md
  - ../../../.how/registry/05-model/data-model.md
  - ../../../.how/registry/06-flows/delete-template.md
  - ../../../.how/_platform/ARCHITECTURE-SPINE.md
  - ../../../.how/_platform/cross-cutting.md
sources:
  - ../../../.what/_prd/offline-deck/prd.md
  - ../../../.control/registry/requirements.yaml
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.
>
> **Projection, not authorship.** This file projects `.what/registry/`, `.how/registry/` and `.how/_platform/ARCHITECTURE-SPINE.md` onto wave W1. It introduces no `FR`, `UC`, `BR` or `AD`. A gap found while building is landed in the corpus by the skill that owns that layer — never patched in here, and never absorbed as a code decision.

# W1 x Registry — FR-21: order, membership, and Sync Artifact

## Why

**A mandate to meet, and the pain behind it.** `CAP-9` promises Admin the Artifact Registry as the place where Deck structure is authored, and `FR-20` already delivers layout editing. `FR-21` — order and membership — has no HTTP verb at all: `.how/registry/02-contracts/01-artifacts.md` marks Admin delete and reorder `[MISSING]`, and `AD-16`'s service-bound snapshot is `[MISSING]` from the DDL, so Sync Artifact has nowhere to write. Admin therefore cannot change the worship order without a deploy, and every existing Service silently follows whatever the live Registry says — the exact shift `AD-16` exists to prevent, on the Friday an Operator has already reviewed the Service that presents on Sabbath. This wave closes both halves and is the last `FR` outstanding against `CAP-9`.

## Capabilities

- **CAP-9**
  - **intent:** Admin can change which Artifact Registry entries exist and in what order, and can bring a Service that was already reviewed onto the current structure, without waiting for a deploy.
  - **success:** The `FR-21` proof of done, both halves. After Admin deletes an entry and reorders the rest, a process restart leaves the deletion `gone` and the order as Admin left it (`BR-9`, `SCN-5`). A Service created before that edit renders unchanged until Admin runs Sync Artifact (`BR-8`), after which it renders the new structure while every entered Operator field survives (`BR-10`), and each announcement row still expands the **whole** live announcement list, repeats included (`BR-11`). Proven by `tests/registry-reorder-delete-http.test.mjs` and `tests/registry-sync-artifact.test.mjs`.

`CAP-9` is allocated from `.control/registry/requirements.yaml`, where `FR-20` and `FR-21` both hang off it. No capability is minted here.

## Constraints

- Every write in this wave carries the client's `updated_at` as a precondition and answers `409` on a stale value — delete, reorder, and Sync alike, no path exempt (`AD-6`).
- **Two surfaces, neither doing the other's job.** The Artifact Registry owns order, labels and layout; Hub intake and the Announcements list own the weekly values (hymn numbers per SongSet slot, names, verses, flyer membership). No verb added here takes a weekly value (`SRS` Constraints, `SDD` Decision Summary).
- `UC-15` is a screen action, not an API-only change: the `/admin/artifacts` list gains the delete and reorder controls the `SDD` records it lacks, and the Reset button stays as shipped (`inventory-screen` row 7, `SDD` Failure Behaviour).
- A save that fails does not claim the new order: the old order is what survives a restart (`UC-15` failure flow).
- Delete is terminal: `gone` has no transition back to `live`, and Reset is `live` to `live` on a still-live seed row, never undelete (`state-machines.md`, `OQ-24`, `OQ-15`).
- `artifact_templates.position` stays unique and sequential `0..N-1` with no gap once the delete verb exists; the verb compacts (`data-model.md` Invariants, `OQ-31`).
- The seeder never fills the gap a delete leaves, and no read path substitutes seed content for a row the database lacks or cannot parse (`AD-17`).
- Deleting a `songset-*` row is allowed and leaves the Hub hymn binding stored and inert, not an error; deleting the last live row is allowed and yields an `N=0` Deck (`AD-19`, `AD-17`, `UC-15` alternates).
- Entry keys stay server-owned and closed at six over three kinds, with at most one row per `songset-*` identity enforced on the write path, never by a column constraint (`AD-19`).
- Sync Artifact is a Hub **Service** surface, Admin-only, re-checking the role from SQLite in-route even though `src/proxy.ts` gates that Service route for any signed-in account, and it ships with its `tests/proxy-matcher.test.mjs` assertion (`AD-16`, `AD-14`, `AD-5`). An Operator may see a stale snapshot and request a Sync; they may not perform one.
- The clone carries order, kinds, labels, layouts, placeholder bindings and the `AD-22` administrator override records. Kinds travel by carrying the entry keys they are derived from: no snapshot gains a `slot`, `songset_slot` or `kind` column of its own (`AD-16`, `AD-19`).
- Announcement membership is **not** cloned — the master list stays live and reaches an existing Service at render time — yet stays scoped per Service (`AD-16`, `BR-11`).
- Sync replaces the snapshot destructively and may not alter the Service's entered data: an entered value whose slot went away stays stored and inert, a new slot starts empty (`AD-16`, `BR-10`, `UC-16` alternate).
- A live Registry row whose payload will not parse is omitted from the Sync and logged with id and reason, exactly as the plan read does; an unrenderable snapshot is never frozen (`OQ-32`, `AD-17` fail-closed).
- The snapshot table arrives through the app's startup DDL on the `getDb` path, on the durable `DB_PATH`, under the one monotonic `data_version` in `settings` — not as a re-seed (`AD-9`, `AD-11`, `AD-4`, `AD-21`, `AD-18`).
- No new Logical Component is minted. The Registry verbs land on `LC-11` (gateway) and `LC-15` (store), direction `/admin/artifacts` → `LC-11` → `LC-15` → `artifact_templates`; the Sync route is a Hub services gateway surface. Registering what the wave touched is `wdi-build` Phase 4's catch-up, not a new `LC` invented here.
- A reorder or delete must not leave lyric slides cramped — the `NFR-3` readability floor holds through any order Admin leaves (`SRS` Risks; `enforced_by: tests/lyrics.test.mjs`).
- `buildSlidePlan` stays the single source of slide order and content, no renderer reads a snapshot directly, and the clone and re-clone validate under `AD-15` like every other write (`AD-7`, `AD-12`, `AD-16`).
- Public repository: no congregation data, `.env`, `data/local/`, `data/uploads/`, rendered slides or source decks reach a tracked file, and the guard test runs before every commit (`AGENTS.md`).

## Non-goals

- **Create or add a new Artifact Template from Admin.** An `SRS` Non-Goal: development until a create verb ships, and `AD-17`'s per-row seed-origin column ships with it. `insertIfMissing` stays bootstrap only.
- Undelete, or any recovery of a `gone` row (`OQ-24`).
- `FR-20` layout editing — already as-built, and not re-opened here although it shares `CAP-9`.
- Filling the weekly payload; that is Hub.
- Live control or reorder on stage; that is Presenter.
- Per-church configuration of the Registry.
- An Operator-facing affordance for a stale snapshot (`OQ-14`).
- Extending the Placeholder Catalog or the entry-key vocabulary (`AD-19`: code plus tests).

## Success signal

Admin deletes one Registry entry, reorders two more, and restarts the process: the deletion is still gone and the order is the one Admin left. A Service reviewed before that edit still renders the old structure until Admin runs Sync Artifact on it, and after Sync it renders the new structure with every hymn number, name and verse the Operator entered still in place.

## Assumptions

- Reorder is one ordered write over the live list rather than a per-row move, because `position` must come out contiguous `0..N-1` on the same write and `AD-6` gives one precondition token per mutation. Not stated in the `SDD`.
- Both test filenames are registered in the `test` script in `package.json`, which is how this repo admits a test file — read from `package.json`, not from the corpus.
- Wave id `W1`: `waves.yaml` still reads `waves: []`, so the coordinator opens it.

## Open Questions

- **OQ-A** — what HTTP verb and path carry Admin delete and reorder? `01-artifacts.md` marks them `[MISSING]` and forbids inventing a path; the `SDD`'s `AD-5` row bounds them to `/api/admin/artifacts/**`, already inside the proxy matcher. The chosen shape must land in `01-artifacts.md` and `00-inventory.md` before the wave closes, and it must answer that contract's five lanes — `01-artifacts.md` currently records rate limiting and idempotency for the new verbs as "not applicable until FR-21".
- **OQ-B** — what HTTP path carries Sync Artifact? `AD-16` puts it on a Service route and the `SDD` forbids inventing a Registry route, so its inventory row belongs to Hub. Same landing requirement.
- **OQ-C** — does this wave close `AD-16`'s pre-existing-Service exception by cloning a snapshot for every existing Service in the `AD-21` transition? `AD-16` names that the preferred landing, not a decision.
- **OQ-D** — does `announcement_items.service_id` become enforced-scoped in this wave? The column is nullable, so both readings `AD-16` discusses are still expressible, and the corpus schedules no change.
- **OQ-E** — does `AD-17`'s per-row seed-origin column stay deferred? It is reachable only through the create verb, which is a Non-goal here.
- **OQ-F** — which screen carries the Sync Artifact action? No row in `.how/_platform/inventory-screen.md` lists `UC-16`: row 7 `/admin/artifacts` carries `UC-14` and `UC-15`, and row 4 `/services/[id]` does not name `UC-16`. `AD-16` puts the action on a Service route, so a screen row is missing rather than the action being screenless.

Already open in `.control/questions/` and carried, not re-opened: `OQ-14` · `OQ-15` · `OQ-24` · `OQ-31` · `OQ-32`.
