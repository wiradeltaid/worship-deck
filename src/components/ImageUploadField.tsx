import { useId, useRef, useState } from 'react';
import { ImageFieldPreview } from '@/components/ImageFieldPreview';
import ImageCropDialog from '@/components/media/ImageCropDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface CropConfig {
  defaultAspect?: number | null;
  defaultResize?: 'original' | '1080p' | '800px';
}

/**
 * One service image field: the picture, the two ways to set it, and the way to
 * unset it.
 *
 * The stored value — always `/api/uploads/<32-hex>.<ext>` — is deliberately not
 * rendered anywhere as editable text. It is a machine-generated name that told
 * the operator nothing while occupying the most prominent line of the card;
 * what they need to see is whether a file is chosen and which picture landed.
 *
 * Two paths put bytes on the hub, and both end in a hub-local upload:
 *
 * - the file picker, left as a *native* `<input type="file">` so the browser's
 *   own "No file chosen" / chosen-filename state is the answer to "is something
 *   selected?", rather than a re-implementation of it;
 * - a link, which the server downloads through the shared hardened fetch. The
 *   link is a source, never a stored value: the offline deck must carry its own
 *   copy rather than depend on someone else's host staying up on a Sabbath
 *   morning.
 *
 * The remove control is not a nicety. Hiding the URL text box removes the only
 * way the operator previously had to clear a wrongly uploaded image, and a
 * cosmetic fix that strands them is a worse defect than the one it fixes.
 */

// The picker half is styled; the text beside it is the browser's own state.
const PICKER_CLASS =
  'w-full text-xs text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-xl file:border file:border-primary/20 file:bg-primary/10 file:px-4 file:py-2 file:text-xs file:font-bold file:text-primary hover:file:bg-primary/20 disabled:opacity-60';

type UploadResponse = { error?: string; url?: string };

/** Parse a JSON body without letting a non-JSON error page throw. */
async function readJson(res: Response): Promise<UploadResponse> {
  try {
    return (await res.json()) as UploadResponse;
  } catch {
    return {};
  }
}

export function ImageUploadField({
  label,
  value,
  onChange,
  previewAlt,
  uploadLabel,
  disabled = false,
  cropConfig,
}: {
  /** Field name shown above the controls, e.g. "Sermon Graphic". */
  label: string;
  /** The stored upload ref. Displayed only as a picture, never as text. */
  value: string;
  onChange: (url: string) => void;
  previewAlt: string;
  /** Text on the upload button, e.g. "Upload Sermon Image". */
  uploadLabel: string;
  disabled?: boolean;
  cropConfig?: CropConfig;
}) {
  const pickerId = useId();
  const linkId = useId();
  const pickerRef = useRef<HTMLInputElement>(null);

  const [link, setLink] = useState('');
  // One flag per path, so a slow download cannot make the upload button look
  // like the thing that is busy.
  const [busy, setBusy] = useState<'upload' | 'fetch' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Mirrors the native picker so the upload button knows whether it has work.
  const [picked, setPicked] = useState(false);
  const [cropTargetFile, setCropTargetFile] = useState<File | null>(null);

  const isBusy = busy !== null;
  const locked = disabled || isBusy;

  const clearPicker = () => {
    if (pickerRef.current) pickerRef.current.value = '';
    setPicked(false);
  };

  const uploadPickedFile = () => {
    const file = pickerRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file first.');
      return;
    }
    setError(null);
    setCropTargetFile(file);
  };

  const handleUploadFile = async (fileToUpload: File) => {
    setCropTargetFile(null);
    setError(null);
    setBusy('upload');
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await readJson(res);
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Upload failed');
      }
      onChange(data.url);
      clearPicker();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setBusy(null);
    }
  };

  const fetchFromLink = async () => {
    const url = link.trim();
    if (!url) {
      setError('Paste an image link first.');
      return;
    }
    setError(null);
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
      onChange(data.url);
      // The link has done its job; the stored copy is what matters now.
      setLink('');
      clearPicker();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to download that image'
      );
    } finally {
      setBusy(null);
    }
  };

  const remove = () => {
    setError(null);
    setLink('');
    clearPicker();
    onChange('');
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap items-start gap-4">
        <ImageFieldPreview url={value} alt={previewAlt} />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-12 sm:items-center">
            <div className="sm:col-span-8">
              <Label htmlFor={pickerId} className="sr-only">
                {label} file
              </Label>
              <input
                ref={pickerRef}
                id={pickerId}
                type="file"
                accept="image/*"
                className={PICKER_CLASS}
                disabled={locked}
                onChange={(e) => {
                  setError(null);
                  const file = e.target.files?.[0];
                  if (file) {
                    setPicked(true);
                    setCropTargetFile(file);
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
                variant="outline"
                className="w-full"
                onClick={uploadPickedFile}
                disabled={locked || !picked}
              >
                {busy === 'upload' ? 'Uploading…' : uploadLabel}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
            <div className="sm:col-span-8">
              <Label htmlFor={linkId} className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Or paste an image link
              </Label>
              <Input
                id={linkId}
                type="url"
                className="text-xs"
                value={link}
                onChange={(e) => {
                  setError(null);
                  setLink(e.target.value);
                }}
                placeholder="https://example.com/photo.jpg"
                disabled={locked}
              />
            </div>
            <div className="sm:col-span-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={fetchFromLink}
                disabled={locked || !link.trim()}
              >
                {busy === 'fetch' ? 'Downloading…' : 'Download from link'}
              </Button>
            </div>
          </div>

          {value ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Image saved on the hub.
              </span>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-destructive"
                onClick={remove}
                disabled={locked}
              >
                Remove
              </Button>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {cropTargetFile && (
        <ImageCropDialog
          open={Boolean(cropTargetFile)}
          file={cropTargetFile}
          defaultAspect={cropConfig?.defaultAspect}
          defaultResize={cropConfig?.defaultResize}
          title={`Crop & Resize ${label}`}
          onComplete={handleUploadFile}
          onCancel={() => {
            setCropTargetFile(null);
            clearPicker();
          }}
        />
      )}
    </div>
  );
}
