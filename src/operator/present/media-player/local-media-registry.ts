/**
 * Local Media Registry (SPEC-111-04)
 *
 * Implements client-side persistent storage in IndexedDB (`worship-deck-media`)
 * with separate directory handle settings and content-addressed SHA-256 media index.
 * Maintains an in-memory matching map for O(1) 60fps render lookups.
 */

export interface LocalMediaRecord {
  sha256: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  fileHandle?: any; // FileSystemFileHandle, File, or Blob
  storageKind: 'directory-handle' | 'opfs' | 'in-memory';
  lastModified: number;
  verifiedAt: string;
  opfsPath?: string;
}

export type StalenessStatus = 'valid' | 'detached';

export const DB_NAME = 'worship-deck-media';
export const DB_VERSION = 1;
export const SETTINGS_STORE = 'media-settings';
export const INDEX_STORE = 'media-index';

export class LocalMediaRegistry {
  private matchingMap = new Map<string, LocalMediaRecord>();
  private directoryHandle: any = null;
  private listeners = new Set<() => void>();
  private inMemoryIndex = new Map<string, LocalMediaRecord>();
  private inMemorySettings = new Map<string, any>();
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {}

  private isIDBAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  private async openDB(): Promise<IDBDatabase> {
    if (!this.isIDBAvailable()) {
      throw new Error('IndexedDB not available');
    }
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE);
        }
        if (!db.objectStoreNames.contains(INDEX_STORE)) {
          db.createObjectStore(INDEX_STORE, { keyPath: 'sha256' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return this.dbPromise;
  }

  /**
   * Hydrates the in-memory matching map from IndexedDB or memory fallback.
   */
  async hydrate(): Promise<void> {
    if (!this.isIDBAvailable()) {
      this.matchingMap = new Map(this.inMemoryIndex);
      this.directoryHandle = this.inMemorySettings.get('downloadDirectory') ?? null;
      this.notify();
      return;
    }

    try {
      const db = await this.openDB();

      // Read directory handle
      const dirHandle = await new Promise<any>((resolve) => {
        const tx = db.transaction(SETTINGS_STORE, 'readonly');
        const req = tx.objectStore(SETTINGS_STORE).get('downloadDirectory');
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      });
      this.directoryHandle = dirHandle;

      // Read all records
      const records = await new Promise<LocalMediaRecord[]>((resolve) => {
        const tx = db.transaction(INDEX_STORE, 'readonly');
        const req = tx.objectStore(INDEX_STORE).getAll();
        req.onsuccess = () => resolve((req.result as LocalMediaRecord[]) || []);
        req.onerror = () => resolve([]);
      });

      this.matchingMap.clear();
      for (const rec of records) {
        if (rec.sha256) {
          this.matchingMap.set(rec.sha256.toLowerCase(), rec);
        }
      }
      this.notify();
    } catch {
      // Graceful fallback to memory on IDB failure
      this.matchingMap = new Map(this.inMemoryIndex);
      this.directoryHandle = this.inMemorySettings.get('downloadDirectory') ?? null;
      this.notify();
    }
  }

  /**
   * Returns in-memory matching map for O(1) synchronous 60fps render lookups.
   */
  getMatchingMap(): ReadonlyMap<string, LocalMediaRecord> {
    return this.matchingMap;
  }

  getRecord(sha256: string): LocalMediaRecord | undefined {
    return this.matchingMap.get(sha256.toLowerCase());
  }

  hasRecord(sha256: string): boolean {
    return this.matchingMap.has(sha256.toLowerCase());
  }

  /**
   * Evaluates if a known local media record has become stale on disk.
   */
  checkStaleness(
    record: LocalMediaRecord,
    currentSizeBytes: number,
    currentLastModified: number
  ): StalenessStatus {
    if (record.sizeBytes !== currentSizeBytes) {
      return 'detached';
    }
    // Allow up to 2000ms delta for filesystem timestamp granularity differences
    if (Math.abs(record.lastModified - currentLastModified) > 2000) {
      return 'detached';
    }
    return 'valid';
  }

  /**
   * Saves or updates a verified local media record.
   */
  async saveRecord(record: LocalMediaRecord): Promise<void> {
    const key = record.sha256.toLowerCase();
    const cleanRecord: LocalMediaRecord = {
      ...record,
      sha256: key,
    };

    this.matchingMap.set(key, cleanRecord);
    this.inMemoryIndex.set(key, cleanRecord);

    if (this.isIDBAvailable()) {
      try {
        const db = await this.openDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(INDEX_STORE, 'readwrite');
          const req = tx.objectStore(INDEX_STORE).put(cleanRecord);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch {
        // Ignored in test/offline fallback
      }
    }

    this.notify();
  }

  /**
   * Removes a record from the local index by its sha256 checksum.
   */
  async removeRecord(sha256: string): Promise<void> {
    const key = sha256.toLowerCase();
    this.matchingMap.delete(key);
    this.inMemoryIndex.delete(key);

    if (this.isIDBAvailable()) {
      try {
        const db = await this.openDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(INDEX_STORE, 'readwrite');
          const req = tx.objectStore(INDEX_STORE).delete(key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch {
        // Ignored
      }
    }

    this.notify();
  }

  async getAllRecords(): Promise<LocalMediaRecord[]> {
    return Array.from(this.matchingMap.values());
  }

  getDirectoryHandle(): any | null {
    return this.directoryHandle;
  }

  async setDirectoryHandle(handle: any): Promise<void> {
    this.directoryHandle = handle;
    this.inMemorySettings.set('downloadDirectory', handle);

    if (this.isIDBAvailable()) {
      try {
        const db = await this.openDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(SETTINGS_STORE, 'readwrite');
          const req = tx.objectStore(SETTINGS_STORE).put(handle, 'downloadDirectory');
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch {
        // Ignored
      }
    }

    this.notify();
  }

  async clearDirectoryHandle(): Promise<void> {
    this.directoryHandle = null;
    this.inMemorySettings.delete('downloadDirectory');

    if (this.isIDBAvailable()) {
      try {
        const db = await this.openDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(SETTINGS_STORE, 'readwrite');
          const req = tx.objectStore(SETTINGS_STORE).delete('downloadDirectory');
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch {
        // Ignored
      }
    }

    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// Global singleton instance
export const localMediaRegistry = new LocalMediaRegistry();
