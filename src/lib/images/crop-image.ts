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
