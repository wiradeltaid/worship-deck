# SPEC-50 — Unified Schedule Workspace UI/UX Full Architecture & Screen Replacement Blueprint

> **Status:** closed  
> **Release:** unified-schedule-workspace-full-architecture  
> **Component:** hub  
> **Touches:** operator, spa, presenter, sync, artifacts  
> **Depends on:** SPEC-49  

## Problem Statement

Following the delivery of the SPEC-49 visual prototype at `/new`, the maintainer conducted an in-depth review of the command center workflow (Review 2026-09-20) and identified fundamental workflow and screen coverage gaps:
1. **Ambiguous Preset & Schedule Lifecycle (Master vs. Instance):**
   - The prototype does not separate **Master Preset Mode** (defining recurring liturgies, form groupings, required predefined fields, and spine templates) from **Schedule Instance Mode** (assembling and editing an operational service for a specific date and time).
   - Operators cannot add, edit, or delete presets, and there are no safety guards preventing the deletion of presets currently in use by active schedules.
   - Modifying items in the timeline creates confusion as to whether it mutates the master preset or only the active date instance.
2. **Missing Schedule Persistence & History:**
   - Selecting a preset and date has no explicit persistence ("Simpan Jadwal") or auto-save indicator.
   - There is no schedule history drawer or browser to view past schedules, reopen previous services for re-presentation, or duplicate past services as new templates.
3. **Disconnected Reusable Master Libraries:**
   - Predefined slide types (Song Sets, Announcement Sets, Canvas Layouts) cannot be looked up from historical master data; creating a song set or announcement set does not offer the choice to save it to a master library or reuse past ones.
   - There is no mechanism to save a customized canvas slide layout as a reusable "New Slide Type" / template.
   - Predefined fields are not managed globally (inter-preset registry) with custom form layouting per preset.
4. **Incomplete Screen Replacement Coverage:**
   - The current `/new` prototype operates as an isolated mockup, leaving existing operational screens in `spa/src/pages/` unmapped:
     - `DashboardPage` (`/`): Service list and deletion;
     - `CreateServicePage` (`/services/new`): Raw rundown copy-paste and auto-parser;
     - `RunSheetPage` (`/services/:id`): Legacy `EditForm` and `DynamicFormBody`;
     - `RemotePage` (`/services/:id/remote`): Smartphone remote controller;
     - `AdminSyncPage` (`/admin/sync`): Desktop offline on-demand push/pull sync and conflict resolution;
     - `AdminPage` (`/admin`): Account management, worship settings, and system settings.
   - Without an architectural blueprint that fully accommodates and replaces these screens, the application cannot retire legacy code (~3,422 lines identified in `07-codebase-loc-analysis-and-alignment-matrix.md`) or achieve the grand vision outlined in `ops/research/wdi-ecosystem-strategy/worship-presenter-web/unified-schedule-roadmap/`.

SPEC-50 addresses these gaps by establishing the definitive UI/UX architecture and screen replacement blueprint, ensuring 100% functional adoption of legacy screens into the modern Unified Schedule Workspace with strict adherence to data contracts, rendering invariants, offline sync safety, and security boundaries.

## Milestone & Screen Replacement Coverage Matrix

| Existing Screen / Feature | Current Route | Status in SPEC-50 Blueprint | Target Workspace Location & Functional Parity |
|---|---|:---:|---|
| **Dashboard / Services List** | `/` | **Replaced & Integrated** | Schedule History Drawer (`📂 Riwayat Jadwal`): lists past/upcoming services, search, filter by preset, duplicate, and delete with safety guards. |
| **Create Service (Parser)** | `/services/new` | **Replaced & Integrated** | Workspace Creation Flow: "Teks Rundown Mentah" tab in center panel with live parser & dynamic song suggestions; non-destructive proposal workflow. |
| **Run Sheet & Edit Form** | `/services/:id` | **Replaced & Integrated** | Unified 3-Panel Workspace: Timeline (left), In-Place Contextual Editor (center), Sticky 16:9 Live Canvas Preview (right). |
| **Live Presenter Console** | `/services/:id/present` | **Retained & Unified** | Triggered via `▶ Tayangkan Sekarang` in workspace header; consumes dynamic `schedule_items` slide plan; 2-screen confidence split with Liveness Guard. |
| **Mobile Remote Controller** | `/services/:id/remote` | **Retained & Unified** | In-Workspace `📱 Remote Control` modal with dynamic QR Code, PIN, and pairing link; secured via expiring scoped token. |
| **Projector & Slideshow** | `.../projector`, `.../slideshow` | **Retained Intact** | Pure clean-feed projection surfaces consuming the unified slide plan via single-source-of-truth planner. |
| **Visual Parity Diagnostic** | `/services/diagnostic-parity` | **Retained & Linked** | Accessible under Workspace Tools / Admin menu. |
| **Admin Settings & Accounts** | `/admin` | **Replaced & Integrated** | In-Workspace Settings Drawer (⚙️): AccountsManager, WorshipSettings, SystemSettings without leaving the active schedule. |
| **Canvas & Font Registry** | `/admin/artifacts` | **Replaced & Integrated** | Level 1: In-Place Canvas Designer Modal; Level 2: Master Canvas Template & Font Manager in Admin/Preset Drawer. |
| **Desktop-to-Web Sync** | `/admin/sync` | **Replaced & Integrated** | Persistent Sync Status Badge in header (Online/Local/Synced/Pending), on-demand push/pull triggers, and in-place Conflict Resolver Dialog with atomic aggregate transfer. |
| **Master Preset Management** | *New Feature* | **Introduced in SPEC-50** | Mode toggle: Master Preset Builder vs Schedule Instance; Preset CRUD with dependency check guard (cannot delete preset with active services). |
| **Reusable Master Libraries** | *New Feature* | **Introduced in SPEC-50** | Master Song Sets, Master Announcement Sets, Save Canvas as New Slide Type, Global Predefined Fields Registry. |

## User Workflows & State Transitions

### Workflow 1: Mode Separation (Master Preset Builder vs. Schedule Instance)
```text
┌────────────────────────────────────────────────────────────────────────────┐
│ MODE SWITCHER: [ ● Jadwal Ibadah (Instance) ]  [ ○ Master Preset Builder ] │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┴─────────────────────────────┐
        ▼                                                           ▼
[ MODE: JADWAL IBADAH ]                                     [ MODE: MASTER PRESET ]
1. Pilih Preset (Sabat, Vesper, Doa)                        1. Kelola Blueprint Liturgi Baku
2. Pilih Tanggal & Waktu                                    2. Atur Predefined Fields & Form Layout
3. Tempel Rundown / Susun Timeline                          3. Atur Item Default & Template Kanvas
4. Modifikasi Lokal (Instance-Only)                         4. Tambah / Hapus Preset
   - Mutasi hanya pada schedule_items                          - Guard: Dilarang hapus jika
   - Master Preset tetap immutable                               sedang dipakai di jadwal aktif!
5. Aksi: Simpan Jadwal, Tayangkan, Unduh PPTX                 - Status: draft -> published -> retired
```

### Workflow 2: Reusable Master Libraries (Song Sets, Announcements, Canvas)
- **Song Sets:** Operator can build a new song set or click "Pilih dari Master Songset" to lookup past song sets. Deleting from master library validates that no other presets reference it. Historical services retain frozen snapshot payloads in their `schedule_items`, preventing retroactive drift.
- **Announcement Sets:** Operator can upload flyers or click "Pilih dari Master Warta" to reuse past announcement sets. Supports auto-advance looping carousel.
- **Canvas Slide Templates:** When modifying slide text boxes, fonts, or backgrounds in the Canvas Designer, operator can click **"💾 Simpan sebagai Tipe Slide Baru"** to register it into the master canvas library.
- **Predefined Fields Registry:** Global token dictionary (`{sermon_speaker}`, `{sermon_title}`, `{scripture_reference}`) managed in a dedicated drawer and bound to preset form layouts with strict data-type validation.

### Workflow 3: Remote Control & Live Presentation Security
- Clicking **"📱 Remote Control"** in the workspace header opens a dialog displaying:
  - High-contrast dynamic QR Code generated on-the-fly;
  - Pairing URL (`https://.../services/:id/remote?token=...`) containing a cryptographically secure, scoped token with 4-hour TTL;
  - 4-digit pairing PIN with rate limiting (max 5 attempts before lockout);
  - Immediate revocation button: "Putuskan Semua Remote".
- Mobile device opens `RemoteOperator` and controls the live slide sequence in real-time.
- **Presenter Liveness Guard:** If a presentation is actively live on the projector (`is_live = true`), structural edits to the schedule are gated with a confirmation modal and broadcast atomic slide updates to prevent audience disruption.

### Workflow 4: Desktop Offline On-Demand Sync & Conflict Handling
- Top navigation bar contains a **Sync Status Badge**:
  - `🟢 Terhubung & Sinkron` (All changes synced)
  - `🟡 3 Perubahan Lokal` (Pending push/pull)
  - `🔴 Konflik Terdeteksi` (Version skew detected)
- **Atomic Aggregate Sync Contract:**
  - Service + all `schedule_items` + referenced preset version are transferred in a single `BEGIN IMMEDIATE` transaction in SQLite WAL mode.
  - Entities tracked via UUIDv7 with tombstones for deletions.
  - `schema_version` gate protects older desktop clients from unsupported entity payloads.
- **Conflict Resolution Dialog:**
  - Side-by-side diff viewer for conflicting services (`local_payload` vs `server_payload`);
  - Resolution actions: "Gunakan Versi Lokal" (force push with incremented revision), "Gunakan Versi Server" (accept remote), or "Simpan sebagai Salinan Baru" (fork instance with new UUIDv7).

## User Stories

1. As an administrator, I want to switch to "Master Preset Builder" mode to define recurring worship blueprints and field layouts, so that regular weekly services maintain strict liturgical consistency (`UC-14`, satisfying `FR-20`).
2. As an operator, I want to modify timeline items in "Schedule Instance" mode without affecting the underlying master preset, so that ad-hoc service changes remain isolated (`UC-5`, satisfying `FR-11`).
3. As an operator, I want to lookup and insert previously created song sets and announcement sets from a master library, so that repetitive data entry is eliminated (`UC-24`, satisfying `FR-29`, `FR-32`).
4. As an operator, I want to save a customized canvas slide layout as a new reusable slide type, so that special slide designs can be reused across services (`UC-14`, satisfying `FR-30`).
5. As a preacher or liturgist, I want to scan a QR code in the workspace to open the mobile remote controller on my smartphone under a secure expiring token, so that I can advance slides seamlessly (`UC-11`, `UC-12`).
6. As an operator during a live service, I want to trigger Quick Scripture Lookup to project spontaneous verses without altering the underlying schedule plan (`UC-13`).
7. As a desktop operator, I want to see sync status in the header and resolve conflicts in an in-place modal, so that data synchronization between offline Windows PCs and the cloud is effortless and safe (`UC-5`, satisfying `FR-21`).

## Tickets

- `SPEC-50-01`: Master Preset Lifecycle & Schedule Persistence Architecture
- `SPEC-50-02`: Reusable Master Libraries & Predefined Fields Registry
- `SPEC-50-03`: Remote Control Pairing & Live Presenter Unification
- `SPEC-50-04`: Desktop Sync Status, Settings Drawer & Screen Replacement Matrix
