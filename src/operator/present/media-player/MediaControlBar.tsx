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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MediaStore } from './media-store';
import type { MediaEngine } from './media-engine';
import { canProjectMediaItem, type PlaylistState, type PlaylistItem } from './playlist-model';
import { routePlaybackSource } from './playback-router';
import { useT } from '@/lib/i18n/operator';

export interface MediaControlBarProps {
  store: MediaStore;
  engine: MediaEngine;
  onOpenDrawer: () => void;
  className?: string;
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
}: MediaControlBarProps) {
  const { t } = useT();
  const [state, setState] = useState<PlaylistState>(store.getSnapshot());
  const [seekingTime, setSeekingTime] = useState<number | null>(null);
  const isSeekingRef = useRef(false);

  useEffect(() => {
    return store.subscribe(() => {
      setState(store.getSnapshot());
    });
  }, [store]);

  const activeItem = state.items.find((i) => i.id === state.activeId) || null;
  const isCued = Boolean(activeItem);
  const isVideo = activeItem?.type === 'video';

  const routeResult = activeItem ? routePlaybackSource(activeItem) : null;
  const activeSource = activeItem?.source || routeResult?.source || 'cloud';

  const handlePlayPause = useCallback(async () => {
    if (!isCued) return;
    if (state.isPlaying) {
      await engine.pause();
      store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
    } else {
      const res = await engine.play();
      if (res.success) {
        store.dispatch({ type: 'SET_PLAYING', isPlaying: true });
      }
    }
  }, [isCued, state.isPlaying, engine, store]);

  const handleStop = useCallback(() => {
    if (!isCued) return;
    engine.pause();
    engine.seek(0);
    store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
    store.dispatch({ type: 'SET_TIME', currentTime: 0 });
  }, [isCued, engine, store]);

  const handleFadeOut = useCallback(async () => {
    if (!isCued || !state.isPlaying) return;
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
  }, [isCued, state.isPlaying, state.volume, engine, store]);

  const handleToggleMute = useCallback(() => {
    if (!isCued) return;
    const nextMuted = !state.isMuted;
    engine.setMuted(nextMuted);
    store.dispatch({ type: 'SET_MUTED', isMuted: nextMuted });
  }, [isCued, state.isMuted, engine, store]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      engine.setVolume(val);
      store.dispatch({ type: 'SET_VOLUME', volume: val });
    },
    [engine, store]
  );

  const handleToggleProject = useCallback(() => {
    if (!isCued || !activeItem || !canProjectMediaItem(activeItem)) return;
    const nextProjected = !state.isProjected;
    store.dispatch({ type: 'SET_PROJECTED', isProjected: nextProjected });
    store.dispatch({
      type: 'SET_PROJECT_STATUS',
      projectStatus: nextProjected ? 'on_screen' : 'off',
    });
  }, [isCued, activeItem, state.isProjected, store]);

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
      isSeekingRef.current = false;
      engine.seek(val);
      store.dispatch({ type: 'SET_TIME', currentTime: val });
      setSeekingTime(null);
    },
    [engine, store]
  );

  const handleSeekPointerUp = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      commitSeek(parseFloat(e.currentTarget.value));
    },
    [commitSeek]
  );

  const handleSeekKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
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

  const displayTime = seekingTime ?? state.currentTime;
  const duration = state.duration || activeItem?.duration || 0;

  return (
    <div
      data-testid="media-control-bar"
      aria-label="Media Control Bar"
      className={cn(
        'w-full h-13 shrink-0 px-3 bg-card/95 border-b border-border shadow-xs flex items-center justify-between gap-3 select-none text-xs transition-opacity',
        !isCued && 'opacity-60 bg-muted/20',
        className
      )}
    >
      {/* 1. Left Panic Group: Play/Pause, Stop, Fade, Mute, Volume Slider */}
      <div className="flex items-center gap-1.5 shrink-0" data-testid="media-panic-group">
        <Button
          type="button"
          size="sm"
          variant={state.isPlaying ? 'default' : 'outline'}
          data-testid="media-control-bar-play"
          disabled={!isCued}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void handlePlayPause()}
          className="h-8 px-2.5 gap-1.5 font-medium"
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
        <div className="hidden sm:flex items-center gap-1.5 w-24 ml-0.5">
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
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary focus:outline-none"
          />
        </div>
      </div>

      {/* 2. Center: Media Type Icon, Track Name, Source Badge, Current/Total Time, Seekbar */}
      <div className="flex flex-1 items-center gap-2.5 min-w-0 max-w-2xl px-1">
        {activeItem ? (
          <>
            <div className="flex items-center gap-1.5 shrink-0 max-w-[12rem] min-w-0">
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
                onPointerUp={handleSeekPointerUp}
                onKeyUp={handleSeekKeyUp}
                onBlur={handleSeekBlur}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label={t('media.dock.seekAriaLabel')}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary focus:outline-none"
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

      {/* 3. Right: Projector Video Toggle & Drawer Launcher */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Bidirectional Projector Toggle */}
        <Button
          type="button"
          size="sm"
          variant={state.isProjected ? 'default' : 'outline'}
          data-testid="media-control-bar-project"
          disabled={!isCued || !isVideo}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleToggleProject}
          className={cn(
            'h-8 px-2.5 gap-1.5 text-xs font-semibold',
            state.isProjected
              ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
              : 'text-muted-foreground hover:text-foreground',
            !isVideo && 'opacity-40'
          )}
          title={
            !isVideo
              ? t('media.controlBar.videoOnlyTooltip')
              : state.isProjected
              ? t('media.topBar.takeOffTitle')
              : t('media.topBar.projectVideoTitle')
          }
        >
          {state.isProjected ? (
            <>
              <Monitor className="h-3.5 w-3.5" />
              <span>{t('media.topBar.takeOffLabel')}</span>
            </>
          ) : (
            <>
              <MonitorOff className="h-3.5 w-3.5" />
              <span>{t('media.topBar.projectVideoLabel')}</span>
            </>
          )}
        </Button>

        {/* Drawer Launcher */}
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
    </div>
  );
});
