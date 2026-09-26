# 02: Client-Side Service Snapshot & Auto-Warming Pre-Cache

**What to build:** Implement a robust client-side caching module in `lib/offline/service-snapshot.ts` and integrate it into `RunSheetPage`, `PresentPage`, and `ProjectorPage` to eliminate blank screens and redirect loops on network loss:
1. In `lib/offline/service-snapshot.ts`:
   - Define a lightweight IndexedDB store (`worship_deck_offline_db`) with object stores `service_snapshots` and `media_cache`.
   - Store full service payloads indexed by `serviceId`:
     - Fields: `id`, `plan`, `plan_identity`, `transition`, `raw_payload`, `parsed_data`, `field_values`, `images_payload`, `cached_at`, `status` (`'warming' | 'ready' | 'degraded'`).
   - Implement deep asset crawling `extractRequiredMediaUrls(serviceData)`:
     - Scans `serviceData.plan` items:
       1. Slide background URLs via `resolveEffectiveBackgroundImage`.
       2. Slide image elements via `resolveElementImage` for elements of type `image` and `image-placeholder`.
     - Scans `serviceData.images_payload`: `sermonGraphicUrl`, `familyPhotoUrl`, `youthPhotoUrl`, and `announcementInserts` array.
     - Deduplicates all unique non-empty HTTP/HTTPS/relative URLs.
   - Implement `warmServiceSnapshot(serviceId, serviceData)`:
     - If unique required media count is 0, set `status: 'ready'` immediately ("Offline Ready: All slides cached (0 external assets)").
     - For each media URL: fetches binary data with CORS fallback and stores blob in `media_cache` (or Cache Storage).
     - If all assets succeed: set `status: 'ready'`.
     - If any asset fails (timeout, network error, 404): set `status: 'degraded'` with the list of failed URLs.
   - Implement `resolveMediaUrl(url: string)`:
     - Checks `media_cache` for stored blob; returns `URL.createObjectURL(blob)` when present or offline.
     - Lifecycle memory management: track created Object URLs and provide `revokeMediaUrls()` on unmount or service switch to prevent browser memory leaks during multi-hour rehearsals.
   - Storage eviction policy:
     - Automatically retain active service plus up to 3 most recently cached services; purge older snapshots and orphaned media blobs to prevent unbounded IndexedDB growth.
   - Modular headless contract:
     - Keep `lib/offline/service-snapshot.ts` strictly headless and decoupled from form UI, exporting clean primitives (`warmServiceSnapshot`, `getServiceSnapshot`, `resolveMediaUrl`) so that future surfaces (such as the `/new` Workspace) can consume offline snapshot capabilities out-of-the-box.
2. In `spa/src/pages/RunSheetPage.tsx`:
   - When `/api/services/:id` is successfully fetched online, trigger `warmServiceSnapshot` in the background.
   - If `fetch('/api/services/:id')` fails due to network outage, fall back to `getServiceSnapshot(id)`: if found, set `svc` and render the Run Sheet with a prominent "Mode Offline — Membaca data tersimpan" banner instead of redirecting to `/`.
   - Render a calm Offline Readiness Indicator in the header action bar (green badge for ready, subtle spinner while warming, retry button on failure).
3. In `src/operator/present/PresenterOperator.tsx`:
   - Also render the Offline Readiness Indicator in the Presenter header chrome, maintaining status parity across both surfaces.
4. In `spa/src/pages/PresentPage.tsx` and `spa/src/pages/ProjectorPage.tsx`:
   - When fetching `/api/services/:id`, catch network failures and load from `getServiceSnapshot(id)`.
   - If snapshot exists, boot `PresenterOperator` and `ProjectorClient` immediately without redirecting to `/` or rendering `ProjectedError`.
5. In `tests/offline-service-snapshot.test.mjs`:
   - Test deep asset extraction from slide plans (backgrounds, image elements, announcement inserts).
   - Test zero-media service readiness resolution.
   - Test IndexedDB storage, retrieval, and LRU eviction of old snapshots.
   - Test Object URL revocation cleanup.
   - Test fallback behavior in Presenter and Projector when network fetch throws.
   - Include absence/injection test proving that deleting the snapshot fallback causes a missing-data redirect.

Satisfies `FR-14`, `FR-16`, `FR-19`, and `UC-20`.

**Blocked by:** `SPEC-84-01`

**Status:** closed

- [x] Read `src/lib/slide-plan.ts`, `spa/src/pages/RunSheetPage.tsx`, `src/operator/present/PresenterOperator.tsx`, `spa/src/pages/PresentPage.tsx`, and `spa/src/pages/ProjectorPage.tsx`.
- [x] In `lib/offline/service-snapshot.ts`:
      - Implement IndexedDB database initialization (`openOfflineDb`).
      - Implement `extractRequiredMediaUrls(serviceData)`.
      - Implement `warmServiceSnapshot(serviceId, serviceData)` with progress callbacks and zero-media handling.
      - Implement `getServiceSnapshot(serviceId)` with LRU eviction.
      - Implement `resolveMediaUrl(url)` with `revokeMediaUrls()` cleanup.
- [x] In `spa/src/pages/RunSheetPage.tsx`:
      - Wire auto-warming effect on successful service load.
      - Add network-error catch falling back to `getServiceSnapshot`.
      - Add readiness indicator badge in header actions.
- [x] In `src/operator/present/PresenterOperator.tsx`:
      - Add readiness indicator badge in header chrome.
- [x] In `spa/src/pages/PresentPage.tsx` and `spa/src/pages/ProjectorPage.tsx`:
      - Add fallback to `getServiceSnapshot` on network failure.
- [x] In `tests/offline-service-snapshot.test.mjs`:
      - Unit test for media extraction and snapshot serialization.
      - Integration test verifying Presenter/Projector data hydration from offline snapshot.
      - Test eviction and URL revocation.
      - Inject defect and prove absence guard fails.
- [x] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/offline-service-snapshot.test.mjs` and `npm run typecheck`.
