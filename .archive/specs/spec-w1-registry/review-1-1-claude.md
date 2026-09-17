---
story: '1-1-admin-delete-and-reorder-persist-over-a-restart'
reviewer: 'claude (panel seat)'
builder_family: 'codex'
diff: 'd63dac1..558b6ec'
review_mode: 'full'
spec_file: '_bmad-output/specs/spec-w1-registry/stories/1-1-admin-delete-and-reorder-persist-over-a-restart.md'
skill: 'bmad-code-review'
layers_run: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'acceptance-auditor']
status_recommendation: 'no change — findings only, not a verdict'
---

# Panel review — Story 1-1 (Claude seat)

Findings only. This does not adjudicate against the other panel seat, does not touch story status,
and does not edit `.what/`, `.how/`, or any DEC. All four review layers ran (Blind Hunter, Edge Case
Hunter, Verification Gap, Acceptance Auditor); the Acceptance Auditor found no AC/constraint
violations beyond one cosmetic wording deviation. Severity and triage below reflect my own reading
of the surrounding code (`src/lib/registry/store.ts`, the two route files, `ArtifactEditor.tsx`,
`src/lib/slide-plan.ts`), not the raw subagent output.

## Must-fix (decision needed)

### 1. Deletion has no guard, warning, or scope restriction distinguishing a shipped/core template still wired into the rundown pipeline from an admin's own extra template

- **Where:** `src/lib/registry/store.ts:154` (`deleteArtifactTemplate`), `src/components/admin/ArtifactEditor.tsx` (Delete button renders unconditionally for every row, including read-only/non-`editable` ones), `src/lib/slide-plan.ts` `ROW_HANDLERS` (hard-codes ids like `welcome`, `sermon`, `opening-prayer`, `special-song`, …).
- **What happens:** `buildRequestPlan` silently skips any id in `orderedTemplateIds` that has no `ROW_HANDLERS` entry, and `hydrateLeafOrOmit` (`src/lib/slide-plan.ts:775`) already tolerates a missing template by omitting that slide rather than throwing. So deleting a core template like `welcome` or `sermon` does not crash anything — it silently and permanently drops that slide from every future service render, with no error surfaced anywhere, and (per this story) the deletion survives a restart.
- **Why this is ambiguous, not a code bug:** the story's own AC and Design Notes deliberately made deletion uniform across every live row (the test suite explicitly deletes `song-set`, an intentionally non-"core" example, and down to zero rows). Nothing in the spec's Boundaries & Constraints restricts *which* rows may be deleted, and the edit path already has an analogous protection (`assertStableAgainstSeed` in the same file) that the delete path has no counterpart for. Whether that asymmetry is intentional (edit protects shape, delete is meant to be a full escape hatch) or an oversight is a product call, not something I can patch unambiguously.
- **Suggested resolution paths** (pick one, or explicitly accept the risk): (a) block/warn on deleting a template id that `ROW_HANDLERS` still references; (b) at minimum, make the confirm-dialog copy state the blast radius (it currently reads `Delete "X" permanently?` with no indication the template is still live in the rundown, unlike `handleReset`'s confirm text which does state its effect); (c) explicitly accept as-is and record the decision.

## Follow-up (patch — fixable without further input)

### 2. `nextRegistryUpdatedAt` has no guard against `Date.parse` returning `NaN`
- **Where:** `src/lib/registry/store.ts:111-117`.
- **What happens:** `Math.max(Date.now(), latest + 1)` becomes `NaN` if `Date.parse(row.latest)` can't parse the stored `updated_at`; `new Date(NaN).toISOString()` then throws an uncaught `RangeError`, crashing the whole delete/reorder transaction instead of failing gracefully. Not reachable through any current write path (every writer uses `new Date().toISOString()`), but it's new code with no defensive check against a stored-data anomaly.
- Source: blind-hunter + edge-case-hunter (independently found the same line).

### 3. A `400` from the reorder endpoint (concurrent membership change) is not reconciled the way a `409` already is
- **Where:** `src/components/admin/ArtifactEditor.tsx` `handleMoveTemplate` (~line 921-958): only `res.status === 409` triggers `loadList()` + `reconcileSelectedTemplate`; a `400` (e.g. another session deleted a row between this admin's last load and this reorder submit, so `items.length !== rows.length`) falls into the generic `!res.ok` branch, shows a bare error, and never reloads the list. Since `desired` is always well-formed by construction from local `templates` state, a `400` from this specific call site is realistically always a concurrent-membership case — the same class of problem the `409` branch already handles.
- **Consequence:** the admin's Up/Down/Delete buttons stay wired to a stale `templates` array indefinitely until an unrelated action reloads the page.
- Source: edge-case-hunter.

### 4. `handleMoveTemplate`'s swap and `handleDeleteTemplate`'s request body are exercised only by the server-side HTTP test, never by a test of the client wiring itself
- **Where:** `src/components/admin/ArtifactEditor.tsx` `handleMoveTemplate` (the `index`/`target` swap and the `items` payload it builds) and `handleDeleteTemplate` (the `{ updatedAt: item.updatedAt }` body and the `deletingSelected` branch).
- **Verified:** `tests/registry-reorder-delete-http.test.mjs` calls the route handlers (`orderRoute`/`deleteRoute`) directly with hand-built payloads — it never goes through `ArtifactEditor`. `tests/canvas-dirty-guard.test.mjs`'s only relevant assertions are a `fetch`-target count (6) and a URL-prefix regex, plus a `setSelectedId` call-count/text check — neither inspects the swap direction, the request body's field names, or which branch clears the selection.
- **Consequence:** an inverted swap direction (Up moves a row down), a wrong field name in the delete body (e.g. `id` instead of `updatedAt`, which would make every delete 409 instead of ever succeeding), or a flipped `deletingSelected` check would ship with every existing test green.
- **Suggested test shape:** extend `tests/canvas-dirty-guard.test.mjs`'s existing AST-based approach (the same rigor already applied to `AC-3`'s `setSelectedId` wiring) to assert the swap targets `templates[index]`/`templates[index + direction]` and that the delete body's object literal contains `updatedAt: item.updatedAt`.
- Source: verification-gap (+ blind-hunter, same underlying gap).

### 5. `RegistryNotFoundError` and `validateWholeOrder`'s unknown-id error share identical message text for two different HTTP semantics
- **Where:** `src/lib/registry/store.ts:15` (`Unknown template: ${id}`, 404 via `RegistryNotFoundError` in the delete route) and `store.ts:144` (`Unknown template: ${id}`, 400 via `RegistryValidationError` in the reorder route).
- **Consequence:** cosmetic only — the existing client dispatches on `res.status`, not message text — but a future consumer pattern-matching on the message would not be able to tell the two conditions apart.
- Source: blind-hunter.

### 6. `ArtifactTemplateOrderItem` is exported but never consumed
- **Where:** `src/lib/registry/store.ts:35-38`; the new order route (`src/app/api/admin/artifacts/order/route.ts`) types `items` as `unknown` and never imports this type.
- **Suggested resolution:** either use it to type the route's `items` before it reaches `reorderArtifactTemplates`, or stop exporting it.
- Source: blind-hunter.

## Considered and not raised as findings

- **Every surviving row's `updated_at` is bumped on delete/reorder, not just the moved ones** — this is the literal, documented behavior from the story's own Design Notes ("Changes to a position refresh affected rows' tokens so a previously loaded list cannot silently overwrite a newer order"), and the local-session reconciliation (`reconcileSelectedTemplate`) already covers the one case the story addresses. A different open tab/session getting a `409` on its next unrelated save is normal optimistic-concurrency behavior, not a defect.
- **The static `/api/admin/artifacts/order` route permanently shadows a template literally named `order`** — real, but this story explicitly blocks any create/undelete path (Boundaries & Constraints), so the id space is fixed by developers, not admins, and the Code Map already names this exact trade-off ("static `order` avoids treating the control resource as a template id"). Already an acknowledged, deliberate choice.
- **No audit trail for who deleted what** — would need a schema addition, which this story's Boundaries & Constraints explicitly forbid ("Never: Add a schema/data migration").
- **No "no templates" empty-state message, no synchronous double-click lock on Up/Down** — real, but low-severity UX polish outside this story's stated acceptance criteria, and (for the double-click case) the same theoretical race already exists on every other `busy`-gated action in this component (Save/Reset), so it isn't specific to this diff.
- **`package.json`'s new test entry was inserted mid-list rather than appended at the very tail** — functionally harmless (registered exactly once, runs under `npm test` as verified), a literal-wording deviation from the task bullet rather than a behavioral one.

## Summary

- Must-fix (decision-needed): **1**
- Follow-up (patch): **5**
- Dismissed as by-design/out-of-scope/noise: **4** (see "Considered and not raised as findings")
- Acceptance Auditor: no AC/Boundary violations found; the one wording deviation is folded into the dismissed list above.
