---
type: inventory
kind: endpoint
scope: presenter
status: draft
created: '2026-08-18'
updated: '2026-08-22'
derived_from: code
verified: '84db8e7'
---

# Inventory — endpoints of Presenter

## Rows

| No | Method | Path | Spec file | Status |
| --- | --- | --- | --- | --- |
| 29 | GET | `/api/scripture` | `01-scripture.md` | published |
| pending | POST | `/api/present/[id]/remote/pair` | `03-remote-control.md` | shipped |
| pending | DELETE | `/api/present/[id]/remote/pair` | `03-remote-control.md` | shipped |
| pending | POST | `/api/present/[id]/remote/claim` | `03-remote-control.md` | shipped |
| pending | GET | `/api/present/[id]/remote/stream` | `03-remote-control.md` | shipped |
| pending | POST | `/api/present/[id]/remote/intent` | `03-remote-control.md` | shipped |

The `BroadcastChannel` is not HTTP; spec in `02-present-channel.md`.

## Findings

- Number 29 follows the platform inventory.
- The five remote-control rows carry `pending` deliberately. `.how/_platform/inventory-api.md` is
  `derived_from: code` in this product, so a planned row there would immediately read as a
  plan-versus-code gap — the same 45 gaps that were closed on 2026-08-22. They take platform numbers
  from `wdi-blueprint` when the wave that builds them lands, and numbering is never assigned here.
