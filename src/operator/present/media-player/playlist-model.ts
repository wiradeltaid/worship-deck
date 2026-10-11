export type MediaType = 'audio' | 'video';
export type MediaStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ProjectStatus = 'off' | 'sending' | 'on_screen' | 'error';
export type MediaAvailability = 'cloud-only' | 'local-only' | 'synced';

export interface CloudPresence {
  id: string;
  name: string;
  url: string;
  size?: number;
  orderKey?: string;
  mimeType?: string;
}

export interface LocalPresence {
  storageKind: 'directory-handle' | 'opfs' | 'in-memory';
  stale?: boolean;
  fileHandle?: any;
  orderKey?: string;
}

export interface PlaylistItem {
  id: string;
  name: string;
  url: string;
  type: MediaType;
  duration?: number;
  size?: number;
  status?: MediaStatus;
  errorMessage?: string;
  sha256?: string;
  source?: 'local' | 'cloud';
  orderKey?: string;
}

export interface UnifiedPlaylistItem extends PlaylistItem {
  cloud?: CloudPresence;
  local?: LocalPresence;
  availability?: MediaAvailability;
}

export interface PlaylistState {
  items: PlaylistItem[];
  activeId: string | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isFading: boolean;
  currentTime: number;
  duration: number;
  isProjected: boolean;
  projectStatus: ProjectStatus;
}

/**
 * Pure derivation of an item's availability:
 * - 'synced': present in both cloud and valid non-stale local storage
 * - 'local-only': present only in local storage
 * - 'cloud-only': present only in cloud catalog
 */
export function deriveAvailability(
  item: PlaylistItem | UnifiedPlaylistItem,
  transfers?: Record<string, number>
): MediaAvailability {
  const uItem = item as UnifiedPlaylistItem;

  const hasCloud = Boolean(
    uItem.cloud ||
    item.source === 'cloud' ||
    (item.url && !item.url.startsWith('blob:') && !item.url.startsWith('/local-media/'))
  );

  const isLocalStale = Boolean(uItem.local?.stale);
  const hasLocal = !isLocalStale && Boolean(
    (uItem.local && uItem.local.storageKind) ||
    item.source === 'local'
  );

  if (hasCloud && hasLocal) {
    return 'synced';
  }
  if (hasLocal && !hasCloud) {
    return 'local-only';
  }
  return 'cloud-only';
}

/**
 * Resolves title & metadata policy when an item exists in both cloud and local:
 * Server name and orderKey are authoritative for catalog display;
 * Local handle is retained for offline stream routing.
 */
export function mergeUnifiedPlaylistItem(
  cloudItem: PlaylistItem,
  localRecord?: {
    storageKind: 'directory-handle' | 'opfs' | 'in-memory';
    fileHandle?: any;
    orderKey?: string;
    stale?: boolean;
  } | null
): UnifiedPlaylistItem {
  const sha256 = (cloudItem.sha256 || '').toLowerCase();
  const hasLocal = Boolean(localRecord);
  const isStale = Boolean(localRecord?.stale);

  return {
    ...cloudItem,
    id: cloudItem.id,
    name: cloudItem.name, // Server name is authoritative for catalog display
    url: cloudItem.url,
    sha256,
    cloud: {
      id: cloudItem.id,
      name: cloudItem.name,
      url: cloudItem.url,
      size: cloudItem.size,
      orderKey: cloudItem.orderKey,
    },
    local: localRecord
      ? {
          storageKind: localRecord.storageKind,
          stale: isStale,
          fileHandle: localRecord.fileHandle,
          orderKey: localRecord.orderKey,
        }
      : undefined,
    availability: hasLocal && !isStale ? 'synced' : 'cloud-only',
    source: hasLocal && !isStale ? 'local' : 'cloud',
  };
}

export function createInitialPlaylistState(): PlaylistState {
  return {
    items: [],
    activeId: null,
    isPlaying: false,
    volume: 1.0,
    isMuted: false,
    isFading: false,
    currentTime: 0,
    duration: 0,
    isProjected: false,
    projectStatus: 'off',
  };
}

export function addPlaylistItems(state: PlaylistState, newItems: PlaylistItem[]): PlaylistState {
  if (newItems.length === 0) return state;

  const existingIds = new Set(state.items.map((i) => i.id));
  const filtered = newItems.filter((i) => !existingIds.has(i.id));
  if (filtered.length === 0) return state;

  const updatedItems = [...state.items, ...filtered];
  const activeId = state.activeId ?? updatedItems[0]?.id ?? null;

  return {
    ...state,
    items: updatedItems,
    activeId,
  };
}

export function removePlaylistItem(state: PlaylistState, id: string): PlaylistState {
  // Invariant: Currently loaded/playing item cannot be removed while playing
  if (state.isPlaying && state.activeId === id) {
    return state;
  }

  const index = state.items.findIndex((i) => i.id === id);
  if (index === -1) return state;

  const updatedItems = state.items.filter((i) => i.id !== id);
  let nextActiveId = state.activeId;

  if (state.activeId === id) {
    nextActiveId = updatedItems[index]?.id ?? updatedItems[index - 1]?.id ?? null;
  }

  return {
    ...state,
    items: updatedItems,
    activeId: nextActiveId,
    isPlaying: nextActiveId ? state.isPlaying : false,
    isProjected: nextActiveId ? state.isProjected : false,
    projectStatus: nextActiveId ? state.projectStatus : 'off',
  };
}

export function movePlaylistItem(state: PlaylistState, fromIndex: number, toIndex: number): PlaylistState {
  if (
    fromIndex < 0 ||
    fromIndex >= state.items.length ||
    toIndex < 0 ||
    toIndex >= state.items.length ||
    fromIndex === toIndex
  ) {
    return state;
  }

  const updated = [...state.items];
  const [removed] = updated.splice(fromIndex, 1);
  if (!removed) return state;
  updated.splice(toIndex, 0, removed);

  return {
    ...state,
    items: updated,
  };
}

/**
 * Progression rule: Audio track auto-advances to the next audio track;
 * halts if next track is video or current track is video.
 */
export function getNextPlaylistItem(currentId: string | null, items: PlaylistItem[]): PlaylistItem | null {
  if (!currentId || items.length === 0) return null;

  const index = items.findIndex((i) => i.id === currentId);
  if (index === -1) return null;

  const current = items[index];
  if (!current || current.type === 'video') {
    // Current video track never auto-advances
    return null;
  }

  const nextIndex = index + 1;
  if (nextIndex >= items.length) {
    return null;
  }

  const next = items[nextIndex];
  if (!next || next.type === 'video') {
    // Halts if next track is video
    return null;
  }

  return next;
}

export function getPrevPlaylistItem(currentId: string | null, items: PlaylistItem[]): PlaylistItem | null {
  if (!currentId || items.length === 0) return null;

  const index = items.findIndex((i) => i.id === currentId);
  if (index <= 0) return null;

  return items[index - 1] ?? null;
}

export function selectPlaylistItem(state: PlaylistState, id: string): PlaylistState {
  if (state.activeId === id) return state;

  return {
    ...state,
    activeId: id,
    currentTime: 0,
    isProjected: false,
    projectStatus: 'off',
  };
}

export function canProjectMediaItem(item: PlaylistItem | null | undefined): boolean {
  return Boolean(item && item.type === 'video');
}
