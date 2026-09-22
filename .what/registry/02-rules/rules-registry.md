---
type: rules
scope: component
component: registry
status: draft
created: 2026-08-18
updated: 2026-09-22
---

# Business Rules — Registry

## Rules

| id | Rule | Binds | Source | Status |
| --- | --- | --- | --- | --- |
| BR-8 | Edits to the live Registry do not change an existing Service until Sync Artifact. | registry | FR-21 · UC-14 · UC-15 | active |
| BR-9 | An entry Admin deleted does not reappear after restart. | registry | FR-21 · UC-15 | active |
| BR-10 | Sync Artifact replaces the structure that is rendered; Operator fields remain. | registry | FR-21 · UC-16 | active |
| BR-11 | ~~Each Announcement registry row expands the whole live Hub announcement list.~~ **RETIRED (DEC-004), superseded by BR-12.** | registry | FR-21 · UC-16 · UC-20 | superseded |
| BR-12 | An `ann-set` marker on the main spine splices in that Announcement Set's own ordered sequence of authored General slides; each set is independent, composed only in the Registry. A copied image shares one file by reference across Main and every Announcement Set — deleting a slide never deletes an image another slide still uses. | registry | FR-21 · UC-14 · UC-15 | active |
| BR-13 | An unrecognised `{token}` in an authored text element never blocks generation; it renders as empty text. The editor flags the unknown key at save time. | registry | FR-30 · UC-14 | active |
| BR-16 | Manual Device Sync refuses to push to, or pull from, an instance while a presenter is actively projecting there — the sync lock (`TryAcquireSyncLock`) exists so a live service is never mutated mid-presentation. | registry | FR-40 · UC-32 | active |
