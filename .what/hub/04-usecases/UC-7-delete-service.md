---
type: uc
id: UC-7
component: hub
satisfies: [FR-10]
critical: true
created: 2026-08-18
---

# UC-7 — I delete this Service and its assets

## Trigger

The Operator chooses delete on a Service.

## Precondition

The Operator is signed in. That Service exists.

## Main Flow

1. The Operator requests delete of that dated Service.
2. The system deletes the Service, its `song_set_inputs` rows, and local image files bound only to that Service.
3. The system leaves every `announcement_items` row untouched — the FK cascade is retired (migration 9→10); they survive regardless of one-off or recurring.
4. The Service disappears from the list.

## Alternate Flows

None.

## Failure Flows

| From step | Failure | What the system does | What the user is left with |
| --- | --- | --- | --- |
| 1 | Session expired | Rejects; no partial write (OQ-23) | Operator signs in again; the Service is still there |
| 1 | Service is already gone | Reports not found | List already lacks that row |
| 1 | Missing or stale `updated_at` token | Rejects (400 missing, 409 stale); no partial write (AD-6) | Operator resends with the current token, or re-reads first |
| 2 | Delete fails mid-way | Does not claim success | Operator tries again; no promise of a hidden half-delete |

## Outcome

That Service cannot be opened again. That week's local photo and flyer files that belonged only to it are gone. `announcement_items` rows survive intact — Registry-owned (DEC-004), not Service-scoped, and no longer cascaded.

## Business Rules

BR-5
