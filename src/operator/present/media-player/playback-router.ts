/**
 * Local-First Playback Routing (SPEC-111-08, Kernel K3)
 *
 * Implements strict 4-condition predicate evaluation to prioritize local
 * Service Worker playback while providing graceful fallback to cloud streaming.
 */

import { localMediaRegistry } from './local-media-registry';
import { resolveLocalMediaUrl, isServiceWorkerControllerActive } from './virtual-streamer';
import type { PlaylistItem } from './playlist-model';

export interface RoutePlaybackResult {
  canRouteLocal: boolean;
  resolvedUrl: string;
  source: 'local' | 'cloud';
  reason?:
    | 'all-predicates-met'
    | 'no-sha256'
    | 'not-in-local-index'
    | 'file-stale-or-detached'
    | 'sw-controller-missing';
}

/**
 * Evaluates whether a playlist item can be served locally via Service Worker
 * or must fall back to cloud streaming.
 */
export function routePlaybackSource(
  item: PlaylistItem | null | undefined,
  options?: {
    customSWActive?: boolean;
    currentSizeBytes?: number;
    currentLastModified?: number;
  }
): RoutePlaybackResult {
  if (!item) {
    return {
      canRouteLocal: false,
      resolvedUrl: '',
      source: 'cloud',
      reason: 'no-sha256',
    };
  }

  // Cloud URL fallback: extract genuine cloud URL and guard against local-media URLs
  const rawCloudUrl = (item as any).cloud?.url;
  const isSyntheticLocalId = typeof item.id === 'string' && item.id.startsWith('local-');
  let cloudUrl = '';

  if (rawCloudUrl && !rawCloudUrl.startsWith('/local-media/') && !rawCloudUrl.startsWith('blob:')) {
    cloudUrl = rawCloudUrl;
  } else if (item.url && item.url.startsWith('blob:')) {
    // Preserve playable Blob URL for local items when Service Worker is not active
    cloudUrl = item.url;
  } else if (!isSyntheticLocalId && item.url && !item.url.startsWith('/local-media/')) {
    cloudUrl = item.url;
  } else if (!isSyntheticLocalId && item.id) {
    cloudUrl = `/api/media/${item.id}/content`;
  } else if (item.url) {
    cloudUrl = item.url;
  }

  // Predicate 1: Item must have valid sha256
  const sha = (item.sha256 || '').toLowerCase().trim();
  if (!sha || sha.length !== 64) {
    return {
      canRouteLocal: false,
      resolvedUrl: cloudUrl,
      source: 'cloud',
      reason: 'no-sha256',
    };
  }

  // Predicate 2: Present in local media index
  const record = localMediaRegistry.getRecord(sha);
  if (!record) {
    return {
      canRouteLocal: false,
      resolvedUrl: cloudUrl,
      source: 'cloud',
      reason: 'not-in-local-index',
    };
  }

  // Predicate 3: File size and lastModified match (staleness check)
  const sizeToCheck = options?.currentSizeBytes ?? record.sizeBytes;
  const mtimeToCheck = options?.currentLastModified ?? record.lastModified;
  const staleness = localMediaRegistry.checkStaleness(record, sizeToCheck, mtimeToCheck);
  if (staleness !== 'valid') {
    return {
      canRouteLocal: false,
      resolvedUrl: cloudUrl,
      source: 'cloud',
      reason: 'file-stale-or-detached',
    };
  }

  // Predicate 4: Service Worker controller is active
  const swActive = options?.customSWActive ?? isServiceWorkerControllerActive();
  if (!swActive) {
    return {
      canRouteLocal: false,
      resolvedUrl: cloudUrl,
      source: 'cloud',
      reason: 'sw-controller-missing',
    };
  }

  // All 4 predicates satisfied -> Local priority!
  return {
    canRouteLocal: true,
    resolvedUrl: resolveLocalMediaUrl(sha),
    source: 'local',
    reason: 'all-predicates-met',
  };
}

let activeBlobUrl: string | null = null;

/**
 * Resolves a media item's playable URL lazily on demand.
 * If local SW is not active but a local File/Blob handle exists, creates a temporary blob URL
 * and revokes prior blob URLs to avoid persistent memory leaks.
 */
export async function resolveLazyMediaUrl(
  item: PlaylistItem | null | undefined,
  options?: { customSWActive?: boolean; currentSizeBytes?: number; currentLastModified?: number }
): Promise<{ url: string; revoke?: () => void }> {
  if (!item) return { url: '' };

  const route = routePlaybackSource(item, options);
  if (route.canRouteLocal) {
    return { url: route.resolvedUrl };
  }

  // If routing failed because file is stale or detached, DO NOT serve local blob!
  if (route.reason === 'file-stale-or-detached') {
    return { url: route.resolvedUrl };
  }

  // Fallback: only serve lazy Blob URL if route failed because SW controller is missing,
  // AND the local file record is verified valid (not stale/detached).
  if (item.sha256 && route.reason === 'sw-controller-missing') {
    const rec = localMediaRegistry.getRecord(item.sha256);
    if (rec?.fileHandle) {
      const sizeToCheck = options?.currentSizeBytes ?? rec.sizeBytes;
      const mtimeToCheck = options?.currentLastModified ?? rec.lastModified;
      const staleness = localMediaRegistry.checkStaleness(rec, sizeToCheck, mtimeToCheck);
      if (staleness !== 'valid') {
        return { url: route.resolvedUrl };
      }

      let fileObj: Blob | File | null = null;
      if (typeof rec.fileHandle.getFile === 'function') {
        try {
          fileObj = await rec.fileHandle.getFile();
        } catch {
          fileObj = null;
        }
      } else if (rec.fileHandle instanceof Blob || rec.fileHandle instanceof File) {
        fileObj = rec.fileHandle;
      }

      if (fileObj && typeof URL !== 'undefined') {
        const u = URL.createObjectURL(fileObj);
        activeBlobUrl = u;
        return {
          url: u,
          revoke: () => {
            if (typeof URL !== 'undefined') {
              URL.revokeObjectURL(u);
            }
            if (activeBlobUrl === u) {
              activeBlobUrl = null;
            }
          },
        };
      }
    }
  }

  return { url: route.resolvedUrl };
}

/**
 * Revokes any currently active lazy blob URL.
 */
export function revokeActiveMediaBlobUrl(): void {
  if (activeBlobUrl && typeof URL !== 'undefined') {
    URL.revokeObjectURL(activeBlobUrl);
    activeBlobUrl = null;
  }
}
