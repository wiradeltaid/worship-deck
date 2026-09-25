/**
 * SPEC-77: Client-side image crop and resize engine
 *
 * Implements:
 * 1. Pure target dimension calculation ensuring aspect ratio preservation and no upscaling.
 * 2. MIME type & extension resolution preserving PNG transparency.
 * 3. HTML5 canvas cropping and resizing with high smoothing quality.
 */

export interface Dimensions {
  width: number;
  height: number;
}

export interface ResizeLimits {
  maxWidth?: number;
  maxHeight?: number;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeProfile = 'original' | '1080p' | '800px';

export type AspectPresetId =
  | 'original'
  | '16:9'
  | '4:3'
  | '1:1'
  | '3:4'
  | '2:3'
  | '9:16'
  | 'a4'
  | 'custom';

export const ASPECT_RATIO_PRESETS: Array<{ id: AspectPresetId; label: string; desc: string }> = [
  { id: 'original', label: 'Original', desc: 'Sesuai dimensi asli gambar' },
  { id: '16:9', label: '16:9', desc: 'Slide Widescreen' },
  { id: '4:3', label: '4:3', desc: 'Standard Presentation' },
  { id: '1:1', label: '1:1', desc: 'Square / Avatar' },
  { id: '3:4', label: '3:4', desc: 'Portrait Tablet / Slide' },
  { id: '2:3', label: '2:3', desc: 'Cover Buku / 4×6 Photo' },
  { id: '9:16', label: '9:16', desc: 'Vertical Mobile / Story' },
  { id: 'a4', label: 'A4', desc: 'Flyer / Dokumen Cetak' },
  { id: 'custom', label: 'Custom', desc: 'Rasio bebas W:H' },
];

export const PRESET_NUMERICAL_ASPECTS: Record<Exclude<AspectPresetId, 'original' | 'custom'>, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '3:4': 3 / 4,
  '2:3': 2 / 3,
  '9:16': 9 / 16,
  'a4': 210 / 297,
};

/**
 * Maps legacy defaultAspect inputs (number | null | string) to AspectPresetId.
 * SPEC-80: defaultAspect null/undefined maps to 'original'.
 */
export function resolveDefaultPreset(defaultAspect?: number | null | AspectPresetId): AspectPresetId {
  if (defaultAspect === null || defaultAspect === undefined || defaultAspect === 'original') {
    return 'original';
  }
  if (typeof defaultAspect === 'string') {
    const matched = ASPECT_RATIO_PRESETS.find((p) => p.id === defaultAspect);
    if (matched) return matched.id;
  }
  if (typeof defaultAspect === 'number' && isFinite(defaultAspect) && defaultAspect > 0) {
    if (Math.abs(defaultAspect - 16 / 9) < 0.01) return '16:9';
    if (Math.abs(defaultAspect - 1) < 0.01) return '1:1';
    if (Math.abs(defaultAspect - 4 / 3) < 0.01) return '4:3';
    if (Math.abs(defaultAspect - 3 / 4) < 0.01) return '3:4';
    if (Math.abs(defaultAspect - 2 / 3) < 0.01) return '2:3';
    if (Math.abs(defaultAspect - 9 / 16) < 0.01) return '9:16';
    if (Math.abs(defaultAspect - 210 / 297) < 0.01) return 'a4';
    return 'custom';
  }
  return 'original';
}

/**
 * Validates and clamps custom aspect ratio inputs.
 */
export function resolveCustomAspect(
  wStr: string,
  hStr: string
): { aspect: number; isValid: boolean; error: string | null } {
  const wTrim = wStr.trim();
  const hTrim = hStr.trim();

  // Strict full-string positive decimal number regex (rejects partial non-numeric like "2foo")
  const numberRegex = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
  if (!numberRegex.test(wTrim) || !numberRegex.test(hTrim)) {
    return { aspect: 1, isValid: false, error: 'Masukkan angka rasio yang valid' };
  }

  const w = parseFloat(wTrim);
  const h = parseFloat(hTrim);
  if (isNaN(w) || isNaN(h) || !Number.isFinite(w) || !Number.isFinite(h)) {
    return { aspect: 1, isValid: false, error: 'Masukkan angka rasio yang valid' };
  }
  if (w <= 0 || h <= 0) {
    return { aspect: 1, isValid: false, error: 'Rasio lebar dan tinggi harus lebih besar dari 0' };
  }
  const rawAspect = w / h;
  if (!Number.isFinite(rawAspect) || rawAspect <= 0) {
    return { aspect: 1, isValid: false, error: 'Rasio lebar dan tinggi tidak valid' };
  }
  const clampedAspect = Math.max(0.1, Math.min(10.0, rawAspect));
  return { aspect: clampedAspect, isValid: true, error: null };
}

/**
 * Computes the numerical aspect ratio passed to Cropper.
 * SPEC-80: Guaranteed to return a finite positive number, never undefined or null.
 */
export function calculateEffectiveAspect(
  preset: AspectPresetId,
  mediaSize: { naturalWidth: number; naturalHeight: number } | null,
  customWidth: string,
  customHeight: string
): { aspect: number; isValid: boolean; error: string | null } {
  if (preset === 'original') {
    if (
      mediaSize &&
      mediaSize.naturalHeight > 0 &&
      Number.isFinite(mediaSize.naturalWidth) &&
      Number.isFinite(mediaSize.naturalHeight)
    ) {
      const origAspect = mediaSize.naturalWidth / mediaSize.naturalHeight;
      if (Number.isFinite(origAspect) && origAspect > 0) {
        return { aspect: Math.max(0.01, Math.min(100.0, origAspect)), isValid: true, error: null };
      }
    }
    return { aspect: 1, isValid: true, error: null };
  }

  if (preset === 'custom') {
    return resolveCustomAspect(customWidth, customHeight);
  }

  const numerical = PRESET_NUMERICAL_ASPECTS[preset as keyof typeof PRESET_NUMERICAL_ASPECTS];
  return { aspect: numerical ?? 16 / 9, isValid: true, error: null };
}

export interface ResizeOptions {
  profile?: ResizeProfile;
  fileName?: string;
  mimeType?: string;
}

export const RESIZE_PROFILE_LIMITS: Record<ResizeProfile, ResizeLimits | undefined> = {
  original: undefined,
  '1080p': { maxWidth: 1920, maxHeight: 1080 },
  '800px': { maxWidth: 800, maxHeight: 800 },
};

/**
 * Pure calculation for target dimensions when scaling a cropped area within limits.
 * Guarantees:
 * - Proportional aspect ratio preservation.
 * - Fits within both maxWidth and maxHeight if defined.
 * - Never upscales (scale factor <= 1).
 */
export function calculateTargetDimensions(
  cropWidth: number,
  cropHeight: number,
  limits?: ResizeLimits
): Dimensions {
  if (cropWidth <= 0 || cropHeight <= 0) {
    return { width: 1, height: 1 };
  }

  const rawW = cropWidth;
  const rawH = cropHeight;

  if (!limits || (!limits.maxWidth && !limits.maxHeight)) {
    return { width: Math.floor(rawW), height: Math.floor(rawH) };
  }

  const maxW = limits.maxWidth && limits.maxWidth > 0 ? limits.maxWidth : Infinity;
  const maxH = limits.maxHeight && limits.maxHeight > 0 ? limits.maxHeight : Infinity;

  // Scale down if exceeds bounds, never upscale
  const scaleW = rawW > maxW ? maxW / rawW : 1;
  const scaleH = rawH > maxH ? maxH / rawH : 1;
  const scale = Math.min(scaleW, scaleH);

  let targetW = Math.floor(rawW);
  let targetH = Math.floor(rawH);

  if (scale < 1) {
    targetW = Math.max(1, Math.round(rawW * scale));
    targetH = Math.max(1, Math.round(rawH * scale));
  }

  return { width: targetW, height: targetH };
}

/**
 * Resolves output MIME type and matching file extension.
 * Preserves PNG transparency; defaults photographic inputs to JPEG.
 */
export function resolveOutputFormat(
  sourceMimeType?: string,
  sourceFileName?: string
): { mimeType: string; extension: string } {
  const mime = (sourceMimeType || '').toLowerCase();
  const name = (sourceFileName || '').toLowerCase();

  if (mime === 'image/png' || name.endsWith('.png')) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (mime === 'image/webp' || name.endsWith('.webp')) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  // Default to JPEG with quality 0.88 for photographic compression efficiency
  return { mimeType: 'image/jpeg', extension: 'jpg' };
}

/**
 * Executes canvas cropping and resizing on an image source, returning a File.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CropArea,
  options?: ResizeOptions
): Promise<File> {
  const image = await createImage(imageSrc);
  const limits = options?.profile ? RESIZE_PROFILE_LIMITS[options.profile] : RESIZE_PROFILE_LIMITS['1080p'];

  const cropX = Math.round(pixelCrop.x);
  const cropY = Math.round(pixelCrop.y);
  const cropW = Math.max(1, Math.round(pixelCrop.width));
  const cropH = Math.max(1, Math.round(pixelCrop.height));

  const targetDims = calculateTargetDimensions(cropW, cropH, limits);

  const canvas = document.createElement('canvas');
  canvas.width = targetDims.width;
  canvas.height = targetDims.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    targetDims.width,
    targetDims.height
  );

  const format = resolveOutputFormat(options?.mimeType, options?.fileName);
  const quality = format.mimeType === 'image/jpeg' ? 0.88 : undefined;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), format.mimeType, quality);
  });

  if (!blob) {
    throw new Error('Failed to generate image blob from canvas');
  }

  const baseName = (options?.fileName || 'image')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  // Derive final extension from the actual encoded Blob MIME type if available
  const actualMime = blob.type || format.mimeType;
  const actualExt =
    actualMime === 'image/png'
      ? 'png'
      : actualMime === 'image/webp'
        ? 'webp'
        : 'jpg';
  const outputFileName = `cropped-${baseName}.${actualExt}`;

  return new File([blob], outputFileName, { type: actualMime });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', () => reject(new Error('Failed to load image for cropping')));
    img.setAttribute('crossOrigin', 'anonymous');
    img.src = url;
  });
}
