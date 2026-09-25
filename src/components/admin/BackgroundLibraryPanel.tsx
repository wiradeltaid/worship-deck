import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import ImageCropDialog from '@/components/media/ImageCropDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n/operator';

export interface BackgroundImage {
  id: number;
  url: string;
  name?: string;
  category?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MediaImage = BackgroundImage;

const PICKER_CLASS =
  'w-full text-xs text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-xl file:border file:border-primary/20 file:bg-primary/10 file:px-4 file:py-2 file:text-xs file:font-bold file:text-primary hover:file:bg-primary/20 disabled:opacity-60';

type UploadResponse = { error?: string; url?: string };

async function readJson(res: Response): Promise<UploadResponse> {
  try {
    return (await res.json()) as UploadResponse;
  } catch {
    return {};
  }
}

export function BackgroundLibraryPanel() {
  const { t } = useT();
  const pickerId = useId();
  const nameId = useId();
  const linkId = useId();
  const pickerRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const targetReplaceImageRef = useRef<BackgroundImage | null>(null);

  const [images, setImages] = useState<BackgroundImage[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload inputs
  const [customName, setCustomName] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<'upload' | 'fetch' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [picked, setPicked] = useState(false);
  const [cropTargetFile, setCropTargetFile] = useState<File | null>(null);

  // Category filtering & upload category (SPEC-40: Announcement, Background, General)
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'general' | 'background' | 'announcement'>('all');
  const [uploadCategory, setUploadCategory] = useState<'general' | 'background' | 'announcement'>('announcement');

  // Action states
  const [settingDefaultId, setSettingDefaultId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const [cacheBusters, setCacheBusters] = useState<Record<number, number>>({});

  const isBusy = busy !== null;

  const fetchImages = async () => {
    try {
      const res = await fetch('/api/admin/media-library', { credentials: 'same-origin' });
      if (!res.ok) {
        throw new Error('Failed to load');
      }
      const data = (await res.json()) as { images: BackgroundImage[] };
      setImages(data.images ?? []);
    } catch {
      toast.error(t('admin.backgrounds.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchImages();
  }, []);

  const addImageToLibrary = async (url: string, category: string = uploadCategory, name: string = customName.trim()) => {
    try {
      const res = await fetch('/api/admin/media-library', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, category, name, isDefault: false }),
      });

      if (!res.ok) {
        toast.error(t('admin.backgrounds.addFailed'));
        return;
      }

      const created = (await res.json()) as BackgroundImage;
      setImages((prev) => [...prev, created]);
      setCustomName('');
      toast.success(t('admin.backgrounds.added'));
    } catch {
      toast.error(t('admin.backgrounds.addFailed'));
    }
  };

  const uploadPickedFile = () => {
    const file = pickerRef.current?.files?.[0];
    if (!file) return;
    setUploadError(null);
    setCropTargetFile(file);
  };

  const handleUploadCroppedFile = async (fileToUpload: File) => {
    setCropTargetFile(null);
    setUploadError(null);
    setBusy('upload');
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await readJson(res);
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Upload failed');
      }
      await addImageToLibrary(data.url);
      if (pickerRef.current) pickerRef.current.value = '';
      setPicked(false);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setBusy(null);
    }
  };

  const fetchFromLink = async () => {
    const url = link.trim();
    if (!url) return;

    setUploadError(null);
    setBusy('fetch');
    try {
      const res = await fetch('/api/upload/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await readJson(res);
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not download that image');
      }
      await addImageToLibrary(data.url);
      setLink('');
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to download that image');
    } finally {
      setBusy(null);
    }
  };

  const handleMakeDefault = async (image: BackgroundImage) => {
    if (image.isDefault) return;

    setSettingDefaultId(image.id);
    try {
      const res = await fetch(`/api/admin/background-library/${image.id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isDefault: true,
          updatedAt: image.updatedAt,
        }),
      });

      if (res.status === 409) {
        toast.error(t('admin.backgrounds.staleConflict'));
        void fetchImages();
        return;
      }

      if (!res.ok) {
        toast.error(t('admin.backgrounds.defaultFailed'));
        return;
      }

      const updated = (await res.json()) as BackgroundImage;
      setImages((prev) =>
        prev.map((item) => {
          if (item.id === updated.id) {
            return updated;
          }
          if (item.isDefault) {
            return { ...item, isDefault: false };
          }
          return item;
        })
      );
      toast.success(t('admin.backgrounds.defaultSaved'));
    } catch {
      toast.error(t('admin.backgrounds.defaultFailed'));
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleRenameSave = async (image: BackgroundImage) => {
    try {
      const res = await fetch(`/api/admin/media-library/${image.id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingName.trim(),
          updatedAt: image.updatedAt,
        }),
      });

      if (res.status === 409) {
        toast.error(t('admin.backgrounds.staleConflict'));
        void fetchImages();
        return;
      }

      if (!res.ok) {
        toast.error(t('admin.backgrounds.nameFailed'));
        return;
      }

      const updated = (await res.json()) as BackgroundImage;
      setImages((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
      );
      toast.success(t('admin.backgrounds.nameSaved'));
      setEditingId(null);
    } catch {
      toast.error(t('admin.backgrounds.nameFailed'));
    }
  };

  const handleReplaceClick = (image: BackgroundImage) => {
    targetReplaceImageRef.current = image;
    if (replaceInputRef.current) {
      replaceInputRef.current.value = '';
      replaceInputRef.current.click();
    }
  };

  const handleReplaceFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = targetReplaceImageRef.current;
    if (!file || !target) return;

    setReplacingId(target.id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('updatedAt', target.updatedAt);

      const res = await fetch(`/api/admin/media-library/${target.id}/replace`, {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });

      if (res.status === 409) {
        toast.error(t('admin.backgrounds.staleConflict'));
        void fetchImages();
        return;
      }

      if (!res.ok) {
        const errData = await readJson(res);
        toast.error(errData.error || t('admin.backgrounds.replaceFailed'));
        return;
      }

      const updated = (await res.json()) as BackgroundImage;
      setImages((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
      );
      setCacheBusters((prev) => ({ ...prev, [target.id]: Date.now() }));
      toast.success(t('admin.backgrounds.replaced'));
    } catch {
      toast.error(t('admin.backgrounds.replaceFailed'));
    } finally {
      setReplacingId(null);
      targetReplaceImageRef.current = null;
    }
  };

  const handleDelete = async (image: BackgroundImage) => {
    const ok = window.confirm(t('admin.backgrounds.confirmDelete'));
    if (!ok) return;

    setDeletingId(image.id);
    try {
      const res = await fetch(`/api/admin/background-library/${image.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedAt: image.updatedAt,
        }),
      });

      if (res.status === 409) {
        toast.error(t('admin.backgrounds.staleConflict'));
        void fetchImages();
        return;
      }

      if (!res.ok) {
        toast.error(t('admin.backgrounds.deleteFailed'));
        return;
      }

      setImages((prev) => prev.filter((item) => item.id !== image.id));
      toast.success(t('admin.backgrounds.deleted'));
    } catch {
      toast.error(t('admin.backgrounds.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input for in-place asset replacement */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReplaceFileSelected}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.backgrounds.title')}</CardTitle>
          <CardDescription>{t('admin.backgrounds.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold">{t('admin.backgrounds.addTitle')}</h3>

            {/* Category selection directly above the inputs with high contrast */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Media Category:</Label>
              <div className="flex flex-wrap items-center gap-2">
                {(['announcement', 'background', 'general'] as const).map((cat) => {
                  const isSelected = uploadCategory === cat;
                  return (
                    <Button
                      key={cat}
                      type="button"
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      aria-pressed={isSelected}
                      className={`text-xs capitalize h-8 px-3 font-semibold transition-all ${
                        isSelected
                          ? 'shadow-xs ring-2 ring-primary/30 ring-offset-1'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setUploadCategory(cat)}
                    >
                      {isSelected ? <Check className="mr-1.5 h-3.5 w-3.5 stroke-[2.5]" /> : null}
                      {cat === 'announcement' ? 'Announcement' : cat === 'background' ? 'Background' : 'General'}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Custom Name field */}
            <div className="space-y-1.5 pt-1">
              <Label htmlFor={nameId} className="text-xs font-medium text-muted-foreground">
                {t('admin.backgrounds.customName')}
              </Label>
              <Input
                id={nameId}
                type="text"
                className="text-xs bg-background"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={t('admin.backgrounds.customNamePlaceholder')}
                disabled={isBusy}
              />
            </div>

            {/* Upload File Input */}
            <div className="grid gap-3 sm:grid-cols-12 sm:items-center pt-1">
              <div className="sm:col-span-8">
                <Label htmlFor={pickerId} className="sr-only">
                  {t('admin.backgrounds.addUpload')}
                </Label>
                <input
                  ref={pickerRef}
                  id={pickerId}
                  type="file"
                  accept="image/*"
                  className={PICKER_CLASS}
                  disabled={isBusy}
                  onChange={(e) => {
                    setUploadError(null);
                    const f = e.target.files?.[0];
                    if (f) {
                      setPicked(true);
                      setCropTargetFile(f);
                    } else {
                      setPicked(false);
                      setCropTargetFile(null);
                    }
                  }}
                />
              </div>
              <div className="sm:col-span-4">
                <Button
                  type="button"
                  variant="default"
                  className="w-full text-xs font-semibold"
                  onClick={uploadPickedFile}
                  disabled={isBusy || !picked}
                >
                  {busy === 'upload' ? t('admin.backgrounds.uploading') : t('admin.backgrounds.addUpload')}
                </Button>
              </div>
            </div>

            {/* URL input */}
            <div className="grid gap-3 sm:grid-cols-12 sm:items-end pt-1">
              <div className="sm:col-span-8">
                <Label htmlFor={linkId} className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t('admin.backgrounds.addUrl')}
                </Label>
                <Input
                  id={linkId}
                  type="url"
                  className="text-xs bg-background"
                  value={link}
                  onChange={(e) => {
                    setUploadError(null);
                    setLink(e.target.value);
                  }}
                  placeholder={t('admin.backgrounds.urlPlaceholder')}
                  disabled={isBusy}
                />
              </div>
              <div className="sm:col-span-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={fetchFromLink}
                  disabled={isBusy || !link.trim()}
                >
                  {busy === 'fetch'
                    ? t('admin.backgrounds.downloading')
                    : t('admin.backgrounds.downloadFromLink')}
                </Button>
              </div>
            </div>

            {uploadError ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {uploadError}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.backgrounds.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-1.5">
              {(['all', 'announcement', 'background', 'general'] as const).map((cat) => {
                const isActive = categoryFilter === cat;
                return (
                  <Button
                    key={cat}
                    type="button"
                    size="sm"
                    variant={isActive ? 'default' : 'outline'}
                    className={`text-xs capitalize h-7 px-3 font-medium transition-all ${
                      isActive ? 'shadow-xs font-semibold' : ''
                    }`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat === 'all'
                      ? 'All Assets'
                      : cat === 'announcement'
                      ? 'Announcements'
                      : cat === 'background'
                      ? 'Backgrounds'
                      : 'General'}
                  </Button>
                );
              })}
            </div>
            <span className="text-xs text-muted-foreground">
              {images.filter((img) => categoryFilter === 'all' || (img.category || 'background') === categoryFilter).length} asset{images.filter((img) => categoryFilter === 'all' || (img.category || 'background') === categoryFilter).length === 1 ? '' : 's'}
            </span>
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
              <span>Loading…</span>
            </div>
          ) : images.filter((img) => categoryFilter === 'all' || (img.category || 'background') === categoryFilter).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('admin.backgrounds.empty')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {images
                .filter((img) => categoryFilter === 'all' || (img.category || 'background') === categoryFilter)
                .map((img) => {
                const isSettingDefault = settingDefaultId === img.id;
                const isDeleting = deletingId === img.id;
                const isReplacing = replacingId === img.id;
                const isEditing = editingId === img.id;
                const cacheBuster = cacheBusters[img.id];
                const imageSrc = cacheBuster ? `${img.url}?t=${cacheBuster}` : img.url;
                const displayName = img.name || `Media #${img.id}`;

                return (
                  <div
                    key={img.id}
                    className={`relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all ${
                      img.isDefault ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                    }`}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-muted">
                      <img
                        src={imageSrc}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute left-2 top-2 flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-semibold uppercase tracking-wider bg-background/80 backdrop-blur-xs"
                        >
                          {img.category || 'background'}
                        </Badge>
                        {img.isDefault ? (
                          <Badge
                            variant="default"
                            className="shadow-sm font-semibold text-[10px]"
                          >
                            <Check className="mr-1 h-3 w-3" />
                            {t('admin.backgrounds.defaultBadge')}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    {/* Card Content with Name and Actions */}
                    <div className="flex flex-1 flex-col justify-between p-3 space-y-3">
                      <div>
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-7 text-xs"
                              placeholder="Name"
                              autoFocus
                            />
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="default"
                              title="Save name"
                              onClick={() => void handleRenameSave(img)}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="outline"
                              title="Cancel"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate text-xs font-semibold text-foreground" title={displayName}>
                              {displayName}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              title={t('admin.backgrounds.rename')}
                              onClick={() => {
                                setEditingId(img.id);
                                setEditingName(img.name || '');
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        <span className="truncate block text-[11px] text-muted-foreground/80 font-mono mt-0.5" title={img.url}>
                          {img.url}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-t border-border pt-2.5">
                        <div className="flex items-center gap-1.5">
                          {!img.isDefault ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              disabled={isSettingDefault || isDeleting || isReplacing}
                              onClick={() => void handleMakeDefault(img)}
                            >
                              {isSettingDefault ? '…' : t('admin.backgrounds.makeDefault')}
                            </Button>
                          ) : (
                            <span className="text-xs font-semibold text-primary">
                              {t('admin.backgrounds.defaultBadge')}
                            </span>
                          )}

                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            disabled={isSettingDefault || isDeleting || isReplacing}
                            title="Replace image in place preserving URL"
                            onClick={() => handleReplaceClick(img)}
                          >
                            <RefreshCw className={`mr-1 h-3 w-3 ${isReplacing ? 'animate-spin' : ''}`} />
                            {isReplacing ? '…' : t('admin.backgrounds.replace')}
                          </Button>
                        </div>

                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-xs"
                          disabled={isDeleting || isSettingDefault || isReplacing}
                          title={t('admin.backgrounds.delete')}
                          onClick={() => void handleDelete(img)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {cropTargetFile && (
        <ImageCropDialog
          open={Boolean(cropTargetFile)}
          file={cropTargetFile}
          defaultAspect={16 / 9}
          defaultResize="1080p"
          title="Crop & Resize Background"
          onComplete={handleUploadCroppedFile}
          onCancel={() => {
            setCropTargetFile(null);
            if (pickerRef.current) pickerRef.current.value = '';
            setPicked(false);
          }}
        />
      )}
    </div>
  );
}

export const MediaGalleryPanel = BackgroundLibraryPanel;
export default BackgroundLibraryPanel;
