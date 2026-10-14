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
import {
  routePlaybackSource,
  resolveLazyMediaUrl,
  revokeActiveMediaBlobUrl,
} from './playback-router';

export interface MediaStageProps {
  store: MediaStore;
  engine: MediaEngine;
  audioRef: RefObject<HTMLAudioElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  onToastError?: (message: string) => void;
  mutedOverride?: boolean;
  isInert?: boolean;
}

export const MediaStage = memo(function MediaStage({
  store,
  engine,
  audioRef,
  videoRef,
  onToastError,
  mutedOverride = false,
  isInert = false,
}: MediaStageProps) {
  const activeItemRef = useRef<PlaylistItem | null>(null);
  const playGenerationRef = useRef(0);
  const activeBlobRevokeRef = useRef<(() => void) | null>(null);
  const [isRepeatOne, setIsRepeatOne] = useState(() => store.getSnapshot().repeatMode === 'one');

  // Revoke any active lazy blob URL on unmount
  useEffect(() => {
    return () => {
      activeBlobRevokeRef.current?.();
      activeBlobRevokeRef.current = null;
      revokeActiveMediaBlobUrl();
    };
  }, []);

  // Enforce zero-sound mute guarantee and inert resource stripping on mount and on mode change
  useEffect(() => {
    if (mutedOverride || isInert) {
      if (audioRef.current) {
        audioRef.current.muted = true;
        audioRef.current.volume = 0;
      }
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.volume = 0;
      }
    }
  }, [mutedOverride, isInert, audioRef, videoRef]);

  // Keep track of active item and synchronize src (guarded: fully inert when isInert is true)
  useEffect(() => {
    if (isInert) {
      playGenerationRef.current++;
      activeBlobRevokeRef.current?.();
      activeBlobRevokeRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
      }
      return;
    }

    const unsubscribe = store.subscribe(() => {
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

        const gen = ++playGenerationRef.current;
        const route = routePlaybackSource(current);
        const initialUrl = route.resolvedUrl || current.url;

        const applyTargetUrl = (targetUrl: string, revoke?: () => void) => {
          if (playGenerationRef.current !== gen) {
            revoke?.();
            return;
          }

          if (activeBlobRevokeRef.current) {
            activeBlobRevokeRef.current();
            activeBlobRevokeRef.current = null;
          }
          if (revoke) {
            activeBlobRevokeRef.current = revoke;
          }

          const baseVol = mutedOverride
          ? 0
          : typeof engine.getBaseVolume === 'function'
          ? engine.getBaseVolume()
          : state.volume;
          const effectiveMuted = mutedOverride ? true : state.isMuted;

          if (current.type === 'video') {
            if (videoRef.current) {
              const el = videoRef.current;
              videoRef.current.src = targetUrl;
              videoRef.current.muted = effectiveMuted;
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
              audioRef.current.src = targetUrl;
              audioRef.current.muted = effectiveMuted;
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
        };

        if (initialUrl.startsWith('/local-media/') && !route.canRouteLocal) {
          void resolveLazyMediaUrl(current)
            .then((lazy) => {
              if (playGenerationRef.current === gen && lazy.url) {
                applyTargetUrl(lazy.url, lazy.revoke);
              } else {
                lazy.revoke?.();
                applyTargetUrl(initialUrl);
              }
            })
            .catch(() => {
              applyTargetUrl(initialUrl);
            });
        } else {
          applyTargetUrl(initialUrl);
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

    return () => {
      playGenerationRef.current++;
      activeBlobRevokeRef.current?.();
      activeBlobRevokeRef.current = null;
      unsubscribe();
    };
  }, [store, engine, audioRef, videoRef, mutedOverride, isInert]);

  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      if (isInert) return;
      const el = e.currentTarget;
      store.dispatch({ type: 'SET_TIME', currentTime: el.currentTime });
    },
    [store, isInert]
  );

  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      if (isInert) return;
      const el = e.currentTarget;
      store.dispatch({ type: 'SET_DURATION', duration: el.duration || 0 });
    },
    [store, isInert]
  );

  const handlePlay = useCallback(() => {
    if (isInert) return;
    store.dispatch({ type: 'SET_PLAYING', isPlaying: true });
  }, [store, isInert]);

  const handlePause = useCallback(() => {
    if (isInert) return;
    store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
  }, [store, isInert]);

  const handleEnded = useCallback(() => {
    if (isInert) return;
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
  }, [store, engine, isInert]);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      if (isInert) return;
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
    [store, onToastError, isInert]
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
        muted={mutedOverride ? true : undefined}
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
        muted={mutedOverride ? true : undefined}
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
