import {
  memo,
  useState,
  useEffect,
  useRef,
  useCallback,
  type RefObject,
} from 'react';
import type { MediaStore } from './media-store';
import type { MediaEngine } from './media-engine';
import { resolveNextPlaylistItem, type PlaylistItem } from './playlist-model';

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
  const [isRepeatOne, setIsRepeatOne] = useState(() => store.getSnapshot().repeatMode === 'one');

  // Keep track of active item and synchronize src
  useEffect(() => {
    return store.subscribe(() => {
      const state = store.getSnapshot();
      const repeatOne = state.repeatMode === 'one';
      setIsRepeatOne(repeatOne);
      if (audioRef.current) audioRef.current.loop = repeatOne;
      if (videoRef.current) videoRef.current.loop = repeatOne;

      const current = state.items.find((i) => i.id === state.activeId) ?? null;
      const prev = activeItemRef.current;
      activeItemRef.current = current;

      if (current && (!prev || prev.id !== current.id || prev.url !== current.url)) {
        if (!current.url) {
          if (audioRef.current) audioRef.current.pause();
          if (videoRef.current) videoRef.current.pause();
          return;
        }

        const baseVol = typeof engine.getBaseVolume === 'function' ? engine.getBaseVolume() : state.volume;
        if (current.type === 'video') {
          if (videoRef.current) {
            const el = videoRef.current;
            videoRef.current.src = current.url;
            videoRef.current.muted = state.isMuted;
            videoRef.current.volume = baseVol;
            videoRef.current.load();
            if (state.isPlaying) {
              const startPlay = () => {
                void el.play().catch(() => {
                  store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
                });
              };
              if (el.readyState >= 2) {
                startPlay();
              } else {
                el.addEventListener('canplay', startPlay, { once: true });
              }
            }
          }
          if (audioRef.current) {
            audioRef.current.pause();
          }
        } else {
          if (audioRef.current) {
            const el = audioRef.current;
            audioRef.current.src = current.url;
            audioRef.current.muted = state.isMuted;
            audioRef.current.volume = baseVol;
            audioRef.current.load();
            if (state.isPlaying) {
              const startPlay = () => {
                void el.play().catch(() => {
                  store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
                });
              };
              if (el.readyState >= 2) {
                startPlay();
              } else {
                el.addEventListener('canplay', startPlay, { once: true });
              }
            }
          }
          if (videoRef.current) {
            videoRef.current.pause();
          }
        }
      } else if (!current) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.removeAttribute('src');
        }
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.removeAttribute('src');
        }
      }
    });
  }, [store, engine, audioRef, videoRef]);

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
    const nextItem = resolveNextPlaylistItem(state);

    if (nextItem) {
      if (nextItem.id === state.activeId) {
        // Replay active track (repeat-one or single-audio loop):
        // Route authoritatively via engine to maintain single-owner state and volume handling
        engine.seek(0);
        store.dispatch({ type: 'SET_TIME', currentTime: 0 });
        void engine.play().then((res) => {
          store.dispatch({ type: 'SET_PLAYING', isPlaying: res.success });
        });
      } else {
        // Auto-advance to next track: keep isProjected persistent across items.
        // PresenterOperator will stream video if nextItem is video, or fallback to slides if audio.
        store.dispatch({ type: 'SELECT_ITEM', id: nextItem.id });
        store.dispatch({ type: 'SET_PLAYING', isPlaying: true });
        setTimeout(() => {
          void engine.play().then((res) => {
            if (!res.success) {
              store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
            }
          });
        }, 50);
      }
    } else {
      // Track finish teardown: Always disable projection to protect sanctuary screen
      store.dispatch({ type: 'SET_PROJECTED', isProjected: false });
      store.dispatch({ type: 'SET_PROJECT_STATUS', projectStatus: 'off' });
      // Halt playback, keep dock active without abrupt disappearance
      store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
    }
  }, [store, engine]);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      // Ignore unload errors when element has no src attribute or empty src
      if (!el.currentSrc && !el.getAttribute('src')) {
        return;
      }

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
      className="absolute h-px w-px opacity-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <audio
        ref={audioRef}
        loop={isRepeatOne}
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
        loop={isRepeatOne}
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
