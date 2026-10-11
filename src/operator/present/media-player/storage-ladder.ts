/**
 * Storage Ladder & Platform Capability Helper (SPEC-111-01, DEC-098)
 *
 * Implements the 3-tier storage ladder:
 *   1. Directory Picker (File System Access API via window.showDirectoryPicker)
 *   2. OPFS (Origin Private File System via navigator.storage.getDirectory)
 *   3. In-Memory / Blob URL fallback
 *
 * Provides durable storage requests (navigator.storage.persist) and
 * Service Worker MessageChannel stream transfer contracts.
 */

export type StorageTier = 'directory-picker' | 'opfs' | 'memory-fallback';

export interface StorageCapabilities {
  hasDirectoryPicker: boolean;
  hasFilePicker: boolean;
  hasOPFS: boolean;
  hasPersistence: boolean;
  isPersisted: boolean;
  recommendedTier: StorageTier;
}

export interface StreamBridgeRequest {
  type: 'LOCAL_MEDIA_STREAM_REQUEST';
  sha256: string;
  range?: string;
  requestId: string;
}

export interface StreamBridgeResponse {
  type: 'LOCAL_MEDIA_STREAM_RESPONSE';
  requestId: string;
  sha256: string;
  status: 200 | 206 | 404 | 500;
  headers?: Record<string, string>;
  blob?: Blob;
  error?: string;
}

/**
 * Detect available storage capabilities in the current JavaScript runtime.
 * Safely handles missing window, undefined navigator.storage, or permission rejections.
 */
export async function detectStorageCapabilities(
  customWindow?: any
): Promise<StorageCapabilities> {
  const win = customWindow ?? (typeof window !== 'undefined' ? window : undefined);
  const nav = win?.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);

  const hasDirectoryPicker = typeof win?.showDirectoryPicker === 'function';
  const hasFilePicker = typeof win?.showOpenFilePicker === 'function';
  const hasOPFS = typeof nav?.storage?.getDirectory === 'function';
  const hasPersistence = typeof nav?.storage?.persist === 'function';

  let isPersisted = false;
  if (typeof nav?.storage?.persisted === 'function') {
    try {
      isPersisted = Boolean(await nav.storage.persisted());
    } catch {
      isPersisted = false;
    }
  }

  let recommendedTier: StorageTier = 'memory-fallback';
  if (hasDirectoryPicker) {
    recommendedTier = 'directory-picker';
  } else if (hasOPFS) {
    recommendedTier = 'opfs';
  }

  return {
    hasDirectoryPicker,
    hasFilePicker,
    hasOPFS,
    hasPersistence,
    isPersisted,
    recommendedTier,
  };
}

/**
 * Request durable storage quota from the browser (protects from eviction under disk pressure).
 */
export async function requestStoragePersistence(
  customNav?: any
): Promise<boolean> {
  const nav = customNav ?? (typeof navigator !== 'undefined' ? navigator : undefined);
  if (typeof nav?.storage?.persist !== 'function') {
    return false;
  }
  try {
    return Boolean(await nav.storage.persist());
  } catch {
    return false;
  }
}

/**
 * Resolves the active storage tier according to the storage ladder:
 * 1. Directory Picker -> 2. OPFS -> 3. Memory Fallback
 */
export async function resolveActiveStorageTier(options?: {
  requestedTier?: StorageTier;
  capabilities?: StorageCapabilities;
  customWindow?: any;
}): Promise<StorageTier> {
  const caps = options?.capabilities ?? (await detectStorageCapabilities(options?.customWindow));
  const requested = options?.requestedTier;

  if (requested === 'directory-picker' && caps.hasDirectoryPicker) {
    return 'directory-picker';
  }
  if (requested === 'opfs' && caps.hasOPFS) {
    return 'opfs';
  }
  if (requested === 'memory-fallback') {
    return 'memory-fallback';
  }

  // Auto-ladder
  return caps.recommendedTier;
}

/**
 * Validates that an anchor element or tag is NOT using the forbidden <a download>
 * pattern for media storage/persistence (Kernel K2 invariant).
 */
export function assertNoDownloadAnchorUsed(markupOrTag: string): void {
  const lower = markupOrTag.toLowerCase();
  const hasDownloadAttribute = /<a\s+[^>]*download[^>]*>/i.test(lower) || /download\s*=\s*['"][^'"]*['"]/i.test(lower);
  if (hasDownloadAttribute && (lower.includes('.mp4') || lower.includes('.mp3') || lower.includes('.webm') || lower.includes('.wav') || lower.includes('media'))) {
    throw new Error('INVARIANT_VIOLATION: <a download> is prohibited as media storage engine (use File System Access API or OPFS)');
  }
}
