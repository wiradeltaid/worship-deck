---
type: contract
component: hub
lc: LC-2
direction: exposed
created: 2026-08-18
updated: 2026-08-20
---

# Contract — Services

## Source of truth

`none`. `internal/httpapi`, `src/lib/services/*`.

## Purpose

UC-2, UC-3, UC-5, UC-6, UC-7, UC-8, UC-16, UC-18, UC-23, UC-28.

## Operations

| Operation | Purpose | Realizes |
| --- | --- | --- |
| GET `/api/services` | List | UC-3 |
| POST `/api/services` | Create from rundown/form; clones the live registry spine plus every Announcement Set it splices in, into a service-bound snapshot (AD-16, AD-35) | UC-2 |
| PUT `/api/services/[id]` | Update — body now carries `songSets: { [variableName]: { songNumber, songBookCode, background, lyricText } }` in place of the retired `song1Number`..`song4Number` and `announcements[]` (DEC-004); an entry's `lyricText` here is always the this-service-only override (UC-28 main flow) | UC-5 · UC-23 · UC-28 |
| DELETE `/api/services/[id]` | Delete the row + that week's local files + its `song_set_inputs` rows (cascade) | UC-7 |
| GET `/api/services/[id]/pptx` | Generate on download | UC-6 · UC-18 |
| POST `/api/services/preview` | Preview plan from the **live** registry (no Service id) | UC-8 |
| POST `/api/services/[id]/sync-artifact` | Admin-only destructive re-clone of the live registry spine (incl. Announcement Sets, AD-35) onto that Service (AD-16) | UC-16 (OQ-B) |
| PUT `/api/services/[id]/song-sets` (proposed, unnumbered — see `00-inventory.md`) | Read-modify-write of one or more Song Set Weekly Inputs without touching the rest of the Service payload; a thinner alternative to folding `songSets` into the general PUT above, if build finds the general PUT too coarse for autosave-per-entry UX | UC-5 · FR-32 |
| POST `/api/services/[id]/song-sets/[variableName]/save-to-book` (proposed, unnumbered — see `00-inventory.md`; designed, ships only with the AD-36 bootstrap migration, see Constraints) | The explicit, separate "Save to Song Book" action (UC-28 alternate flow, BR-7, DEC-004 S12) | UC-28 |

## Five lanes

| Lane | Answer |
| --- | --- |
| Authentication | Operator/Admin session (AD-5). Without a session: the gate refuses before the route. Sync Artifact re-checks Admin in-route (`requireAdminSession`); Operator → 403. |
| Validation | Service id integer; PUT, DELETE, and POST sync-artifact require the client's `updated_at` (AD-6). GET pptx and POST preview do not take `updated_at` (OQ-20). POST create requires a readable date (OQ-21). |
| Error handling | Envelope in `cross-cutting.md`. 409 stale (UC-5 and UC-16). 404 missing (UC-7 not-found; do not recreate, OQ-23). 400 id/body / no date / missing sync token. 401 gate: session expiry, no partial write (OQ-23). 403 Operator on sync. 500 PPTX generate. Save-to-book: 409 when the hymn number moved under the Operator (SCN-4), 500 on a corpus write failure that does not touch the Service's own override. |
| Rate limiting | `none` — one congregation, home PC; not a public API. |
| Idempotency | GET list is safe. GET pptx / POST preview generate a Deck/plan and do **not** edit the Service payload (OQ-20, UC-6). DELETE again → 404. POST same date without override → 409 + `existingId` (UC-2, OQ-8); with explicit override a second row is inserted — not an upsert. Webhook upsert is CAP-11 (`08-webhook.md`). Stale PUT or stale Sync does not write. A second Sync with a fresh token re-clones. Save-to-book is not idempotent by design — a second press with the same text writes `hymns.lyrics` again, harmlessly. |

## Error behaviour

| Condition | Response | Caller should |
| --- | --- | --- |
| Stale `updated_at` | 409 | RSC again, merge, PUT or Sync again (SCN-2) |
| Sync: not Admin | 403 | Operator may request; only Admin performs |
| Sync: missing `updated_at` | 400 | Send the Service token |
| Sync: Service gone | 404 | Treat as UC-7 |
| Service gone on PUT | 404 | Treat as UC-7; do not POST a replacement (OQ-23) |
| Date already exists, no override | 409 + `existingId` | Open the existing Service, or confirm a second row |
| No date / empty Rundown | 400 | Fix the paste; no row (OQ-21) |
| Unparseable body with a date | 201 + `failedHymnNumbers` | Show the miss; Service exists (NFR-5, OQ-22) |
| Session expired on PUT/DELETE | 401 from `internal/gate` | Sign in; no partial write (OQ-23) |
| Not found | 404 | Refresh the list |
| Plan/PPTX failed | 500 | Retry; Sabbath uses the old file if one exists |
| Save-to-book: hymn number moved under the Operator | 409 | Re-open the editor against the new hymn (SCN-4); the Service's own override already saved separately and is unaffected |
| Save-to-book: `variableName` has no `song_set_inputs` row or no resolvable hymn | 400 | Nothing to save back; edit and save the Service first |

## Compatibility

Removing `updated_at` from PUT or from POST sync-artifact is breaking (AD-6). Changing the parsed payload shape is breaking for the Hub form. Sync must not rewrite `parsed_data` or Song Set Weekly Inputs / Lyric Overrides — those are entered data (AD-16's "State" convention), not structure; Sync only replaces the cloned spine (AD-35). The old constraint here read "announcement membership (BR-10, BR-11)" — BR-11 is retired by DEC-004 (announcement membership is no longer a Hub-owned thing to protect); BR-10 is a `business-rules.md` cross-component rule this component does not own and cannot amend — reported, not edited.

## Constraints

PPTX generate (GET) may be slow; it does not bump `services.updated_at` (OQ-20). Process timeout is the Go API default — [ASSUMED], never read as a number (DEC-003 retired the Next.js shape). A future Node worker (brief addendum) is not this contract. The save-to-book operation was **blocked**: it is a write into what AD-25 called a projected corpus table. That conflict is closed — DEC-005 / AD-36 make the song book administrator-owned data after a one-time bootstrap, the song-book half of AD-25 superseded. The route is now designed rather than blocked, with one build-order constraint: it MUST NOT ship ahead of the AD-36 bootstrap-once migration to `upsertHymns` (`06-flows/lyric-save-to-book.md` § Migration, AD-21) — shipping the route first would let the next restart silently discard an Operator's saved correction.
