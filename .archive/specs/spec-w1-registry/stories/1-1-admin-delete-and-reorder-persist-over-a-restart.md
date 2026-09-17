---
title: 'Admin delete and reorder persist over a restart'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_revision: 'd63dac15b428914f1d456fea6673679f2c79230e'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '.what/registry/04-usecases/UC-15-reorder-and-delete.md'
  - '.how/registry/SDD-registry.md'
  - '.how/_platform/ARCHITECTURE-SPINE.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Admin can edit an Artifact Template layout, but cannot remove a Registry entry or persist a different Registry order through the public HTTP/UI boundary. The missing verbs leave UC-15 unable to keep a deletion gone across restart or make a new Service follow Admin's intended order.

**Approach:** Add one authenticated delete mutation and one authenticated whole-list reorder mutation to the existing Artifact Registry boundary, backed by atomic LC-15 store operations and modest controls in the existing Admin list. Prove the HTTP surface, optimistic-concurrency failures, contiguous positions, and an actual fresh-process restart.

## Boundaries & Constraints

**Always:** Keep `artifact_templates.position` exactly `0..N-1`; mutate it transactionally; preserve `payload`, `label`, `base_type`, and all weekly Hub data; require Admin in-route and client `updated_at` preconditions; use the current error envelope; keep `buildSlidePlan` as the only consumer of order; and run the new named test through `npm test`.

**Block If:** A requirement needs a new entry key, a Registry create/undelete path, a change to a corpus contract or an applied AD/DEC, or an HTTP shape beyond the two shapes stated in Design Notes. Report an SDD/AD-N deviation for `wdi-decision`; do not edit `.what/`, `.how/`, or an applied DEC.

**Never:** Add a schema/data migration, seed gap-filler, per-row `position` API, renderer ordering logic, Sync Artifact work, or any congregation/local/upload/deck data. Reset remains live-to-live and must never become undelete.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Delete | Admin sends `DELETE /api/admin/artifacts/[id]` with that live row's `updatedAt` | The row is absent; remaining rows are compacted, receive fresh concurrency tokens, and the returned list is ordered | `404` unknown id; `409` stale token; neither case writes |
| Reorder | Admin sends all current rows once in desired order, each with its current `updatedAt` | Positions become `0..N-1`; every row receives a fresh token and the returned list has that exact order | `400` malformed, duplicate, missing, extra, or blank-token list; `409` if any token is stale; no partial write |
| Restart | A successful deletion has committed, then a fresh process opens the same `DB_PATH` | Bootstrap does not restore the deleted id and list/plan order remains the persisted order | A restored row is a test failure, not a fallback |
| UI failure | Delete or reorder request fails | The displayed list is not optimistically changed; the prior server order remains visible | Display the returned error; on `409`, reload the list before retry |

</intent-contract>

## Code Map

- `src/lib/registry/store.ts` -- LC-15 owns ordered reads, `RegistryNotFoundError`/`RegistryStaleError`, and `assertContiguousPositions`; add transactional delete/reorder operations here, never in a route or seeder.
- `src/app/api/admin/artifacts/[id]/route.ts` -- existing Admin-first dynamic route and error mappings; add `DELETE` beside GET/PUT using its `params: Promise` convention.
- `src/app/api/admin/artifacts/order/route.ts` -- new static child route for the whole-list reorder endpoint; static `order` avoids treating the control resource as a template id.
- `src/app/api/admin/artifacts/route.ts` -- existing ordered summary envelope (`{ templates }`) and Admin-session pattern to reuse for response shape.
- `src/components/admin/ArtifactEditor.tsx` -- current `templates` state, `loadList`, `busy` states, destructive-confirmation convention, and sidebar list; extend this surface without remounting or silently discarding a dirty canvas.
- `src/lib/registry/types.ts` -- `ArtifactTemplateSummary.updatedAt` supplies the client tokens; do not widen `ARTIFACT_ENTRY_KEYS` or persist a kind.
- `src/lib/registry/seed.ts` and `src/lib/artifacts/registry-snapshot.ts` -- read-only evidence: bootstrap is marker-gated and plan reads `ORDER BY position`; neither gains a deletion fallback.
- `src/proxy.ts` and `tests/proxy-matcher.test.mjs` -- `/api/admin/artifacts/**` is already gated; add explicit assertions for both new concrete paths, not a matcher exclusion/change.
- `tests/i18n.test.mjs` -- specimen for route-handler tests that create an Admin account, obtain the real session cookie, and call a Next route directly.
- `tests/registry-reseed.test.mjs` -- specimen for spawning a fresh Node process against a chosen `DB_PATH` to prove the real startup path.
- `package.json` -- `test` is an explicit filename list; register the new test exactly once.

## Tasks & Acceptance

**Execution:**
- `src/lib/registry/store.ts` -- add exported transactional delete and whole-list reorder functions. Delete checks its target token, removes the row, compacts all remaining positions, refreshes affected `updated_at` values, and returns ordered summaries; reorder accepts the complete ordered `{ id, updatedAt }` snapshot, validates exact membership and all tokens before writing, then assigns contiguous positions and fresh tokens atomically.
- `src/app/api/admin/artifacts/[id]/route.ts` -- add `DELETE` with Admin re-check, object/`updatedAt` validation, `404`/`409` mappings, generic server logging, and the ordered `{ templates }` success envelope.
- `src/app/api/admin/artifacts/order/route.ts` -- add `PUT` with Admin re-check; validate the complete `items` payload shape; delegate only to the store; preserve the standard `400`, `409`, and generic `500` behavior.
- `src/components/admin/ArtifactEditor.tsx` -- add confirmed Delete plus Up/Down order controls to each sidebar row. Disable impossible/busy actions, submit the Design Notes payload, replace local list only from a successful response, clear a deleted selection safely, and reload the list after a conflict without claiming an unsaved order succeeded.
- `tests/registry-reorder-delete-http.test.mjs` -- exercise real authenticated route handlers: valid delete (including `song-set` and last-row allowance), valid reorder, exact error envelopes for invalid input/missing ids/stale tokens/non-Admin, no-partial-write guarantees, compact positions, and a child-process restart proving a deleted id stays absent.
- `tests/proxy-matcher.test.mjs` -- assert `/api/admin/artifacts/<id>` and `/api/admin/artifacts/order` remain gated by the existing proxy matcher.
- `package.json` -- append `tests/registry-reorder-delete-http.test.mjs` to the explicit `test` script.

**Acceptance Criteria:**
- Given an Admin has the current token for a live Registry row, when they delete it through the Admin screen, then the row disappears from the returned/visible list and all remaining persisted positions are exactly `0..N-1`.
- Given a deletion has succeeded, when the application starts in a fresh process on the same database, then the deleted id is still absent and the bootstrap has not restored it.
- Given an Admin submits every current Registry id once in a new sequence with their current tokens, when the reorder succeeds, then a new list read returns precisely that sequence with compact positions.
- Given a delete or reorder has a stale token, when its endpoint is called, then it returns `409` and neither membership nor order changes.
- Given a reorder payload is malformed, duplicates an id, omits an existing id, adds an unknown id, or has a missing/blank token, when its endpoint is called, then it returns `400` and writes nothing.
- Given an unauthenticated or non-Admin request reaches either new endpoint, when it is handled, then it returns `403` and makes no Registry change.
- Given the new artifact endpoints are evaluated by the proxy matcher, when their concrete paths are tested, then both match the protected route set.

## Spec Change Log

## Review Triage Log

### 2026-08-19 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 8 (high 2, medium 5, low 1)
- defer: 0
- reject: 3 (low 3)
- addressed_findings:
  - `[high]` `[patch]` Reconciled a dirty selected canvas's concurrency token from successful delete/reorder summaries without replacing its unsaved payload.
  - `[medium]` `[patch]` Reloaded and reconciled the Admin list after a remote-delete `404`, safely clearing an absent selection.
  - `[high]` `[patch]` Serialized delete/reorder with immediate transactions before membership and token validation.
  - `[medium]` `[patch]` Added regression coverage for delete-side token invalidation, rejection invariants, malformed JSON and payload shapes, empty reorder, and persisted reordered plan/list state after fresh startup.

## Design Notes

The selected OQ-A shape is deliberately narrow and belongs to the existing protected namespace:

- `DELETE /api/admin/artifacts/[id]` body: `{ "updatedAt": "<target token>" }`.
- `PUT /api/admin/artifacts/order` body: `{ "items": [{ "id": "<id>", "updatedAt": "<current token>" }] }`, where array order is desired deck order and it contains every current row exactly once.
- Both successful mutations return `{ "templates": ArtifactTemplateSummary[] }` in persisted order. Reorder validates every token before changing any row; delete validates the deleted row's token, then compacts surviving rows. Changes to a position refresh affected rows' tokens so a previously loaded list cannot silently overwrite a newer order.

This closes the implementation choice only. Before wave close, report this chosen shape so the owner can land OQ-A in `.how/registry/02-contracts/01-artifacts.md` and `00-inventory.md`; this story must not modify those corpus files.

## Verification

**Commands:**
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/registry-reorder-delete-http.test.mjs` -- expected: all new HTTP, restart, and persistence cases pass.
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/proxy-matcher.test.mjs` -- expected: both concrete new paths are protected.
- `npm run build` -- expected: Next.js production build succeeds.
- `npm test` -- expected: the registered suite, including the new file, passes.
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/public-repo-guard.test.mjs` -- expected: tracked change set contains no prohibited public-repository data.

## Auto Run Result

Status: done

Summary: Added authenticated Admin delete and whole-list reorder mutations for Artifact Templates, with transactional contiguous positions and optimistic concurrency.

Files changed:
- `src/lib/registry/store.ts` — atomic delete/reorder operations, complete snapshot validation, and fresh tokens.
- `src/app/api/admin/artifacts/[id]/route.ts` — Admin DELETE endpoint.
- `src/app/api/admin/artifacts/order/route.ts` — Admin whole-list reorder endpoint.
- `src/components/admin/ArtifactEditor.tsx` — confirmed delete, Up/Down controls, conflict recovery, and dirty-canvas token reconciliation.
- `tests/registry-reorder-delete-http.test.mjs` — authenticated HTTP, failure, persistence, and fresh-process coverage.
- `tests/proxy-matcher.test.mjs`, `tests/canvas-dirty-guard.test.mjs`, and `package.json` — protection/dirty-state assertions and suite registration.

Review findings: 8 patches applied (high 2, medium 5, low 1); 0 deferred; 3 rejected as non-actionable or outside the story's specified verification surface. Follow-up review recommendation: false (score 2).

Verification: focused reorder/delete HTTP suite passed (7 tests); proxy matcher passed (5 tests); `npm run build` passed with the pre-existing Turbopack NFT tracing warning; `npm test` passed (529 pass, 0 fail, 1 skipped); public-repository guard passed (5 tests).

Residual risks: The selected OQ-A request/response shape must still be recorded by its corpus-owning follow-up; this story intentionally does not edit `.how/`.
