/**
 * The single unit-conversion table for hydrated Artifact elements.
 *
 * `ResolvedElement.x/y/w/h` are percentages of a fixed 16:9 canvas whose
 * reference pixel size is 960x540, and `style.fontSize` is px on that same
 * reference. PPTX and the web renderer must agree on how those become inches /
 * points and CSS percentages / container units, so *every* conversion lives
 * here and nowhere else.
 *
 * Values may be negative or greater than 100 — that is deliberate clipping
 * inherited from the source deck and is never clamped.
 */
import {
  REFERENCE_CANVAS,
  type ResolvedElement,
  type ResolvedStyle,
} from './runtime-contract';

export { REFERENCE_CANVAS };
import type { CanvasElement } from '@/lib/registry/types';
import { DEFAULT_FONT_FAMILY, resolveCatalogFontFamily } from '@/lib/registry/font-catalog';

/**
 * Shrink-to-fit policy.
 *
 * Rule: **an element never paints outside its own box.** The registry's boxes
 * were auto-sized around their text in the source deck, so they hug it with no
 * slack, and a renderer that lets long text spill paints one element across its
 * neighbours — `closing-song-cue` pushes two 120px lines out of a 30%-high box
 * and over the rest of the slide.
 *
 * Text therefore scales down until its content fits, and stops at
 * `MIN_TEXT_FIT_SCALE`; past that point the box clips instead. Clipping means
 * the element's own content stays inside the element box — it never means the
 * box is clamped to the slide. Off-canvas geometry stays untouched.
 */

/** Line height both renderers lay text out at. */
export const TEXT_LINE_HEIGHT = 1.2;

/**
 * Fraction of the font size that a `TEXT_LINE_HEIGHT` line box leaves *empty*
 * above the first line and below the last, and which therefore does not count
 * as content when deciding whether text fits.
 *
 * A line box is taller than the glyphs it holds: the rest is half leading, split
 * top and bottom, and it carries no ink. Arial's content area is ~1.117em, so at
 * 1.2 the real empty band is ~0.083em; this stays well inside that for every
 * face the registry ships, which is the point — the allowance may never be so
 * large that the box clip amputates a descender on text the policy just called
 * "fitting".
 */
export const TEXT_FIT_LEADING_ALLOWANCE = 0.05;

/**
 * Floor for the fit scale: below 35% of the authored size projected text stops
 * being readable from the back of the hall, so shrinking further would only
 * trade a visible overflow for an invisible one. PowerPoint's own autofit stops
 * near 25%; we stop earlier and clip, because a clipped slide is obvious in
 * Live Preview and gets the content fixed before Sabbath.
 */
export const MIN_TEXT_FIT_SCALE = 0.35;

/**
 * SPEC-23: Ratio applied to the longest word's width to absorb shaping & kerning
 * disagreements between Fabric's un-kerned per-grapheme advance sum and shaped runs
 * in Chromium or LibreOffice Impress / Microsoft PowerPoint.
 * Calibrated on fixture F-1 (96px Arial 'international' = 523.03px; 1.02 adds ~10.46px of slack).
 */
export const WRAP_SLACK_RATIO = 1.02;

/**
 * Computes the minimum width percentage needed to accommodate the longest word
 * with metric slack, preserving authored width when already wider or when word width
 * exceeds the canvas bounds.
 *
 * Total and pure: non-finite or non-positive word width returns authoredWidthPct.
 * Capped at canvas: if longestWordWidthPx > REFERENCE_CANVAS.width, returns authoredWidthPct
 * so the shrink-to-fit path (SPEC-23-02) handles the overlong word rather than pushing the box off-canvas.
 */
export function applyWrapSlack(
  authoredWidthPct: number,
  longestWordWidthPx: number
): number {
  if (!Number.isFinite(longestWordWidthPx) || longestWordWidthPx <= 0) {
    return authoredWidthPct;
  }
  if (longestWordWidthPx > REFERENCE_CANVAS.width) {
    return authoredWidthPct;
  }
  const slackedWidthPx = longestWordWidthPx * WRAP_SLACK_RATIO;
  const slackedWidthPct = (slackedWidthPx / REFERENCE_CANVAS.width) * 100;
  return Math.max(authoredWidthPct, slackedWidthPct);
}

/**
 * Checks if an element's stored longestWordPx measurement is valid against its current style.
 * If font family, size, weight, or style have drifted since measurement, the element
 * must be treated as unmeasured.
 */
export function isMeasurementValid(
  element: ResolvedElement | CanvasElement | { style?: ResolvedStyle; longestWordPx?: number; measuredWith?: any; placeholderKey?: string }
): boolean {
  if (Boolean((element as any).placeholderKey)) {
    return false;
  }
  if (element.longestWordPx === undefined || !element.measuredWith) {
    return false;
  }
  const mw = element.measuredWith;
  const style = element.style ?? {};

  const currentFamily = resolveCatalogFontFamily(resolveFontFamily(style)).trim().toLowerCase();
  const measuredFamily = resolveCatalogFontFamily(mw.fontFamily ?? '').trim().toLowerCase();
  if (currentFamily !== measuredFamily) return false;

  const currentSize = fontSizePx(style);
  if (currentSize !== mw.fontSize) return false;

  const currentWeight = (style.fontWeight ?? 'normal').toString().trim().toLowerCase();
  const measuredWeight = (mw.fontWeight ?? 'normal').toString().trim().toLowerCase();
  if (currentWeight !== measuredWeight) return false;

  const currentStyle = (style.fontStyle ?? 'normal').toString().trim().toLowerCase();
  const measuredStyle = (mw.fontStyle ?? 'normal').toString().trim().toLowerCase();
  if (currentStyle !== measuredStyle) return false;

  return true;
}

/**
 * Exposes whether an element's text fit scale is determined by valid measurements
 * (longestWordPx and measuredWith) or falls back to the unmeasured path.
 */
export function isTextFitScaleMeasured(element: ResolvedElement): boolean {
  return isMeasurementValid(element);
}

/**
 * Estimates line count when wrapLines snapshot is absent but longestWordPx measurement is available.
 * Uses longest word width as an upper-bound proxy for character advance.
 */
export function estimateWrappedLineCount(
  text: string,
  boxWidthPx: number,
  longestWordPx: number
): number {
  const newlineCount = text.split('\n').length;
  if (!Number.isFinite(longestWordPx) || longestWordPx <= 0) return newlineCount;

  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return newlineCount;

  let longestWord = '';
  for (const w of words) {
    if (w.length > longestWord.length) longestWord = w;
  }
  if (!longestWord.length) return newlineCount;

  const avgCharWidth = longestWordPx / longestWord.length;
  if (!Number.isFinite(avgCharWidth) || avgCharWidth <= 0) return newlineCount;

  const charsPerLine = Math.max(1, Math.floor(boxWidthPx / avgCharWidth));
  const totalChars = text.length;
  const upper = Math.max(words.length, newlineCount);
  const estimated = Math.ceil(totalChars / charsPerLine);

  return Math.min(Math.max(estimated, newlineCount), upper);
}


/**
 * Scale factors are floored to this step. Quantizing keeps the browser's
 * measured value and the PPTX estimate landing on the same number, and keeps a
 * sub-pixel measurement wobble from rewriting the font size every frame.
 */
export const TEXT_FIT_SCALE_STEP = 0.01;

export type TextFitMeasurement = {
  /** Widest painted line; `0` when the axis was not measured. */
  contentWidth: number;
  /** Full laid-out height of the text, leading included. */
  contentHeight: number;
  boxWidth: number;
  boxHeight: number;
  /**
   * One em in the same units as the measurements, at the scale that was
   * measured. `TEXT_FIT_LEADING_ALLOWANCE` of it is discounted from
   * `contentHeight`, because the registry's boxes are PowerPoint auto-sized
   * shapes that hug their glyphs while a CSS line box also carries empty
   * leading — comparing the two raw would shrink text for whitespace.
   */
  fontSizePx: number;
};

/** pptxgenjs `LAYOUT_16x9` measures 10in x 5.625in (= 720pt x 405pt). */
export const PPTX_SLIDE_WIDTH_IN = 10;
export const PPTX_SLIDE_HEIGHT_IN = 5.625;
const PPTX_SLIDE_HEIGHT_PT = 405;

/** 405pt of slide height over 540px of reference canvas height (= 0.75). */
export const PX_TO_PT = PPTX_SLIDE_HEIGHT_PT / REFERENCE_CANVAS.height;

/** Used whenever an element carries no explicit `style.fontSize`. */
export const DEFAULT_FONT_SIZE_PX = 32;
export { DEFAULT_FONT_FAMILY };
export const DEFAULT_OBJECT_FIT = 'contain' as const;
export const DEFAULT_TEXT_ALIGN = 'left' as const;
export const DEFAULT_VERTICAL_ALIGN = 'top' as const;

export type PptxGeometry = {
  /** Inches from the left edge; may be negative. */
  x: number;
  /** Inches from the top edge; may be negative. */
  y: number;
  /** Inches wide; may exceed the slide width. */
  w: number;
  /** Inches tall; may exceed the slide height. */
  h: number;
  /** Points. */
  fontSize: number;
};

export type CssGeometry = {
  left: string;
  top: string;
  width: string;
  height: string;
  /** Container-query height units, so text scales with the rendered stage. */
  fontSize: string;
};

const HEX6 = /^#?[0-9A-Fa-f]{6}$/;

/** Keep emitted numbers deterministic so assertions do not chase float dust. */
function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  const out = Math.round(value * factor) / factor;
  return Object.is(out, -0) ? 0 : out;
}

function fontSizePx(style: ResolvedStyle): number {
  const size = style.fontSize;
  return typeof size === 'number' && Number.isFinite(size)
    ? size
    : DEFAULT_FONT_SIZE_PX;
}

/** Percent of the reference canvas -> inches / points on a 16:9 PPTX slide. */
export function toPptxGeometry(element: ResolvedElement): PptxGeometry {
  return {
    x: round((element.x / 100) * PPTX_SLIDE_WIDTH_IN),
    y: round((element.y / 100) * PPTX_SLIDE_HEIGHT_IN),
    w: round((element.w / 100) * PPTX_SLIDE_WIDTH_IN),
    h: round((element.h / 100) * PPTX_SLIDE_HEIGHT_IN),
    fontSize: round(fontSizePx(element.style) * PX_TO_PT),
  };
}

/** Percent of the reference canvas -> CSS box percentages / `cqh` font size. */
export function toCssGeometry(element: ResolvedElement): CssGeometry {
  return {
    left: `${round(element.x)}%`,
    top: `${round(element.y)}%`,
    width: `${round(element.w)}%`,
    height: `${round(element.h)}%`,
    fontSize: `${round((fontSizePx(element.style) / REFERENCE_CANVAS.height) * 100)}cqh`,
  };
}

/**
 * Fit ratio for one axis. `Infinity` means "this axis cannot force a shrink"
 * (nothing measurable to fit); `0` means a degenerate box that can hold nothing
 * and therefore drops straight to the floor.
 */
function axisFitRatio(needed: number, available: number): number {
  if (!Number.isFinite(needed) || needed <= 0) return Number.POSITIVE_INFINITY;
  if (!Number.isFinite(available) || available <= 0) return 0;
  return available / needed;
}

/** Raw fit ratio -> the scale the policy allows. Never throws. */
export function quantizeTextFitScale(ratio: number): number {
  // Unmeasurable: leave the authored size alone rather than guess.
  if (!Number.isFinite(ratio)) return 1;
  if (ratio >= 1) return 1;
  // Round the quotient before flooring: `0.75 / 0.01` is 74.999… in binary
  // floating point, which would otherwise step an exact ratio down a notch.
  const steps = Math.floor(round(ratio / TEXT_FIT_SCALE_STEP, 6));
  return round(Math.max(MIN_TEXT_FIT_SCALE, steps * TEXT_FIT_SCALE_STEP));
}

/**
 * How much of the box the measured content leaves: `>= 1` fits, `Infinity` when
 * there was nothing to fit. Pure and total — an unusable measurement reads as
 * `Infinity` (draw as authored) rather than throwing.
 */
export function textFitRatio(measurement: TextFitMeasurement): number {
  const em = Number.isFinite(measurement.fontSizePx)
    ? Math.max(0, measurement.fontSizePx)
    : 0;
  const inkHeight =
    measurement.contentHeight - TEXT_FIT_LEADING_ALLOWANCE * em;

  return Math.min(
    axisFitRatio(inkHeight, measurement.boxHeight),
    axisFitRatio(measurement.contentWidth, measurement.boxWidth)
  );
}

/**
 * Measured content vs its box -> the font scale to apply, in one shot.
 *
 * Accurate whenever shrinking cannot change how the text breaks. When it can —
 * a browser re-wrapping a long line at a smaller size — this is a lower bound,
 * and `largestFittingTextScale` refines it.
 */
export function resolveTextFitScale(measurement: TextFitMeasurement): number {
  return quantizeTextFitScale(textFitRatio(measurement));
}

/**
 * Largest allowed scale at which `fits` reports the content inside its box.
 *
 * Shrinking a wrapped paragraph can pull it back onto fewer lines, so a single
 * measurement at full size over-shrinks — `welcome`'s "Welcome to" wraps in two
 * on a wide stage and reads as needing 0.4, when 0.7 puts it back on one line
 * and fills the box. `fits` is monotone (a smaller font never needs more room),
 * so a bisection over the quantized scales finds that largest value in at most
 * eight probes, and exactly one when the text already fits.
 *
 * Nothing below the floor is ever probed: that range is where the box clips.
 */
export function largestFittingTextScale(
  fits: (scale: number) => boolean
): number {
  if (fits(1)) return 1;

  const scaleAt = (step: number) => round(step * TEXT_FIT_SCALE_STEP);
  const minStep = Math.round(MIN_TEXT_FIT_SCALE / TEXT_FIT_SCALE_STEP);
  let low = minStep;
  let high = Math.round(1 / TEXT_FIT_SCALE_STEP) - 1;
  let best = minStep;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (fits(scaleAt(mid))) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return scaleAt(best);
}

/**
 * SPEC-29-01: Validates that a candidate `wrapLines` array is a lossless,
 * whole-word partition of the source `text` preserving explicit paragraph boundaries.
 *
 * Invariants:
 * - Each non-empty candidate line consists of consecutive complete whitespace-delimited tokens from one original paragraph.
 * - Concatenating candidate tokens with normalized single spaces reproduces that paragraph's normalized token sequence exactly.
 * - Candidate lines may not cross an explicit newline boundary.
 * - Empty original paragraphs remain explicit paragraph breaks; the validator does not collapse them.
 * - Rejects character fragments (e.g. ['Band', 'ung'] for 'Bandung'), reordered words, missing words, and duplicate words.
 *
 * Returns the normalized string array on success, or `null` if invalid.
 */
export function validateWrapLines(
  text: string | undefined,
  candidateLines: unknown
): string[] | null {
  if (typeof text !== 'string' || text.trim() === '') return null;
  if (!Array.isArray(candidateLines) || candidateLines.length === 0) return null;

  for (let i = 0; i < candidateLines.length; i++) {
    const line = candidateLines[i];
    if (typeof line !== 'string') return null;
    if (line.includes('\n') || line.includes('\r')) return null;
  }

  const paragraphs = text.split('\n');
  let candIdx = 0;
  const normalizedLines: string[] = [];

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx];
    const paraWords = para.trim().split(/\s+/).filter(Boolean);

    if (paraWords.length === 0) {
      if (candIdx < candidateLines.length && candidateLines[candIdx].trim() === '') {
        normalizedLines.push('');
        candIdx++;
      } else {
        return null;
      }
      continue;
    }

    let wordsCollected = 0;
    while (candIdx < candidateLines.length && wordsCollected < paraWords.length) {
      const line = candidateLines[candIdx];
      if (line.trim() === '') {
        return null;
      }
      const lineWords = line.trim().split(/\s+/).filter(Boolean);
      if (lineWords.length === 0) {
        return null;
      }

      if (wordsCollected + lineWords.length > paraWords.length) {
        return null;
      }

      for (let w = 0; w < lineWords.length; w++) {
        if (lineWords[w] !== paraWords[wordsCollected + w]) {
          return null;
        }
      }

      normalizedLines.push(lineWords.join(' '));
      wordsCollected += lineWords.length;
      candIdx++;
    }

    if (wordsCollected !== paraWords.length) {
      return null;
    }
  }

  if (candIdx !== candidateLines.length) {
    return null;
  }

  return normalizedLines;
}

export function isValidWrapLines(
  text: string | undefined,
  candidateLines: unknown
): candidateLines is string[] {
  return validateWrapLines(text, candidateLines) !== null;
}

/**
 * Resolves the effective line count for text-fit scaling.
 * SPEC-22: Prefers authoritative `wrapLines` from Canvas if present, non-empty,
 * and coherent with resolved text; otherwise counts explicit newlines in `element.text`.
 * SPEC-29-01: Validates wrapLines through validateWrapLines before accepting.
 */
export function resolveWrapLineCount(element: ResolvedElement): number {
  const text = resolveElementText(element);
  if (text === undefined) return 0;

  if (Array.isArray(element.wrapLines) && element.wrapLines.length > 0) {
    const validLines = validateWrapLines(text, element.wrapLines);
    if (validLines !== null) {
      return validLines.length;
    }
    // SPEC-23-05 / SPEC-29-01: Coherence guard rejected invalid wrapLines, log visibility
    console.warn(`[render-model] wrapLines rejected for element ${element.id}: whole-word wrap validation failed`);
  }

  // SPEC-23-02: When wrapLines is absent but longestWordPx is valid, estimate line count
  if (isMeasurementValid(element) && typeof element.longestWordPx === 'number') {
    const boxWidthPx = (element.w / 100) * REFERENCE_CANVAS.width;
    return estimateWrappedLineCount(text, boxWidthPx, element.longestWordPx);
  }

  return text.split('\n').length;
}

export type PptxTextRun = {
  text: string;
  options?: {
    softBreakBefore?: boolean;
    breakLine?: boolean;
  };
};

/**
 * SPEC-23-04: Resolves text runs for PPTX export.
 * - When `wrapLines` is present, non-empty and coherent with resolved text:
 *   Splits `text` on operator newlines into paragraphs, and within each paragraph,
 *   splits on the soft-wrapped lines from `wrapLines`. Subsequent lines within a paragraph
 *   carry `softBreakBefore: true` (<a:br/> inside one paragraph). The final line of an
 *   intermediate paragraph carries `breakLine: true` (ending the <a:p>).
 * - When `wrapLines` is absent or incoherent:
 *   Returns the plain string `text`, emitting standard <a:p> elements per operator newline.
 * SPEC-29-01: Validates wrapLines through validateWrapLines before accepting.
 */
export function resolveTextRunsForPptx(
  element: ResolvedElement
): string | PptxTextRun[] | undefined {
  if (element.type !== 'text') return undefined;
  const text = resolveElementText(element);
  if (text === undefined) return undefined;

  if (
    !Array.isArray(element.wrapLines) ||
    element.wrapLines.length === 0
  ) {
    return text;
  }

  const validLines = validateWrapLines(text, element.wrapLines);
  if (validLines === null) {
    return text;
  }

  const paragraphs = text.split('\n');
  let wrapIndex = 0;
  const runs: PptxTextRun[] = [];

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx];
    const isLastPara = pIdx === paragraphs.length - 1;
    const paraWords = para.trim().split(/\s+/).filter(Boolean);

    if (paraWords.length === 0) {
      if (wrapIndex < validLines.length && validLines[wrapIndex] === '') {
        wrapIndex++;
      }
      runs.push({
        text: '',
        options: { breakLine: !isLastPara },
      });
      continue;
    }

    const paraLines: string[] = [];
    let wordsCollected = 0;

    while (wrapIndex < validLines.length && wordsCollected < paraWords.length) {
      const candidate = validLines[wrapIndex];
      const cWords = candidate.trim().split(/\s+/).filter(Boolean).length;
      if (wordsCollected + cWords <= paraWords.length) {
        paraLines.push(candidate);
        wordsCollected += cWords;
        wrapIndex++;
      } else {
        // Words cross paragraph boundary -> malformed wrapLines, fallback to plain text
        return text;
      }
    }

    if (wordsCollected !== paraWords.length) {
      // Could not cleanly partition wrapLines to paragraph -> fallback
      return text;
    }

    for (let lIdx = 0; lIdx < paraLines.length; lIdx++) {
      const lineText = paraLines[lIdx];
      const isFirstInPara = lIdx === 0;
      const isLastInPara = lIdx === paraLines.length - 1;

      runs.push({
        text: lineText,
        options: {
          ...(isFirstInPara ? {} : { softBreakBefore: true }),
          ...(isLastInPara && !isLastPara ? { breakLine: true } : {}),
        },
      });
    }
  }

  return runs.length > 0 ? runs : text;
}

/**
 * Resolves renderable text for PPTX export.
 * SPEC-22: When `wrapLines` is present (from Canvas soft-wrapping), joins lines with '\n'
 * to enforce authoritative word wrapping in OOXML and prevent character-level splits
 * in LibreOffice Impress and PowerPoint.
 * Includes coherence guard: only uses `wrapLines` when flattened wrap text matches
 * the resolved element text, safely falling back to resolved text for dynamically
 * substituted placeholder tokens (e.g. `{sermon_title}` substituted with weekly title).
 * SPEC-29-01: Validates wrapLines through validateWrapLines before accepting.
 */
export function resolveElementTextForPptx(
  element: ResolvedElement
): string | undefined {
  if (element.type !== 'text') return undefined;
  const text = resolveElementText(element);
  if (text === undefined) return undefined;

  if (Array.isArray(element.wrapLines) && element.wrapLines.length > 0) {
    const validLines = validateWrapLines(text, element.wrapLines);
    if (validLines !== null) {
      const joined = validLines.join('\n');
      if (joined.trim()) return joined;
    }
  }
  return text;
}

/**
 * The same policy for renderers that cannot measure glyphs — PPTX generation
 * runs on the server with no layout engine.
 *
 * SPEC-22: Uses `resolveWrapLineCount` to account for authoritative soft-wrapped
 * lines from Canvas, ensuring multi-line reflowed paragraphs apply proper fit scaling.
 *
 * SPEC-23-02: Gives `estimateTextFitScale` a real `contentWidth` from `element.longestWordPx`
 * when measurements are valid, forcing down-scaling on overlong words so LibreOffice Impress
 * will not break them mid-word. Falls back to `contentWidth: 0` for unmeasured elements.
 */
export function estimateTextFitScale(element: ResolvedElement): number {
  const text = resolveElementText(element);
  if (text === undefined) return 1;

  const em = fontSizePx(element.style);
  const lines = resolveWrapLineCount(element);
  if (lines <= 0) return 1;

  const isMeasured = isMeasurementValid(element);
  const contentWidth = isMeasured && typeof element.longestWordPx === 'number'
    ? element.longestWordPx
    : 0;

  const lineHeight =
    typeof element.style?.lineHeight === 'number' && element.style.lineHeight > 0
      ? element.style.lineHeight
      : TEXT_LINE_HEIGHT;

  const contentHeight =
    lineHeight < 1.0
      ? (lines * lineHeight + (1.0 - lineHeight)) * em
      : lines * lineHeight * em;

  return resolveTextFitScale({
    contentWidth,
    contentHeight,
    boxWidth: (element.w / 100) * REFERENCE_CANVAS.width,
    boxHeight: (element.h / 100) * REFERENCE_CANVAS.height,
    fontSizePx: em,
  });
}

/** pptxgenjs wants bare `RRGGBB`; anything non-hex passes through untouched. */
export function toPptxColor(color: string | undefined): string | undefined {
  if (typeof color !== 'string' || !color) return undefined;
  if (!HEX6.test(color)) return color;
  return color.replace('#', '').toUpperCase();
}

/** CSS wants `#RRGGBB`; anything non-hex passes through untouched. */
export function toCssColor(color: string | undefined): string | undefined {
  if (typeof color !== 'string' || !color) return undefined;
  if (!HEX6.test(color)) return color;
  return `#${color.replace('#', '').toUpperCase()}`;
}

export function resolveFontFamily(style: ResolvedStyle): string {
  const family = style.fontFamily;
  return typeof family === 'string' && family.trim()
    ? family
    : DEFAULT_FONT_FAMILY;
}

export function resolveObjectFit(style: ResolvedStyle): 'contain' | 'cover' {
  return style.objectFit === 'cover' ? 'cover' : DEFAULT_OBJECT_FIT;
}

export function resolveTextAlign(
  style: ResolvedStyle
): 'left' | 'center' | 'right' {
  if (style.textAlign === 'center' || style.textAlign === 'right') {
    return style.textAlign;
  }
  return DEFAULT_TEXT_ALIGN;
}

export function resolveVerticalAlign(
  style: ResolvedStyle
): 'top' | 'middle' | 'bottom' {
  if (style.verticalAlign === 'middle' || style.verticalAlign === 'bottom') {
    return style.verticalAlign;
  }
  return DEFAULT_VERTICAL_ALIGN;
}

/**
 * SPEC-29-03: Resolves vertical alignment for PPTX generation.
 * Retains authored vertical alignment (top/middle/bottom) when estimated content fits.
 * When estimated text scale reaches MIN_TEXT_FIT_SCALE and still exceeds the box height,
 * chooses 'top' anchoring so the first visible line is whole and never clipped symmetrically.
 */
export function resolvePptxVerticalAlign(
  element: ResolvedElement
): 'top' | 'middle' | 'bottom' {
  const style = element.style;
  const authoredAlign = resolveVerticalAlign(style);
  if (element.type !== 'text') return authoredAlign;

  const text = resolveElementText(element);
  if (!text) return authoredAlign;

  const scale = estimateTextFitScale(element);
  if (scale <= MIN_TEXT_FIT_SCALE) {
    const lineCount = resolveWrapLineCount(element);
    const em = fontSizePx(style);
    const effectiveLineHeight =
      typeof style?.lineHeight === 'number' && style.lineHeight > 0
        ? style.lineHeight
        : TEXT_LINE_HEIGHT;
    const boxHeightPx = (element.h / 100) * REFERENCE_CANVAS.height;
    const requiredHeightPx = lineCount * (scale * em) * effectiveLineHeight;

    if (requiredHeightPx > boxHeightPx) {
      return 'top';
    }
  }

  return authoredAlign;
}

/** `fontWeight` is free-form in the registry: accept `bold` and 600+ numerics. */
export function resolveBold(style: ResolvedStyle): boolean {
  const weight = style.fontWeight;
  if (typeof weight !== 'string') return false;
  const normalized = weight.trim().toLowerCase();
  if (normalized === 'bold' || normalized === 'bolder') return true;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric >= 600;
}

export function resolveItalic(style: ResolvedStyle): boolean {
  const fontStyle = style.fontStyle;
  if (typeof fontStyle !== 'string') return false;
  const normalized = fontStyle.trim().toLowerCase();
  return normalized === 'italic' || normalized === 'oblique';
}

export function resolveUnderline(style: ResolvedStyle): boolean {
  const textDecoration = style.textDecoration;
  if (typeof textDecoration !== 'string') return false;
  return textDecoration.trim().toLowerCase() === 'underline';
}

/** Always 0..1; out-of-range or missing values fall back to fully opaque. */
export function resolveOpacity(style: ResolvedStyle): number {
  const opacity = style.opacity;
  if (typeof opacity !== 'number' || !Number.isFinite(opacity)) return 1;
  if (opacity < 0) return 0;
  if (opacity > 1) return 1;
  return round(opacity);
}

/** PowerPoint expresses fill opacity as transparency percent (0 = opaque). */
export function toPptxTransparency(style: ResolvedStyle): number {
  return round((1 - resolveOpacity(style)) * 100, 2);
}

/** Column-flex mapping for `verticalAlign`. */
export function toCssJustifyContent(
  style: ResolvedStyle
): 'flex-start' | 'center' | 'flex-end' {
  const vertical = resolveVerticalAlign(style);
  if (vertical === 'middle') return 'center';
  if (vertical === 'bottom') return 'flex-end';
  return 'flex-start';
}

/** Column-flex cross-axis mapping for `textAlign`. */
export function toCssAlignItems(
  style: ResolvedStyle
): 'flex-start' | 'center' | 'flex-end' {
  const horizontal = resolveTextAlign(style);
  if (horizontal === 'center') return 'center';
  if (horizontal === 'right') return 'flex-end';
  return 'flex-start';
}

/** Renderable text, or `undefined` when the element draws nothing. */
export function resolveElementText(
  element: ResolvedElement
): string | undefined {
  if (element.type !== 'text') return undefined;
  const text = element.text;
  if (typeof text !== 'string' || !text.trim()) return undefined;
  return text;
}

/** Renderable image reference, or `undefined` for an unfilled placeholder. */
export function resolveElementImage(
  element: ResolvedElement
): string | undefined {
  if (element.type !== 'image' && element.type !== 'image-placeholder') {
    return undefined;
  }
  const url = element.imageUrl;
  if (typeof url !== 'string' || !url.trim()) return undefined;
  return url;
}
