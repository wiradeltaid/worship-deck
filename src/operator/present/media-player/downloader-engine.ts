/**
 * Conscious Downloader Engine (SPEC-111-07)
 *
 * Implements intentional, operator-commanded media downloading to local disk:
 * - Concurrency 1 sequential queue
 * - Zero auto-downloading (strictly requires explicit operator click)
 * - Atomic write via createWritable() with stream hashing verification
 * - Storage ladder fallback (showDirectoryPicker -> OPFS)
 * - Unlink vs purge protection: local removal preserves physical files on disk
 */

import { localMediaRegistry, type LocalMediaRecord } from './local-media-registry';
import { detectStorageCapabilities, requestStoragePersistence } from './storage-ladder';
import { computeBlobSHA256 } from './media-hasher';

export interface DownloadMediaItem {
  id: string;
  name: string;
  url: string;
  sha256: string;
  size?: number;
  type: 'audio' | 'video';
}

export type DownloadState = 'idle' | 'downloading' | 'completed' | 'error' | 'cancelled';

export interface DownloadProgressInfo {
  sha256: string;
  progressPercent: number;
  state: DownloadState;
  error?: string;
}

export type DownloadProgressListener = (info: DownloadProgressInfo) => void;

export class ConsciousDownloaderEngine {
  private queue: DownloadMediaItem[] = [];
  private activeDownload: {
    item: DownloadMediaItem;
    abortController: AbortController;
  } | null = null;
  private progressListeners = new Set<DownloadProgressListener>();
  private activeProgress: Record<string, DownloadProgressInfo> = {};

  constructor() {}

  /**
   * Enqueues a single item for intentional download.
   */
  enqueueItem(item: DownloadMediaItem): void {
    if (!item.sha256) return;
    const cleanSHA = item.sha256.toLowerCase();

    // Skip if already in queue or currently downloading
    if (this.queue.some((q) => q.sha256.toLowerCase() === cleanSHA)) return;
    if (this.activeDownload?.item.sha256.toLowerCase() === cleanSHA) return;

    this.queue.push({
      ...item,
      sha256: cleanSHA,
    });

    this.updateProgress(cleanSHA, {
      sha256: cleanSHA,
      progressPercent: 0,
      state: 'downloading',
    });

    void this.processNext();
  }

  /**
   * Preflight calculation for bulk download ("Unduh Semua").
   */
  calculateBulkPreflight(items: DownloadMediaItem[]): {
    count: number;
    totalSizeBytes: number;
    totalSizeFormatted: string;
  } {
    let count = 0;
    let totalSizeBytes = 0;

    for (const it of items) {
      if (it.sha256 && !localMediaRegistry.hasRecord(it.sha256)) {
        count++;
        totalSizeBytes += it.size || 0;
      }
    }

    const mb = totalSizeBytes / (1024 * 1024);
    const totalSizeFormatted =
      mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;

    return { count, totalSizeBytes, totalSizeFormatted };
  }

  /**
   * Enqueues all un-downloaded items from a list in sequential order.
   */
  enqueueBulk(items: DownloadMediaItem[]): void {
    for (const it of items) {
      if (it.sha256 && !localMediaRegistry.hasRecord(it.sha256)) {
        this.enqueueItem(it);
      }
    }
  }

  /**
   * Cancels an active or queued download.
   */
  cancelDownload(sha256: string): void {
    const cleanSHA = sha256.toLowerCase();

    // Remove from queued items
    this.queue = this.queue.filter((q) => q.sha256.toLowerCase() !== cleanSHA);

    // Abort if active
    if (this.activeDownload && this.activeDownload.item.sha256.toLowerCase() === cleanSHA) {
      this.activeDownload.abortController.abort();
      this.activeDownload = null;
    }

    this.updateProgress(cleanSHA, {
      sha256: cleanSHA,
      progressPercent: 0,
      state: 'cancelled',
    });

    void this.processNext();
  }

  getProgress(sha256: string): DownloadProgressInfo | undefined {
    return this.activeProgress[sha256.toLowerCase()];
  }

  subscribe(listener: DownloadProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  private updateProgress(sha256: string, info: DownloadProgressInfo): void {
    this.activeProgress[sha256.toLowerCase()] = info;
    for (const l of this.progressListeners) {
      try {
        l(info);
      } catch {
        // Ignored
      }
    }
  }

  private async processNext(): Promise<void> {
    if (this.activeDownload !== null || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift()!;
    const abortController = new AbortController();
    this.activeDownload = { item, abortController };

    try {
      await this.executeDownload(item, abortController.signal);
      this.updateProgress(item.sha256, {
        sha256: item.sha256,
        progressPercent: 100,
        state: 'completed',
      });
    } catch (err: any) {
      if (abortController.signal.aborted) {
        this.updateProgress(item.sha256, {
          sha256: item.sha256,
          progressPercent: 0,
          state: 'cancelled',
        });
      } else {
        this.updateProgress(item.sha256, {
          sha256: item.sha256,
          progressPercent: 0,
          state: 'error',
          error: err?.message || 'Download failed',
        });
      }
    } finally {
      this.activeDownload = null;
      void this.processNext();
    }
  }

  private async executeDownload(
    item: DownloadMediaItem,
    signal: AbortSignal
  ): Promise<void> {
    // 1. Fetch content stream
    const res = await fetch(item.url, { signal });
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const contentLength = parseInt(res.headers.get('Content-Length') || '0', 10) || item.size || 0;
    const blob = await res.blob();

    if (signal.aborted) throw new Error('Download aborted');

    // 2. Stream/chunk hash verification
    const computedSHA = await computeBlobSHA256(blob, (ratio) => {
      this.updateProgress(item.sha256, {
        sha256: item.sha256,
        progressPercent: Math.min(99, Math.round(ratio * 100)),
        state: 'downloading',
      });
    });

    if (item.sha256 && computedSHA.toLowerCase() !== item.sha256.toLowerCase()) {
      throw new Error(
        `HASH_MISMATCH: Computed hash ${computedSHA} does not match server expectation ${item.sha256}`
      );
    }

    // 3. Persist to storage ladder
    const caps = await detectStorageCapabilities();
    let storageKind: 'directory-handle' | 'opfs' | 'in-memory' = 'in-memory';
    let fileHandle: any = blob;

    const dirHandle = localMediaRegistry.getDirectoryHandle();
    if (dirHandle && typeof dirHandle.getFileHandle === 'function') {
      try {
        const fh = await dirHandle.getFileHandle(item.name, { create: true });
        if (typeof fh.createWritable === 'function') {
          const writable = await fh.createWritable();
          await writable.write(blob);
          await writable.close();
          fileHandle = fh;
          storageKind = 'directory-handle';
        }
      } catch {
        // Fallback to OPFS
      }
    }

    if (storageKind === 'in-memory' && caps.hasOPFS) {
      try {
        await requestStoragePersistence();
        const opfsRoot = await navigator.storage.getDirectory();
        const fh = await opfsRoot.getFileHandle(item.name, { create: true });
        if (typeof fh.createWritable === 'function') {
          const writable = await fh.createWritable();
          await writable.write(blob);
          await writable.close();
          fileHandle = fh;
          storageKind = 'opfs';
        }
      } catch {
        // Fallback to in-memory Blob
      }
    }

    // 4. Save record into localMediaRegistry
    const record: LocalMediaRecord = {
      sha256: computedSHA,
      name: item.name,
      sizeBytes: blob.size,
      mimeType: blob.type || (item.type === 'video' ? 'video/mp4' : 'audio/mpeg'),
      fileHandle,
      storageKind,
      lastModified: Date.now(),
      verifiedAt: new Date().toISOString(),
    };

    await localMediaRegistry.saveRecord(record);
  }
}

// Global downloader singleton
export const consciousDownloader = new ConsciousDownloaderEngine();
