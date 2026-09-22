---
type: rules
scope: component
component: hub
status: draft
created: 2026-08-18
updated: 2026-09-22
---

# Business Rules — Hub

## Rules

| id | Rule | Binds | Source | Status |
| --- | --- | --- | --- | --- |
| BR-3 | Hymn numbers are resolved only against the shipped Song Book; an unknown number does not reject the Service. | hub | FR-2 · UC-1 · UC-2 | active |
| BR-4 | A Service **field save** (UC-5) that carries a stale precondition is rejected; the Operator must re-read before trying again. Generate / UC-6 is not a payload edit: the stale-precondition does not apply to it (OQ-20). | hub | FR-28 · UC-5 · UC-23 · OQ-20 | active |
| BR-5 | Deleting a Service never touches the Artifact Registry's Announcement Sets, or any image they still reference — those are Registry-owned (DEC-004), not Service-scoped. | hub | FR-10 · UC-7 | active |
| BR-6 | ~~Lyric slides join verse lines into continuous prose and emit Verse then Chorus after every verse when both exist; a long verse still splits on the plan's character budget.~~ **AMENDED (DEC-004 Supplement S7).** Verse then Reff/Chorus (either spelling, with or without a trailing number) after every verse; a refrain with its own body is used verbatim and different refrains per verse are preserved; a refrain header with no body inherits the nearest preceding non-empty refrain; slide order follows the lyric database's own order; **a blank line inside a section is a hard slide break** (one paragraph, one slide) — splitting by character count is retired and no longer governs anything. | hub | FR-5 · LC-16 · UC-20 | active |
| BR-7 | Editing a Song Set entry's lyrics on the Hub form changes this Service's Deck only by default; the Song Book is untouched. A separate, explicit action beside the editor saves the edit back to the Song Book so later Services start from the corrected text — typing alone never triggers that save. | hub | FR-34 · UC-28 | active |
| BR-14 | The Rundown Parser Profile active at the moment a Service is parsed is recorded on that Service (`parser_profile_id`, `parser_profile_version`); changing the active profile afterward reparses nothing already saved. | hub | FR-36 · UC-30 | active |
| BR-15 | Deleting a Predefined Field is a soft delete (`is_active = 0`); a Service's already-entered value for it is never orphaned or removed, the same posture a retired Song Set entry's weekly input already has. | hub | FR-37 · UC-31 | active |
