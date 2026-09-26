/**
 * Service Snapshot & Auto-Warming Pre-Cache for Offline Presentation Resilience.
 *
 * Implements lightweight client-side IndexedDB caching (`worship_deck_offline_db`)
 * storing service plans and binary media assets so that presentation on stage
 * (Presenter & Projector) continues without interruption during network dropouts.
 *
 * Conforms to SPEC-84 requirements:
 * - Deep asset traversal across slide backgrounds and image elements.
 * - Zero-media immediate readiness resolution.
 * - LRU retention of up to 4 services (active + 3 most recent).
 * - Object URL lifecycle management with explicit revocation.
 * - Robust in-memory fallback for headless/test environments where IndexedDB is unavailable.
 */

import { resolveEffectiveBackgroundImage } from '@/lib/artifacts/render-model';

export type OfflineSnapshotStatus = 'warming' | 'ready' | 'degraded';

export type OfflineServiceSnapshot = {
  id: string;
  plan?: any[];
  plan_identity?: string;
  transition?: string;
  raw_payload?: any;
  parsed_data?: any;
  field_values?: any;
  images_payload?: any;
  cached_at: number;
  status: OfflineSnapshotStatus;
  total_assets?: number;
  cached_assets?: number;
  failed_assets?: string[];
  [key: string]: any;
};

export type OfflineReadiness = {
  status: OfflineSnapshotStatus;
  total: number;
  cached: number;
  failed: number;
  message: string;
};

export type ReadinessListener = (readiness: OfflineReadiness) => void;
const readinessListeners = new Map<string, Set<ReadinessListener>>();

/**
 * Normalizes service IDs across numeric and string representations (e.g. 123 -> "123").
 */
export function normalizeServiceId(id: string | number | undefined | null): string {
  if (id === undefined || id === null) return '';
  return String(id).trim();
}

/**
 * Subscribes a listener to real-time auto-warming progress and readiness transitions for a service.
 */
export function subscribeServiceReadiness(
  serviceId: string | number,
  listener: ReadinessListener
): () => void {
  const key = normalizeServiceId(serviceId);
  let set = readinessListeners.get(key);
  if (!set) {
    set = new Set();
    readinessListeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) readinessListeners.delete(key);
  };
}

export const DB_NAME = 'worship_deck_offline_db';
export const DB_VERSION = 2;
const SNAPSHOT_STORE = 'service_snapshots';
const MEDIA_STORE = 'media_cache';
const OUTBOX_STORE = 'emergency_outbox';
const MAX_CACHED_SERVICES = 4;

let cacheEpoch = 0;

export function getCacheEpoch(): number {
  return cacheEpoch;
}

export type EmergencyPatchRecord = {
  id?: number;
  serviceId: string;
  basePlanIdentity: string;
  patchRevision: number;
  patchTimestamp: number;
  slideIndex: number;
  originalText: string;
  originalArtifact?: any;
  updatedText: string;
  patchedArtifact: any;
};

// In-memory fallback stores for non-browser/test environments
const inMemorySnapshots = new Map<string, OfflineServiceSnapshot>();
const inMemoryMedia = new Map<string, Blob>();
const activeObjectUrls = new Set<string>();
const inMemoryOutbox: EmergencyPatchRecord[] = [];

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error('IndexedDB is not available in this environment'));
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE, { keyPath: 'url' });
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Extracts all unique required media URLs from a service payload.
 *
 * Scans:
 * 1. Slide backgrounds via `resolveEffectiveBackgroundImage` or `layout.backgroundImage`
 * 2. Slide image elements (type 'image' or 'image-placeholder')
 * 3. Top-level images_payload (sermonGraphicUrl, familyPhotoUrl, youthPhotoUrl, announcementInserts)
 */
export function extractRequiredMediaUrls(serviceData: any): string[] {
  if (!serviceData || typeof serviceData !== 'object') {
    return [];
  }

  const urls = new Set<string>();

  const addValidUrl = (raw: unknown) => {
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.length > 0 && !trimmed.startsWith('data:') && !trimmed.startsWith('blob:')) {
        urls.add(trimmed);
      }
    }
  };

  // 1 & 2. Plan items traversal
  const plan = Array.isArray(serviceData.plan) ? serviceData.plan : [];
  for (const item of plan) {
    const artifact = item?.artifact;
    if (artifact && typeof artifact === 'object') {
      // Background image
      try {
        const bg = resolveEffectiveBackgroundImage(artifact);
        if (bg) addValidUrl(bg);
      } catch {
        if (artifact.layout?.backgroundImage) {
          addValidUrl(artifact.layout.backgroundImage);
        }
      }

      // Elements
      const elements = Array.isArray(artifact.layout?.elements) ? artifact.layout.elements : [];
      for (const el of elements) {
        if (el && typeof el === 'object') {
          if (el.type === 'image' || el.type === 'image-placeholder') {
            if (el.imageUrl) addValidUrl(el.imageUrl);
            if (el.content) addValidUrl(el.content);
            if (el.src) addValidUrl(el.src);
          }
        }
      }
    }
  }

  // 3. images_payload
  const imgPayload = serviceData.images_payload;
  if (imgPayload && typeof imgPayload === 'object') {
    addValidUrl(imgPayload.sermonGraphicUrl);
    addValidUrl(imgPayload.familyPhotoUrl);
    addValidUrl(imgPayload.youthPhotoUrl);

    if (Array.isArray(imgPayload.announcementInserts)) {
      for (const insert of imgPayload.announcementInserts) {
        if (typeof insert === 'string') {
          addValidUrl(insert);
        } else if (insert && typeof insert.url === 'string') {
          addValidUrl(insert.url);
        }
      }
    }
  }

  return Array.from(urls);
}

/**
 * Saves a service snapshot into IndexedDB (or in-memory store) with LRU eviction.
 */
export async function saveServiceSnapshot(
  snapshot: OfflineServiceSnapshot,
  generation?: number,
  epoch?: number
): Promise<boolean> {
  const normId = normalizeServiceId(snapshot.id);
  // Atomic generation & epoch guard: reject stale generation or post-logout commits
  if (epoch !== undefined && cacheEpoch !== epoch) {
    return false;
  }
  if (generation !== undefined && warmingGenerationMap.get(normId) !== generation) {
    return false;
  }

  const record: OfflineServiceSnapshot = {
    ...snapshot,
    id: normId,
    cached_at: snapshot.cached_at || Date.now(),
  };

  if (isIndexedDBAvailable()) {
    try {
      const db = await openDb();
      // Re-check generation and epoch immediately before committing transaction
      if (epoch !== undefined && cacheEpoch !== epoch) {
        return false;
      }
      if (generation !== undefined && warmingGenerationMap.get(normId) !== generation) {
        return false;
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
        const store = tx.objectStore(SNAPSHOT_STORE);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });

      // Update in-memory fallback ONLY after successful commit
      if (epoch === undefined || cacheEpoch === epoch) {
        inMemorySnapshots.set(normId, record);
      }

      // Eviction policy: retain up to MAX_CACHED_SERVICES and sweep orphaned media
      await evictOldSnapshots(db);
    } catch {
      if (epoch === undefined || cacheEpoch === epoch) {
        inMemorySnapshots.set(normId, record);
      }
      await evictOldSnapshots(null);
    }
  } else {
    if (epoch === undefined || cacheEpoch === epoch) {
      inMemorySnapshots.set(normId, record);
    }
    await evictOldSnapshots(null);
  }

  return true;
}

/**
 * Retrieves a service snapshot from IndexedDB or in-memory fallback,
 * refreshing recency (LRU access time update) so actively viewed services survive eviction.
 */
export async function getServiceSnapshot(
  serviceId: string | number
): Promise<OfflineServiceSnapshot | null> {
  const normId = normalizeServiceId(serviceId);
  if (!normId) return null;
  const epoch = cacheEpoch;

  let snapshot: OfflineServiceSnapshot | null = null;

  if (isIndexedDBAvailable()) {
    try {
      const db = await openDb();
      if (cacheEpoch !== epoch) return null;

      snapshot = await new Promise<OfflineServiceSnapshot | null>((resolve, reject) => {
        const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
        const store = tx.objectStore(SNAPSHOT_STORE);
        const req = store.get(normId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      // fall back to in-memory store
    }
  }

  if (cacheEpoch !== epoch) return null;

  if (!snapshot) {
    snapshot = inMemorySnapshots.get(normId) || null;
  }

  if (snapshot) {
    // True LRU recency update: refresh access timestamp and await transaction commit
    if (cacheEpoch !== epoch) return null;
    snapshot.cached_at = Date.now();
    if (isIndexedDBAvailable()) {
      try {
        const db = await openDb();
        if (cacheEpoch !== epoch) return null;
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
          tx.objectStore(SNAPSHOT_STORE).put(snapshot);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      } catch {
        // ignore update errors
      }
    }
    if (cacheEpoch !== epoch) return null;
    inMemorySnapshots.set(normId, snapshot);
    return snapshot;
  }

  return null;
}

/**
 * Evicts oldest snapshots if count exceeds MAX_CACHED_SERVICES and sweeps orphaned media.
 */
async function evictOldSnapshots(db: IDBDatabase | null): Promise<void> {
  let survivingSnapshots: OfflineServiceSnapshot[] = [];

  if (db && isIndexedDBAvailable()) {
    try {
      const snapshots = await new Promise<OfflineServiceSnapshot[]>((resolve, reject) => {
        const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
        const store = tx.objectStore(SNAPSHOT_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      let toDelete: OfflineServiceSnapshot[] = [];
      if (snapshots.length > MAX_CACHED_SERVICES) {
        snapshots.sort((a, b) => (a.cached_at || 0) - (b.cached_at || 0));
        toDelete = snapshots.slice(0, snapshots.length - MAX_CACHED_SERVICES);
        survivingSnapshots = snapshots.slice(snapshots.length - MAX_CACHED_SERVICES);
      } else {
        survivingSnapshots = snapshots;
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([SNAPSHOT_STORE, MEDIA_STORE], 'readwrite');
        const deletedMediaUrls: string[] = [];

        tx.oncomplete = () => {
          // Strictly commit in-memory deletions only after IndexedDB transaction successfully commits
          for (const item of toDelete) {
            inMemorySnapshots.delete(item.id);
          }
          for (const urlStr of deletedMediaUrls) {
            inMemoryMedia.delete(urlStr);
          }
          resolve();
        };
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));

        const snapStore = tx.objectStore(SNAPSHOT_STORE);
        for (const item of toDelete) {
          snapStore.delete(item.id);
        }

        // Garbage-collect orphaned media across all retained snapshots
        const survivingUrls = new Set<string>();
        for (const s of survivingSnapshots) {
          for (const u of extractRequiredMediaUrls(s)) {
            survivingUrls.add(u);
          }
        }
        // Protect pending media belonging to active in-progress warming jobs
        for (const u of activeWarmingMediaClaims.keys()) {
          survivingUrls.add(u);
        }

        const mediaStore = tx.objectStore(MEDIA_STORE);
        const allMediaKeysReq = mediaStore.getAllKeys();
        allMediaKeysReq.onsuccess = () => {
          const keys = allMediaKeysReq.result || [];
          for (const key of keys) {
            const urlStr = String(key);
            if (!survivingUrls.has(urlStr) && !activeWarmingMediaClaims.has(urlStr)) {
              mediaStore.delete(key);
              deletedMediaUrls.push(urlStr);
            }
          }
        };
        allMediaKeysReq.onerror = () => {
          try {
            tx.abort();
          } catch {
            reject(allMediaKeysReq.error);
          }
        };
      });
    } catch {
      // Ignore eviction errors
    }
  }

  // Also sweep in-memory snapshots and orphaned media
  let inMemorySurviving: OfflineServiceSnapshot[] = [];
  if (inMemorySnapshots.size > MAX_CACHED_SERVICES) {
    const list = Array.from(inMemorySnapshots.values());
    list.sort((a, b) => (a.cached_at || 0) - (b.cached_at || 0));
    const toDelete = list.slice(0, list.length - MAX_CACHED_SERVICES);
    inMemorySurviving = list.slice(list.length - MAX_CACHED_SERVICES);
    for (const d of toDelete) {
      inMemorySnapshots.delete(d.id);
    }
  } else {
    inMemorySurviving = Array.from(inMemorySnapshots.values());
  }

  const memorySurvivingUrls = new Set<string>();
  for (const s of inMemorySurviving) {
    for (const u of extractRequiredMediaUrls(s)) {
      memorySurvivingUrls.add(u);
    }
  }
  for (const u of activeWarmingMediaClaims.keys()) {
    memorySurvivingUrls.add(u);
  }
  for (const url of Array.from(inMemoryMedia.keys())) {
    if (!memorySurvivingUrls.has(url)) {
      inMemoryMedia.delete(url);
    }
  }
}

// Active pending media claims: maps URL -> count of active warming jobs referencing it
const activeWarmingMediaClaims = new Map<string, number>();

export function getActiveWarmingMediaClaimsCount(): number {
  return activeWarmingMediaClaims.size;
}

export function claimWarmingMedia(urls: string[]): void {
  for (const url of urls) {
    if (url && typeof url === 'string') {
      activeWarmingMediaClaims.set(url, (activeWarmingMediaClaims.get(url) || 0) + 1);
    }
  }
}

/**
 * Sweeps media blobs from both IndexedDB and in-memory stores that are no longer
 * referenced by any currently retained service snapshot.
 */
export async function sweepAllStorageMedia(): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      const db = await openDb();
      await evictOldSnapshots(db);
      return;
    } catch {
      // fallback
    }
  }
  await evictOldSnapshots(null);
}

export function releaseWarmingMedia(urls: string[]): void {
  for (const url of urls) {
    if (url && typeof url === 'string') {
      const current = activeWarmingMediaClaims.get(url) || 0;
      if (current <= 1) {
        activeWarmingMediaClaims.delete(url);
      } else {
        activeWarmingMediaClaims.set(url, current - 1);
      }
    }
  }
  // Follow-up sweep: trigger safe sweep of unreferenced media across both IndexedDB and memory
  sweepAllStorageMedia().catch(() => {});
}

export function clearInMemoryOfflineStore(): void {
  cacheEpoch++;
  warmingGenerationMap.clear();
  revokeMediaUrls();
  inMemorySnapshots.clear();
  inMemoryMedia.clear();
  inMemoryOutbox.length = 0;
  activeWarmingMediaClaims.clear();
}

/**
 * Completely purges all offline snapshots, cached media blobs, and emergency outbox
 * across both IndexedDB and in-memory stores (e.g. on operator logout on shared PCs).
 */
export async function clearOfflineStorage(): Promise<void> {
  clearInMemoryOfflineStore();
  if (isIndexedDBAvailable()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([SNAPSHOT_STORE, MEDIA_STORE, OUTBOX_STORE], 'readwrite');
        tx.objectStore(SNAPSHOT_STORE).clear();
        tx.objectStore(MEDIA_STORE).clear();
        tx.objectStore(OUTBOX_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch {
      // ignore storage errors
    }
  }
}

export function getActiveObjectUrlCount(): number {
  return activeObjectUrls.size;
}

export function getCachedMediaCount(): number {
  return inMemoryMedia.size;
}

const warmingGenerationMap = new Map<string, number>();

/**
 * Returns the current active warming generation sequence for a service ID.
 */
export function getWarmingGeneration(serviceId: string | number): number {
  return warmingGenerationMap.get(normalizeServiceId(serviceId)) || 0;
}

/**
 * Pre-warms and caches all assets for a given service.
 * Monotonically tracks warming generations per service ID to ensure older concurrent
 * warming jobs cannot overwrite newer service snapshots or publish stale progress.
 */
export async function warmServiceSnapshot(
  serviceId: string | number,
  serviceData: any,
  onProgress?: (progress: OfflineReadiness) => void
): Promise<OfflineReadiness> {
  const normId = normalizeServiceId(serviceId);
  const epoch = cacheEpoch;
  const currentGen = (warmingGenerationMap.get(normId) || 0) + 1;
  warmingGenerationMap.set(normId, currentGen);

  const mediaUrls = extractRequiredMediaUrls(serviceData);
  const total = mediaUrls.length;

  claimWarmingMedia(mediaUrls);
  try {
    if (total === 0) {
      const readyState: OfflineReadiness = {
        status: 'ready',
        total: 0,
        cached: 0,
        failed: 0,
        message: 'Offline Ready (0 external assets)',
      };
      if (cacheEpoch !== epoch || warmingGenerationMap.get(normId) !== currentGen) {
        return readyState;
      }
      const saved = await saveServiceSnapshot(
        {
          ...serviceData,
          id: normId,
          cached_at: Date.now(),
          status: 'ready',
          total_assets: 0,
          cached_assets: 0,
          failed_assets: [],
        },
        currentGen,
        epoch
      );
      if (!saved || cacheEpoch !== epoch || warmingGenerationMap.get(normId) !== currentGen) {
        return readyState;
      }
      onProgress?.(readyState);
      const listeners = readinessListeners.get(normId);
      if (listeners) {
        for (const listener of listeners) {
          try {
            listener(readyState);
          } catch {
            // ignore
          }
        }
      }
      return readyState;
    }

    let cachedCount = 0;
    const failedUrls: string[] = [];

    const notify = (status: OfflineSnapshotStatus, failed: number) => {
      const state: OfflineReadiness = {
        status,
        total,
        cached: cachedCount,
        failed,
        message:
          status === 'ready'
            ? total === 0
              ? 'Offline Ready (0 external assets)'
              : `Offline Ready: ${cachedCount}/${total} assets`
            : status === 'warming'
            ? `Warming: ${cachedCount}/${total} assets`
            : `Degraded: ${failed} assets failed`,
      };
      if (cacheEpoch !== epoch || warmingGenerationMap.get(normId) !== currentGen) {
        return state;
      }
      onProgress?.(state);
      const listeners = readinessListeners.get(normId);
      if (listeners) {
        for (const listener of listeners) {
          try {
            listener(state);
          } catch {
            // ignore
          }
        }
      }
      return state;
    };

    notify('warming', 0);

    for (const url of mediaUrls) {
      if (cacheEpoch !== epoch || warmingGenerationMap.get(normId) !== currentGen) {
        break;
      }
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const blob = await res.blob();
        // Check generation and epoch again immediately before committing blob
        if (cacheEpoch !== epoch || warmingGenerationMap.get(normId) !== currentGen) {
          break;
        }
        const savedBlob = await saveMediaBlob(url, blob, epoch);
        if (!savedBlob || cacheEpoch !== epoch || warmingGenerationMap.get(normId) !== currentGen) {
          break;
        }
        cachedCount++;
        notify('warming', failedUrls.length);
      } catch {
        failedUrls.push(url);
      }
    }

    const finalStatus: OfflineSnapshotStatus = failedUrls.length === 0 ? 'ready' : 'degraded';
    const finalState = notify(finalStatus, failedUrls.length);

    if (cacheEpoch === epoch && warmingGenerationMap.get(normId) === currentGen) {
      await saveServiceSnapshot(
        {
          ...serviceData,
          id: normId,
          cached_at: Date.now(),
          status: finalStatus,
          total_assets: total,
          cached_assets: cachedCount,
          failed_assets: failedUrls,
        },
        currentGen,
        epoch
      );
    }

    return finalState;
  } finally {
    releaseWarmingMedia(mediaUrls);
  }
}

export type MediaResolutionContext = {
  createdUrls: Set<string>;
  isRevoked: boolean;
  revoke: () => void;
};

/**
 * Creates an operation-scoped media resolution context tracking created object URLs.
 * Calling revoke() immediately revokes only the URLs created by this operation,
 * marks the context terminally isRevoked = true, and prevents late-created URLs from leaking.
 */
export function createMediaResolutionContext(): MediaResolutionContext {
  const createdUrls = new Set<string>();
  const ctx: MediaResolutionContext = {
    createdUrls,
    isRevoked: false,
    revoke: () => {
      ctx.isRevoked = true;
      for (const url of createdUrls) {
        if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // ignore
          }
        }
        activeObjectUrls.delete(url);
      }
      createdUrls.clear();
    },
  };
  return ctx;
}

/**
 * Resolves all media URLs in a service plan (backgrounds and image elements)
 * to local blob object URLs if present in offline media cache.
 */
export async function resolvePlanMedia(
  plan: any[],
  context?: MediaResolutionContext,
  isCancelled?: () => boolean
): Promise<any[]> {
  if (!Array.isArray(plan)) return [];
  if (isCancelled?.() || context?.isRevoked) {
    context?.revoke();
    return plan;
  }
  const resolved = await Promise.all(
    plan.map(async (item) => {
      if (isCancelled?.() || context?.isRevoked) {
        context?.revoke();
        return item;
      }
      if (!item || typeof item !== 'object' || !item.artifact) return item;
      const artifact = { ...item.artifact };
      if (artifact.layout && typeof artifact.layout === 'object') {
        const layout = { ...artifact.layout };
        if (layout.backgroundImage) {
          layout.backgroundImage = await resolveMediaUrl(layout.backgroundImage, context);
        }
        if (Array.isArray(layout.elements)) {
          layout.elements = await Promise.all(
            layout.elements.map(async (el: any) => {
              if (isCancelled?.() || context?.isRevoked) {
                context?.revoke();
                return el;
              }
              if (
                el &&
                typeof el === 'object' &&
                (el.type === 'image' || el.type === 'image-placeholder')
              ) {
                const copy = { ...el };
                if (copy.imageUrl) {
                  copy.imageUrl = await resolveMediaUrl(copy.imageUrl, context);
                }
                if (
                  copy.content &&
                  typeof copy.content === 'string' &&
                  !copy.content.startsWith('data:') &&
                  !copy.content.startsWith('blob:')
                ) {
                  copy.content = await resolveMediaUrl(copy.content, context);
                }
                if (copy.src) {
                  copy.src = await resolveMediaUrl(copy.src, context);
                }
                return copy;
              }
              return el;
            })
          );
        }
        artifact.layout = layout;
      }
      if (isCancelled?.() || context?.isRevoked) {
        context?.revoke();
        return item;
      }
      return { ...item, artifact };
    })
  );

  if (isCancelled?.() || context?.isRevoked) {
    context?.revoke();
    return plan;
  }

  return resolved;
}

/**
 * Stores a binary media blob keyed by URL with epoch guard preventing post-logout writes.
 */
export async function saveMediaBlob(
  url: string,
  blob: Blob,
  epoch?: number
): Promise<boolean> {
  if (epoch !== undefined && cacheEpoch !== epoch) {
    return false;
  }

  if (isIndexedDBAvailable()) {
    try {
      const db = await openDb();
      if (epoch !== undefined && cacheEpoch !== epoch) {
        return false;
      }
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE, 'readwrite');
        const store = tx.objectStore(MEDIA_STORE);
        store.put({ url, blob, cached_at: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      if (epoch === undefined || cacheEpoch === epoch) {
        inMemoryMedia.set(url, blob);
      }
    } catch {
      if (epoch === undefined || cacheEpoch === epoch) {
        inMemoryMedia.set(url, blob);
      }
    }
  } else {
    if (epoch === undefined || cacheEpoch === epoch) {
      inMemoryMedia.set(url, blob);
    }
  }
  return true;
}

/**
 * Resolves a media URL to a local object URL if cached offline, or returns the original URL.
 */
export async function resolveMediaUrl(
  url: string,
  context?: MediaResolutionContext
): Promise<string> {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const epoch = cacheEpoch;

  let blob = inMemoryMedia.get(url);

  if (!blob && isIndexedDBAvailable()) {
    try {
      const db = await openDb();
      if (cacheEpoch !== epoch) return url;
      const record = await new Promise<{ url: string; blob: Blob } | null>((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE, 'readonly');
        const store = tx.objectStore(MEDIA_STORE);
        const req = store.get(url);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if (cacheEpoch !== epoch) return url;
      if (record?.blob) {
        blob = record.blob;
        if (cacheEpoch === epoch) {
          inMemoryMedia.set(url, blob);
        }
      }
    } catch {
      // continue with original url
    }
  }

  if (cacheEpoch !== epoch) return url;

  if (blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const objectUrl = URL.createObjectURL(blob);
    if (context?.isRevoked) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore
      }
      return url;
    }
    activeObjectUrls.add(objectUrl);
    context?.createdUrls.add(objectUrl);
    return objectUrl;
  }

  return url;
}

/**
 * Revokes all created Object URLs to prevent browser memory leaks.
 */
export function revokeMediaUrls(): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    for (const objectUrl of activeObjectUrls) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore errors
      }
    }
  }
  activeObjectUrls.clear();
}

/**
 * Persists an emergency slide patch to the emergency outbox and updates the local service snapshot.
 */
export async function saveEmergencyPatch(
  patch: Omit<EmergencyPatchRecord, 'id'>
): Promise<number> {
  const normId = normalizeServiceId(patch.serviceId);
  const record: EmergencyPatchRecord = {
    ...patch,
    serviceId: normId,
    patchTimestamp: patch.patchTimestamp || Date.now(),
  };

  let id = Date.now();

  if (isIndexedDBAvailable()) {
    try {
      const db = await openDb();
      id = await new Promise<number>((resolve, reject) => {
        const tx = db.transaction([OUTBOX_STORE, SNAPSHOT_STORE], 'readwrite');
        const outboxStore = tx.objectStore(OUTBOX_STORE);
        const snapStore = tx.objectStore(SNAPSHOT_STORE);

        const addReq = outboxStore.add(record);
        addReq.onsuccess = () => {
          const snapReq = snapStore.get(normId);
          snapReq.onsuccess = () => {
            const snap = snapReq.result as OfflineServiceSnapshot | undefined;
            if (snap && Array.isArray(snap.plan) && snap.plan[record.slideIndex]) {
              const updatedPlan = [...snap.plan];
              updatedPlan[record.slideIndex] = {
                ...updatedPlan[record.slideIndex],
                artifact: record.patchedArtifact,
              };
              snap.plan = updatedPlan;
              snap.cached_at = Date.now();
              snapStore.put(snap);
            }
          };
        };

        tx.oncomplete = () => resolve(addReq.result as number || id);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch {
      // fallback
    }
  }

  // Update in-memory fallback stores
  record.id = id;
  inMemoryOutbox.push(record);
  const memSnap = inMemorySnapshots.get(normId);
  if (memSnap && Array.isArray(memSnap.plan) && memSnap.plan[record.slideIndex]) {
    const updatedPlan = [...memSnap.plan];
    updatedPlan[record.slideIndex] = {
      ...updatedPlan[record.slideIndex],
      artifact: record.patchedArtifact,
    };
    memSnap.plan = updatedPlan;
    memSnap.cached_at = Date.now();
  }

  return id;
}

/**
 * Retrieves all pending emergency patches for a given service.
 */
export async function getEmergencyPatches(
  serviceId: string | number
): Promise<EmergencyPatchRecord[]> {
  const normId = normalizeServiceId(serviceId);
  if (!normId) return [];

  if (isIndexedDBAvailable()) {
    try {
      const db = await openDb();
      const records = await new Promise<EmergencyPatchRecord[]>((resolve, reject) => {
        const tx = db.transaction(OUTBOX_STORE, 'readonly');
        const store = tx.objectStore(OUTBOX_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
          const all = (req.result || []) as EmergencyPatchRecord[];
          const filtered = all.filter((r) => r.serviceId === normId);
          resolve(filtered);
        };
        req.onerror = () => reject(req.error);
      });
      return records;
    } catch {
      // fallback
    }
  }

  return inMemoryOutbox.filter((r) => r.serviceId === normId);
}

/**
 * Clears pending emergency patches for a service (e.g. after sync to server or discard).
 */
export async function clearEmergencyPatches(
  serviceId: string | number
): Promise<void> {
  const normId = normalizeServiceId(serviceId);
  if (!normId) return;

  if (isIndexedDBAvailable()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(OUTBOX_STORE, 'readwrite');
        const store = tx.objectStore(OUTBOX_STORE);
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const val = cursor.value as EmergencyPatchRecord;
            if (val && val.serviceId === normId) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch {
      // fallback
    }
  }

  for (let i = inMemoryOutbox.length - 1; i >= 0; i--) {
    if (inMemoryOutbox[i].serviceId === normId) {
      inMemoryOutbox.splice(i, 1);
    }
  }
}

/**
 * Discards pending emergency patches and restores the canonical service snapshot.
 * Uses the earliest recorded originalArtifact and originalText per slideIndex to ensure
 * offline snapshots are restored cleanly even across multiple repeated edits.
 */
export async function revertEmergencyPatches(
  serviceId: string | number
): Promise<void> {
  const normId = normalizeServiceId(serviceId);
  const patches = await getEmergencyPatches(normId);

  // Group by slideIndex, picking the earliest patch (lowest patchRevision) to get the true original
  const earliestOriginals = new Map<number, { text: string; artifact?: any }>();
  const sorted = [...patches].sort((a, b) => (a.patchRevision || 0) - (b.patchRevision || 0));
  for (const p of sorted) {
    if (!earliestOriginals.has(p.slideIndex)) {
      earliestOriginals.set(p.slideIndex, {
        text: p.originalText,
        artifact: p.originalArtifact,
      });
    }
  }

  // Restore the snapshot in-place using the earliest recorded original
  const snap = await getServiceSnapshot(normId);
  if (snap && Array.isArray(snap.plan) && earliestOriginals.size > 0) {
    const updatedPlan = [...snap.plan];
    for (const [slideIndex, orig] of earliestOriginals.entries()) {
      if (slideIndex >= 0 && slideIndex < updatedPlan.length) {
        const slide = { ...updatedPlan[slideIndex] };
        if (orig.text !== undefined) {
          slide.body = orig.text;
          slide.lines = orig.text.split('\n');
        }
        if (orig.artifact) {
          slide.artifact = orig.artifact;
        }
        updatedPlan[slideIndex] = slide;
      }
    }
    snap.plan = updatedPlan;
    snap.cached_at = Date.now();
    await saveServiceSnapshot(snap);
  }

  await clearEmergencyPatches(normId);
}
