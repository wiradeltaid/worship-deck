---
type: contract
component: registry
lc: LC-11
direction: exposed
created: 2026-08-18
updated: 2026-08-20
---

# Contract — Artifacts

## Source of truth

No separate OpenAPI file. As-built: `internal/httpapi`, `src/lib/registry/store.ts`.

## Purpose

UC-14, UC-15. Admin-only (AD-14).

## Operations

| Operation | Purpose | Realizes |
| --- | --- | --- |
| GET `/api/admin/artifacts` | Ordered list (`resettable` from `seed_hash IS NOT NULL`) | UC-15 |
| POST `/api/admin/artifacts` | Create an authored General (`seed_hash` NULL) | UC-15 |
| GET `/api/admin/artifacts/[id]` | One payload | UC-14 |
| PUT `/api/admin/artifacts/[id]` | Save layout | UC-14 |
| PATCH `/api/admin/artifacts/[id]` | Rename any kind (column + payload, AD-18) | UC-15 |
| POST `/api/admin/artifacts/[id]/reset` | Restore seed on a still-live **seeded** row | UC-15 |
| DELETE `/api/admin/artifacts/[id]` | Remove a live entry; compact `position` to `0..N-1`; bump every survivor's token | UC-15 (OQ-A) |
| PUT `/api/admin/artifacts/order` | Replace the whole ordered list in one transaction | UC-15 (OQ-A) |
| POST `/api/admin/artifacts/import-pptx` | Import a `.pptx` file as a new authored General template | UC-15 |

Static `/order` is not a template id (the seed does not ship `order`; create refuses that id).

## Five lanes

| Lane | Answer |
| --- | --- |
| Authentication | Admin + AD-5 matcher. No session / not Admin → 403 Forbidden. |
| Validation | AD-15 structure + AD-8 images; kind does not widen (AD-22). Create body is `{ label }` (optional `id` for tests). PUT, PATCH, Reset, and DELETE require `updatedAt`. A rejected PUT names the failing property (`Unknown field: template.x`, `layouts.default.elements[0].style.fontSize must be positive`). An image placeholder element must still bind a key from the Placeholder Catalog (AD-19, AD-32); a text element's inline `{key}` tokens are instead checked against the Predefined Field Catalog (AD-32, BR-13) — same validator, same rule as `announcement_set_slides` (`03-announcement-sets.md`). **This check is a static 17-key list, not yet reading the Admin-authored `predefined_fields` table DEC-058 made authoritative — an Admin-created field's key is rejected here today; tracked as SPEC-56.** Reorder body is `{ items: [{ id, updatedAt }, ...] }` covering every live row exactly once. Reset requires a still-live **seeded** row (OQ-24, OQ-15). Authored origin is `seed_hash IS NULL`. |
| Error handling | Envelope in `cross-cutting.md`. Fail closed on a corrupt row (AD-17). 400 validation / membership mismatch / authored Reset. 404 id. Stale write: 409. Duplicate create id: 409. Reset on a gone id: 404, not a revive. |
| Rate limiting | `none` — Admin-only on one host; not a public surface. |
| Idempotency | GET is safe. PUT same value is safe. Repeated Reset to the same seed is safe on a still-live seed row. Reset on a gone id is 404, not undelete. DELETE of a gone id is 404. PUT order with the same membership and tokens is a write that still refreshes tokens. |

## Error behaviour

| Condition | Response | Caller should |
| --- | --- | --- |
| Payload does not parse | fail closed, not a seed substitute | Fix the row or Reset (Reset only if the row is still live and has a seed) |
| Unknown field or invalid property on PUT | 400 naming the property | Fix the named field |
| Placeholder rebound outside authority | 400 | Restore the server-owned set |
| Stale `updatedAt` on PUT, PATCH, Reset, DELETE, or order | 409 | Re-read, then retry |
| Empty create/rename label | 400 `label is required` | Send a 1–80 character label |
| Duplicate create id | 409 `Template id already exists` | Pick another id |
| Reset on a gone id | 404 `Template not found` | Leave gone; do not treat as undelete (OQ-24) |
| Reset on an authored row (`seed_hash` NULL) | 400 `Authored templates cannot be reset` | Leave the authored row (OQ-15) |
| DELETE missing `updatedAt` | 400 `updatedAt is required` | Send the list token |
| DELETE unknown id | 404 | Refresh the list |
| PUT order length ≠ live count, unknown id, or duplicate id | 400 | Reload the list (concurrent membership) |

## Compatibility

Adding a kind through the API without a code+test change is breaking AD-19. Removing DELETE or whole-list reorder is breaking UC-15.

## Constraints

Deck render does not call this API (AD-14 server-side read / plan). Sync Artifact is a Hub route (`02-services.md`), not a Registry path.
