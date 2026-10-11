/**
 * Virtual Streamer & Service Worker Bridge (SPEC-111-05)
 *
 * Provides client-side helpers to register `media-sw.js`, route local playback
 * through `/local-media/<sha256>`, and transfer file streams to the worker via MessageChannel.
 */

import type { LocalMediaRegistry } from './local-media-registry';

export type RangeParseResult =
  | { start: number; end: number }
  | null
  | 'unsatisfiable';

/**
 * Pure range parser adhering strictly to RFC 7233 byte-range specifications.
 */
export function parseByteRange(
  rangeHeader: string | null | undefined,
  totalSize: number
): RangeParseResult {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) return null;
  const parts = rangeHeader.replace('bytes=', '').trim().split('-');
  if (parts.length !== 2) return null;

  const rawStart = parts[0].trim();
  const rawEnd = parts[1].trim();

  let start = rawStart === '' ? null : parseInt(rawStart, 10);
  let end = rawEnd === '' ? null : parseInt(rawEnd, 10);

  if (start === null && end === null) return null;

  if (start === null) {
    // Suffix range: bytes=-500
    const suffix = end;
    if (suffix === null || isNaN(suffix) || suffix <= 0) return null;
    start = Math.max(0, totalSize - suffix);
    end = totalSize;
  } else if (end === null) {
    // Open-ended range: bytes=500-
    if (isNaN(start) || start < 0) return null;
    if (start >= totalSize) return 'unsatisfiable';
    end = totalSize;
  } else {
    // Closed range: bytes=0-499
    if (isNaN(start) || isNaN(end) || start < 0 || end < start) return null;
    if (start >= totalSize) return 'unsatisfiable';
    end = Math.min(end + 1, totalSize);
  }

  return { start, end };
}

/**
 * Resolves standard local media stream URL for a given SHA-256 identifier.
 */
export function resolveLocalMediaUrl(sha256: string): string {
  return `/local-media/${sha256.toLowerCase()}`;
}

/**
 * Check if the Service Worker controller is active for the current browsing context.
 */
export function isServiceWorkerControllerActive(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.serviceWorker?.controller)
  );
}

/**
 * Registers `media-sw.js` at root scope.
 */
export async function registerMediaServiceWorker(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.register('/media-sw.js', { scope: '/' });
    return Boolean(reg);
  } catch {
    return false;
  }
}

/**
 * Binds message listener on navigator.serviceWorker to handle
 * stream resolution requests from the Service Worker virtual streamer.
 */
export function setupStreamBridgeListener(
  registry: LocalMediaRegistry
): () => void {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return () => {};
  }

  const handler = async (event: MessageEvent) => {
    if (!event.data || event.data.type !== 'LOCAL_MEDIA_STREAM_REQUEST') {
      return;
    }
    const { sha256 } = event.data;
    const port = event.ports?.[0];
    if (!port || !sha256) return;

    try {
      const record = registry.getRecord(sha256);
      if (!record) {
        port.postMessage({ error: 'Record not found' });
        return;
      }

      let blob: Blob | null = null;
      if (record.fileHandle && typeof record.fileHandle.getFile === 'function') {
        blob = await record.fileHandle.getFile();
      } else if (record.fileHandle instanceof Blob) {
        blob = record.fileHandle;
      }

      port.postMessage({ blob });
    } catch (err: any) {
      port.postMessage({ error: err?.message || 'Failed to read media handle' });
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);
  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
  };
}
