import {
  memo,
  useState,
  useEffect,
  useCallback,
  useRef,
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
  HardDrive,
  Cloud,
  FolderPlus,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MediaStore } from './media-store';
import type { MediaEngine } from './media-engine';
import { canProjectMediaItem, type PlaylistState, type PlaylistItem } from './playlist-model';
import { MediaUploader } from './MediaUploader';
import { MediaStatusBadge, type MediaBadgeState } from './MediaStatusBadge';
import { localMediaRegistry, type LocalMediaRecord } from './local-media-registry';
import { computeBlobSHA256 } from './media-hasher';

export interface MediaDrawerProps {
  open: boolean;
  onClose: () => void;
  store: MediaStore;
  engine: MediaEngine;
  className?: string;
  onDownloadItem?: (item: PlaylistItem) => void;
  onCancelDownload?: (sha256: string) => void;
  downloadProgressMap?: Record<string, number>;
}

export const MediaDrawer = memo(function MediaDrawer({
  open,
  onClose,
  store,
  engine,
  className,
  onDownloadItem,
  onCancelDownload,
  downloadProgressMap = {},
}: MediaDrawerProps) {
  const [state, setState] = useState<PlaylistState>(store.getSnapshot());
  const [activeTab, setActiveTab] = useState<'cloud' | 'local'>('cloud');
  const [localRecords, setLocalRecords] = useState<LocalMediaRecord[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return store.subscribe(() => {
      setState(store.getSnapshot());
    });
  }, [store]);

  const refreshLocalRecords = useCallback(() => {
    setLocalRecords(Array.from(localMediaRegistry.getMatchingMap().values()));
  }, []);

  useEffect(() => {
    void localMediaRegistry.hydrate().then(refreshLocalRecords);
    return localMediaRegistry.subscribe(refreshLocalRecords);
  }, [refreshLocalRecords]);

  const handleSelectItem = useCallback(
    (id: string) => {
      store.dispatch({ type: 'SELECT_ITEM', id });
    },
    [store]
  );

  const handlePlayItem = useCallback(
    async (id: string) => {
      store.dispatch({ type: 'SELECT_ITEM', id });
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

  // Manual Local Import Handler
  const handleImportLocalFiles = useCallback(async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsImporting(true);

    try {
      const itemsToAdd: PlaylistItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const sha256 = await computeBlobSHA256(file);
        const record: LocalMediaRecord = {
          sha256,
          name: file.name,
          sizeBytes: file.size,
          mimeType: file.type || (file.name.endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg'),
          fileHandle: file,
          storageKind: 'in-memory',
          lastModified: file.lastModified,
          verifiedAt: new Date().toISOString(),
        };

        await localMediaRegistry.saveRecord(record);

        // Also add to playlist if not already present
        const alreadyInPlaylist = state.items.some((it) => it.sha256 === sha256 || it.id === `local-${sha256.slice(0, 8)}`);
        if (!alreadyInPlaylist) {
          const type: 'audio' | 'video' = file.type.startsWith('video') || file.name.endsWith('.mp4') || file.name.endsWith('.webm') ? 'video' : 'audio';
          itemsToAdd.push({
            id: `local-${sha256.slice(0, 8)}`,
            name: file.name,
            url: URL.createObjectURL(file),
            type,
            size: file.size,
            sha256,
            source: 'local',
          });
        }
      }

      if (itemsToAdd.length > 0) {
        store.dispatch({ type: 'ADD_ITEMS', items: itemsToAdd });
      }
    } finally {
      setIsImporting(false);
    }
  }, [state.items, store]);

  const handleOpenLocalPicker = useCallback(async () => {
    if (typeof window !== 'undefined' && typeof (window as any).showOpenFilePicker === 'function') {
      try {
        const handles = await (window as any).showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'Media files',
              accept: {
                'audio/*': ['.mp3', '.wav', '.m4a', '.ogg'],
                'video/*': ['.mp4', '.webm'],
              },
            },
          ],
        });
        const files: File[] = [];
        for (const h of handles) {
          files.push(await h.getFile());
        }
        await handleImportLocalFiles(files);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }
    // Fallback: input element
    fileInputRef.current?.click();
  }, [handleImportLocalFiles]);

  if (!open) return null;

  return (
    <aside
      data-testid="media-drawer"
      aria-label="Media Playlist Drawer"
      className={cn(
        'fixed right-0 top-0 bottom-0 z-40 w-[26rem] max-w-full bg-card border-l border-border shadow-2xl flex flex-col select-none',
        className
      )}
    >
      {/* Hidden file input for fallback */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            void handleImportLocalFiles(e.target.files);
          }
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Pustaka Media</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {activeTab === 'cloud' ? state.items.length : localRecords.length}
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

      {/* Two-Tab Switcher */}
      <div className="flex border-b border-border bg-muted/30 p-1 gap-1">
        <button
          type="button"
          data-testid="tab-cloud"
          onClick={() => setActiveTab('cloud')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-sm transition-colors text-center cursor-pointer',
            activeTab === 'cloud'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Cloud className="h-3.5 w-3.5" />
          <span>Pustaka Cloud</span>
        </button>
        <button
          type="button"
          data-testid="tab-local"
          onClick={() => setActiveTab('local')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-sm transition-colors text-center cursor-pointer',
            activeTab === 'local'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <HardDrive className="h-3.5 w-3.5" />
          <span>Media Laptop</span>
        </button>
      </div>

      {/* Cloud Tab View */}
      {activeTab === 'cloud' && (
        <>
          <div className="border-b border-border/60 p-3 bg-muted/20">
            <MediaUploader store={store} />
          </div>

          <div
            data-testid="media-playlist-list"
            className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0"
          >
            {state.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-xs text-muted-foreground p-4">
                <Music className="h-8 w-8 mb-2 opacity-30" />
                <p className="font-medium">Pustaka cloud kosong</p>
                <p className="text-[11px] mt-1 text-muted-foreground/80">
                  Unggah lagu BGM atau video pengumuman ke cloud untuk disimpan di server.
                </p>
              </div>
            ) : (
              state.items.map((item, index) => {
                const isActive = state.activeId === item.id;
                const isPlayingThis = isActive && state.isPlaying;
                const isProjectedThis = isActive && state.isProjected;
                const cannotDelete = isActive && state.isPlaying;

                const itemSha = (item.sha256 || '').toLowerCase();
                const isDownloading = itemSha in downloadProgressMap;
                const downloadProgress = downloadProgressMap[itemSha] || 0;
                const hasLocal = itemSha && localMediaRegistry.hasRecord(itemSha);

                let badgeState: MediaBadgeState = 'streaming-only';
                if (isDownloading) {
                  badgeState = 'downloading';
                } else if (hasLocal) {
                  const rec = localMediaRegistry.getRecord(itemSha)!;
                  const staleness = localMediaRegistry.checkStaleness(rec, rec.sizeBytes, rec.lastModified);
                  badgeState = staleness === 'valid' ? 'local' : 'detached';
                }

                return (
                  <div
                    key={item.id}
                    data-testid={`media-item-${item.id}`}
                    onClick={() => handleSelectItem(item.id)}
                    onDoubleClick={() => void handlePlayItem(item.id)}
                    className={cn(
                      'group flex flex-col gap-1.5 rounded-md border p-2 text-xs transition-colors cursor-pointer',
                      isActive
                        ? 'border-primary/50 bg-primary/10 text-foreground font-medium'
                        : 'border-border/60 bg-card hover:bg-muted/40 text-foreground/90'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* Left: Reorder & Play */}
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
                          <span className="truncate text-xs" title={item.name}>
                            {item.name}
                          </span>
                        </div>
                      </div>

                      {/* Right: Projector & Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        {canProjectMediaItem(item) && (
                          <Button
                            type="button"
                            size="sm"
                            variant={isProjectedThis ? 'default' : 'outline'}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => handleToggleProject(e, item)}
                            className={cn(
                              'h-7 px-2 text-[11px] gap-1',
                              isProjectedThis
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground'
                            )}
                            title={isProjectedThis ? 'Tayang di proyektor' : 'Tayangkan ke proyektor'}
                          >
                            {isProjectedThis ? (
                              <>
                                <Monitor className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                <span>LIVE</span>
                              </>
                            ) : (
                              <>
                                <MonitorOff className="h-3 w-3" />
                                <span>KIRIM</span>
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
                          title={cannotDelete ? 'Tidak dapat menghapus item yang sedang diputar' : 'Hapus item'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Bottom row: Accessible 4-state Badge */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px]">
                      <MediaStatusBadge
                        state={badgeState}
                        progress={downloadProgress}
                        onDownload={onDownloadItem ? () => onDownloadItem(item) : undefined}
                        onCancel={onCancelDownload && itemSha ? () => onCancelDownload(itemSha) : undefined}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Local Tab View */}
      {activeTab === 'local' && (
        <div className="flex-1 flex flex-col p-3 gap-3 min-h-0">
          <div className="flex items-center justify-between gap-2 bg-muted/20 p-2.5 rounded-md border border-border/60">
            <div>
              <p className="text-xs font-semibold text-foreground">Media Tersimpan di Laptop</p>
              <p className="text-[11px] text-muted-foreground">Siap diputar saat internet gereja offline.</p>
            </div>
            <Button
              type="button"
              size="sm"
              data-testid="btn-add-local-media"
              disabled={isImporting}
              onClick={() => void handleOpenLocalPicker()}
              className="h-7 px-2.5 text-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isImporting ? 'Memproses...' : 'Tambah Media'}</span>
            </Button>
          </div>

          <div
            data-testid="local-media-list"
            className="flex-1 overflow-y-auto space-y-1.5 min-h-0"
          >
            {localRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-xs text-muted-foreground p-4">
                <HardDrive className="h-8 w-8 mb-2 opacity-30" />
                <p className="font-medium">Belum ada media offline</p>
                <p className="text-[11px] mt-1 text-muted-foreground/80">
                  Unduh item dari tab Pustaka Cloud atau klik 'Tambah Media' untuk mengimpor dari USB flash drive.
                </p>
              </div>
            ) : (
              localRecords.map((record) => (
                <div
                  key={record.sha256}
                  data-testid={`local-record-${record.sha256.slice(0, 8)}`}
                  className="flex items-center justify-between p-2 rounded-md border border-border/60 bg-card text-xs gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {record.mimeType.startsWith('video') ? (
                      <Video className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    ) : (
                      <Music className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-foreground truncate" title={record.name}>
                        {record.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {(record.sizeBytes / (1024 * 1024)).toFixed(1)} MB • {record.storageKind}
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                    Tersedia
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
});
