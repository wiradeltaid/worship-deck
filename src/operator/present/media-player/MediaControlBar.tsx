import {
  memo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  TrendingDown,
  Monitor,
  MonitorOff,
  Music,
  Video,
  ListMusic,
  HardDrive,
  Cloud,
  Shuffle,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MediaStore } from './media-store';
import type { MediaEngine } from './media-engine';
import {
  canProjectMediaItem,
  getPrevPlaylistItem,
  resolveNextPlaylistItem,
  type PlaylistState,
  type PlaylistItem,
  type RepeatMode,
} from './playlist-model';
import { routePlaybackSource } from './playback-router';
import { useT } from '@/lib/i18n/operator';
import type { PresenterRemoteIntent } from '@/lib/presenter-remote-client';

export interface MediaControlBarProps {
  store: MediaStore;
  engine: MediaEngine;
  onOpenDrawer?: () => void;
  className?: string;
  isRemote?: boolean;
  onRemoteMediaIntent?: (intent: PresenterRemoteIntent) => void;
  planIdentity?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const MediaControlBar = memo(function MediaControlBar({
  store,
  engine,
  onOpenDrawer,
  className,
  isRemote = false,
  onRemoteMediaIntent,
  planIdentity = '',
}: MediaControlBarProps) {
  const { t } = useT();
  const [state, setState] = useState<PlaylistState>(store.getSnapshot());
  const [seekingTime, setSeekingTime] = useState<number | null>(null);
  const isSeekingRef = useRef(false);
  const lastSeekTargetRef = useRef<number | null>(null);
  const lastSeekPreTimeRef = useRef<number | null>(null);
  const lastSeekCommittedAtRef = useRef<number>(0);

  useEffect(() => {
    return store.subscribe(() => {
      setState(store.getSnapshot());
    });
  }, [store]);

  const activeItem = state.items.find((i) => i.id === state.activeId) || null;
  const isCued = Boolean(activeItem);
  const isVideo = activeItem?.type === 'video';
  const duration = state.duration || activeItem?.duration || 0;

  const routeResult = activeItem ? routePlaybackSource(activeItem) : null;
  const activeSource = activeItem?.source || routeResult?.source || 'cloud';

  const handlePlayPause = useCallback(async () => {
    if (!isCued) return;
    if (onRemoteMediaIntent) {
      onRemoteMediaIntent({
        type: state.isPlaying ? 'media-pause' : 'media-play',
        planIdentity,
      });
      return;
    }
    if (state.isPlaying) {
      await engine.pause();
      store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
    } else {
      const res = await engine.play();
      if (res.success) {
        store.dispatch({ type: 'SET_PLAYING', isPlaying: true });
      }
    }
  }, [isCued, state.isPlaying, onRemoteMediaIntent, planIdentity, engine, store]);

  const handlePrevTrack = useCallback(() => {
    if (!isCued) return;
    if (onRemoteMediaIntent) {
      const prev = getPrevPlaylistItem(state.activeId, state.items);
      if (prev) {
        onRemoteMediaIntent({
          type: 'media-select-item',
          id: prev.id,
          planIdentity,
        });
      }
      return;
    }
    if (state.currentTime > 3) {
      engine.seek(0);
      store.dispatch({ type: 'SET_TIME', currentTime: 0 });
      return;
    }
    const prev = getPrevPlaylistItem(state.activeId, state.items);
    if (prev) {
      store.dispatch({ type: 'SELECT_ITEM', id: prev.id });
      if (state.isPlaying) {
        setTimeout(() => {
          void engine.play().then((res) => {
            if (!res.success) store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
          });
        }, 50);
      }
    }
  }, [isCued, state.currentTime, state.activeId, state.items, state.isPlaying, onRemoteMediaIntent, planIdentity, engine, store]);

  const handleNextTrack = useCallback(() => {
    if (!isCued) return;
    if (onRemoteMediaIntent) {
      const next = resolveNextPlaylistItem(state);
      if (next) {
        onRemoteMediaIntent({
          type: 'media-select-item',
          id: next.id,
          planIdentity,
        });
      }
      return;
    }
    const next = resolveNextPlaylistItem(state);
    if (next) {
      if (next.id === state.activeId) {
        engine.seek(0);
        store.dispatch({ type: 'SET_TIME', currentTime: 0 });
        if (!state.isPlaying) {
          void engine.play().then((res) => {
            store.dispatch({ type: 'SET_PLAYING', isPlaying: res.success });
          });
        }
      } else {
        store.dispatch({ type: 'SELECT_ITEM', id: next.id });
        if (state.isPlaying) {
          setTimeout(() => {
            void engine.play().then((res) => {
              if (!res.success) store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
            });
          }, 50);
        }
      }
    } else {
      // Fallback if at end without repeat: advance to next item in list if available
      const currIdx = state.items.findIndex((i) => i.id === state.activeId);
      if (currIdx >= 0 && currIdx < state.items.length - 1) {
        const nextItem = state.items[currIdx + 1];
        if (nextItem) {
          store.dispatch({ type: 'SELECT_ITEM', id: nextItem.id });
          if (state.isPlaying) {
            setTimeout(() => {
              void engine.play().then((res) => {
                if (!res.success) store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
              });
            }, 50);
          }
        }
      }
    }
  }, [isCued, state, onRemoteMediaIntent, planIdentity, engine, store]);

  const handleStop = useCallback(() => {
    if (!isCued) return;
    if (onRemoteMediaIntent) {
      onRemoteMediaIntent({
        type: 'media-stop',
        planIdentity,
      });
      return;
    }
    engine.pause();
    engine.seek(0);
    store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
    store.dispatch({ type: 'SET_TIME', currentTime: 0 });
  }, [isCued, onRemoteMediaIntent, planIdentity, engine, store]);

  const handleFadeOut = useCallback(async () => {
    if (!isCued || !state.isPlaying) return;
    if (onRemoteMediaIntent) {
      onRemoteMediaIntent({
        type: 'media-fade',
        planIdentity,
      });
      return;
    }
    const originalVolume = state.volume;
    store.dispatch({ type: 'SET_FADING', isFading: true });
    try {
      await engine.fade({
        durationMs: 3000,
        stepIntervalMs: 50,
      });
    } finally {
      store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
      store.dispatch({ type: 'SET_FADING', isFading: false });
      store.dispatch({ type: 'SET_VOLUME', volume: originalVolume });
    }
  }, [isCued, state.isPlaying, state.volume, onRemoteMediaIntent, planIdentity, engine, store]);

  const handleToggleMute = useCallback(() => {
    if (!isCued) return;
    if (onRemoteMediaIntent) {
      onRemoteMediaIntent({
        type: 'media-set-mute',
        muted: !state.isMuted,
        planIdentity,
      });
      return;
    }
    const nextMuted = !state.isMuted;
    engine.setMuted(nextMuted);
    store.dispatch({ type: 'SET_MUTED', isMuted: nextMuted });
  }, [isCued, onRemoteMediaIntent, planIdentity, state.isMuted, engine, store]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (onRemoteMediaIntent) {
        onRemoteMediaIntent({
          type: 'media-set-volume',
          volume: val,
          planIdentity,
        });
        return;
      }
      engine.setVolume(val);
      store.dispatch({ type: 'SET_VOLUME', volume: val });
    },
    [onRemoteMediaIntent, planIdentity, engine, store]
  );

  const handleToggleShuffle = useCallback(() => {
    if (onRemoteMediaIntent) {
      onRemoteMediaIntent({
        type: 'media-toggle-shuffle',
        planIdentity,
      });
      return;
    }
    const nextShuffle = !state.shuffle;
    store.dispatch({ type: 'SET_SHUFFLE', shuffle: nextShuffle });
  }, [state.shuffle, onRemoteMediaIntent, planIdentity, store]);

  const handleCycleRepeat = useCallback(() => {
    if (onRemoteMediaIntent) {
      onRemoteMediaIntent({
        type: 'media-cycle-repeat',
        planIdentity,
      });
      return;
    }
    const nextRepeat: RepeatMode =
      state.repeatMode === 'off' ? 'all' : state.repeatMode === 'all' ? 'one' : 'off';
    store.dispatch({ type: 'SET_REPEAT_MODE', repeatMode: nextRepeat });
  }, [state.repeatMode, onRemoteMediaIntent, planIdentity, store]);

  const handleToggleProject = useCallback(() => {
    if (!isCued) return;
    if (onRemoteMediaIntent) {
      onRemoteMediaIntent({
        type: 'media-toggle-project',
        planIdentity,
      });
      return;
    }
    const nextProjected = !state.isProjected;
    store.dispatch({ type: 'SET_PROJECTED', isProjected: nextProjected });
    store.dispatch({
      type: 'SET_PROJECT_STATUS',
      projectStatus: nextProjected ? (isVideo ? 'on_screen' : 'sending') : 'off',
    });
  }, [isCued, isVideo, state.isProjected, onRemoteMediaIntent, planIdentity, store]);

  const handleSeekChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setSeekingTime(val);
      isSeekingRef.current = true;
    },
    []
  );

  const commitSeek = useCallback(
    (val: number) => {
      if (!isSeekingRef.current) return;
      isSeekingRef.current = false;
      const targetVal = duration > 0 ? Math.max(0, Math.min(val, duration)) : Math.max(0, val);
      if (onRemoteMediaIntent) {
        lastSeekPreTimeRef.current = state.currentTime;
        lastSeekTargetRef.current = targetVal;
        lastSeekCommittedAtRef.current = Date.now();
        store.dispatch({ type: 'SET_TIME', currentTime: targetVal });
        onRemoteMediaIntent({
          type: 'media-seek',
          timeSeconds: targetVal,
          planIdentity,
        });
        setSeekingTime(null);
        return;
      }
      engine.seek(targetVal);
      store.dispatch({ type: 'SET_TIME', currentTime: targetVal });
      setSeekingTime(null);
    },
    [onRemoteMediaIntent, planIdentity, engine, store, duration, state.currentTime]
  );

  const handleSeekPointerDown = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      e.stopPropagation();
      isSeekingRef.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore environments where pointer capture is unsupported
      }
    },
    []
  );

  const handleSeekPointerUp = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      commitSeek(parseFloat(e.currentTarget.value));
    },
    [commitSeek]
  );

  const handleSeekTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLInputElement>) => {
      commitSeek(parseFloat(e.currentTarget.value));
    },
    [commitSeek]
  );

  const handleSeekKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        isSeekingRef.current = true;
        commitSeek(parseFloat(e.currentTarget.value));
      }
    },
    [commitSeek]
  );

  const handleSeekBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (isSeekingRef.current) {
        commitSeek(parseFloat(e.currentTarget.value));
      }
    },
    [commitSeek]
  );

  // Reconcile optimistic seek target: during the 1000ms grace window following a remote seek,
  // ignore regressing host timestamps that lag behind the committed target (handling both forward and backward seek)
  let effectiveCurrentTime = state.currentTime;
  if (onRemoteMediaIntent && lastSeekTargetRef.current !== null) {
    const elapsed = Date.now() - lastSeekCommittedAtRef.current;
    if (elapsed < 1000) {
      const isForward =
        lastSeekPreTimeRef.current === null ||
        lastSeekTargetRef.current >= lastSeekPreTimeRef.current;
      const hasCaughtUp =
        Math.abs(state.currentTime - lastSeekTargetRef.current) <= 0.75 ||
        (isForward
          ? state.currentTime >= lastSeekTargetRef.current
          : state.currentTime <= lastSeekTargetRef.current);

      if (hasCaughtUp) {
        lastSeekTargetRef.current = null;
        lastSeekPreTimeRef.current = null;
        effectiveCurrentTime = state.currentTime;
      } else {
        effectiveCurrentTime = lastSeekTargetRef.current;
      }
    } else {
      lastSeekTargetRef.current = null;
      lastSeekPreTimeRef.current = null;
    }
  }

  const displayTime = seekingTime ?? effectiveCurrentTime;

  return (
    <div
      data-testid="media-control-bar"
      aria-label="Media Control Bar"
      className={cn(
        'w-full h-auto xl:h-13 shrink-0 px-3 py-2 xl:py-0 bg-card/95 border-b border-border shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2 xl:gap-3 select-none text-xs transition-opacity',
        !isCued && 'opacity-60 bg-muted/20',
        className
      )}
    >
      {/* Row 1 on Mobile & Tablet (< xl) / Center metadata & seekbar + Right Drawer Launcher on Desktop (>= xl) */}
      <div
        data-testid="media-control-bar-row-1"
        className="flex items-center justify-between gap-2 w-full min-w-0 xl:contents"
      >
        {/* Track metadata & full-width seekbar */}
        <div className="flex flex-1 items-center gap-2.5 min-w-0 max-w-2xl px-1 xl:order-2">
          {activeItem ? (
            <>
              <div className="flex items-center gap-1.5 shrink-0 max-w-[9rem] sm:max-w-[12rem] min-w-0">
                {isVideo ? (
                  <Video className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                ) : (
                  <Music className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <span className="font-semibold text-foreground truncate text-xs" title={activeItem.name}>
                  {activeItem.name}
                </span>
                <span
                  data-testid="media-source-indicator"
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-bold uppercase shrink-0',
                    activeSource === 'local'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30'
                  )}
                >
                  {activeSource === 'local' ? (
                    <>
                      <HardDrive className="h-2.5 w-2.5" />
                      <span>{t('media.topBar.sourceLocal')}</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="h-2.5 w-2.5" />
                      <span>{t('media.topBar.sourceCloud')}</span>
                    </>
                  )}
                </span>
              </div>

              {/* Seekbar & Time */}
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums shrink-0">
                  {formatTime(displayTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={displayTime}
                  onChange={handleSeekChange}
                  onPointerDown={handleSeekPointerDown}
                  onPointerUp={handleSeekPointerUp}
                  onPointerCancel={handleSeekPointerUp}
                  onTouchEnd={handleSeekTouchEnd}
                  onTouchCancel={handleSeekTouchEnd}
                  onKeyUp={handleSeekKeyUp}
                  onBlur={handleSeekBlur}
                  onMouseDown={(e) => e.stopPropagation()}
                  aria-label={t('media.dock.seekAriaLabel')}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary focus:outline-none touch-none"
                />
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums shrink-0">
                  {formatTime(duration)}
                </span>
              </div>
            </>
          ) : (
            <span className="text-muted-foreground/70 italic text-[11px] mx-auto">
              {t('media.topBar.emptyPlaceholder')}
            </span>
          )}
        </div>

        {/* Playlist Drawer Launcher (Right of Row 1 on mobile/tablet, 4th item on desktop) */}
        {onOpenDrawer && (
          <div className="shrink-0 xl:order-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="media-control-bar-drawer"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onOpenDrawer}
              className="h-8 px-2.5 gap-1.5 text-xs text-foreground font-medium"
              title={t('media.topBar.openDrawerTitle')}
            >
              <ListMusic className="h-3.5 w-3.5 text-primary" />
              <span>{t('media.topBar.drawerCount', { count: state.items.length })}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Row 2 on Mobile & Tablet (< xl) / Left panic controls & Right projector toggle on Desktop (>= xl) */}
      <div
        data-testid="media-control-bar-row-2"
        className="flex items-center justify-between gap-1.5 w-full min-w-0 overflow-x-auto no-scrollbar py-0.5 xl:contents"
      >
        {/* Panic Group: Prev, Play/Pause, Next, Stop, Fade, Mute, Volume Slider, Shuffle, Repeat */}
        <div className="flex items-center gap-1.5 shrink-0 xl:order-1" data-testid="media-panic-group">
          {/* Previous Track */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="media-control-bar-prev"
            disabled={!isCued}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handlePrevTrack}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            title={t('media.controlBar.prevTitle')}
            aria-label={t('media.controlBar.prevTitle')}
          >
            <SkipBack className="h-3.5 w-3.5" />
          </Button>

          {/* Play / Pause Toggle */}
          <Button
            type="button"
            size="sm"
            variant={state.isPlaying ? 'default' : 'outline'}
            data-testid="media-control-bar-play"
            disabled={!isCued}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void handlePlayPause()}
            className="h-8 px-2.5 gap-1.5 font-medium min-w-[40px]"
            title={state.isPlaying ? t('media.topBar.pauseTitle') : t('media.topBar.playTitle')}
          >
            {state.isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                <span>{t('media.topBar.pauseLabel')}</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                <span>{t('media.topBar.playLabel')}</span>
              </>
            )}
          </Button>

          {/* Next Track */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="media-control-bar-next"
            disabled={!isCued}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleNextTrack}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            title={t('media.controlBar.nextTitle')}
            aria-label={t('media.controlBar.nextTitle')}
          >
            <SkipForward className="h-3.5 w-3.5" />
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="media-control-bar-stop"
            disabled={!isCued || (!state.isPlaying && state.currentTime === 0)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void handleStop()}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            title={t('media.topBar.stopTitle')}
          >
            <Square className="h-3.5 w-3.5" />
          </Button>

          {/* Panic: 3s Fade Out with Auto-Pause */}
          <Button
            type="button"
            size="sm"
            variant={state.isFading ? 'default' : 'outline'}
            data-testid="media-control-bar-fade"
            disabled={!isCued || !state.isPlaying || state.isFading}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void handleFadeOut()}
            className={cn(
              'h-8 px-2 gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10',
              state.isFading && 'animate-pulse bg-amber-500/20'
            )}
            title={t('media.topBar.fadeTitle')}
          >
            <TrendingDown className="h-3.5 w-3.5" />
            <span>{t('media.topBar.fadeLabel')}</span>
          </Button>

          {/* Mute Toggle */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="media-control-bar-mute"
            disabled={!isCued}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleMute}
            className={cn(
              'h-8 w-8 p-0',
              state.isMuted
                ? 'bg-destructive/15 text-destructive border-destructive/40'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={state.isMuted ? t('media.topBar.unmuteTitle') : t('media.topBar.muteTitle')}
          >
            {state.isMuted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </Button>

          {/* Volume Slider directly next to Mute */}
          <div className={cn("items-center gap-1.5 ml-0.5", isRemote ? "flex w-20 sm:w-24" : "hidden sm:flex w-24")}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              disabled={!isCued}
              value={state.isMuted ? 0 : state.volume}
              onChange={handleVolumeChange}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={t('media.dock.volumeAriaLabel')}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary focus:outline-none disabled:opacity-40"
            />
          </div>

          {/* Shuffle Mode Toggle */}
          <Button
            type="button"
            size="sm"
            variant={state.shuffle ? 'default' : 'outline'}
            data-testid="media-control-bar-shuffle"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleShuffle}
            className={cn(
              'h-8 w-8 p-0',
              state.shuffle
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={state.shuffle ? t('media.controlBar.shuffleOn') : t('media.controlBar.shuffleOff')}
            aria-label={t('media.controlBar.shuffleLabel')}
          >
            <Shuffle className="h-3.5 w-3.5" />
          </Button>

          {/* 3-State Repeat Mode Cycle (Off -> All -> One -> Off) */}
          <Button
            type="button"
            size="sm"
            variant={state.repeatMode !== 'off' ? 'default' : 'outline'}
            data-testid="media-control-bar-repeat"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCycleRepeat}
            className={cn(
              'h-8 w-8 p-0',
              state.repeatMode !== 'off'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={
              state.repeatMode === 'one'
                ? t('media.controlBar.repeatOne')
                : state.repeatMode === 'all'
                  ? t('media.controlBar.repeatAll')
                  : t('media.controlBar.repeatOff')
            }
            aria-label={t('media.controlBar.repeatLabel')}
          >
            {state.repeatMode === 'one' ? (
              <Repeat1 className="h-3.5 w-3.5" />
            ) : (
              <Repeat className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* Bidirectional Projector Toggle (Row 2 right on mobile/tablet, 3rd item on desktop) */}
        <div className="shrink-0 xl:order-3">
          <Button
            type="button"
            size="sm"
            variant={state.isProjected ? 'default' : 'outline'}
            data-testid="media-control-bar-project"
            disabled={!isCued}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleProject}
            className={cn(
              'h-8 px-2.5 gap-1.5 text-xs font-semibold',
              state.isProjected
                ? isVideo
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                  : 'bg-primary/20 text-primary border-primary/40 hover:bg-primary/30'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={
              state.isProjected
                ? isVideo
                  ? t('media.topBar.takeOffTitle')
                  : t('media.controlBar.projectedAudioFallback')
                : !isVideo
                ? t('media.controlBar.videoOnlyTooltip')
                : t('media.topBar.projectVideoTitle')
            }
          >
            {state.isProjected ? (
              <>
                <Monitor className="h-3.5 w-3.5" />
                <span>{isVideo ? t('media.topBar.takeOffLabel') : t('media.controlBar.projectArmedLabel')}</span>
              </>
            ) : (
              <>
                <MonitorOff className="h-3.5 w-3.5" />
                <span>{t('media.topBar.projectVideoLabel')}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});
