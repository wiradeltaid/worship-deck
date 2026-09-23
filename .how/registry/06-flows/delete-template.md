---
type: flow
component: registry
realizes: [UC-15]
risky: true
created: 2026-08-18
updated: 2026-08-19
---

# Flow — Delete a Registry entry

## Realizes

UC-15 delete. Delete is terminal (`gone`). Reset is live→live only on a still-live seed row; it does not undelete (OQ-24).

## Participants

LC-11 → LC-15 → `artifact_templates`.

## Happy path

1. Admin confirms delete on `/admin/artifacts`. LC-11 `DELETE /api/admin/artifacts/[id]` with `{ updatedAt }`.
2. LC-15 deletes the row, compacts `position` to `0..N-1`, and bumps every survivor's `updated_at` in one transaction.
3. The next boot does not insert that id (AD-17, SCN-5).

## Sequence diagram

```mermaid
sequenceDiagram
  participant A as Admin
  participant G as LC-11
  participant S as LC-15
  participant D as SQLite
  A->>G: DELETE /api/admin/artifacts/[id] { updatedAt }
  G->>S: deleteArtifactTemplate
  S->>D: DELETE artifact_templates; compact position
  Note over D: seeder does not fill the gap (AD-17)
```

## Failure modes

| Hop | Failure | System does | Safe to retry |
| --- | --- | --- | --- |
| No session / not Admin | 403 | does not write | after sign-in as Admin |
| Missing `updatedAt` | 400 | does not write | yes |
| Stale `updatedAt` | 409 | does not write | re-read list, retry |
| id | 404 | does not write | yes |
| last live row deleted | list empty; seeder must not refill (AD-17, UC-15 N=0) | yes — empty Deck is allowed |
| songset-* / `song-set` row deleted | Registry row gone; Hub hymn field stays stored and inert (AD-19) | yes |
| Reset while live payload will not parse | `getArtifactTemplate` throw → 500 before gone/no-seed 404 | no — fix the row or wait |
| Boot | seeder fills the gap | **defect** AD-17 | not a user retry |

## Guarantees

Delete + restart = still gone. Plan does not substitute seed for a missing id. Existing Services keep the frozen id until Sync Artifact.

## Extended by DEC-004 (G4, built — waves W3/W4)

The same delete discipline (gone is terminal, restart does not revive, Sync freezes the frozen
copy) extends to every new table:

- A **Song Set entry** delete removes its spine row; Hub's stored weekly values for that
  `variable_name` stay stored and inert — not deleted, not cleared (UC-24).
- An **Announcement Set** delete is rejected with 409 while a live spine marker still references
  it (`03-announcement-sets.md`) — the marker must be removed or repointed first, never a
  cascading delete of a still-referenced set.
- A **slide inside an Announcement Set** deletes exactly like a General on the spine: its own row
  goes `gone`, `position` compacts within that set only, and any image it referenced is untouched
  (`copy-paste-share-by-reference.md`).
- A **Background Library image** or **Song Book** delete never cascades to a weekly/live reference
  still pointing at it — it falls through the resolution order instead (AD-33/AD-34, S3).
