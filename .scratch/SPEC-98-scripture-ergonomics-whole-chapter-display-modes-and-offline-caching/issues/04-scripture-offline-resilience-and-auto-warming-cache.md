# 04: Authoritative Offline Scripture Pre-Cache & Fail-Closed Resilience

**What to build:** In `src/lib/offline/service-snapshot.ts`, `src/operator/present/PresenterOperator.tsx`, and `src/components/offline/OfflineReadinessBadge.tsx`:

1. **Authoritative Service Scripture Pre-Cache Contract**:
   - In `src/lib/offline/service-snapshot.ts` (`warmServiceSnapshot`):
     - Scan canonical service data for scripture references:
       - `field_values.scripture_reference`
       - `field_values.theme_verse`
       - `parsed_data.theme_verse`
       - `parsed_data.verse_reading`
     - Resolve translation using service's configured translation or resolved system default.
     - Form canonical cache key: `${translation}:${canonicalBookId}:${chapter}:${verseStart}:${verseEnd}` (or `${translation}:${canonicalBookId}:${chapter}:ALL` for whole chapter).
     - Fetch passages and store in local `scripture_cache`.
     - Extend `OfflineReadiness` data structure:
       ```ts
       export type OfflineReadiness = {
         status: OfflineSnapshotStatus;
         total: number;
         cached: number;
         failed: number;
         message: string;
         scriptures?: { total: number; cached: number; failed: number };
       };
       ```
     - Offline Ready badge reflects overall readiness: green when all required media and service rundown scriptures are successfully cached.

2. **IndexedDB Store Migration (`scripture_cache`)**:
   - Bump IndexedDB schema in `src/lib/offline/service-snapshot.ts` (`DB_VERSION = 3`):
     - Create object store `scripture_cache` with key path `cache_key`.
     - Store schema:
       ```ts
       {
         cache_key: string;
         reference: string;
         translation: string;
         verses: Array<{ verse: number; text: string }>;
         text: string;
         cached_at: number;
       }
       ```
   - Provide typed helpers:
     - `cacheScripturePassage(entry: ScriptureCacheRecord): Promise<void>`
     - `getCachedScripturePassage(translation: string, canonicalKey: string): Promise<ScriptureCacheRecord | null>`

3. **Fail-Closed Fallback Semantics (Preserving SCN-4)**:
   - In `PresenterOperator.tsx:pushScripture`:
     - Online 200: cache result in `scripture_cache` asynchronously, then display/broadcast.
     - Network Error / `TypeError: Failed to fetch` / Server 5xx:
       - Query `getCachedScripturePassage`.
       - If hit: display and broadcast with calm informational toast: `"Ditampilkan dari cache offline"`.
       - If miss: fail closed with `t('presenter.scripture.lookupFailed')`.
     - HTTP 400 Bad Request / 404 Not Found:
       - **Fail closed immediately** without cache fallback (preserves `SCN-4` negative assertion).
   - Add automated test suite in `tests/scripture-offline-resilience.test.mjs`.

**Blocked by:** SPEC-98-03

**Status:** closed

- [x] Bump IndexedDB to v3 with `scripture_cache` object store in `service-snapshot.ts`.
- [x] Implement authoritative service scripture pre-fetching during `warmServiceSnapshot`.
- [x] Integrate scripture pre-fetch counts into `OfflineReadiness` and badge display.
- [x] Enforce fail-closed cache fallback semantics preserving SCN-4.
- [x] Verify seamless offline presentation when network connectivity is dropped.
