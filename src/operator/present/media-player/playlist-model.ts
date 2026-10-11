export type MediaType = 'audio' | 'video';
export type MediaStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ProjectStatus = 'off' | 'sending' | 'on_screen' | 'error';

export interface PlaylistItem {
  id: string;
  name: string;
  url: string;
  type: MediaType;
  duration?: number;
  size?: number;
  status?: MediaStatus;
  errorMessage?: string;
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
