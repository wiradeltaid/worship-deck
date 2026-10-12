import type {
  PlaylistState,
  PlaylistItem,
  ProjectStatus,
  MediaStatus,
  RepeatMode,
} from './playlist-model';
import {
  createInitialPlaylistState,
  addPlaylistItems,
  removePlaylistItem,
  movePlaylistItem,
  selectPlaylistItem,
} from './playlist-model';

export type MediaAction =
  | { type: 'ADD_ITEMS'; items: PlaylistItem[] }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'MOVE_ITEM'; fromIndex: number; toIndex: number }
  | { type: 'SELECT_ITEM'; id: string }
  | { type: 'SET_PLAYING'; isPlaying: boolean }
  | { type: 'SET_TIME'; currentTime: number }
  | { type: 'SET_DURATION'; duration: number }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'SET_MUTED'; isMuted: boolean }
  | { type: 'SET_FADING'; isFading: boolean }
  | { type: 'SET_PROJECTED'; isProjected: boolean }
  | { type: 'SET_PROJECT_STATUS'; projectStatus: ProjectStatus }
  | { type: 'SET_SHUFFLE'; shuffle: boolean }
  | { type: 'SET_REPEAT_MODE'; repeatMode: RepeatMode }
  | { type: 'UPDATE_ITEM_STATUS'; id: string; status: MediaStatus; errorMessage?: string }
  | { type: 'UPDATE_ITEM'; id: string; patch: Partial<PlaylistItem> }
  | { type: 'RESET' };

export interface MediaStore {
  getSnapshot: () => PlaylistState;
  subscribe: (listener: () => void) => () => void;
  dispatch: (action: MediaAction) => void;
}

export function createMediaStore(initialState?: Partial<PlaylistState>): MediaStore {
  let state: PlaylistState = {
    ...createInitialPlaylistState(),
    ...initialState,
  };

  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) {
      listener();
    }
  }

  function reducer(current: PlaylistState, action: MediaAction): PlaylistState {
    switch (action.type) {
      case 'ADD_ITEMS':
        return addPlaylistItems(current, action.items);

      case 'REMOVE_ITEM':
        return removePlaylistItem(current, action.id);

      case 'MOVE_ITEM':
        return movePlaylistItem(current, action.fromIndex, action.toIndex);

      case 'SELECT_ITEM':
        return selectPlaylistItem(current, action.id);

      case 'SET_PLAYING':
        if (current.isPlaying === action.isPlaying) return current;
        return { ...current, isPlaying: action.isPlaying };

      case 'SET_TIME':
        if (Math.abs(current.currentTime - action.currentTime) < 0.05) return current;
        return { ...current, currentTime: action.currentTime };

      case 'SET_DURATION':
        if (current.duration === action.duration) return current;
        return { ...current, duration: action.duration };

      case 'SET_VOLUME':
        if (current.volume === action.volume) return current;
        return { ...current, volume: Math.max(0, Math.min(1, action.volume)) };

      case 'SET_MUTED':
        if (current.isMuted === action.isMuted) return current;
        return { ...current, isMuted: action.isMuted };

      case 'SET_FADING':
        if (current.isFading === action.isFading) return current;
        return { ...current, isFading: action.isFading };

      case 'SET_PROJECTED':
        if (current.isProjected === action.isProjected) return current;
        return {
          ...current,
          isProjected: action.isProjected,
          projectStatus: action.isProjected ? 'sending' : 'off',
        };

      case 'SET_PROJECT_STATUS':
        if (current.projectStatus === action.projectStatus) return current;
        return { ...current, projectStatus: action.projectStatus };

      case 'SET_SHUFFLE':
        if (current.shuffle === action.shuffle) return current;
        return { ...current, shuffle: action.shuffle };

      case 'SET_REPEAT_MODE':
        if (current.repeatMode === action.repeatMode) return current;
        return { ...current, repeatMode: action.repeatMode };

      case 'UPDATE_ITEM_STATUS': {
        const itemIndex = current.items.findIndex((i) => i.id === action.id);
        if (itemIndex === -1) return current;
        const target = current.items[itemIndex];
        if (!target) return current;
        const updated = [...current.items];
        updated[itemIndex] = {
          ...target,
          status: action.status,
          errorMessage: action.errorMessage,
        };
        return { ...current, items: updated };
      }

      case 'UPDATE_ITEM': {
        const itemIndex = current.items.findIndex((i) => i.id === action.id);
        if (itemIndex === -1) return current;
        const target = current.items[itemIndex];
        if (!target) return current;
        const updated = [...current.items];
        updated[itemIndex] = {
          ...target,
          ...action.patch,
        };
        return { ...current, items: updated };
      }

      case 'RESET':
        return createInitialPlaylistState();

      default:
        return current;
    }
  }

  return {
    getSnapshot() {
      return state;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(action: MediaAction) {
      const nextState = reducer(state, action);
      if (nextState !== state) {
        state = nextState;
        notify();
      }
    },
  };
}
