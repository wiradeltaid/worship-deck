# brownfield — as-built ground W2 stands on

## Next.js is still the tree, not the rule

`src/app/api/**`, `src/proxy.ts`, and `src/lib/slide-plan.ts` are the live as-built Hub until a story moves that verb to Go. `generatePptx` in `src/lib/pptx.ts` currently calls `buildSlidePlan` (SQLite) then PptxGenJS in the same Node process. After story 2-2 the draw path is `src/lib/pptx-draw.ts`; `pptx.ts` stays a thin wrapper for as-built Next `GET .../pptx` until story 2-3’s Go route is the live download.

Do not add `PLAN_ENGINE=node` as a live API escape hatch.

## `pptx.ts` import graph is the worker trap

`src/lib/pptx.ts` imported `buildSlidePlan` and `getSlideTransition` (`settings.ts` → `getDb`). A worker that imported `pptx.ts` would pull SQLite into the child. Split is mandatory: draw-only module, transition passed in.

## Matcher pin

`tests/proxy-matcher.test.mjs` evaluates Next’s `config.matcher` via `unstable_doesMiddlewareMatch`. Go cannot use that helper (Go’s `regexp` has no lookahead). Go implements the same **prefix list** with `(?:/|$)` semantics. Drift between the two lists is a defect. `/api/uploads/*` stays gated.

## `getDb()` memoizes and bootstraps

`src/lib/db/index.ts` `getDb()` opens once, runs DDL, data_version repairs, hymn/bible reconcile, AD-17 registry bootstrap, admin bootstrap. Go story 2-1 opens SQLite and applies `CREATE TABLE IF NOT EXISTS` equivalent to that DDL block. **Seed/bootstrap of registry rows and hymns** still happens when a test (or as-built Next) calls `getDb()` on the file first. Go MUST NOT re-seed the public registry from a second copy of the seed in a way that restores a deleted row (`AD-17`).

## Dual process on one `DB_PATH`

`AD-4`: one writer. Tests that spawn Go must not also keep a Node `getDb()` handle on that file after Go starts, or must accept that Node opened it only to seed, then closed. Prefer: Node `getDb()` + seed + insert service, then spawn Go as the only remaining opener.

## Snapshot names

`RegistrySnapshot` is the live in-memory map for one plan build (`registry-snapshot.ts`). `ServiceRegistrySnapshot` is the AD-16 freeze table. Go planner: if `service_registry_snapshots` has rows for the service id, use those; else live `artifact_templates ORDER BY position`.

## Inventory numbers

Do not invent `/api/health` or renumber GET pptx (row 8). `inventory.py --write` after adding a Host key once assigned 34+; do not `--write` in a way that renumbers. `inventory.py --check` only.

## `npm test` filename list

New `tests/pptx-worker.test.mjs` and `tests/pptx-go-http.test.mjs` never run until listed in `package.json`.

## Constructor parameter properties

Forbidden under `--experimental-strip-types`.
