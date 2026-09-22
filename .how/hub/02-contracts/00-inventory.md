---
type: inventory
kind: endpoint
scope: hub
status: draft
created: '2026-08-18'
updated: '2026-09-22'
derived_from: code
verified: '75d990b'
---

# Inventory — endpoints of Hub

Numbers match `.how/_platform/inventory-api.md` for Hub-owned rows. Spec per resource, not per verb.

## Rows

| No | Method | Path | Spec file | Status |
| --- | --- | --- | --- | --- |
| 1 | POST | `/api/auth/login` | `01-auth.md` | published |
| 2 | POST | `/api/auth/logout` | `01-auth.md` | published |
| 3 | POST | `/api/auth/change-password` | `01-auth.md` | published |
| 4 | GET | `/api/services` | `02-services.md` | published |
| 5 | POST | `/api/services` | `02-services.md` | published |
| 6 | PUT | `/api/services/[id]` | `02-services.md` | published |
| 7 | DELETE | `/api/services/[id]` | `02-services.md` | published |
| 8 | GET | `/api/services/[id]/pptx` | `02-services.md` | published |
| 30 | POST | `/api/webhook` | `08-webhook.md` | published |
| 33 | POST | `/api/services/[id]/sync-artifact` | `02-services.md` | published |
| 11 | POST | `/api/announcements` | `03-announcements.md` | retired |
| 12 | PUT | `/api/announcements` | `03-announcements.md` | retired |
| 13 | PATCH | `/api/announcements/[id]` | `03-announcements.md` | retired |
| 14 | DELETE | `/api/announcements/[id]` | `03-announcements.md` | retired |
| N/A | PUT | `/api/services/[id]/song-sets` (proposed) | `02-services.md` | proposed — needs a number in `.how/_platform/inventory-api.md` (out of this component's scope, reported) |
| N/A | POST | `/api/services/[id]/song-sets/[variableName]/save-to-book` (proposed) | `02-services.md` | proposed — same numbering gap; designed, not blocked — the AD-25 drift note in `05-model/data-model.md` is closed by DEC-005/AD-36, with one build-order constraint (the AD-36 bootstrap-once migration must land first) |
| 15 | POST | `/api/upload` | `04-upload.md` | published |
| 16 | POST | `/api/upload/from-url` | `04-upload.md` | published |
| 17 | GET | `/api/uploads/[filename]` | `04-upload.md` | published |
| 18 | GET | `/api/hymns` | `05-hymns.md` | published |
| 19 | GET | `/api/admin/accounts` | `06-accounts.md` | published |
| 20 | POST | `/api/admin/accounts` | `06-accounts.md` | published |
| 21 | PATCH | `/api/admin/accounts/[id]` | `06-accounts.md` | published |
| 22 | DELETE | `/api/admin/accounts/[id]` | `06-accounts.md` | published |
| 23 | GET | `/api/admin/settings` | `07-settings.md` | published |
| 24 | PUT | `/api/admin/settings` | `07-settings.md` | published |
| 30 | POST | `/api/webhook` | `08-webhook.md` | published |
| 84 | PUT | `/api/admin/form-groupings/reorder` | `10-form-layout.md` | published |
| 85 | POST | `/api/admin/form-groupings` | `10-form-layout.md` | published |
| 83 | DELETE | `/api/admin/form-groupings/[id]` | `10-form-layout.md` | published |
| 82 | POST | `/api/admin/form-grouping-slots` | `10-form-layout.md` | published |
| 80 | DELETE | `/api/admin/form-grouping-slots/[id]` | `10-form-layout.md` | published |
| 81 | PUT | `/api/admin/form-grouping-slots/reorder` | `10-form-layout.md` | published |
| 79 | POST | `/api/admin/form-grouping-slots/[id]/move-grouping` | `10-form-layout.md` | published |
| 100 | POST | `/api/admin/predefined-fields` | `10-form-layout.md` | published |
| 98 | DELETE | `/api/admin/predefined-fields/[id]` | `10-form-layout.md` | published |
| 99 | POST | `/api/admin/predefined-fields/seed-defaults` | `10-form-layout.md` | published |
| 112 | GET | `/api/worship-form-layout` | `10-form-layout.md` | published |
| 96 | GET | `/api/admin/parser-profiles` | `09-rundown-parser-profiles.md` | published |
| 97 | POST | `/api/admin/parser-profiles` | `09-rundown-parser-profiles.md` | published |
| 93 | GET | `/api/admin/parser-profiles/[id]` | `09-rundown-parser-profiles.md` | published |
| 94 | PATCH | `/api/admin/parser-profiles/[id]` | `09-rundown-parser-profiles.md` | published |
| 95 | PUT | `/api/admin/parser-profiles/[id]` | `09-rundown-parser-profiles.md` | published |
| 92 | DELETE | `/api/admin/parser-profiles/[id]` | `09-rundown-parser-profiles.md` | published |
| 91 | POST | `/api/admin/parser-profiles/[id]/set-default` | `09-rundown-parser-profiles.md` | published |
| 105 | GET | `/api/parser-profiles` | `09-rundown-parser-profiles.md` | published |
| 110 | POST | `/api/sync/push` | `11-manual-sync.md` | published |
| 109 | GET | `/api/sync/pull` | `11-manual-sync.md` | published |
| 111 | GET | `/api/sync/status` | `11-manual-sync.md` | published |

## Findings

- Numbers 25–29 and 31–32 belong to Registry/Presenter in the platform inventory; not used here. 33 is Hub Sync Artifact (UC-16).
- No OpenAPI; prose contracts. Source: `internal/httpapi`.
- POST `/api/webhook` (30) is as-built CAP-11 later; this phase's create path is POST `/api/services` (UC-2).
- **DEC-004 (2026-08-20):** rows 11–14 (`/api/announcements*`) retire with FR-3 — see
  `03-announcements.md`. Two new operations are needed for FR-32/FR-34 (Song Set weekly inputs and
  the explicit lyric save-to-book action) but have no number yet: this component cannot assign one
  without editing `.how/_platform/inventory-api.md`, which is out of scope here and is reported to the
  platform/blueprint owner instead.
- **2026-09-22:** rows 79–85, 91–100, 105, 109–112 added — SPEC-44 (Rundown Parser Profiles, FR-36),
  SPEC-46 (Form Layout / Predefined Fields, FR-37), and the mutation half of SPEC-47's Manual Device
  Sync (FR-40; the asset half, rows 106–108, is Registry's, see `.how/registry/02-contracts/00-inventory.md`).
  All three shipped before their `FR`/`UC` or this contract existed; `wdi-reconcile` → `wdi-product` →
  `wdi-blueprint` → `wdi-component` backfilled the chain in that order.
