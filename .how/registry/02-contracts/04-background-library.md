---
type: contract
component: registry
lc: LC-11
direction: exposed
created: 2026-08-20
updated: '2026-09-22'
---

# Contract — Background Library

## Source of truth

`none`. Backing table: `background_library_images` (`category` column: `background` is this
contract's scope; `announcement`/`flyer` is `06-media-library.md`'s — one table, two contracts by
category, per FR-38's widening of this list).

## Purpose

UC-25. Admin-only (AD-14). Read by Hub's weekly Song Set inputs (FR-32) and by Presenter's live
switch (FR-33, UC-27) — those are read paths into this list, not writes; see Constraints.

## Operations

| Operation | Purpose | Realizes |
| --- | --- | --- |
| GET `/api/admin/background-library` | List images and which one (if any) is default | UC-25 |
| POST `/api/admin/background-library` | Add an image (images only, S10) | UC-25 |
| PATCH `/api/admin/background-library/[id]` | Mark this image the global default (clears the prior default) | UC-25 |
| POST `/api/admin/background-library/[id]/replace` | Replace this image's file in place, keeping its id and default flag | UC-25 |
| DELETE `/api/admin/background-library/[id]` | Remove an image; any weekly/live reference falls through to the next step of AD-33's resolution order | UC-25 |

## Five lanes

| Lane | Answer |
| --- | --- |
| Authentication | Admin + AD-5 matcher. No session / not Admin → 403 Forbidden. |
| Validation | Image reference resolves through the shared helpers (AD-8) — same MIME/allowlist rule as any other Registry image. No colour or gradient value is ever accepted (S10) — a non-image body is a 400, not silently coerced. |
| Error handling | Envelope in `cross-cutting.md`. 400 non-image / invalid reference. 404 unknown id. 409 stale `updatedAt`. |
| Rate limiting | `none` — Admin-only on one host. |
| Idempotency | GET safe. Re-marking the same image default twice is safe (second call is a no-op success). DELETE of an already-gone id is 404. |

## Error behaviour

| Condition | Response | Caller should |
| --- | --- | --- |
| POST body is not an image reference | 400 `Background must be an image` | Send an image URL/upload reference |
| PATCH targets an unknown id | 404 | Refresh the list |
| DELETE the current default | 200 — allowed; no default remains until Admin marks a new one | Mark a new default, or accept blank-canvas fallback (AD-33) |
| Stale `updatedAt` on PATCH/DELETE | 409 | Re-read, then retry |

## Compatibility

Widening this table to accept solid colours or gradients is breaking S10. Removing the
single-default invariant is breaking AD-33/AD-34's resolution order (weekly choice → global
default → blank) — a second implicit default would make that order ambiguous.

## Constraints

This contract does not expose a live/session write path — the Operator's live background switch
(FR-33, UC-27) travels over the Presenter session channel (AD-10, AD-34), not this API; it is
read-only against this library, never a mutation of it. Deleting an image never deletes the
underlying file (share-by-reference, BR-12's discipline extended to this library); an orphan-file
purge tool is later Admin work, not designed here.
