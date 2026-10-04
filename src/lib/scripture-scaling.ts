/**
 * Shared dynamic font scaling formula for scripture overlays.
 *
 * Sizing criteria (SPEC-85 superseding SPEC-43):
 * Returns pure container query sizes (cqh) ensuring proportional scaling with stage
 * dimensions across any screen resolution (720p to 4K) without root font size deformation:
 * - Short verses (< 60 chars): 8.5cqh (~ filling 40-50% vertical screen presence)
 * - Medium verses (60-120 chars): 6.5cqh
 * - Standard passages (120-200 chars): 4.8cqh
 * - Longer passages (> 200 chars): 3.5cqh with bounded max-height to ensure containment.
 */
export function getScriptureScaling(
  text: string,
  verseCount?: number,
  typographyMode?: 'chapter' | 'verse',
  estimatedVisualLines?: number
): {
  fontSizeStyle: string;
  tailwindClass: string;
  minHeightStyle: string;
  charCount: number;
} {
  const len = text.trim().length;

  // Chapter presentation scales adaptively by estimatedVisualLines (SPEC-102):
  // - 1–5 visual lines: 6.0cqh (minHeight: 32cqh)
  // - 6–7 visual lines: 5.4cqh (minHeight: 26cqh)
  // - 8–10 visual lines: 4.8cqh (minHeight: 20cqh)
  if (typographyMode === 'chapter') {
    const lines =
      typeof estimatedVisualLines === 'number' && estimatedVisualLines > 0
        ? estimatedVisualLines
        : Math.max(1, Math.ceil(len / 60));

    if (lines <= 5) {
      return {
        fontSizeStyle: '6.0cqh',
        tailwindClass: 'font-normal',
        minHeightStyle: '32cqh',
        charCount: len,
      };
    }
    if (lines <= 7) {
      return {
        fontSizeStyle: '5.4cqh',
        tailwindClass: 'font-normal',
        minHeightStyle: '26cqh',
        charCount: len,
      };
    }
    return {
      fontSizeStyle: '4.8cqh',
      tailwindClass: 'font-normal',
      minHeightStyle: '20cqh',
      charCount: len,
    };
  }

  if (typeof verseCount === 'number') {
    if (verseCount === 1 || len < 60) {
      return {
        fontSizeStyle: '8.5cqh',
        tailwindClass: 'font-medium tracking-tight',
        minHeightStyle: '38cqh',
        charCount: len,
      };
    }
    if (verseCount <= 4 || len < 120) {
      return {
        fontSizeStyle: '6.5cqh',
        tailwindClass: 'font-normal',
        minHeightStyle: '28cqh',
        charCount: len,
      };
    }
    if (verseCount <= 8 || len < 200) {
      return {
        fontSizeStyle: '4.8cqh',
        tailwindClass: 'font-normal',
        minHeightStyle: '20cqh',
        charCount: len,
      };
    }
    return {
      fontSizeStyle: '3.5cqh',
      tailwindClass: 'font-normal',
      minHeightStyle: 'auto',
      charCount: len,
    };
  }

  if (len < 60) {
    return {
      fontSizeStyle: '8.5cqh',
      tailwindClass: 'font-medium tracking-tight',
      minHeightStyle: '38cqh',
      charCount: len,
    };
  }
  if (len < 120) {
    return {
      fontSizeStyle: '6.5cqh',
      tailwindClass: 'font-normal',
      minHeightStyle: '28cqh',
      charCount: len,
    };
  }
  if (len < 200) {
    return {
      fontSizeStyle: '4.8cqh',
      tailwindClass: 'font-normal',
      minHeightStyle: '20cqh',
      charCount: len,
    };
  }
  return {
    fontSizeStyle: '3.5cqh',
    tailwindClass: 'font-normal',
    minHeightStyle: 'auto',
    charCount: len,
  };
}

/**
 * Calculates shrink-to-fit scale factor for scripture text within fixed stage-anchored bounds.
 * Prevents text clipping and guarantees strict containment within the 82cqh verse budget
 * and net content box width, supporting exact container content-box measurements and pillarbox geometries.
 */
export function computeScriptureFitScale({
  stageHeight,
  stageWidth,
  naturalHeight,
  naturalWidth,
  containerHeight,
  containerWidth,
}: {
  stageHeight: number;
  stageWidth: number;
  naturalHeight: number;
  naturalWidth: number;
  containerHeight?: number;
  containerWidth?: number;
}): number {
  if (stageHeight <= 0 || stageWidth <= 0 || naturalHeight <= 0 || naturalWidth <= 0) return 1;

  const maxAllowedHeight =
    typeof containerHeight === 'number'
      ? Math.min(containerHeight, stageHeight * 0.82)
      : stageHeight * 0.82;
  const maxAllowedWidth =
    typeof containerWidth === 'number'
      ? containerWidth
      : stageWidth * 0.85;

  if (maxAllowedHeight <= 0 || maxAllowedWidth <= 0) return 0;

  if (naturalHeight > maxAllowedHeight || naturalWidth > maxAllowedWidth) {
    const heightRatio = maxAllowedHeight / naturalHeight;
    const widthRatio = maxAllowedWidth / naturalWidth;
    return Math.min(1, Math.min(heightRatio, widthRatio) * 0.98);
  }
  return 1;
}
