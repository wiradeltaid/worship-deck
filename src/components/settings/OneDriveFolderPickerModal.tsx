import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/operator';
import { Folder, ChevronRight, RefreshCw, FolderCheck, AlertCircle } from 'lucide-react';

export interface OneDriveFolderItem {
  id: string;
  name: string;
  child_count: number;
  last_modified: string;
  parent_id: string;
}

export interface OneDriveFolderPickerModalProps {
  open: boolean;
  onClose: () => void;
  currentFolderId?: string;
  currentFolderPath?: string;
  onSelectFolder: (folderId: string, folderPath: string) => Promise<void> | void;
}

interface BreadcrumbCrumb {
  id: string;
  name: string;
}

export default function OneDriveFolderPickerModal({
  open,
  onClose,
  currentFolderId = '',
  currentFolderPath = '',
  onSelectFolder,
}: OneDriveFolderPickerModalProps) {
  const { t } = useT();

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbCrumb[]>([
    { id: 'root', name: t('onedrive.folderPicker.root') },
  ]);
  const [folders, setFolders] = useState<OneDriveFolderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const activeParent = breadcrumbs[breadcrumbs.length - 1];

  const fetchFolders = async (parentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/settings/onedrive/folders?parent_id=${encodeURIComponent(parentId)}`;
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) {
        throw new Error(t('onedrive.folderPicker.error'));
      }
      const data = (await res.json()) as OneDriveFolderItem[];
      setFolders(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('onedrive.folderPicker.error'));
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setBreadcrumbs([{ id: 'root', name: t('onedrive.folderPicker.root') }]);
      setSelectedFolder(currentFolderId ? { id: currentFolderId, name: currentFolderPath || 'Current' } : null);
      fetchFolders('root');
    }
  }, [open, currentFolderId, currentFolderPath]);

  const handleNavigateInto = (f: OneDriveFolderItem) => {
    setBreadcrumbs((prev) => [...prev, { id: f.id, name: f.name }]);
    setSelectedFolder({ id: f.id, name: f.name });
    fetchFolders(f.id);
  };

  const handleBreadcrumbClick = (index: number) => {
    const target = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    fetchFolders(target.id);
  };

  const computeDisplayPath = () => {
    if (breadcrumbs.length === 1 && !selectedFolder) {
      return '/';
    }
    const parts = breadcrumbs.slice(1).map((b) => b.name);
    if (selectedFolder && selectedFolder.id !== activeParent.id) {
      parts.push(selectedFolder.name);
    }
    return '/' + parts.join('/');
  };

  const handleConfirmSelect = async () => {
    setSaving(true);
    try {
      const folderId = selectedFolder?.id || activeParent.id;
      const folderPath = computeDisplayPath();
      await onSelectFolder(folderId, folderPath);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl sm:max-h-[85vh] flex flex-col p-6" role="dialog" aria-modal="true" aria-label={t('onedrive.folderPicker.title')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Folder className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            {t('onedrive.folderPicker.title')}
          </DialogTitle>
        </DialogHeader>

        {/* Breadcrumb Bar */}
        <div className="flex flex-wrap items-center gap-1.5 py-2 px-3 bg-muted/40 rounded-lg text-xs font-medium border border-border/60 overflow-x-auto">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id + idx}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleBreadcrumbClick(idx)}
                className={`h-6 px-1.5 py-0.5 text-xs hover:underline transition-colors ${
                  idx === breadcrumbs.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'
                }`}
              >
                {crumb.name}
              </Button>
            </React.Fragment>
          ))}
        </div>

        {/* Folder Content Listing */}
        <div className="flex-1 min-h-[280px] max-h-[420px] overflow-y-auto border border-border/80 rounded-lg divide-y divide-border/40 bg-card">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-56 gap-2 text-muted-foreground text-sm">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-600 dark:text-sky-400" />
              <span>{t('onedrive.folderPicker.loading')}</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-56 gap-3 text-destructive text-sm p-4 text-center">
              <AlertCircle className="w-8 h-8" />
              <p>{error}</p>
              <Button size="sm" variant="outline" onClick={() => fetchFolders(activeParent.id)}>
                {t('onedrive.folderPicker.retry')}
              </Button>
            </div>
          ) : folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 gap-2 text-muted-foreground text-sm">
              <Folder className="w-8 h-8 stroke-1" />
              <span>{t('onedrive.folderPicker.empty')}</span>
            </div>
          ) : (
            <div className="p-1 space-y-0.5">
              {folders.map((folder) => {
                const isSelected = selectedFolder?.id === folder.id;
                return (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedFolder({ id: folder.id, name: folder.name })}
                    onDoubleClick={() => handleNavigateInto(folder)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer transition-colors text-sm select-none ${
                      isSelected
                        ? 'bg-sky-500/15 border border-sky-500/40 text-sky-800 dark:text-sky-200'
                        : 'hover:bg-muted/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-sky-600 dark:text-sky-400 fill-sky-400/20' : 'text-sky-600 dark:text-sky-400'}`} />
                      <span className="font-medium truncate">{folder.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                      <span>{folder.child_count} {t('onedrive.folderPicker.items')}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateInto(folder);
                        }}
                        className="p-1 h-7 w-7 hover:bg-muted rounded text-foreground transition-colors"
                        title="Enter folder"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Path Preview & Footer */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs border-t border-border/80">
          <div className="flex items-center gap-2 text-muted-foreground truncate">
            <span className="font-semibold">{t('onedrive.folderPicker.selected')}:</span>
            <span className="font-mono bg-muted px-2 py-0.5 rounded text-foreground truncate max-w-xs sm:max-w-md">
              {computeDisplayPath()}
            </span>
          </div>
          <DialogFooter className="flex gap-2 w-full sm:w-auto">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              {t('onedrive.folderPicker.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmSelect}
              disabled={saving || loading}
              className="bg-sky-600 hover:bg-sky-500 text-white gap-1.5"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderCheck className="w-3.5 h-3.5" />}
              {t('onedrive.folderPicker.selectThis')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
