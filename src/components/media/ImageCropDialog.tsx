import React, { useState, useEffect, useCallback, useId, useMemo } from 'react';
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
  type AspectPresetId,
  ASPECT_RATIO_PRESETS,
  PRESET_NUMERICAL_ASPECTS,
  resolveDefaultPreset,
  resolveCustomAspect,
  calculateEffectiveAspect,
} from '@/lib/images/crop-image';

export type { AspectPresetId };
export {
  ASPECT_RATIO_PRESETS,
  PRESET_NUMERICAL_ASPECTS,
  resolveDefaultPreset,
  resolveCustomAspect,
  calculateEffectiveAspect,
};

export interface ImageCropDialogProps {
  open: boolean;
  file: File | null;
  defaultAspect?: number | null | AspectPresetId;
  defaultResize?: ResizeProfile;
  title?: string;
  onComplete: (file: File) => void;
  onCancel: () => void;
}

export const RESIZE_PROFILES: Array<{ label: string; value: ResizeProfile; desc: string }> = [
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
  const [selectedPreset, setSelectedPreset] = useState<AspectPresetId>(() => resolveDefaultPreset(defaultAspect));
  const [selectedProfile, setSelectedProfile] = useState<ResizeProfile>(defaultResize);
  const [mediaSize, setMediaSize] = useState<{ naturalWidth: number; naturalHeight: number } | null>(null);
  const [customWidth, setCustomWidth] = useState<string>('16');
  const [customHeight, setCustomHeight] = useState<string>('9');
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
    setSelectedPreset(resolveDefaultPreset(defaultAspect));
    setSelectedProfile(defaultResize);
    setMediaSize(null);
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

  const onMediaLoadedHandler = useCallback((loaded: { naturalWidth: number; naturalHeight: number }) => {
    setMediaSize({ naturalWidth: loaded.naturalWidth, naturalHeight: loaded.naturalHeight });
  }, []);

  const customValidation = useMemo(
    () => resolveCustomAspect(customWidth, customHeight),
    [customWidth, customHeight]
  );

  const effectiveAspect = useMemo(() => {
    return calculateEffectiveAspect(selectedPreset, mediaSize, customWidth, customHeight).aspect;
  }, [selectedPreset, mediaSize, customWidth, customHeight]);

  const handleApplyCrop = async () => {
    if (!file || !imageSrc || !croppedAreaPixels) return;
    if (selectedPreset === 'custom' && !customValidation.isValid) return;

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

  const isApplyDisabled =
    isProcessing ||
    !croppedAreaPixels ||
    (selectedPreset === 'custom' && !customValidation.isValid);

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
              aspect={effectiveAspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onMediaLoaded={onMediaLoadedHandler}
              onCropComplete={onCropCompleteHandler}
            />
          )}
        </div>

        {/* Pan and zoom interaction hint */}
        <p className="text-[11px] text-muted-foreground text-center">
          Geser gambar untuk mengatur posisi, gunakan slider zoom untuk memperbesar/memperkecil
        </p>

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
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-12 shrink-0 font-medium text-xs text-foreground">Ratio:</span>
              <div className="flex flex-wrap gap-1">
                {ASPECT_RATIO_PRESETS.map((preset) => {
                  const isActive = selectedPreset === preset.id;
                  return (
                    <Button
                      key={preset.id}
                      type="button"
                      size="xs"
                      variant={isActive ? 'default' : 'outline'}
                      className="h-6 text-[11px] px-2.5"
                      onClick={() => {
                        setCroppedAreaPixels(null);
                        setSelectedPreset(preset.id);
                      }}
                      title={preset.desc}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Custom Ratio Inputs */}
            {selectedPreset === 'custom' && (
              <div className="flex items-center gap-2 pl-14 pt-1">
                <span className="text-muted-foreground text-[11px]">Rasio W:H :</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  aria-label="Custom Aspect Width"
                  value={customWidth}
                  onChange={(e) => {
                    setCroppedAreaPixels(null);
                    setCustomWidth(e.target.value);
                  }}
                  className="w-16 h-6 px-1.5 text-center font-mono text-xs border rounded bg-background"
                />
                <span className="font-semibold text-muted-foreground">:</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  aria-label="Custom Aspect Height"
                  value={customHeight}
                  onChange={(e) => {
                    setCroppedAreaPixels(null);
                    setCustomHeight(e.target.value);
                  }}
                  className="w-16 h-6 px-1.5 text-center font-mono text-xs border rounded bg-background"
                />
                {!customValidation.isValid && customValidation.error && (
                  <span className="text-destructive text-[11px]">{customValidation.error}</span>
                )}
              </div>
            )}
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
              disabled={isApplyDisabled}
            >
              {isProcessing ? 'Processing...' : 'Crop & Upload'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
