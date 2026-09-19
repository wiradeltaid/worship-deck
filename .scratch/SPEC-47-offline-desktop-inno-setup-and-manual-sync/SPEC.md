# SPEC-47 — Offline Desktop Application with Inno Setup and On-Demand Manual Sync

> **Status:** open
> **Release:** offline-desktop-inno-setup-and-manual-sync
> **Component:** hub
> **Touches:** settings, db, pptx, services, uploads, artifacts
> **Depends on:** SPEC-45

## Problem Statement

Worship Presenter Web currently runs as a client-server web application (Go HTTP API + Vite React SPA + Node.js PPTX worker) that requires manual terminal orchestration (`go run` / `npm run dev`) or cloud hosting. Church environments introduce two major operational requirements:

1. **Uninterrupted Offline Worship Operation (Standalone Desktop App):**
   - Churches cannot rely on active internet connectivity during Sunday worship services. A dropped internet connection or cloud latency must never interrupt slide projection, lyrics rendering, or operator control.
   - Operators and volunteer technicians require a single, zero-friction installer (`Setup.exe`) generated via **Inno Setup** that installs on standard Windows 10/11 machines without pre-installing Go, Node.js, or Git.
   - The desktop runtime must run safely as a loopback server (`127.0.0.1`), avoid firewall prompts, manage single-instance lifecycles (prevent duplicate background servers), and keep user data (SQLite database, uploaded backgrounds, flyers) safe in `%LocalAppData%` across application updates.

2. **On-Demand Manual Bidirectional Data Sync (Local <-> Web):**
   - Pastors, worship leaders, and media teams often prepare service rundowns, songs, and announcement flyers in advance on a hosted web instance (e.g. from home or office).
   - On the church presentation PC, operators need to pull changes from the web server before the service starts. Conversely, edits made locally on the presentation PC (e.g. last-minute song pitch change, lyric adjustments, or local flyer uploads) must be pushable back to the web server.
   - **Crucial constraint:** Sync must be strictly **on-demand / on-action** (triggered manually via an explicit button click), NOT automatic background polling, periodic timers, or startup routines.
   - Current database schemas rely on `INTEGER PRIMARY KEY AUTOINCREMENT` for services, songs, and announcements, which collide when records are created independently offline. Deletions currently perform hard deletes, which causes deleted records to resurrect upon sync. Media assets in `data/uploads/` require content-addressed deduplication to prevent transferring megabytes of duplicate images over church Wi-Fi.

## Provenance & Architectural Foundation

This specification is grounded in the thorough architectural peer analysis conducted between **Composer** and **Terra** (GPT-5.6 Terra) recorded in `.work/offline-sync-discussion-prompt.txt`, `.work/terra-output.txt`, and session telemetry. Key tenets accepted from this review:
1. Replicate domain entities through an authenticated HTTP contract; **never copy raw SQLite database files**.
2. Isolate runtime application binaries (Program Files read-only) from persistent user data (`%LocalAppData%\WorshipPresenter\`).
3. Bundle an exact, pinned Node.js portable runtime for offline PPTX generation rather than attempting an unverified Go port.
4. Enforce strict single-instance mutual exclusion and loopback IPv4 binding (`127.0.0.1`).

## Solution

1. **Standalone Windows Desktop Packaging (Inno Setup):**
   - **Executable & Static Assets:** Ship `worship-presenter.exe` compiled from Go. The React SPA (`spa/dist`) is served directly by Go on loopback (`127.0.0.1`).
   - **Runtime Precedence & Port Discovery:** Configuration priority: 1. CLI flags (`--data-dir`, `--port`), 2. Env vars (`DATA_DIR`, `PORT`), 3. Defaults (`%LocalAppData%\WorshipPresenter` on Windows, port 3000). Server binds strictly to `127.0.0.1` (never `0.0.0.0`) to avoid Windows Firewall alert prompts. If port 3000 is occupied, it scans fallback range `3000-3010`.
   - **Single-Instance Mutex & Runtime Handshake:** Acquire per-user Windows Named Mutex (`Local\WorshipPresenter.<UserSID>`). The primary process writes its active URL to `%LocalAppData%\WorshipPresenter\runtime.json`. A second launch reads `runtime.json`, opens the default browser to that URL, and exits cleanly.
   - **Data Directory Isolation:** Read-only program binaries, SPA assets, and seed catalogs reside in `{app}` (`Program Files`). The active SQLite database (`data.db`, WAL, SHM), `uploads/`, logs, and local config reside in `%LocalAppData%\WorshipPresenter\`. Inno Setup updates overwrite `{app}` without touching `%LocalAppData%`.
   - **Node.js Portable PPTX Worker:** Bundle an official portable `node.exe` runtime (Win-x64, pinned LTS) and production `node_modules` under `{app}\runtime\`. Go executes the worker via absolute path `NODE_BIN={app}\runtime\node.exe` so PPTX generation works seamlessly on machines without global Node.js.

2. **On-Demand Bidirectional Sync Architecture:**
   - **Security & Pairing Contract:**
     - Web Admin generates a one-time 6-digit pairing code expiring in 10 minutes (`POST /api/sync/pair`).
     - Local Desktop enters pairing code; server issues an authenticated `device_token` scoped to `tenant_id` (`sync:write`).
     - Device token is stored locally via DPAPI or secure configuration file. Every sync request sends `Authorization: Bearer <device_token>` over HTTPS.
     - Web Admin can revoke device tokens at any time; revoked devices are immediately rejected with HTTP 401.
   - **Global Entity Identity (UUIDv7):** Introduce `global_id TEXT UNIQUE NOT NULL` (UUIDv7) across sync-participating tables: `services`, `service_registry_snapshots`, `announcement_items`, `announcement_sets`, `announcement_set_slides`, `hymns`, `song_set_entries`, `background_library_images`. Internal integer auto-increments remain for local queries, while sync protocols strictly reference `global_id`.
   - **Tombstone Change Tracking:** Implement `sync_tombstones(global_id, entity_type, deleted_at, source_rev)` so deletions propagate accurately without resurrecting zombie records.
   - **Optimistic Concurrency & Conflict Handling:** Track monotonic revision numbers (`rev`). Master data (hymns, templates) uses Last-Write-Wins based on server revisions. Critical service rundowns utilize an **Interactive Conflict Dialog** in the UI when concurrent edits occur on both sides, letting operators choose local, web, or duplicate saving.
   - **Save-Both Duplicate Rewiring:** When an operator chooses "Save Both", the conflicting local service receives a fresh UUIDv7 `global_id`, appends `(Copy)` to its title, and cleanly duplicates all child references.
   - **Content-Addressed Media Sync:** Assets (backgrounds, flyers, fonts) are synced via SHA256 content hashes:
     - `POST /api/sync/assets/check` exchanges manifests and returns missing hashes.
     - `POST /api/sync/assets/upload` uploads binary with `X-Content-SHA256` verification before atomic file promotion.
     - `GET /api/sync/assets/{sha256}` downloads missing binary assets with hash verification.
   - **Presenter Liveness Protection:** Sync writes are guarded against active presentation sessions. When Presenter mode is actively projecting to the congregation, full-apply sync is blocked/deferred with a 409 conflict and clear warning to protect live slide stability.

3. **DEC-047 Coexistence & Verified Non-Interference:**
   - Verified against `main-2` (`autopilot/DEC-047`): DEC-047 implements form layout and predefined field persistence (`form_layout.go`, `migrate_service_field_values.go`, `CreateForm.tsx`, `EditForm.tsx`).
   - SPEC-47 touches desktop launcher infrastructure (`cmd/api`), installer script (`installer/`), global identity schema (`internal/db/sync.go`), and sync HTTP endpoints (`internal/httpapi/sync.go`). Zero file or functional overlap exists.

## User Stories

1. As a church technician, I want to install Worship Presenter on a Windows church PC using a standard `Setup.exe` installer without needing developer tools or internet access during installation, so that the presentation workstation is ready to operate offline (satisfies `UC-1`).
2. As a church media operator, I want to click a "Pull from Web" button before the service to download the latest service schedule and flyers prepared by the worship team, so that the local presentation PC has the exact sermon notes and songs (satisfies `UC-5`).
3. As a worship leader editing slides on the local presentation PC, I want to click "Push to Web" after the service to upload our local lyric tweaks and rundown adjustments back to the cloud, so that our cloud archive is up-to-date (satisfies `UC-5`).
4. As an operator during live Sunday worship, I want the system to guard live projection against background sync mutations, so that incoming remote changes never alter slides unexpectedly on the congregation screen (satisfies `UC-11`, `UC-12`).

## Implementation Decisions

1. **Inno Setup Script Specification:**
   - Script path: `installer/worship-presenter.iss`.
   - `AppMutex=Local\WorshipPresenter.{#AppGuid}`.
   - `DefaultDirName={autopf}\Worship Presenter Web`.
   - `[UninstallDelete]` explicitly preserves user databases unless an interactive checkbox is explicitly selected.

2. **Sync Data Protocol Contract:**
   - `POST /api/sync/push`: Submits local outbox mutations tagged with unique `mutation_id` (UUIDv7) and `base_rev`. Server processes mutations idempotently.
   - `GET /api/sync/pull?cursor=<rev>`: Returns server change log entries after the specified revision cursor.
   - `POST /api/sync/assets/check`: Compares client and server SHA256 hashes; responds with missing hashes.
   - `POST /api/sync/assets/upload` and `GET /api/sync/assets/{sha256}`: Idempotent binary asset upload/download.

3. **Concurrency & Absence Guards:**
   - Local sync mutations write to SQLite using `BEGIN IMMEDIATE` within a dedicated transaction, respecting `busy_timeout=5000` and WAL mode.
   - Absence guard proofs: Prove test failure when `setInterval` or automatic background sync timers are introduced in the frontend.
   - Presenter guard proof: Trigger sync apply while active presentation channel is open, asserting HTTP 409 conflict with safe presentation status message.

## Testing & Human Smoke Decisions

- **Installer Smoke Test:** Test installation into a custom directory, verify `%LocalAppData%` database creation, verify single-instance mutex prevents second instance, and verify clean uninstallation without data loss.
- **Node Portable Isolation Guard:** Execute PPTX worker test with `PATH` cleared of global Node.js, ensuring `NODE_BIN={app}\runtime\node.exe` renders decks correctly.
- **Tombstone Deletion Proof:** Create record on local, sync to web, delete on local, sync again, verify record is marked deleted on web and does not reappear on local.
- **Idempotency Proof:** Re-send the exact same `mutation_id` push payload twice, proving zero duplicate records or errors.
- **Presenter Guard Proof:** Trigger sync apply while active presentation channel is open, asserting HTTP 409 conflict with safe presentation status message.
- **Absence Guard Proof:** Inject defect adding automatic polling timer; observe test failure; revert to green.
