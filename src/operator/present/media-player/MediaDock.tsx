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
  Volume2,
  VolumeX,
  TrendingDown,
  MonitorOff,
  Square,
  ListMusic,
  Video,
  Music,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MediaStore } from './media-store';
import type { MediaEngine } from './media-engine';
import type { PlaylistState, PlaylistItem } from './playlist-model';
import { useT } from '@/lib/i18n/operator';

export interface MediaDockProps {
  store: MediaStore;
  engine: MediaEngine;
  onOpenDrawer: () => void;
  onDismiss?: () => void;
  className?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const MediaDock = memo(function MediaDock({
  store,
  engine,
  onOpenDrawer,
  onDismiss,
  className,
}: MediaDockProps) {
  const { t } = useT();
  const [state, setState] = useState<PlaylistState>(store.getSnapshot());
  const [seekingTime, setSeekingTime] = useState<number | null>(null);
  const isSeekingRef = useRef(false);

  useEffect(() => {
    return store.subscribe(() => {
      setState(store.getSnapshot());
    });
  }, [store]);

  const activeItem: PlaylistItem | undefined = state.items.find(
    (i) => i.id === state.activeId
  );

  const handlePlayPause = useCallback(() => {
    if (state.isPlaying) {
      engine.pause();
      store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
    } else {
      void engine.play().then((res) => {
        if (res.success) {
          store.dispatch({ type: 'SET_PLAYING', isPlaying: true });
        }
      });
    }
  }, [state.isPlaying, engine, store]);

  const handleFade = useCallback(() => {
    if (engine.isFading()) {
      engine.cancelFade();
      store.dispatch({ type: 'SET_FADING', isFading: false });
    } else {
      store.dispatch({ type: 'SET_FADING', isFading: true });
      void engine.fade({ durationMs: 3000 }).finally(() => {
        store.dispatch({ type: 'SET_FADING', isFading: false });
        store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
      });
    }
  }, [engine, store]);

  const handleMute = useCallback(() => {
    const nextMuted = !state.isMuted;
    engine.setMuted(nextMuted);
    store.dispatch({ type: 'SET_MUTED', isMuted: nextMuted });
  }, [state.isMuted, engine, store]);

  const handleTakeOffScreen = useCallback(() => {
    store.dispatch({ type: 'SET_PROJECTED', isProjected: false });
    store.dispatch({ type: 'SET_PROJECT_STATUS', projectStatus: 'off' });
  }, [store]);

  const handleStopAndClose = useCallback(() => {
    engine.pause();
    engine.seek(0);
    store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
    store.dispatch({ type: 'SET_TIME', currentTime: 0 });
    store.dispatch({ type: 'SET_PROJECTED', isProjected: false });
    store.dispatch({ type: 'SET_PROJECT_STATUS', projectStatus: 'off' });
    if (onDismiss) {
      onDismiss();
    }
  }, [engine, store, onDismiss]);

  const handleSeekChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setSeekingTime(val);
      isSeekingRef.current = true;
    },
    []
  );

  const handleSeekCommit = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      isSeekingRef.current = false;
      const val = parseFloat(e.currentTarget.value);
      engine.seek(val);
      store.dispatch({ type: 'SET_TIME', currentTime: val });
      setSeekingTime(null);
    },
    [engine, store]
  );

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      engine.setVolume(val);
      store.dispatch({ type: 'SET_VOLUME', volume: val });
    },
    [engine, store]
  );

  if (!activeItem && state.items.length === 0) {
    return null;
  }

  const displayTime = seekingTime ?? state.currentTime;
  const duration = state.duration || activeItem?.duration || 0;

  return (
    <aside
      data-testid="media-dock"
      aria-label="Media Player Dock"
      className={cn(
        'relative flex h-14 w-full items-center justify-between gap-3 border-t border-border bg-card/95 px-3 backdrop-blur shadow-md select-none',
        className
      )}
    >
      {/* 1. Left Panic Group */}
      <div className="flex items-center gap-1.5 shrink-0" data-testid="media-panic-group">
        {/* Play/Pause */}
        <Button
          type="button"
          size="sm"
          variant={state.isPlaying ? 'default' : 'secondary'}
          data-testid="media-panic-play-pause"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handlePlayPause}
          className="h-8 w-8 p-0"
          title={state.isPlaying ? t('media.topBar.pauseTitle') : t('media.topBar.playTitle')}
        >
          {state.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>

        {/* Fade Out (3s) */}
        <Button
          type="button"
          size="sm"
          variant={state.isFading ? 'destructive' : 'outline'}
          data-testid="media-panic-fade"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleFade}
          disabled={!state.isPlaying && !state.isFading}
          className="h-8 gap-1 px-2 text-xs"
          title={t('media.topBar.fadeTitle')}
        >
          <TrendingDown className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('media.topBar.fadeLabel')}</span>
        </Button>

        {/* Mute */}
        <Button
          type="button"
          size="sm"
          variant={state.isMuted ? 'destructive' : 'outline'}
          data-testid="media-panic-mute"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleMute}
          className="h-8 w-8 p-0"
          title={state.isMuted ? t('media.topBar.unmuteTitle') : t('media.topBar.muteTitle')}
        >
          {state.isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>

        {/* Take off screen (if projected) */}
        {state.isProjected && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            data-testid="media-panic-take-off-screen"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleTakeOffScreen}
            className="h-8 gap-1 px-2 text-xs"
            title={t('media.topBar.takeOffTitle')}
          >
            <MonitorOff className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t('media.topBar.takeOffLabel')}</span>
          </Button>
        )}

        {/* Stop & Tutup */}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          data-testid="media-panic-stop"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleStopAndClose}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title={t('media.topBar.stopTitle')}
        >
          <Square className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 2. Center: Track Info, Seekbar, and Time */}
      <div className="flex flex-1 items-center gap-3 min-w-0 max-w-2xl">
        <div className="flex items-center gap-2 min-w-0 max-w-[12rem] shrink-0">
          {activeItem?.type === 'video' ? (
            <Video className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          ) : (
            <Music className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <span className="truncate text-xs font-medium text-foreground">
            {activeItem?.name || t('media.topBar.emptyPlaceholder')}
          </span>
          {state.isProjected && (
            <span className="rounded bg-blue-500/20 px-1 py-0.2 text-[9px] font-semibold text-blue-700 dark:text-blue-300 uppercase shrink-0">
              {t('media.dock.projectedBadge')}
            </span>
          )}
        </div>

        {/* Seekbar */}
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
            onPointerUp={handleSeekCommit}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={t('media.dock.seekAriaLabel')}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary focus:outline-none"
          />
          <span className="text-[11px] font-mono text-muted-foreground tabular-nums shrink-0">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* 3. Right: Volume and Playlist Drawer Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 w-24">
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={state.isMuted ? 0 : state.volume}
            onChange={handleVolumeChange}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={t('media.dock.volumeAriaLabel')}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary focus:outline-none"
          />
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="media-dock-open-drawer"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onOpenDrawer}
          className="h-8 gap-1.5 px-2 text-xs font-medium"
          title={t('media.dock.openPlaylist')}
        >
          <ListMusic className="h-3.5 w-3.5" />
          <span className="hidden md:inline">{t('media.dock.playlistLabel')}</span>
        </Button>
      </div>
    </aside>
  );
});
