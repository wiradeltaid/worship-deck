---
type: contract
component: hub
lc: LC-19
direction: exposed
created: '2026-09-22'
updated: '2026-09-22'
---

# Contract — Rundown Parser Profiles

## Source of truth

`none`. `internal/httpapi/parser_profiles.go`, `src/lib/parser.ts`.

## Purpose

UC-30. Admin authors named sets of extraction rules the Rundown parser applies; FR-36.

## Operations

| Operation | Purpose | Realizes |
| --- | --- | --- |
| GET `/api/admin/parser-profiles` | List every profile, built-in and Admin-authored | UC-30 |
| POST `/api/admin/parser-profiles` | Create a profile | UC-30 |
| GET `/api/admin/parser-profiles/[id]` | One profile | UC-30 |
| PATCH `/api/admin/parser-profiles/[id]` | Update a profile | UC-30 |
| PUT `/api/admin/parser-profiles/[id]` | Update a profile (same handler as PATCH) | UC-30 |
| DELETE `/api/admin/parser-profiles/[id]` | Delete a profile | UC-30 |
| POST `/api/admin/parser-profiles/[id]/set-default` | Mark one profile the active default | UC-30 |
| GET `/api/parser-profiles` | The profile list an Operator surface may read (non-admin session) | UC-2 |

## Five lanes

| Lane | Answer |
| --- | --- |
| Authentication | `/api/admin/*` requires an Admin session (AD-5). `GET /api/parser-profiles` requires any signed-in session — it is what the Operator's Rundown-paste surface reads to know which profile is active, never a write path. |
| Validation | `slug`: lowercase alphanumeric with hyphens, 1–64 chars, unique (409 on collision). `title`: required, ≤120 chars. `description`: ≤500 chars. `rules_json` MUST parse (`validateRulesJSON`); an unparseable body is refused at write time. Exactly one profile may hold `is_default = 1`; `set-default` clears the flag on every other row in the same write. A built-in profile (`is_builtin = 1`) MUST NOT be deleted, and the active default MUST NOT be deleted either — both are explicit guards in `deleteParserProfile`, not merely undocumented behaviour. |
| Error handling | Envelope in `cross-cutting.md`. 404 unknown id. 400 malformed `rules_json`, missing `title`, invalid `slug`, deleting a builtin, or deleting the active default. 409 duplicate `slug`. 403 non-Admin on any `/api/admin/*` route. |
| Rate limiting | `none` — same posture as every other admin surface (`02-services.md`). |
| Idempotency | GET is safe. PATCH/PUT overwrite the named fields; two identical PATCHes are harmless. `set-default` run twice on the same id is a no-op the second time. DELETE again → 404. |

## Error behaviour

| Condition | Response | Caller should |
| --- | --- | --- |
| Unknown profile id | 404 | Refresh the list |
| Duplicate `slug` on create | 409 | Choose a different slug |
| Malformed `rules_json` | 400 | Fix the rule set client-side before saving |
| Delete the active default profile | 400, "Default parser profile cannot be deleted; designate another default first" | `set-default` another profile, then delete |
| Delete a built-in profile | 400, "Builtin profiles cannot be deleted" | Never offered as deletable in the UI |
| Non-Admin caller | 403 | Sign in as Admin |

## Compatibility

`rules_json`'s shape is read by both `internal/parse` (Go, server-side parse) and `src/lib/parser.ts`
(client-side preview, if any) — a shape change is breaking for whichever side is not updated in the
same change. `GET /api/parser-profiles`'s response shape is read by the Operator's Rundown-paste
surface to resolve the active profile; narrowing it is breaking for that surface.

## Constraints

Exactly one profile is active at a time (FR-36) — there is no per-Service profile override at parse
time; changing the active profile changes parsing for every Rundown pasted from that moment on. Each
Service that has been parsed records which profile and version produced it (`services.parser_profile_id`,
`parser_profile_version`) — a historical record of what ran, not a per-Service override switch. The
built-in profile is seeded once on startup, inserted only if its slug is absent (`migrate_parser_profiles.go`)
— the same bootstrap-once, insert-if-absent posture AD-17 already gives the Artifact Registry and
AD-36 gives the Song Book.
