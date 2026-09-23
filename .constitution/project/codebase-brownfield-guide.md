---
status: Draft
ratified_by: null
---

# brownfield — codebase guide

**Loaded when:** writing or reviewing code.

Filled at W1 close. The spec companion described the tree *before* UC-15/UC-16 shipped; this file is the as-built ground after W1. While `draft`, MAY be read as guidance and MUST NOT reject a change.

## Two different things are called a snapshot

| Name | What it is | Where |
|---|---|---|
| `RegistrySnapshot` | Live registry map assembled for one plan build. Not durable, not per Service. | `src/lib/artifacts/registry-snapshot.ts` |
| `ServiceRegistrySnapshot` | Durable per-Service freeze on `DB_PATH`. | Table `service_registry_snapshots`; clone/sync in `src/lib/registry/service-snapshot.ts` |

Preview (`POST /api/services/preview`) still reads the live map. A persisted Service's plan/PPTX pass `{ serviceId }`.

## Store verbs that now exist

`src/lib/registry/store.ts` exports list/get/update/reset/insertIfMissing **and** `deleteArtifactTemplate` / `reorderArtifactTemplates`, plus Story 20.3 `createAuthoredGeneralTemplate` / `renameArtifactTemplate`. HTTP (Go mux route syntax, post-DEC-003; the routes themselves are unchanged): `POST /api/admin/artifacts` with `{ label }`; `PATCH /api/admin/artifacts/{id}` with `{ label, updatedAt }`; `DELETE /api/admin/artifacts/{id}` with `{ updatedAt }`; `PUT /api/admin/artifacts/order` with `{ items: [{ id, updatedAt }, ...] }` covering every live row.

Delete and reorder bump every survivor's token and compact `position` to `0..N-1`.

`updateArtifactTemplate` still never touches `position`. Create appends at `COUNT(*)`.

## `assertStableAgainstSeed` skips authored rows

Authored origin is `seed_hash IS NULL`. Save does not call `getSeedTemplateById` on those rows. Reset on NULL is refused. Do not route delete or reorder through the seed check.

## Entry-key set is now five, widened by DEC-004

`ARTIFACT_ENTRY_KEYS = ['general', 'song-set', 'song-set-entry', 'ann-set-marker', 'announcement']`
(`src/lib/registry/types.ts`). Story 20.7's widening (`song-set-entry`) has shipped, and DEC-004 added
`ann-set-marker` alongside it — both land in the same set this section once called "still three."

## `announcement_items.service_id` stays nullable

OQ-D: not this wave. Scoped writes already set it.

## `data_version` is 11, not 3

W1's AD-21 1→2 transition cloned a snapshot for every Service that had none. Story 25.2 stamped 2→3
for the sub-second `updated_at` write path. Six more numbered migrations have landed since this
section was last written — `internal/db/bootstrap.go`'s `currentDataVersionInt` is the current source
of truth (11 as of this correction), and each `internal/db/migrate_*.go` file names its own
transition; this section MUST NOT be read as the full migration history past 2→3. The pre-counter
wipe licence still expires at first deploy.

## Tests are named, not globbed

Add the file to `package.json` `test` or it never runs.

## The Go API is the authorization boundary (AD-5)

A new exclusion ships with its assertion test in the same change set. As-built: `internal/gate` + `tests/go-http-gate.test.mjs`. Sync Artifact is on a Service path gated for any signed-in account, so the route re-checks Admin.
