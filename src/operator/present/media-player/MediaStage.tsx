import {
  memo,
  useEffect,
  useRef,
  useCallback,
  type RefObject,
} from 'react';
import type { MediaStore } from './media-store';
import type { MediaEngine } from './media-engine';
import { getNextPlaylistItem, type PlaylistItem } from './playlist-model';

export interface MediaStageProps {
  store: MediaStore;
  engine: MediaEngine;
  audioRef: RefObject<HTMLAudioElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  onToastError?: (message: string) => void;
}

export const MediaStage = memo(function MediaStage({
  store,
  engine,
  audioRef,
  videoRef,
  onToastError,
}: MediaStageProps) {
  const activeItemRef = useRef<PlaylistItem | null>(null);

  // Keep track of active item
  useEffect(() => {
    return store.subscribe(() => {
      const state = store.getSnapshot();
      const current = state.items.find((i) => i.id === state.activeId) ?? null;
      activeItemRef.current = current;
    });
  }, [store]);

  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      store.dispatch({ type: 'SET_TIME', currentTime: el.currentTime });
    },
    [store]
  );

  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      store.dispatch({ type: 'SET_DURATION', duration: el.duration || 0 });
    },
    [store]
  );

  const handlePlay = useCallback(() => {
    store.dispatch({ type: 'SET_PLAYING', isPlaying: true });
  }, [store]);

  const handlePause = useCallback(() => {
    store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
  }, [store]);

  const handleEnded = useCallback(() => {
    const state = store.getSnapshot();
    const currentId = state.activeId;
    const nextItem = getNextPlaylistItem(currentId, state.items);

    // Track finish teardown: Always disable projection to protect sanctuary screen
    store.dispatch({ type: 'SET_PROJECTED', isProjected: false });
    store.dispatch({ type: 'SET_PROJECT_STATUS', projectStatus: 'off' });

    if (nextItem) {
      // Auto-advance to next audio track
      store.dispatch({ type: 'SELECT_ITEM', id: nextItem.id });
      // Next tick play
      setTimeout(() => {
        void engine.play();
      }, 50);
    } else {
      // Halt playback, keep dock active without abrupt disappearance
      store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
    }
  }, [store, engine]);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      const mediaErr = el.error;
      const errorMsg = mediaErr ? `MEDIA_ERR_${mediaErr.code}: ${mediaErr.message || 'Decode error'}` : 'Gagal memutar media';

      store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
      store.dispatch({ type: 'SET_PROJECTED', isProjected: false });
      store.dispatch({ type: 'SET_PROJECT_STATUS', projectStatus: 'error' });

      const state = store.getSnapshot();
      if (state.activeId) {
        store.dispatch({
          type: 'UPDATE_ITEM_STATUS',
          id: state.activeId,
          status: 'error',
          errorMessage: 'Gagal',
        });
      }

      if (onToastError) {
        onToastError(errorMsg);
      }
    },
    [store, onToastError]
  );

  return (
    <div
      data-testid="media-stage-host"
      className="hidden"
      aria-hidden="true"
      style={{ display: 'none' }}
    >
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
      />
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
      />
    </div>
  );
});
