/**
 * Shared dynamic font scaling formula for scripture overlays.
 *
 * Sizing criteria (SPEC-43):
 * - Short verses (< 60 chars): renders prominently with 4.5rem-5.5rem (text-7xl / ~7.5cqh), filling 40-50% vertical screen presence.
 * - Medium verses (60-120 chars): 3.5rem-4.25rem (text-5xl-6xl / ~6cqh).
 * - Standard passages (120-200 chars): 2.5rem-3.25rem (text-4xl-5xl / ~4.5cqh).
 * - Longer passages (> 200 chars): graceful scale down to floor (1.75rem-2.5rem / ~3.5cqh) with bounded max-height to ensure containment.
 */
export function getScriptureScaling(text: string): {
  fontSizeStyle: string;
  tailwindClass: string;
  minHeightStyle: string;
  charCount: number;
} {
  const len = text.trim().length;
  if (len < 60) {
    return {
      fontSizeStyle: 'clamp(2.5rem, 8.5cqh, 6rem)',
      tailwindClass: 'text-6xl sm:text-7xl md:text-8xl font-medium tracking-tight',
      minHeightStyle: '38cqh',
      charCount: len,
    };
  }
  if (len < 120) {
    return {
      fontSizeStyle: 'clamp(2rem, 6.5cqh, 4.5rem)',
      tailwindClass: 'text-5xl sm:text-6xl md:text-7xl',
      minHeightStyle: '28cqh',
      charCount: len,
    };
  }
  if (len < 200) {
    return {
      fontSizeStyle: 'clamp(1.5rem, 4.8cqh, 3.5rem)',
      tailwindClass: 'text-3xl sm:text-4xl md:text-5xl',
      minHeightStyle: '20cqh',
      charCount: len,
    };
  }
  return {
    fontSizeStyle: 'clamp(1.25rem, 3.5cqh, 2.5rem)',
    tailwindClass: 'text-2xl sm:text-3xl md:text-4xl',
    minHeightStyle: 'auto',
    charCount: len,
  };
}
