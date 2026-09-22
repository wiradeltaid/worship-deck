---
type: contract
component: registry
lc: LC-11
direction: exposed
created: 2026-08-20
updated: '2026-09-22'
---

# Contract — Song Set Entries and the shared layout trio

## Source of truth

`none`. Backing tables: `song_set_entries` — the Master Data catalog (own table, decoupled from
spine placement); `artifact_templates` rows with `base_type = 'song-set-entry'` are the main-spine
**placements** referencing it, now potentially more than one placement per entry — DEC-057;
`song_set_layouts`.

## Purpose

UC-24 (entry list), UC-14 (trio layout edit). Admin-only (AD-14).

## Operations

| Operation | Purpose | Realizes |
| --- | --- | --- |
| GET `/api/admin/song-set-entries` | Ordered list of live entries (`variable_name`, title, position) | UC-24 |
| POST `/api/admin/song-set-entries` | Add an entry (`{ variable_name, title }`), appended to the spine | UC-24 |
| PATCH `/api/admin/song-set-entries/[variable_name]` | Rename title and/or `variable_name` (migrating `song_set_inputs` atomically per SPEC-13-06 Option A) | UC-24 |
| PUT `/api/admin/song-set-entries/[variableName]/extraction-regex` | Set the regex the Rundown parser uses to pull this entry's hymn number out of a pasted Rundown line | UC-24, UC-30 |
| DELETE `/api/admin/song-set-entries/[variable_name]` | Remove the entry from the spine; Hub's weekly values for that name stay stored, inert until reused or replaced | UC-24 (UC-15 shape) |
| GET `/api/admin/song-set-layouts/[role]` | One trio layout (`role` = `title`\|`verse`\|`reff`) | UC-14 |
| PUT `/api/admin/song-set-layouts/[role]` | Save that layout | UC-14 |
| POST `/api/admin/song-set-layouts/[role]/reset` | Restore that layout to seed | UC-14 |

**Wire spelling.** This contract names the field `variable_name` throughout, which is the DB
column name (`artifact_templates.variable_name`). On the wire the shipped handler reads and writes
it as **`variableName`**, camelCase, like every other JSON field in this API. Both spellings name
one thing; a client MUST send `variableName`.

Add/remove/reorder of a Song Set entry's *position on the spine* reuses the existing
`/api/admin/artifacts` order endpoint (`01-artifacts.md`) — an entry is still one spine row; this
contract only adds the entry-identity fields the artifacts contract does not carry.

## Five lanes

| Lane | Answer |
| --- | --- |
| Authentication | Admin + AD-5 matcher. No session / not Admin → 403 Forbidden. |
| Validation | `variable_name`: 1–80 chars, code-checked pattern (kebab/snake, no spaces), unique among **live** entries only (AD-31; not a DB `UNIQUE` — a `gone` entry's name is not reserved and MAY be reused by a later entry, no tombstone — owner ruling, 2026-08-20). Title: 1–120 chars. Trio layouts: AD-15 structure, same validator as a General; `verse`/`reff` payload MUST NOT carry a background-image element (AD-33's blank-canvas rule) — rejected as a validation error naming the field, not silently stripped. |
| Error handling | Envelope in `cross-cutting.md`. 400 validation. 404 unknown `variable_name` or `role`. 409 duplicate `variable_name` on create, or stale `updatedAt` on PATCH/DELETE/PUT/reset. |
| Rate limiting | `none` — Admin-only on one host. |
| Idempotency | GET safe. PUT same trio value is safe. Repeated Reset on the same seed role is safe. DELETE of an already-gone `variable_name` is 404, not a silent success. |

## Error behaviour

| Condition | Response | Caller should |
| --- | --- | --- |
| `variable_name` collides with a live entry | 409 `Song set entry already exists` | Pick another name (a name freed by deleting a prior entry is not a collision and MAY be reused on create; on rename, any existing inert weekly inputs under that name are replaced by the renamed entry's active inputs) |
| Rename attempts invalid `variable_name` pattern | 400 `Invalid variableName` | Correct pattern (kebab/snake lowercase, 1–80 chars) |
| Trio `verse`/`reff` PUT includes a background image element | 400 naming the offending element (`layouts.verse.elements[n] must not set a background image`) | Remove the background; it resolves at hydrate/live time instead (AD-33) |
| Reset on `role` with no seed (should not happen — all 3 roles ship seeded) | 500, logged as a defect | Report; not a normal user path |
| DELETE missing `updatedAt` | 400 `updatedAt is required` | Send the list token |
| Stale `updatedAt` anywhere | 409 | Re-read, then retry |

## Compatibility

Removing DELETE or rename is breaking UC-24. Widening `song_set_layouts` beyond 3 fixed roles, or
letting `verse`/`reff` carry an authored background, is breaking AD-33.

## Constraints

Deck render does not call this API (AD-14 server-side read / plan). The Hub weekly form (FR-32)
reads the entry list to render its own inputs — it calls this GET, it does not write here.

**Trio propagation is frozen, not live (owner ruling, 2026-08-20).** A PUT here changes only the
live `song_set_layouts` row this endpoint owns. It does **not** reach any existing Service's Deck —
a Service reads its own frozen copy in `service_song_set_layouts`, cloned at creation and replaced
only by an explicit Sync Artifact (AD-16). Only a Service created after this PUT sees the new
layout by default. This reverses an earlier design where the trio was read live at generate time.
