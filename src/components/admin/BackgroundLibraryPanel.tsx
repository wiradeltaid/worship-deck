import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n/operator';

export interface BackgroundImage {
  id: number;
  url: string;
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
  const linkId = useId();
  const pickerRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<BackgroundImage[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload/link inputs
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<'upload' | 'fetch' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [picked, setPicked] = useState(false);

  // Category filtering & upload category
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'flyer' | 'background' | 'general'>('all');
  const [uploadCategory, setUploadCategory] = useState<'flyer' | 'background' | 'general'>('flyer');

  // Action states
  const [settingDefaultId, setSettingDefaultId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const addImageToLibrary = async (url: string, category: string = uploadCategory) => {
    try {
      const res = await fetch('/api/admin/media-library', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, category, isDefault: false }),
      });

      if (!res.ok) {
        toast.error(t('admin.backgrounds.addFailed'));
        return;
      }

      const created = (await res.json()) as BackgroundImage;
      setImages((prev) => [...prev, created]);
      toast.success(t('admin.backgrounds.added'));
    } catch {
      toast.error(t('admin.backgrounds.addFailed'));
    }
  };

  const uploadPickedFile = async () => {
    const file = pickerRef.current?.files?.[0];
    if (!file) return;

    setUploadError(null);
    setBusy('upload');
    try {
      const formData = new FormData();
      formData.append('file', file);
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
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.backgrounds.title')}</CardTitle>
          <CardDescription>{t('admin.backgrounds.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold">{t('admin.backgrounds.addTitle')}</h3>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Category:</span>
              {(['flyer', 'background', 'general'] as const).map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  size="sm"
                  variant={uploadCategory === cat ? 'secondary' : 'outline'}
                  className="text-xs capitalize h-6 px-2 font-medium"
                  onClick={() => setUploadCategory(cat)}
                >
                  {cat === 'flyer' ? 'Flyer' : cat === 'background' ? 'Background' : 'General'}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-12 sm:items-center">
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
                    setPicked(Boolean(e.target.files?.length));
                  }}
                />
              </div>
              <div className="sm:col-span-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={uploadPickedFile}
                  disabled={isBusy || !picked}
                >
                  {busy === 'upload' ? t('admin.backgrounds.uploading') : t('admin.backgrounds.addUpload')}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
              <div className="sm:col-span-8">
                <Label htmlFor={linkId} className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t('admin.backgrounds.addUrl')}
                </Label>
                <Input
                  id={linkId}
                  type="url"
                  className="text-xs"
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
                  className="w-full"
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
            <div className="flex items-center gap-1">
              {(['all', 'flyer', 'background', 'general'] as const).map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  size="sm"
                  variant={categoryFilter === cat ? 'default' : 'outline'}
                  className="text-xs capitalize h-7 px-2.5"
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat === 'all' ? 'All Assets' : cat === 'flyer' ? 'Flyers' : cat === 'background' ? 'Backgrounds' : 'General'}
                </Button>
              ))}
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

                return (
                  <div
                    key={img.id}
                    className={`relative overflow-hidden rounded-xl border bg-card transition-all ${
                      img.isDefault ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                    }`}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-muted">
                      <img
                        src={img.url}
                        alt={`Media #${img.id}`}
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

                    <div className="flex items-center justify-between p-3">
                      <div>
                        {!img.isDefault ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isSettingDefault || isDeleting}
                            onClick={() => void handleMakeDefault(img)}
                          >
                            {isSettingDefault ? '…' : t('admin.backgrounds.makeDefault')}
                          </Button>
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground">
                            {t('admin.backgrounds.defaultBadge')}
                          </span>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-sm"
                        disabled={isDeleting || isSettingDefault}
                        title={t('admin.backgrounds.delete')}
                        onClick={() => void handleDelete(img)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const MediaGalleryPanel = BackgroundLibraryPanel;
export default BackgroundLibraryPanel;
