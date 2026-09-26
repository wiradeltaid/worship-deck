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

const DB_NAME = 'worship_deck_offline_db';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'service_snapshots';
const MEDIA_STORE = 'media_cache';
const OUTBOX_STORE = 'emergency_outbox';
const MAX_CACHED_SERVICES = 4;

// In-memory fallback stores for non-browser/test environments
const inMemorySnapshots = new Map<string, OfflineServiceSnapshot>();
const inMemoryMedia = new Map<string, Blob>();
const activeObjectUrls = new Set<string>();

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
            else if (el.content) addValidUrl(el.content);
            else if (el.src) addValidUrl(el.src);
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
export async function saveServiceSnapshot(snapshot: OfflineServiceSnapshot): Promise<void> {
  const record: OfflineServiceSnapshot = {
    ...snapshot,
    cached_at: snapshot.cached_at || Date.now(),
  };

  inMemorySnapshots.set(record.id, record);

  if (isIndexedDBAvailable()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
        const store = tx.objectStore(SNAPSHOT_STORE);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Eviction policy: retain up to MAX_CACHED_SERVICES
      await evictOldSnapshots(db);
    } catch {
      await evictOldSnapshots(null);
    }
  } else {
    await evictOldSnapshots(null);
  }
}

/**
 * Retrieves a service snapshot from IndexedDB or in-memory fallback.
 */
export async function getServiceSnapshot(serviceId: string): Promise<OfflineServiceSnapshot | null> {
  if (isIndexedDBAvailable()) {
    try {
      const db = await openDb();
      const snapshot = await new Promise<OfflineServiceSnapshot | null>((resolve, reject) => {
        const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
        const store = tx.objectStore(SNAPSHOT_STORE);
        const req = store.get(serviceId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if (snapshot) {
        inMemorySnapshots.set(snapshot.id, snapshot);
        return snapshot;
      }
    } catch {
      // fall back to in-memory store
    }
  }

  return inMemorySnapshots.get(serviceId) || null;
}

/**
 * Evicts oldest snapshots if count exceeds MAX_CACHED_SERVICES and sweeps orphaned media.
 */
async function evictOldSnapshots(db: IDBDatabase | null): Promise<void> {
  if (db && isIndexedDBAvailable()) {
    try {
      const snapshots = await new Promise<OfflineServiceSnapshot[]>((resolve, reject) => {
        const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
        const store = tx.objectStore(SNAPSHOT_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (snapshots.length > MAX_CACHED_SERVICES) {
        // Sort ascending by cached_at (oldest first)
        snapshots.sort((a, b) => (a.cached_at || 0) - (b.cached_at || 0));
        const toDelete = snapshots.slice(0, snapshots.length - MAX_CACHED_SERVICES);
        const surviving = snapshots.slice(snapshots.length - MAX_CACHED_SERVICES);

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

          // Garbage-collect orphaned media
          const survivingUrls = new Set<string>();
          for (const s of surviving) {
            for (const u of extractRequiredMediaUrls(s)) {
              survivingUrls.add(u);
            }
          }

          const mediaStore = tx.objectStore(MEDIA_STORE);
          const allMediaKeysReq = mediaStore.getAllKeys();
          allMediaKeysReq.onsuccess = () => {
            const keys = allMediaKeysReq.result || [];
            for (const key of keys) {
              const urlStr = String(key);
              if (!survivingUrls.has(urlStr)) {
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
      }
    } catch {
      // Ignore eviction errors
    }
  }

  // Also sweep in-memory snapshots and orphaned media
  if (inMemorySnapshots.size > MAX_CACHED_SERVICES) {
    const list = Array.from(inMemorySnapshots.values());
    list.sort((a, b) => (a.cached_at || 0) - (b.cached_at || 0));
    const toDelete = list.slice(0, list.length - MAX_CACHED_SERVICES);
    const surviving = list.slice(list.length - MAX_CACHED_SERVICES);
    for (const d of toDelete) {
      inMemorySnapshots.delete(d.id);
    }
    const survivingUrls = new Set<string>();
    for (const s of surviving) {
      for (const u of extractRequiredMediaUrls(s)) {
        survivingUrls.add(u);
      }
    }
    for (const url of Array.from(inMemoryMedia.keys())) {
      if (!survivingUrls.has(url)) {
        inMemoryMedia.delete(url);
      }
    }
  }
}

export function clearInMemoryOfflineStore(): void {
  revokeMediaUrls();
  inMemorySnapshots.clear();
  inMemoryMedia.clear();
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

/**
 * Pre-warms and caches all assets for a given service.
 */
export async function warmServiceSnapshot(
  serviceId: string,
  serviceData: any,
  onProgress?: (progress: OfflineReadiness) => void
): Promise<OfflineReadiness> {
  const mediaUrls = extractRequiredMediaUrls(serviceData);
  const total = mediaUrls.length;

  if (total === 0) {
    const readyState: OfflineReadiness = {
      status: 'ready',
      total: 0,
      cached: 0,
      failed: 0,
      message: 'Offline Ready (0 external assets)',
    };
    await saveServiceSnapshot({
      ...serviceData,
      id: serviceId,
      cached_at: Date.now(),
      status: 'ready',
      failed_assets: [],
    });
    onProgress?.(readyState);
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
          ? `Offline Ready: ${cachedCount}/${total} assets`
          : status === 'warming'
          ? `Warming: ${cachedCount}/${total} assets`
          : `Degraded: ${failed} assets failed`,
    };
    onProgress?.(state);
    return state;
  };

  notify('warming', 0);

  for (const url of mediaUrls) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      await saveMediaBlob(url, blob);
      cachedCount++;
      notify('warming', failedUrls.length);
    } catch {
      failedUrls.push(url);
    }
  }

  const finalStatus: OfflineSnapshotStatus = failedUrls.length === 0 ? 'ready' : 'degraded';
  const finalState = notify(finalStatus, failedUrls.length);

  await saveServiceSnapshot({
    ...serviceData,
    id: serviceId,
    cached_at: Date.now(),
    status: finalStatus,
    failed_assets: failedUrls,
  });

  return finalState;
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
 * Stores a binary media blob keyed by URL.
 */
export async function saveMediaBlob(url: string, blob: Blob): Promise<void> {
  inMemoryMedia.set(url, blob);

  if (isIndexedDBAvailable()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE, 'readwrite');
        const store = tx.objectStore(MEDIA_STORE);
        store.put({ url, blob, cached_at: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // In-memory fallback used
    }
  }
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

  let blob = inMemoryMedia.get(url);

  if (!blob && isIndexedDBAvailable()) {
    try {
      const db = await openDb();
      const record = await new Promise<{ url: string; blob: Blob } | null>((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE, 'readonly');
        const store = tx.objectStore(MEDIA_STORE);
        const req = store.get(url);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if (record?.blob) {
        blob = record.blob;
        inMemoryMedia.set(url, blob);
      }
    } catch {
      // continue with original url
    }
  }

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
