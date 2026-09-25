import React, { useState, useEffect, useCallback, useId } from 'react';
import Cropper from 'react-easy-crop';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  getCroppedImg,
  type CropArea,
  type ResizeProfile,
} from '@/lib/images/crop-image';

export interface ImageCropDialogProps {
  open: boolean;
  file: File | null;
  defaultAspect?: number | null; // e.g. 16/9, 1, 4/3, or null for Freeform
  defaultResize?: ResizeProfile;
  title?: string;
  onComplete: (file: File) => void;
  onCancel: () => void;
}

const ASPECT_RATIO_PRESETS: Array<{ label: string; value: number | null }> = [
  { label: '16:9', value: 16 / 9 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: 'Freeform', value: null },
];

const RESIZE_PROFILES: Array<{ label: string; value: ResizeProfile; desc: string }> = [
  { label: 'Max 1080p', value: '1080p', desc: 'Up to 1920×1080' },
  { label: 'Max 800px', value: '800px', desc: 'Up to 800×800' },
  { label: 'Original', value: 'original', desc: 'Full pixel crop' },
];

export default function ImageCropDialog({
  open,
  file,
  defaultAspect = null,
  defaultResize = '1080p',
  title = 'Crop & Resize Image',
  onComplete,
  onCancel,
}: ImageCropDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [selectedAspect, setSelectedAspect] = useState<number | null>(defaultAspect);
  const [selectedProfile, setSelectedProfile] = useState<ResizeProfile>(defaultResize);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const zoomSliderId = useId();

  // Create object URL when file is provided and revoke on cleanup/unmount
  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setImageSrc(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setSelectedAspect(defaultAspect);
    setSelectedProfile(defaultResize);
    setCroppedAreaPixels(null);
    setErrorMessage(null);
    setIsProcessing(false);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, defaultAspect, defaultResize]);

  const onCropCompleteHandler = useCallback((_croppedArea: any, areaPixels: CropArea) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!file || !imageSrc || !croppedAreaPixels) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels, {
        profile: selectedProfile,
        fileName: file.name,
        mimeType: file.type,
      });
      onComplete(croppedFile);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Failed to process crop. You can skip cropping and upload the original file.'
      );
      setIsProcessing(false);
    }
  };

  const handleSkipCrop = () => {
    if (!file) return;
    onComplete(file);
  };

  if (!open || !file) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
      <DialogContent className="max-w-2xl sm:max-w-2xl p-4 gap-3 bg-popover text-popover-foreground">
        <DialogHeader className="pb-1 border-b border-border/50">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
            {errorMessage}
          </div>
        )}

        {/* Viewport for react-easy-crop */}
        <div className="relative h-72 sm:h-80 w-full overflow-hidden rounded-lg bg-black/90">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={selectedAspect ?? undefined}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropCompleteHandler}
            />
          )}
        </div>

        {/* Controls Grid */}
        <div className="space-y-3 pt-1 text-xs">
          {/* Zoom Slider */}
          <div className="flex items-center gap-3">
            <Label htmlFor={zoomSliderId} className="w-12 shrink-0 font-medium text-xs">
              Zoom:
            </Label>
            <input
              id={zoomSliderId}
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary cursor-pointer"
            />
            <span className="w-10 text-right font-mono text-[11px] text-muted-foreground">
              {zoom.toFixed(2)}x
            </span>
          </div>

          {/* Aspect Ratio Preset Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-12 shrink-0 font-medium text-xs text-foreground">Ratio:</span>
            <div className="flex flex-wrap gap-1">
              {ASPECT_RATIO_PRESETS.map((preset) => {
                const isActive = selectedAspect === preset.value;
                return (
                  <Button
                    key={preset.label}
                    type="button"
                    size="xs"
                    variant={isActive ? 'default' : 'outline'}
                    className="h-6 text-[11px] px-2.5"
                    onClick={() => {
                      setCroppedAreaPixels(null);
                      setSelectedAspect(preset.value);
                    }}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Resize Profile Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-12 shrink-0 font-medium text-xs text-foreground">Resize:</span>
            <div className="flex flex-wrap gap-1">
              {RESIZE_PROFILES.map((prof) => {
                const isActive = selectedProfile === prof.value;
                return (
                  <Button
                    key={prof.value}
                    type="button"
                    size="xs"
                    variant={isActive ? 'default' : 'outline'}
                    className="h-6 text-[11px] px-2.5"
                    onClick={() => setSelectedProfile(prof.value)}
                    title={prof.desc}
                  >
                    {prof.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSkipCrop}
            disabled={isProcessing}
            title="Upload original file without cropping"
          >
            Skip Crop
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleApplyCrop}
              disabled={isProcessing || !croppedAreaPixels}
            >
              {isProcessing ? 'Processing...' : 'Crop & Upload'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
