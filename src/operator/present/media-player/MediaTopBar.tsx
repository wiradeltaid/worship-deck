import {
  memo,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Volume1,
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

export interface MediaTopBarProps {
  store: MediaStore;
  engine: MediaEngine;
  onOpenDrawer: () => void;
  className?: string;
}

export const MediaTopBar = memo(function MediaTopBar({
  store,
  engine,
  onOpenDrawer,
  className,
}: MediaTopBarProps) {
  const [state, setState] = useState<PlaylistState>(store.getSnapshot());

  useEffect(() => {
    return store.subscribe(() => {
      setState(store.getSnapshot());
    });
  }, [store]);

  const activeItem = state.items.find((i) => i.id === state.activeId) || null;
  const isCued = Boolean(activeItem);

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
    store.dispatch({ type: 'SET_FADING', isFading: true });
    await engine.fade({
      durationMs: 3000,
      stepIntervalMs: 50,
      onStep: (v) => {
        store.dispatch({ type: 'SET_VOLUME', volume: v });
      },
    });
    store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
    store.dispatch({ type: 'SET_FADING', isFading: false });
  }, [isCued, state.isPlaying, engine, store]);

  const handleToggleMute = useCallback(() => {
    if (!isCued) return;
    const nextMuted = !state.isMuted;
    engine.setMuted(nextMuted);
    store.dispatch({ type: 'SET_MUTED', isMuted: nextMuted });
  }, [isCued, state.isMuted, engine, store]);

  const handleToggleProject = useCallback(() => {
    if (!isCued || !activeItem || !canProjectMediaItem(activeItem)) return;
    const nextProjected = !state.isProjected;
    store.dispatch({ type: 'SET_PROJECTED', isProjected: nextProjected });
  }, [isCued, activeItem, state.isProjected, store]);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      data-testid="media-top-bar"
      aria-label="Media Top Control Bar"
      className={cn(
        'w-full h-11 shrink-0 px-3 bg-card/95 border-b border-border shadow-sm flex items-center justify-between gap-3 select-none text-xs transition-opacity',
        !isCued && 'opacity-60 bg-muted/20',
        className
      )}
    >
      {/* Left: Panic Controls (Always clickable, spacebar focus safe) */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          size="sm"
          variant={state.isPlaying ? 'default' : 'outline'}
          data-testid="media-top-bar-play"
          disabled={!isCued}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void handlePlayPause()}
          className="h-8 px-2.5 gap-1.5 font-medium"
          title={state.isPlaying ? 'Jeda Media (Pause)' : 'Putar Media (Play)'}
        >
          {state.isPlaying ? (
            <>
              <Pause className="h-3.5 w-3.5" />
              <span>JEDA</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              <span>PUTAR</span>
            </>
          )}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="media-top-bar-stop"
          disabled={!isCued || (!state.isPlaying && state.currentTime === 0)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void handleStop()}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title="Berhenti (Stop)"
        >
          <Square className="h-3.5 w-3.5" />
        </Button>

        {/* Panic Control: 3s Fade Out with Auto-Pause */}
        <Button
          type="button"
          size="sm"
          variant={state.isFading ? 'default' : 'outline'}
          data-testid="media-top-bar-fade"
          disabled={!isCued || !state.isPlaying || state.isFading}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void handleFadeOut()}
          className={cn(
            'h-8 px-2 gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10',
            state.isFading && 'animate-pulse bg-amber-500/20'
          )}
          title="Redam Audio (Fade Out ~3s)"
        >
          <Volume1 className="h-3.5 w-3.5" />
          <span>FADE</span>
        </Button>

        {/* Mute Toggle */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="media-top-bar-mute"
          disabled={!isCued}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleToggleMute}
          className={cn(
            'h-8 w-8 p-0',
            state.isMuted
              ? 'bg-destructive/15 text-destructive border-destructive/40'
              : 'text-muted-foreground hover:text-foreground'
          )}
          title={state.isMuted ? 'Bunyikan (Unmute)' : 'Senyapkan (Mute)'}
        >
          {state.isMuted ? (
            <VolumeX className="h-3.5 w-3.5" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </Button>

        {/* Panic: Projector Toggle */}
        {activeItem && canProjectMediaItem(activeItem) && (
          <Button
            type="button"
            size="sm"
            variant={state.isProjected ? 'default' : 'outline'}
            data-testid="media-top-bar-take-off"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleProject}
            className={cn(
              'h-8 px-2.5 gap-1.5 text-xs font-semibold',
              state.isProjected
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={
              state.isProjected
                ? 'Panic: Tarik dari layar proyektor'
                : 'Tayangkan video ke layar proyektor'
            }
          >
            {state.isProjected ? (
              <>
                <Monitor className="h-3.5 w-3.5" />
                <span>OFF SCREEN</span>
              </>
            ) : (
              <>
                <MonitorOff className="h-3.5 w-3.5" />
                <span>KE LAYAR</span>
              </>
            )}
          </Button>
        )}
      </div>

      {/* Center: Track Details & Source Indicator */}
      <div className="flex items-center gap-2 min-w-0 flex-1 justify-center px-2">
        {activeItem ? (
          <>
            {activeItem.type === 'video' ? (
              <Video className="h-4 w-4 text-blue-500 shrink-0" />
            ) : (
              <Music className="h-4 w-4 text-emerald-500 shrink-0" />
            )}

            <span className="font-semibold text-foreground truncate max-w-[14rem]" title={activeItem.name}>
              {activeItem.name}
            </span>

            {/* Source Indicator: Text badge Lokal or Cloud */}
            <span
              data-testid="media-source-indicator"
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shrink-0',
                activeSource === 'local'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30'
              )}
            >
              {activeSource === 'local' ? (
                <>
                  <HardDrive className="h-2.5 w-2.5" />
                  <span>Lokal</span>
                </>
              ) : (
                <>
                  <Cloud className="h-2.5 w-2.5" />
                  <span>Cloud</span>
                </>
              )}
            </span>

            <span className="text-[11px] text-muted-foreground font-mono shrink-0">
              {formatTime(state.currentTime)} / {formatTime(state.duration || activeItem.duration || 0)}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground/70 italic text-[11px]">
            Belum ada media yang dipilih (Bilah kontrol tetap ~44px tanpa pergeseran layar)
          </span>
        )}
      </div>

      {/* Right: Drawer Launcher */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="media-top-bar-drawer"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onOpenDrawer}
          className="h-8 px-2.5 gap-1.5 text-xs text-foreground font-medium"
          title="Buka Pustaka Media"
        >
          <ListMusic className="h-3.5 w-3.5 text-primary" />
          <span>Pustaka ({state.items.length})</span>
        </Button>
      </div>
    </div>
  );
});
