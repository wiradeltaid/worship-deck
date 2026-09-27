# SPEC-91 — Full-Fidelity Bidirectional Cloud Sync and Asset Hydration

## Requirement Traceability & Scope
- **PRD**: `offline-deck`, `operator-turn`
- **Architectural Decisions**:
  - `AD-30` (Three-Tier Architecture — Go HTTP API + Vite React SPA + Node.js PPTX worker)
  - `AD-31` (Artifact Registry — Admin-Configurable Structure and Slides)
  - `AD-33` (Free-Canvas Song-Set Layout Trio Seeding — Title, Verse, Reff roles)
- **Functional Requirements**:
  - `FR-40` (Manual Device Sync — Bidirectional Data and Asset Exchange between Local and Remote Instances)
  - `FR-21` (Offline Structure Survival across Restarts and Redeploy)
- **Components**: `hub`, `registry`
- **Touches**: `sync`, `artifacts`, `settings`

---

## Problem Statement

During manual verification of on-demand cloud sync (`/admin/sync`) on a freshly installed desktop instance, multiple data loss, asset corruption, and protocol asymmetry defects were discovered:

1. **Broken Media Gallery, Announcement Images, and Uploaded Photos (Missing Asset Hydration on Pull):**
   - In `spa/src/pages/AdminSyncPage.tsx`, `executePull` fetches database mutations via `pullSync(targetUrl)` and applies them locally via `pushSyncChunked(window.location.origin, applyPayload)`.
   - However, `executePull` never extracts the content-addressed hashes from the pulled entities, never calls `checkSyncAssets` against the local server, and never calls `downloadSyncAsset` to fetch the binary files from the remote server.
   - Consequently, local SQLite contains database rows referencing `/api/uploads/<sha256>.<ext>`, but the actual physical files in `./data/uploads/` do not exist on the local disk. When the operator navigates to the Media Gallery or views slides containing uploaded photos (Family of the Week, Youth of the Week, Announcement flyers), all image links fail with HTTP 404 errors.

2. **Asymmetric Asset Replication on Push:**
   - While `executePush` contains an asset check, it scans only legacy background images and announcement items. Assets referenced in services (`images_payload`, `parsed_data`), Announcement Sets, and custom slide payloads are never inspected or uploaded to the remote server, leaving remote instances with broken links when pushed from local.

3. **Omitted Modern Presentation Entities in Sync Protocol & Missing Global IDs:**
   - The sync mutation schema (`SyncMutations`) in `internal/httpapi/sync.go` and `src/lib/sync/client.ts` only synchronizes 5 legacy tables: `services`, `hymns`, `song_set_entries`, `background_library_images`, and `announcement_items`.
   - It completely omits the modern presentation architecture introduced in `DEC-004`, `SPEC-21`, and `SPEC-81`:
     - `announcement_sets`: table container for modern Announcement Sets. Currently lacks `global_id TEXT UNIQUE`.
     - `announcement_set_slides`: individual slides within announcement sets. Currently lacks `global_id TEXT UNIQUE` and foreign reference `ann_set_global_id`.
     - `artifact_templates`: master Deck Sequence ordering in Artifact Registry.
     - `service_registry_snapshots`: per-service snapshot of deck sequence.
     - `song_set_layouts` & `service_song_set_layouts`: custom Title/Verse/Reff slide layouts.
   - When pulling from cloud, the local desktop instance receives none of the cloud-configured announcement sets or deck sequences.

4. **Loss of Hidden Slide States and Emergency Local Patches:**
   - In `internal/httpapi/sync.go`, the SQL query fetching services (`sQuery`) omits `hidden_slide_ids` and `emergency_patches`.
   - On pull or push, hidden slide toggles and emergency local edits are dropped or reset to empty `[]`.

---

## Architecture & Detailed Solution

### 1. Database Schema Migration & Stable Relational Identity (`internal/db/`, `internal/httpapi/sync.go`)
- Schema Migration (`internal/db/migrate_sync_announcement_sets.go`):
  - Add `global_id TEXT UNIQUE` to `announcement_sets`.
  - Add `global_id TEXT UNIQUE` and `ann_set_global_id TEXT` to `announcement_set_slides`.
  - Backfill deterministic UUIDv7 global IDs for existing rows.
- Stable Relational Identity & Parent-First Ordering:
  - Parent entities are always inserted/upserted before child rows (`announcement_sets` before `announcement_set_slides`; `services` before `service_registry_snapshots`).
  - Cross-instance relations are resolved strictly via stable global identifiers (`global_id`, canonical `role` for layouts, `variable_name` for song set entries), never local auto-increment integer IDs.
- Service State Preservation:
  - Add `HiddenSlideIDs json.RawMessage` and `EmergencyPatches json.RawMessage` to `SyncService`.
  - Update `sQuery` in `syncPull` to select `COALESCE(hidden_slide_ids, '[]')` and `COALESCE(emergency_patches, '[]')`.
  - Persist both fields on upsert during push and pull.

### 2. Full-Fidelity Bidirectional Protocol Schema (`internal/httpapi/sync.go`, `src/lib/sync/client.ts`)
- Extend `SyncMutations` in both Go backend and TypeScript client:
  ```go
  type SyncMutations struct {
      Services                 []SyncService                 `json:"services"`
      Hymns                    []SyncHymn                    `json:"hymns"`
      SongSetEntries           []SyncSongSetEntry            `json:"song_set_entries"`
      BackgroundLibraryImages  []SyncBackgroundImage         `json:"background_library_images"`
      AnnouncementItems        []SyncAnnouncementItem        `json:"announcement_items"`
      AnnouncementSets         []SyncAnnouncementSet         `json:"announcement_sets"`
      AnnouncementSetSlides    []SyncAnnouncementSetSlide    `json:"announcement_set_slides"`
      ArtifactTemplates        []SyncArtifactTemplate        `json:"artifact_templates"`
      ServiceRegistrySnapshots []SyncServiceRegistrySnapshot `json:"service_registry_snapshots"`
      SongSetLayouts           []SyncSongSetLayout           `json:"song_set_layouts"`
      ServiceSongSetLayouts    []SyncServiceSongSetLayout    `json:"service_song_set_layouts"`
  }
  ```
- Tombstones & Deletion Semantics:
  - Track deletions for `announcement_sets`, `announcement_set_slides`, and `artifact_templates` in `sync_tombstones`.
  - Replicate tombstones bidirectionally to ensure deleted slides or sets are pruned on both peers.

### 3. Bidirectional Asset Hydration Pipeline (`spa/src/pages/AdminSyncPage.tsx`, `src/lib/sync/client.ts`)
- Universal Recursive Asset Extractor (`src/lib/sync/client.ts`):
  - Function `extractUploadHashes(payload: unknown): string[]`: Recursively scans arbitrary objects, arrays, and JSON strings for pattern `/api/uploads/([a-f0-9]{64})/i`.
- Push Pipeline (Local -> Remote):
  1. Extract all asset hashes from local mutations.
  2. Query `checkSyncAssets(remoteUrl, hashes)` to discover missing remote hashes.
  3. Upload missing bytes via `downloadSyncAsset(localUrl, hash)` -> `uploadSyncAsset(remoteUrl, buffer)`.
  4. Submit mutation payload to `pushSync(remoteUrl, payload)`.
- Pull Pipeline (Remote -> Local):
  1. Fetch remote mutations via `pullSync(remoteUrl)`.
  2. Extract all asset hashes from `remoteData.changes`.
  3. Query `checkSyncAssets(localUrl, hashes)` to discover missing local hashes.
  4. For each missing hash, download binary from `targetUrl` via `downloadSyncAsset(targetUrl, hash)` and verify SHA-256 checksum before committing to local `./data/uploads/` via `uploadSyncAsset(localUrl, buffer)`.
  5. Apply database mutations locally via `pushSyncChunked(localUrl, payload)` only after asset hydration succeeds or reports explicit recoverable status.

### 4. Automated Two-Direction Contract & Verification Tests (`tests/sync-full-fidelity-entities.test.mjs`, `tests/sync-asset-hydration.test.mjs`, `tests/sync-bidirectional-contract.test.mjs`, `package.json`)
- Registration in `package.json`:
  - Register all three test files in `"test"` script and dedicated `"smoke:spec-91"`.
- Two-Direction Contract Verification:
  - Test round-trip replication from Instance A -> Cloud -> Instance B, and reverse Instance B -> Cloud -> Instance A.
  - Verify exact checksum matching on physical files in `./data/uploads/`.
  - Verify intact preservation of `hidden_slide_ids` and `emergency_patches`.
  - Verify zero HTTP 404 errors on media gallery and presentation images.

---

## Ticket Breakdown

- **SPEC-91-01**: Schema Migration, Stable Global IDs, and Backend Sync Entity Protocol (`internal/db/migrate_sync_announcement_sets.go`, `internal/httpapi/sync.go`, `tests/sync-full-fidelity-entities.test.mjs`, `package.json`)
- **SPEC-91-02**: Bidirectional Asset Discovery and Hydration Pipeline (`spa/src/pages/AdminSyncPage.tsx`, `src/lib/sync/client.ts`, `tests/sync-asset-hydration.test.mjs`, `package.json`)
- **SPEC-91-03**: Two-Direction Round-Trip Contract & Absence Guard Verification (`tests/sync-bidirectional-contract.test.mjs`, `package.json`)
