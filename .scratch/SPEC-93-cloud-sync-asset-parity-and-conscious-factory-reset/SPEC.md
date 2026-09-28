# SPEC-93 — Cloud Sync Asset Hydration Parity and Conscious Factory Reset

## Requirement Traceability & Scope
- **PRD**: `offline-deck`, `operator-turn`
- **Architectural Decisions**:
  - `AD-17` (narrowed by `DEC-078` and `DEC-080`: Administrator Factory Reset Operation)
  - `AD-30` (Three-Tier Architecture — Go HTTP API + Vite React SPA + Node.js PPTX worker)
  - `AD-31` (Artifact Registry — Admin-Configurable Structure and Slides)
  - `AD-33` (Free-Canvas Song-Set Layout Trio Seeding — Title, Verse, Reff roles)
  - `DEC-078` (superseded by `DEC-080`)
  - `DEC-080` (Dual-Mode Asset Identity Protocol and Conscious Factory Reset Confirmation)
- **Functional Requirements**:
  - `FR-20` (Offline Presentation Capability)
  - `FR-21` (Offline Structure Survival across Restarts and Redeploy)
  - `FR-40` (Manual Device Sync — Bidirectional Data and Asset Exchange between Local and Remote Instances)
- **Use Cases**:
  - `UC-14`, `UC-15` (Artifact Management & Seed Baseline)
  - `UC-32` (Manual Device Data Sync)
- **Components**: `hub`, `registry`
- **Touches**: `artifacts`, `settings`, `sync`

---

## Problem Statement

During hand-testing of cloud synchronization (pull from `presenter-dev.bic.my.id`) and administrative maintenance on desktop workstations, two critical usability and correctness issues were identified:

1. **Failure of Media Asset Hydration during Pull and Push (`Degraded: 26 assets failed`):**
   - In `internal/httpapi/uploads.go`, user-uploaded files have historically been named using 16-byte random hex:
     `hex.EncodeToString(rand(16)) + ext` -> e.g. `34645da1a600f8824686c0ae7104bc1d.png` (32 hex characters).
   - In production databases (`presenter-dev.bic.my.id`), 100% of uploaded images in `background_library_images`, `services`, and `service_song_set_layouts` use these 32-hex tokens.
   - However, the cloud sync protocol in SPEC-91 and SPEC-92 was implemented assuming content-addressed SHA-256 (64 hex characters):
     - `extractUploadHashes` in `src/lib/sync/client.ts` was restricted to `/\/api\/uploads\/([a-f0-9]{64})\.[a-z0-9]+/gi`.
     - `sha256Regex` in `internal/httpapi/sync_assets.go` enforced `^[a-fA-F0-9]{64}$`.
   - Consequently, when pulling from the cloud, **zero assets are extracted**. The SQLite metadata rows are applied locally, but zero physical files are downloaded to `data/uploads/`.
   - When the user opens Edit Service or Presenter deck sequence, all image requests return HTTP 404. `OfflineReadinessBadge` displays `Degraded: 26 assets failed`, slide backgrounds do not render, and the Media Gallery is empty.
   - Furthermore, `AdminSyncPage.tsx` lines 215 and 295 assert `actualSha === missingHash`. Since `missingHash` for legacy assets is the 32-hex random token, this assertion throws a fatal `checksum mismatch` if 32-hex hashes are passed without dual-mode verification.
   - Additionally, when `uploadSyncAsset` calls `/api/sync/assets/upload` without preserving the original filename extension, the server saves files as `<hash>.bin`, breaking references to `<hash>.png`.

2. **Accidental Trigger Risk on Factory Reset & Stale Client-Side Cache Resurfacing:**
   - In `AdminSyncPage.tsx`, the Factory Reset modal currently provides only a standard Cancel/Confirm dialog.
   - Because factory reset is an irreversible destructive operation wiping all local services, custom templates, and dynamic schedules, operators requested a **conscious confirmation textbox** requiring the user to type `"factory reset"` before the destructive button is enabled (consistent with standard high-consequence administrative patterns).
   - Moreover, `handleFactoryReset` only calls `POST /api/admin/reset-factory` and reloads the window. It does **not purge IndexedDB** (`worship_deck_offline_db` in `src/lib/offline/service-snapshot.ts`), leaving pre-reset service snapshots and media cache blobs alive in the browser, risking resurrection of obsolete cached slide content.

---

## Solution

1. **Dual-Mode Asset Identity Protocol & Write-Path Content-Addressing (`DEC-080`)**:
   - **Write-Path Modernization (`internal/httpapi/uploads.go`)**:
     - Update `writeUpload` so newly uploaded files are named using their content SHA-256 (`actualSha256 + ext`).
     - Deduplicate uploads: if a file with the same content hash already exists in `uploadsDir()`, reuse it.
     - Preserves full backward-compatibility for existing 32-hex files via `getUpload`.
   - **Discrete Identifier Endpoint Validation (`internal/httpapi/sync_assets.go`)**:
     - Enforce discrete identifier lengths: exactly 32 or 64 hex characters via `^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{64})$`.
     - Reject ambiguous lengths (e.g. 31, 33, 63, 65 chars) with HTTP 400 Bad Request.
     - In `syncAssetUpload`, accept `filename` query param or header, validate it is a pure basename (preventing path traversal `..`, `/`, `\`), and verify its stem matches the declared identifier.
     - For 64-character identifiers, server computes SHA-256 of received body and rejects mismatches.
     - In `findAssetBySHA256`: require exact basename match (`<identifier>.<allowed-ext>`), eliminating ambiguous prefix matching.
   - **Dual-Mode Asset Extraction (`src/lib/sync/client.ts`)**:
     - Broaden `uploadPathRegex` to match both `/api/uploads/` and `/uploads/`:
       `/(?:\/api)?\/uploads\/((?:[a-f0-9]{32}|[a-f0-9]{64}))\.([a-z0-9]+)/gi`.
     - Return structured asset metadata `{ hash: string, filename: string, extension: string }` while strictly ignoring non-upload digests (`seed_hash`, `content_hash`, and entity UUIDs).
   - **Hydration Parity & Checksum Verification (`spa/src/pages/AdminSyncPage.tsx`)**:
     - For 64-hex hashes: perform cryptographic SHA-256 verification (`actualSha === missingHash`).
     - For 32-hex legacy tokens: verify buffer length `> 0`, pass original filename with extension to `uploadSyncAsset`, and persist file on disk under its original name.
     - Symmetrical push hydration: extract and upload local assets to remote before pushing mutations.
     - **Outcome Fidelity**: If any referenced media asset fails to transfer, the sync result must be explicitly reported as degraded/incomplete with a breakdown of missing items and a retry button, never reported as a clean success.

2. **Conscious Confirmation Modal & Client-Side Cache Purge (`DEC-080`)**:
   - **Conscious Confirmation Input**:
     - In `AdminSyncPage.tsx`, add an `<Input>` inside the Factory Reset modal requiring the user to type `"factory reset"` (case-insensitive, trimmed).
     - Display localized instruction copy matching the operator request: `"Type: factory reset to begin resetting"` / `"Ketik: factory reset untuk memulai reset"`.
     - Keep the destructive "Reset to Factory Defaults" button strictly disabled until the exact phrase matches.
   - **Mandatory Server-Side Validation**:
     - In `internal/httpapi/admin_reset.go`, require a JSON body containing `{ "confirm": "factory reset" }`. Return HTTP 400 Bad Request if missing, empty, or mismatched.
   - **Client-Side Cache Purge with Blocking Remediation**:
     - In `handleFactoryReset`, execute `await clearOfflineStorage()` (clearing `service_snapshots`, `media_cache`, and `emergency_outbox` in IndexedDB `worship_deck_offline_db`) with fallback to `indexedDB.deleteDatabase('worship_deck_offline_db')`.
     - If the cache purge fails, block the reload and present an explicit remediation error rather than reloading into a stale resurrected cache state.

---

## User Stories

1. As an operator pulling church services from the cloud, I want all background images and flyers to download automatically to my desktop, so that slides and the Media Gallery render completely without 404 errors or `Degraded: 26 assets failed` warnings.
2. As an operator creating a service with newly uploaded local photos on a desktop workstation and pushing to cloud, I want the binary files to upload alongside the service records, so that remote church instances also have the media.
3. As an administrator performing a factory reset, I want to be prompted to type `"factory reset"` before the reset executes, so that I never trigger an irreversible database wipe by an accidental click.
4. As an administrator after a factory reset, I want the browser's offline IndexedDB cache to be completely cleared, so that old deleted services and stale media blobs cannot resurface.

---

## Implementation Decisions

- **Discrete Dual-Mode Asset Identity**: Strictly accept only 32-hex legacy random tokens or 64-hex content-addressed digests (`(?:[a-f0-9]{32}|[a-f0-9]{64})`). Write-path uploads generate 64-hex SHA-256 names going forward.
- **Filename Stem & Traversal Safety**: Asset upload requests must include the original filename with extension (`?filename=<name>.<ext>`) whose stem matches the declared identifier, ensuring safe basename storage without `.bin` fallback.
- **Integrity Assertion Branching**: `actualSha === missingHash` applies strictly to 64-hex hashes; 32-hex legacy tokens verify non-empty buffer transfer and matching filename identity.
- **Mandatory Server Reset Gate**: `POST /api/admin/reset-factory` requires JSON body `{ "confirm": "factory reset" }`, returning 400 on absence or mismatch.
- **Client Cache Purge Ordering**: `clearOfflineStorage()` must be successfully resolved before `window.location.reload()` is invoked.

---

## Testing Decisions

- `tests/sync-asset-endpoints.test.mjs`:
  - Assert `GET /api/sync/assets/{hash}` and `POST /api/sync/assets/check` accept 32-hex and 64-hex parameters, rejecting 31, 33, 63, and 65-char values.
  - Assert `POST /api/sync/assets/upload?filename=foo.png` creates `foo.png` with original extension, rejecting directory traversal attempts (`../`) and stem mismatches.
  - Assert `writeUpload` in `uploads.go` generates SHA-256 filenames for newly uploaded content.
- `tests/sync-client-dual-hash.test.mjs`:
  - Assert `extractUploadHashes` captures 32-hex and 64-hex upload paths from both `/api/uploads/` and `/uploads/`.
  - Assert `extractUploadHashes` strictly ignores `seed_hash`, `content_hash`, and entity UUIDs.
- `tests/admin-sync-asset-parity.test.mjs`:
  - Assert simulation of pull asset hydration handles 32-hex legacy files without checksum mismatch errors and verifies physical file availability on disk.
  - Assert push asset hydration extracts and uploads local assets before pushing mutations.
  - Assert sync with missing referenced assets reports incomplete/degraded status, never false success.
- `tests/conscious-factory-reset.test.mjs`:
  - Assert AdminSyncPage factory reset button is disabled until `"factory reset"` is input.
  - Assert `POST /api/admin/reset-factory` returns 400 when confirm body is missing or mismatched.
  - Assert `clearOfflineStorage()` is called upon factory reset and blocks reload on failure.
  - Assert AdminSyncPage factory reset button is disabled until `"factory reset"` is entered.
  - Assert `clearOfflineStorage()` is called upon factory reset.
  - Assert server `POST /api/admin/reset-factory` validates confirmation.
