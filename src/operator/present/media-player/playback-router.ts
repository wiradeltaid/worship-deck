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

  // Cloud URL fallback
  const cloudUrl = item.url || (item.id ? `/api/media/${item.id}/content` : '');

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
