import {
  memo,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  X,
  Play,
  Pause,
  Trash2,
  ChevronUp,
  ChevronDown,
  Monitor,
  MonitorOff,
  Music,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MediaStore } from './media-store';
import type { MediaEngine } from './media-engine';
import { canProjectMediaItem, type PlaylistState, type PlaylistItem } from './playlist-model';
import { MediaUploader } from './MediaUploader';

export interface MediaDrawerProps {
  open: boolean;
  onClose: () => void;
  store: MediaStore;
  engine: MediaEngine;
  className?: string;
}

export const MediaDrawer = memo(function MediaDrawer({
  open,
  onClose,
  store,
  engine,
  className,
}: MediaDrawerProps) {
  const [state, setState] = useState<PlaylistState>(store.getSnapshot());

  useEffect(() => {
    return store.subscribe(() => {
      setState(store.getSnapshot());
    });
  }, [store]);

  const handleSelectItem = useCallback(
    (id: string) => {
      store.dispatch({ type: 'SELECT_ITEM', id });
    },
    [store]
  );

  const handlePlayItem = useCallback(
    async (id: string) => {
      store.dispatch({ type: 'SELECT_ITEM', id });
      // Small tick for DOM element src load
      setTimeout(() => {
        void engine.play().then((res) => {
          if (res.success) {
            store.dispatch({ type: 'SET_PLAYING', isPlaying: true });
          }
        });
      }, 50);
    },
    [store, engine]
  );

  const handleDeleteItem = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      store.dispatch({ type: 'REMOVE_ITEM', id });
    },
    [store]
  );

  const handleMoveUp = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      if (index > 0) {
        store.dispatch({ type: 'MOVE_ITEM', fromIndex: index, toIndex: index - 1 });
      }
    },
    [store]
  );

  const handleMoveDown = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      if (index < state.items.length - 1) {
        store.dispatch({ type: 'MOVE_ITEM', fromIndex: index, toIndex: index + 1 });
      }
    },
    [store, state.items.length]
  );

  const handleToggleProject = useCallback(
    (e: React.MouseEvent, item: PlaylistItem) => {
      e.stopPropagation();
      if (!canProjectMediaItem(item)) return;

      if (state.activeId !== item.id) {
        store.dispatch({ type: 'SELECT_ITEM', id: item.id });
      }

      const nextProjected = !(state.activeId === item.id && state.isProjected);
      store.dispatch({ type: 'SET_PROJECTED', isProjected: nextProjected });
    },
    [state.activeId, state.isProjected, store]
  );

  if (!open) return null;

  return (
    <aside
      data-testid="media-drawer"
      aria-label="Media Playlist Drawer"
      className={cn(
        'fixed right-0 top-0 bottom-0 z-40 w-[24rem] max-w-full bg-card border-l border-border shadow-2xl flex flex-col select-none',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Media Playlist</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {state.items.length}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          data-testid="media-drawer-close"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
          className="h-7 w-7 p-0"
          title="Tutup Panel Media"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Uploader Section */}
      <div className="border-b border-border/60 p-3 bg-muted/20">
        <MediaUploader store={store} />
      </div>

      {/* Playlist List */}
      <div
        data-testid="media-playlist-list"
        className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0"
      >
        {state.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-xs text-muted-foreground p-4">
            <Music className="h-8 w-8 mb-2 opacity-30" />
            <p className="font-medium">Daftar putar kosong</p>
            <p className="text-[11px] mt-1 text-muted-foreground/80">
              Unggah lagu BGM atau video pengumuman untuk diputar saat jeda ibadah.
            </p>
          </div>
        ) : (
          state.items.map((item, index) => {
            const isActive = state.activeId === item.id;
            const isPlayingThis = isActive && state.isPlaying;
            const isProjectedThis = isActive && state.isProjected;
            const cannotDelete = isActive && state.isPlaying;

            return (
              <div
                key={item.id}
                data-testid={`media-item-${item.id}`}
                onClick={() => handleSelectItem(item.id)}
                onDoubleClick={() => void handlePlayItem(item.id)}
                className={cn(
                  'group flex items-center justify-between gap-2 rounded-md border p-2 text-xs transition-colors cursor-pointer',
                  isActive
                    ? 'border-primary/50 bg-primary/10 text-foreground font-medium'
                    : 'border-border/60 bg-card hover:bg-muted/40 text-foreground/90'
                )}
              >
                {/* Left: Reorder controls & Icon */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex flex-col">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={index === 0}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => handleMoveUp(e, index)}
                      className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground disabled:opacity-20"
                      title="Pindah ke atas"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={index === state.items.length - 1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => handleMoveDown(e, index)}
                      className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground disabled:opacity-20"
                      title="Pindah ke bawah"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={isPlayingThis ? 'default' : 'ghost'}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handlePlayItem(item.id)}
                    className="h-7 w-7 p-0 shrink-0"
                    title={isPlayingThis ? 'Sedang memutar' : 'Putar'}
                  >
                    {isPlayingThis ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5 ml-0.5" />
                    )}
                  </Button>
                </div>

                {/* Middle: Details */}
                <div className="flex flex-1 flex-col min-w-0 pr-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {item.type === 'video' ? (
                      <span className="rounded bg-blue-500/20 px-1 py-0.2 text-[9px] font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                        VIDEO
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        AUDIO
                      </span>
                    )}
                    <span className="truncate text-xs">{item.name}</span>
                  </div>

                  {item.errorMessage && (
                    <span className="text-[10px] text-destructive truncate">
                      {item.errorMessage}
                    </span>
                  )}
                </div>

                {/* Right: Project button & Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  {item.type === 'video' && (
                    <Button
                      type="button"
                      size="sm"
                      variant={isProjectedThis ? 'default' : 'outline'}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => handleToggleProject(e, item)}
                      className={cn(
                        'h-7 px-2 text-[10px] gap-1',
                        isProjectedThis && 'bg-blue-600 hover:bg-blue-700 text-white'
                      )}
                      title={isProjectedThis ? 'Tarik dari Layar' : 'Tampilkan di Layar Jemaat'}
                    >
                      {isProjectedThis ? (
                        <>
                          <MonitorOff className="h-3 w-3" />
                          <span>DI LAYAR</span>
                        </>
                      ) : (
                        <>
                          <Monitor className="h-3 w-3" />
                          <span>Layar</span>
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={cannotDelete}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => handleDeleteItem(e, item.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive disabled:opacity-30"
                    title={cannotDelete ? 'Tidak dapat menghapus lagu yang sedang diputar' : 'Hapus'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
});
