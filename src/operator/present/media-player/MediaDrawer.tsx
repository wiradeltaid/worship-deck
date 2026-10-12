import {
  memo,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
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
  CheckCircle2,
  AlertTriangle,
  Upload,
  Download,
  Plus,
  MoreVertical,
  RotateCw,
  ListMusic,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { MediaStore } from './media-store';
import type { MediaEngine } from './media-engine';
import {
  canProjectMediaItem,
  deriveAvailability,
  type PlaylistState,
  type PlaylistItem,
  type MediaAvailability,
} from './playlist-model';
import { localMediaRegistry, type LocalMediaRecord } from './local-media-registry';
import { computeBlobSHA256 } from './media-hasher';
import { useT } from '@/lib/i18n/operator';

export type MediaDrawerFilter = 'all' | 'cloud-only' | 'local-only' | 'synced';

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
  const { t } = useT();
  const [state, setState] = useState<PlaylistState>(store.getSnapshot());
  const [filter, setFilter] = useState<MediaDrawerFilter>('all');
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

  const handleTogglePlayItem = useCallback(
    async (id: string) => {
      if (state.activeId === id && state.isPlaying) {
        engine.pause();
        store.dispatch({ type: 'SET_PLAYING', isPlaying: false });
      } else if (state.activeId === id) {
        // Resuming the currently selected item
        void engine.play().then((res) => {
          if (res.success) {
            store.dispatch({ type: 'SET_PLAYING', isPlaying: true });
          }
        });
      } else {
        // Selecting a different item: set playing and select; MediaStage authoritatively handles loading and playback
        store.dispatch({ type: 'SET_PLAYING', isPlaying: true });
        store.dispatch({ type: 'SELECT_ITEM', id });
      }
    },
    [state.activeId, state.isPlaying, store, engine]
  );

  const handleDeleteCloudOnly = useCallback(
    async (item: PlaylistItem) => {
      const cloudId = item.cloud?.id || item.id;
      try {
        await fetch(`/api/media/playlist/${encodeURIComponent(cloudId)}`, {
          method: 'DELETE',
        });
      } catch {
        // Fall back gracefully
      }
      const hasLocal = Boolean(
        item.local ||
        (item.sha256 && localMediaRegistry.hasRecord(item.sha256))
      );
      if (hasLocal) {
        const localRec = item.sha256 ? localMediaRegistry.getRecord(item.sha256) : null;
        let localUrl = item.url;
        if (localRec?.fileHandle && typeof URL !== 'undefined' && localRec.fileHandle instanceof Blob) {
          localUrl = URL.createObjectURL(localRec.fileHandle);
        }
        store.dispatch({
          type: 'UPDATE_ITEM',
          id: item.id,
          patch: { cloud: undefined, source: 'local', url: localUrl },
        });
      } else {
        store.dispatch({ type: 'REMOVE_ITEM', id: item.id });
      }
    },
    [store]
  );

  const handleDeleteLocalOnly = useCallback(
    async (item: PlaylistItem, sha256?: string) => {
      if (sha256) {
        await localMediaRegistry.removeRecord(sha256);
        refreshLocalRecords();
      }
      const hasCloud = Boolean(item.cloud?.id || (item.source === 'cloud' && item.url));
      if (hasCloud) {
        store.dispatch({
          type: 'UPDATE_ITEM',
          id: item.id,
          patch: {
            local: undefined,
            source: 'cloud',
            url: item.cloud?.url || (item.url.startsWith('blob:') ? '' : item.url),
          },
        });
      } else {
        store.dispatch({ type: 'REMOVE_ITEM', id: item.id });
      }
    },
    [refreshLocalRecords, store]
  );

  const handleDeleteBoth = useCallback(
    async (item: PlaylistItem, sha256?: string) => {
      const cloudId = item.cloud?.id || item.id;
      try {
        await fetch(`/api/media/playlist/${encodeURIComponent(cloudId)}?purge=true`, {
          method: 'DELETE',
        });
      } catch {
        // Fall back gracefully
      }
      if (sha256) {
        await localMediaRegistry.removeRecord(sha256);
        refreshLocalRecords();
      }
      store.dispatch({ type: 'REMOVE_ITEM', id: item.id });
    },
    [refreshLocalRecords, store]
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

  // Manual Local Import from Computer (DEC-098 Storage Ladder)
  const handleImportLocalFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!files || files.length === 0) return;
      setIsImporting(true);

      try {
        const itemsToAdd: PlaylistItem[] = [];
        const seenInBatch = new Set<string>();

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const sha256 = await computeBlobSHA256(file);
          if (seenInBatch.has(sha256)) continue;
          seenInBatch.add(sha256);

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

          // Also add to playlist if not already present, or upgrade existing cloud item to synced
          const alreadyInPlaylist = state.items.some(
            (it) => it.sha256 === sha256 || it.id === `local-${sha256.slice(0, 8)}`
          );
          if (alreadyInPlaylist) {
            const existing = state.items.find(
              (it) => it.sha256 === sha256 || it.id === `local-${sha256.slice(0, 8)}`
            );
            if (existing) {
              store.dispatch({
                type: 'UPDATE_ITEM',
                id: existing.id,
                patch: {
                  url: URL.createObjectURL(file),
                  source: 'local',
                  local: {
                    storageKind: 'in-memory',
                    stale: false,
                    fileHandle: file,
                  },
                },
              });
            }
          } else {
            const type: 'audio' | 'video' =
              file.type.startsWith('video') ||
              file.name.endsWith('.mp4') ||
              file.name.endsWith('.webm')
                ? 'video'
                : 'audio';

            itemsToAdd.push({
              id: `local-${sha256.slice(0, 8)}`,
              name: file.name,
              url: URL.createObjectURL(file),
              type,
              size: file.size,
              sha256,
              source: 'local',
              local: {
                storageKind: 'in-memory',
                stale: false,
                fileHandle: file,
              },
            });
          }
        }

        if (itemsToAdd.length > 0) {
          store.dispatch({ type: 'ADD_ITEMS', items: itemsToAdd });
        }
      } finally {
        setIsImporting(false);
      }
    },
    [state.items, store]
  );

  const handleOpenLocalPicker = useCallback(async () => {
    if (typeof window !== 'undefined' && typeof (window as any).showOpenFilePicker === 'function') {
      try {
        const handles = await (window as any).showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: t('media.drawer.fileFilterDesc'),
              accept: {
                'audio/mpeg': ['.mp3'],
                'audio/wav': ['.wav'],
                'audio/mp4': ['.m4a'],
                'audio/ogg': ['.ogg'],
                'audio/aac': ['.aac'],
                'audio/flac': ['.flac'],
                'video/mp4': ['.mp4'],
                'video/webm': ['.webm'],
                'video/quicktime': ['.mov'],
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
  }, [handleImportLocalFiles, t]);

  // Upload local item to cloud catalog
  const handleUploadItemToCloud = useCallback(
    async (item: PlaylistItem) => {
      const rec = item.sha256 ? localMediaRegistry.getRecord(item.sha256) : null;
      if (!rec?.fileHandle) return;

      store.dispatch({
        type: 'UPDATE_ITEM_STATUS',
        id: item.id,
        status: 'loading',
      });

      try {
        let fileObj: File | Blob = rec.fileHandle;
        if (typeof rec.fileHandle.getFile === 'function') {
          fileObj = await rec.fileHandle.getFile();
        }

        const formData = new FormData();
        formData.append('file', fileObj, item.name);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Upload failed with HTTP ${res.status}`);
        }

        const data = await res.json();
        if (data.url) {
          const filename = data.url.replace('/api/uploads/', '');
          let cloudId = item.id;
          try {
            const playlistRes = await fetch('/api/media/playlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: item.name,
                type: item.type,
                storage_key: filename,
                size_bytes: item.size || (fileObj as any).size || 0,
                sha256: item.sha256,
              }),
            });
            if (playlistRes.ok) {
              const playlistData = await playlistRes.json();
              cloudId = playlistData.id || cloudId;
            }
          } catch {
            // Handled gracefully if offline or fallback
          }

          store.dispatch({
            type: 'UPDATE_ITEM',
            id: item.id,
            patch: {
              url: data.url,
              status: 'ready',
              cloud: {
                id: cloudId,
                name: item.name,
                url: data.url,
                size: item.size,
              },
            },
          });
        }
      } catch (err: any) {
        store.dispatch({
          type: 'UPDATE_ITEM_STATUS',
          id: item.id,
          status: 'error',
          errorMessage: err?.message || 'Upload failed',
        });
      }
    },
    [store]
  );

  // Derived filtered items preserving original array ordering
  const filteredItems = useMemo(() => {
    return state.items.filter((item) => {
      const itemSha = (item.sha256 || '').toLowerCase();
      const hasLocalRecord = Boolean(itemSha && localMediaRegistry.hasRecord(itemSha));
      const isDownloading = Boolean(itemSha && itemSha in downloadProgressMap);

      const availability: MediaAvailability = deriveAvailability(
        {
          ...item,
          local: hasLocalRecord ? { storageKind: 'directory-handle', stale: false } : undefined,
        },
        downloadProgressMap
      );

      if (filter === 'all') return true;
      if (filter === 'cloud-only') return availability === 'cloud-only' && !isDownloading;
      if (filter === 'local-only') return availability === 'local-only';
      if (filter === 'synced') return availability === 'synced';
      return true;
    });
  }, [state.items, filter, downloadProgressMap, localRecords]);

  if (!open) return null;

  return (
    <aside
      data-testid="media-drawer"
      aria-label={t('media.drawer.title')}
      className={cn(
        'fixed right-0 top-0 bottom-0 z-40 w-[26rem] max-w-full bg-card border-l border-border shadow-2xl flex flex-col select-none',
        className
      )}
    >
      {/* Hidden file input for fallback file upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,video/*"
        className="hidden"
        onClick={(e) => {
          (e.currentTarget as HTMLInputElement).value = '';
        }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            void handleImportLocalFiles(e.target.files);
          }
          e.target.value = '';
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{t('media.drawer.title')}</h2>
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
          title={t('media.drawer.close')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Actions & Filter Controls */}
      <div className="p-3 border-b border-border bg-muted/20 space-y-2.5">
        {/* Primary Action Button: Tambah Media dari Komputer */}
        <Button
          type="button"
          variant="default"
          size="sm"
          data-testid="btn-add-media"
          disabled={isImporting}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void handleOpenLocalPicker()}
          className="w-full h-8 gap-1.5 text-xs font-semibold cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{isImporting ? t('media.drawer.processing') : t('media.drawer.addFromComputer')}</span>
        </Button>

        {/* 4-Way Filter Dropdown */}
        <div data-testid="media-drawer-filter-bar" className="w-full">
          <Select
            value={filter}
            onValueChange={(val) => {
              if (val) setFilter(val as MediaDrawerFilter);
            }}
          >
            <SelectTrigger
              data-testid="filter-select-trigger"
              className="w-full h-8 text-xs bg-background"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  { id: 'all', label: t('media.drawer.filterAll') },
                  { id: 'cloud-only', label: t('media.drawer.filterCloud') },
                  { id: 'local-only', label: t('media.drawer.filterLocal') },
                  { id: 'synced', label: t('media.drawer.filterSynced') },
                ] as const
              ).map((mode) => (
                <SelectItem
                  key={mode.id}
                  value={mode.id}
                  data-testid={`filter-${mode.id}`}
                  className="text-xs cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    {mode.id === 'all' && <ListMusic className="h-3.5 w-3.5 text-muted-foreground" />}
                    {mode.id === 'cloud-only' && <Cloud className="h-3.5 w-3.5 text-muted-foreground" />}
                    {mode.id === 'local-only' && <HardDrive className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                    {mode.id === 'synced' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                    <span>{mode.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Single Unified Playlist List */}
      <div
        data-testid="unified-media-list"
        className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0"
      >
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-xs text-muted-foreground p-4">
            <Music className="h-8 w-8 mb-2 opacity-30" />
            <p className="font-medium">{t('media.drawer.emptyTitle')}</p>
            <p className="text-[11px] mt-1 text-muted-foreground/80">
              {t('media.drawer.emptyDesc')}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const itemIndex = state.items.findIndex((i) => i.id === item.id);
            const isActive = state.activeId === item.id;
            const isPlayingThis = isActive && state.isPlaying;
            const isProjectedThis = isActive && state.isProjected;
            const cannotDelete = isActive && (state.isPlaying || state.isProjected);

            const itemSha = (item.sha256 || '').toLowerCase();
            const isDownloading = Boolean(itemSha && itemSha in downloadProgressMap);
            const downloadProgress = downloadProgressMap[itemSha] || 0;
            const localRecord = itemSha ? localMediaRegistry.getRecord(itemSha) : null;
            const isDetached = localRecord
              ? localMediaRegistry.checkStaleness(localRecord, localRecord.sizeBytes, localRecord.lastModified) ===
                'detached'
              : false;

            const availability = deriveAvailability(
              {
                ...item,
                local: localRecord ? { storageKind: 'directory-handle', stale: isDetached } : undefined,
              },
              downloadProgressMap
            );

            return (
              <div
                key={item.id}
                data-testid={`media-row-${item.id}`}
                onClick={() => handleSelectItem(item.id)}
                onDoubleClick={() => void handleTogglePlayItem(item.id)}
                className={cn(
                  'group flex items-center justify-between gap-2 rounded-md border p-2 text-xs transition-colors cursor-pointer h-10',
                  isActive
                    ? 'border-primary/50 bg-primary/10 text-foreground font-medium'
                    : 'border-border/60 bg-card hover:bg-muted/40 text-foreground/90'
                )}
              >
                {/* 1. Left: Reorder arrows & Play Trigger */}
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex flex-col">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={itemIndex <= 0}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => handleMoveUp(e, itemIndex)}
                      className="h-3.5 w-3.5 p-0 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                      title={t('media.drawer.moveUp')}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={itemIndex >= state.items.length - 1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => handleMoveDown(e, itemIndex)}
                      className="h-3.5 w-3.5 p-0 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                      title={t('media.drawer.moveDown')}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={isPlayingThis ? 'default' : 'ghost'}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleTogglePlayItem(item.id)}
                    className="h-6 w-6 p-0 shrink-0"
                    title={isPlayingThis ? t('media.drawer.pause') : t('media.drawer.play')}
                  >
                    {isPlayingThis ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
                  </Button>
                </div>

                {/* 2. Middle: Type Icon, Title */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
                  {item.type === 'video' ? (
                    <Video className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  ) : (
                    <Music className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}

                  <span className="truncate text-xs text-foreground flex-1" title={item.name}>
                    {item.name}
                  </span>
                </div>

                {/* 3. Right: Projector Toggle, Status Icon (placed before more menu), Actions Menu */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {canProjectMediaItem(item) && (
                    <Button
                      type="button"
                      size="sm"
                      variant={isProjectedThis ? 'default' : 'outline'}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => handleToggleProject(e, item)}
                      className={cn(
                        'h-6 px-1.5 text-[10px] gap-1',
                        isProjectedThis ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                      )}
                      title={isProjectedThis ? t('media.drawer.projectLive') : t('media.drawer.projectSend')}
                    >
                      {isProjectedThis ? (
                        <>
                          <Monitor className="h-2.5 w-2.5" />
                          <span>{t('media.drawer.liveLabel')}</span>
                        </>
                      ) : (
                        <>
                          <MonitorOff className="h-2.5 w-2.5" />
                          <span>{t('media.drawer.sendLabel')}</span>
                        </>
                      )}
                    </Button>
                  )}

                  {/* Compact Status Icon (placed immediately before More Menu) */}
                  {(() => {
                    const statusTitle = isDownloading
                      ? t('media.drawer.statusDownloading', { percent: Math.round(downloadProgress) })
                      : isDetached
                      ? t('media.drawer.statusDetached')
                      : availability === 'synced'
                      ? t('media.drawer.statusSynced')
                      : availability === 'local-only'
                      ? t('media.drawer.statusLocalOnly')
                      : t('media.drawer.statusCloudOnly');

                    return (
                      <span
                        className="shrink-0 inline-flex items-center justify-center w-5 h-6"
                        data-testid={`status-icon-${item.id}`}
                        title={statusTitle}
                      >
                        {isDownloading ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400">
                            <Download className="h-3.5 w-3.5 animate-pulse" />
                          </span>
                        ) : isDetached ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                        ) : availability === 'synced' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : availability === 'local-only' ? (
                          <HardDrive className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </span>
                    );
                  })()}

                  {/* Actions Dropdown Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label="Actions"
                      className="h-6 w-6 inline-flex items-center justify-center rounded p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 text-xs">
                      {/* Cloud Download / Upload Workflows */}
                      {availability === 'cloud-only' && onDownloadItem && (
                        <DropdownMenuItem
                          onClick={() => onDownloadItem(item)}
                          className="cursor-pointer gap-2"
                        >
                          <Download className="h-3.5 w-3.5 text-primary" />
                          <span>{t('media.drawer.downloadToLocal')}</span>
                        </DropdownMenuItem>
                      )}
                      {availability === 'local-only' && (
                        <DropdownMenuItem
                          onClick={() => void handleUploadItemToCloud(item)}
                          className="cursor-pointer gap-2"
                        >
                          <Upload className="h-3.5 w-3.5 text-primary" />
                          <span>{t('media.drawer.uploadToCloud')}</span>
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />

                      {/* Explicit Deletion triggers based on availability */}
                      {availability === 'local-only' && (
                        <DropdownMenuItem
                          disabled={cannotDelete}
                          onClick={() => void handleDeleteLocalOnly(item, itemSha)}
                          className="cursor-pointer text-amber-600 dark:text-amber-400 focus:text-amber-600 dark:focus:text-amber-400 gap-2"
                        >
                          <HardDrive className="h-3.5 w-3.5" />
                          <span>{t('media.drawer.deleteFromLocal')}</span>
                        </DropdownMenuItem>
                      )}

                      {availability === 'cloud-only' && (
                        <DropdownMenuItem
                          disabled={cannotDelete}
                          onClick={() => void handleDeleteCloudOnly(item)}
                          className="cursor-pointer text-destructive focus:text-destructive gap-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>{t('media.drawer.deleteFromCloud')}</span>
                        </DropdownMenuItem>
                      )}

                      {availability === 'synced' && (
                        <>
                          <DropdownMenuItem
                            disabled={cannotDelete}
                            onClick={() => void handleDeleteLocalOnly(item, itemSha)}
                            className="cursor-pointer text-amber-600 dark:text-amber-400 focus:text-amber-600 dark:focus:text-amber-400 gap-2"
                          >
                            <HardDrive className="h-3.5 w-3.5" />
                            <span>{t('media.drawer.deleteFromLocalOnly')}</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            disabled={cannotDelete}
                            onClick={() => void handleDeleteCloudOnly(item)}
                            className="cursor-pointer text-destructive focus:text-destructive gap-2"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{t('media.drawer.deleteFromCloudOnly')}</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            disabled={cannotDelete}
                            onClick={() => void handleDeleteBoth(item, itemSha)}
                            className="cursor-pointer text-destructive focus:text-destructive gap-2 font-medium"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{t('media.drawer.deleteBoth')}</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
});
