# 06: Content-Addressed Media Sync and Admin Sync UI

**What to build:**
Complete the media synchronization pipeline, conflict resolution interface, and operator UI:
1. Implement SHA256 content-addressing for media uploads (`/api/sync/assets/check` and `/api/sync/assets/{sha256}`):
   - Compare asset hash manifests between local and web.
   - Transfer only missing image/font binary hashes, preventing redundant bandwidth usage.
2. Build the Sync Management panel in the React SPA admin (`spa/src/pages/admin/SyncPage.tsx`):
   - Configuration for Remote Web URL and Pairing/API Key.
   - Status indicators showing Last Synced Timestamp, Pending Local Changes count, and Remote Updates available.
   - Two explicit trigger buttons: **"Push to Cloud"** and **"Pull from Cloud"** (on-demand only, never automatic background polling).
3. Build the Interactive Conflict Resolution dialog:
   - When a service rundown was edited concurrently on both local and web, show a comparison modal allowing the operator to choose "Keep Local Version", "Use Cloud Version", or "Save Both (Duplicate)".
4. Add comprehensive automated smoke tests in `tests/smoke-spec-47.test.mjs` and wire into `package.json`.

**Blocked by:** 03-inno-setup-installer-pipeline-and-data-preservation.md, 05-bidirectional-on-demand-delta-sync-engine-and-guards.md

**Status:** open

- [ ] Implement SHA256 media asset sync endpoints in Go API.
- [ ] Build React admin SyncPage with connection configuration and status indicators.
- [ ] Implement on-demand "Push to Cloud" and "Pull from Cloud" action buttons with loading/progress states.
- [ ] Build Interactive Conflict Resolution modal for service rundown collisions.
- [ ] Add `tests/smoke-spec-47.test.mjs` covering media sync deduplication, conflict modals, and absence guards.
- [ ] Wire `smoke:spec-47` script into `package.json`.
- [ ] Human verification check: Upload a large announcement flyer locally, click "Push to Cloud", verify it uploads; modify service in cloud and locally, click "Pull from Cloud", verify conflict modal pops up and correctly resolves.
