import {
  memo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MediaStore } from './media-store';
import type { PlaylistItem, MediaType } from './playlist-model';

export interface MediaUploaderProps {
  store: MediaStore;
  onToastError?: (msg: string) => void;
  className?: string;
}

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MiB cap
const SUPPORTED_AUDIO_EXT = /\.(mp3|wav|m4a|ogg)$/i;
const SUPPORTED_VIDEO_EXT = /\.(mp4|webm)$/i;

export const MediaUploader = memo(function MediaUploader({
  store,
  onToastError,
  className,
}: MediaUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setErrorMessage(null);
      setIsUploading(true);

      const itemsToAdd: PlaylistItem[] = [];

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file) continue;

          // Check size limit
          if (file.size > MAX_FILE_SIZE_BYTES) {
            const err = `Berkas "${file.name}" melebihi batas 500 MiB`;
            setErrorMessage(err);
            if (onToastError) onToastError(err);
            continue;
          }

          // Check format
          const isAudio = SUPPORTED_AUDIO_EXT.test(file.name);
          const isVideo = SUPPORTED_VIDEO_EXT.test(file.name);

          if (!isAudio && !isVideo) {
            const err = `Format "${file.name}" tidak didukung. Gunakan .mp3, .wav, .m4a, .ogg, .mp4, atau .webm`;
            setErrorMessage(err);
            if (onToastError) onToastError(err);
            continue;
          }

          const mediaType: MediaType = isVideo ? 'video' : 'audio';

          // Upload to server
          const formData = new FormData();
          formData.append('file', file);

          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const err = `Gagal mengunggah "${file.name}" (${res.statusText})`;
            setErrorMessage(err);
            if (onToastError) onToastError(err);
            continue;
          }

          const data = (await res.json()) as { url?: string };
          if (!data.url) {
            continue;
          }

          itemsToAdd.push({
            id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            url: data.url,
            type: mediaType,
            size: file.size,
            status: 'ready',
          });
        }

        if (itemsToAdd.length > 0) {
          store.dispatch({ type: 'ADD_ITEMS', items: itemsToAdd });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Galat saat mengunggah media';
        setErrorMessage(msg);
        if (onToastError) onToastError(msg);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [store, onToastError]
  );

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".mp3,.wav,.m4a,.ogg,.mp4,.webm,audio/*,video/*"
        data-testid="media-uploader-input"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isUploading}
        data-testid="media-uploader-button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="h-8 w-full gap-2 text-xs border-dashed"
      >
        <Upload className="h-3.5 w-3.5" />
        <span>{isUploading ? 'Mengunggah...' : 'Tambah Audio / Video (Maks 500 MiB)'}</span>
      </Button>

      {errorMessage && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}
    </div>
  );
});
