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
  cloud?: CloudPresence;
  local?: LocalPresence;
}

export interface UnifiedPlaylistItem extends PlaylistItem {
  cloud?: CloudPresence;
  local?: LocalPresence;
  availability?: MediaAvailability;
}

export type RepeatMode = 'off' | 'all' | 'one';

export const MEDIA_SHUFFLE_STORAGE_KEY = 'worshipdeck:media:shuffle';
export const MEDIA_REPEAT_STORAGE_KEY = 'worshipdeck:media:repeatMode';

export function loadSavedMediaPreferences(): { shuffle: boolean; repeatMode: RepeatMode } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { shuffle: false, repeatMode: 'off' };
  }
  try {
    const rawShuffle = window.localStorage.getItem(MEDIA_SHUFFLE_STORAGE_KEY);
    const rawRepeat = window.localStorage.getItem(MEDIA_REPEAT_STORAGE_KEY);
    const shuffle = rawShuffle === 'true';
    const repeatMode: RepeatMode =
      rawRepeat === 'one' || rawRepeat === 'all' || rawRepeat === 'off' ? rawRepeat : 'off';
    return { shuffle, repeatMode };
  } catch {
    return { shuffle: false, repeatMode: 'off' };
  }
}

export function saveMediaPreference(key: 'shuffle' | 'repeatMode', value: boolean | RepeatMode): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (key === 'shuffle') {
      window.localStorage.setItem(MEDIA_SHUFFLE_STORAGE_KEY, String(value));
    } else {
      window.localStorage.setItem(MEDIA_REPEAT_STORAGE_KEY, String(value));
    }
  } catch {
    // Graceful fallback for restricted/private storage environments
  }
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
  shuffle: boolean;
  repeatMode: RepeatMode;
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
  const prefs = loadSavedMediaPreferences();
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
    shuffle: prefs.shuffle,
    repeatMode: prefs.repeatMode,
  };
}

export function addPlaylistItems(state: PlaylistState, newItems: PlaylistItem[]): PlaylistState {
  if (newItems.length === 0) return state;

  const existingIds = new Set(state.items.map((i) => i.id));
  const existingShas = new Set(
    state.items
      .map((i) => i.sha256?.toLowerCase())
      .filter((s): s is string => Boolean(s))
  );

  const filtered = newItems.filter((i) => {
    if (existingIds.has(i.id)) return false;
    const sha = i.sha256?.toLowerCase();
    if (sha && existingShas.has(sha)) return false;
    return true;
  });
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

export function resolveNextPlaylistItem(
  state: PlaylistState,
  rng: () => number = Math.random
): PlaylistItem | null {
  const current = state.items.find((i) => i.id === state.activeId);
  if (!current || state.items.length === 0) return null;

  // 1. Repeat-One strictly overrides shuffle and sequential advance (loops current audio or video track)
  if (state.repeatMode === 'one') {
    return current;
  }

  // 2. Shuffle mode (across all media items: audio and video)
  if (state.shuffle) {
    const candidates = state.items.filter((i) => i.id !== state.activeId);
    if (candidates.length > 0) {
      const pickedIndex = Math.floor(rng() * candidates.length);
      return candidates[pickedIndex] ?? null;
    }
    // Only 1 item in playlist: loop back if repeatMode === 'all'
    if (state.repeatMode === 'all') {
      return state.items[0] ?? null;
    }
    return null;
  }

  // 3. Sequential advance (across all media items: audio and video)
  const currentIndex = state.items.findIndex((i) => i.id === state.activeId);
  if (currentIndex === -1) return null;

  const nextIndex = currentIndex + 1;
  if (nextIndex < state.items.length) {
    return state.items[nextIndex] ?? null;
  }

  // Reached end of playlist: loop to start if repeatMode === 'all'
  if (state.repeatMode === 'all') {
    return state.items[0] ?? null;
  }

  return null;
}

export function getPrevPlaylistItem(currentId: string | null, items: PlaylistItem[]): PlaylistItem | null {
  if (!currentId || items.length === 0) return null;

  const index = items.findIndex((i) => i.id === currentId);
  if (index <= 0) return null;

  return items[index - 1] ?? null;
}

export function selectPlaylistItem(state: PlaylistState, id: string): PlaylistState {
  if (state.activeId === id) return state;

  const target = state.items.find((i) => i.id === id);
  const isVideo = target?.type === 'video';

  return {
    ...state,
    activeId: id,
    currentTime: 0,
    isProjected: state.isProjected,
    projectStatus: state.isProjected ? (isVideo ? 'on_screen' : 'sending') : 'off',
  };
}

export function canProjectMediaItem(item: PlaylistItem | null | undefined): boolean {
  return Boolean(item && item.type === 'video');
}
