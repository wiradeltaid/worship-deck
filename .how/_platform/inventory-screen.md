---
type: inventory
kind: screen
scope: _platform
status: draft
created: '2026-08-18'
updated: '2026-09-22'
derived_from: code
verified: '06edf67'
platform_rows: []
states: {}
---

# Inventory — screens

Derived by `inventory.py` from `<Route>` in `spa/src/App.tsx`. Screen identity is `<spa>/<Component>` (DEC-003). Numbers are stable; new rows take the next number.

## Rows

| No | Screen | Route | States | Owning component | UC served |
| --- | --- | --- | --- | --- | --- |
| 2 | spa/Dashboard | `/` | — | hub | UC-3 |
| 7 | spa/AdminArtifactsPage | `/admin/artifacts` | — | registry | UC-14, UC-15 |
| 12 | spa/AdminSyncPage | `/admin/sync` | — | registry | — |
| 6 | spa/AdminPage | `/admin` | — | hub | UC-9, UC-19, UC-22 |
| 1 | spa/LoginPage | `/login` | — | hub | UC-9 |
| 13 | spa/WorkspaceMockupPage | `/new` | — | hub | UC-5 |
| 10 | spa/ProjectorPage | `/services/[id]/present/projector` | — | presenter | UC-12 |
| 9 | spa/PresentPage | `/services/[id]/present` | — | presenter | UC-12, UC-13 |
| 11 | spa/RemotePage | `/services/[id]/remote` | — | presenter | UC-29 |
| 8 | spa/SlideshowPage | `/services/[id]/slideshow` | — | presenter | UC-11 |
| 4 | spa/ServiceRunSheet | `/services/[id]` | — | hub | UC-4, UC-5, UC-6, UC-7, UC-16, UC-18 |
| 14 | spa/ParityDiagnosticPage | `/services/diagnostic-parity` | — | registry | UC-14 |
| 3 | spa/CreateServicePage | `/services/new` | — | hub | UC-2 |

## Findings

- States are not declared on these pages; the `states:` map in frontmatter is empty, so the column is `—`. Empty and error states demanded by the UX guide are not yet named here.
- UC served is a judgement the reader cannot derive from `App.tsx`; values are the prior catalogue mapping, kept in this file, except where that mapping names a UC the page does not run.
- UC-16 (Sync Artifact) is on row 4 (`/services/[id]`), Admin-only control. It is not on row 7.
- Plan vs code (DEC-003): Screen identity prefix is `spa`. Operator and projected shells live under `spa/src/pages`; client trees remain in `src/operator` and `src/projected`.
- **Plan vs code (DEC-004):** row 5 (`spa/AnnouncementsPage`, UC-21) is retired by this decision — UC-21 leaves Hub's catalogue and its promise moves to the Registry. The Announcement Set / Song Set Entry / Background Library authoring surfaces DEC-004 promised (UC-24, UC-25) have since shipped inside row 7 (`spa/AdminArtifactsPage`); no separate page exists for them and none is needed.
- **Open question — row 12 (`spa/AdminSyncPage`) has no UC served.** SPEC-47 shipped device-to-device manual sync (push/pull, content-addressed assets) without adding a use case for it to `usecases.yaml`; the tickets' `satisfies` fields point at UC-5/UC-11/UC-14, none of which describe "sync two devices." Not resolved here — `wdi-blueprint`'s `catalog` intent (or `wdi-question`) owns writing the missing UC, not this inventory.
- 2026-09-22: rows 12–14 (`spa/AdminSyncPage`, `spa/WorkspaceMockupPage`, `spa/ParityDiagnosticPage`) added by `wdi-reconcile` → `wdi-blueprint`. SPEC-26, SPEC-47, and SPEC-48 shipped these screens without this inventory being refreshed.

## Retired

| No | Screen | Route | Retired | Why |
| --- | --- | --- | --- | --- |
| — | `spa/AnnouncementsPage` | `/announcements` | 2026-08-22 | FR-3 retired: the screen and its nav item are deleted; composition lives in the Artifact Registry (DEC-004). It served UC-21 |

