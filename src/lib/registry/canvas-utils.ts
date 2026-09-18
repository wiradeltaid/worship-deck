import type {
  ArtifactLayout,
  CanvasElement,
} from '@/lib/registry/types';
import { DEFAULT_FONT_FAMILY, getFontStack, resolveCatalogFontFamily } from '@/lib/registry/font-catalog';
import {
  TEXT_LINE_HEIGHT,
  applyWrapSlack,
  isMeasurementValid,
  largestFittingTextScale,
  textFitRatio,
  MIN_TEXT_FIT_SCALE,
  validateWrapLines,
  isValidWrapLines,
} from '@/lib/artifacts/render-model';

export { TEXT_LINE_HEIGHT, validateWrapLines, isValidWrapLines };

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;

export const USER_ELEMENT_PREFIX = 'usr-';

export const NEW_TEXT_CONTENT = 'New text';
export const NEW_SHAPE_FILL = '#5C2E16';
export const NEW_TEXT_SIZE_PX = { w: 400, h: 80 };
export const NEW_SHAPE_SIZE_PX = { w: 300, h: 180 };
export const INSERT_CASCADE_PX = 18;
export const INSERT_CASCADE_STEPS = 8;

export const DEFAULT_FONT_COLOR = '#FFFFFF';
export { DEFAULT_FONT_FAMILY };
export const DEFAULT_TEXT_ALIGN = 'left' as const;
export const DEFAULT_FONT_SIZE = 32;
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 200;

export function pctToPx(value: number, total: number) {
  return (value / 100) * total;
}

export function pxToPct(value: number, total: number) {
  return (value / total) * 100;
}

export const MIN_ELEMENT_W_PCT = pxToPct(1, CANVAS_WIDTH);
export const MIN_ELEMENT_H_PCT = pxToPct(1, CANVAS_HEIGHT);

export function toStrictHexColor(fill: unknown, fallback?: string): string | undefined {
  if (typeof fill !== 'string' || !fill.trim()) return fallback;

  const hexMatch = fill.match(/^#([0-9A-Fa-f]{6})$/);
  if (hexMatch) return `#${hexMatch[1].toUpperCase()}`;

  const rgbMatch = fill.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/
  );
  if (rgbMatch) {
    const channels = [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map(Number);
    if (channels.every((n) => n >= 0 && n <= 255)) {
      return `#${channels
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()}`;
    }
  }

  return fallback;
}

export function clampFontSize(value: number) {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value));
}

export function parseFontSizeDraft(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function commitFontSizeFromDraft(
  raw: string,
  committedFontSize: number
): { fontSize: number; inputValue: string } {
  const parsed = parseFontSizeDraft(raw);
  if (parsed === null) {
    return { fontSize: committedFontSize, inputValue: String(committedFontSize) };
  }
  const clamped = clampFontSize(parsed);
  return { fontSize: clamped, inputValue: String(clamped) };
}

export function normalizeFontSize(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_FONT_SIZE;
}

export function isUserAuthoredId(elementId: string) {
  return elementId.startsWith(USER_ELEMENT_PREFIX);
}

export function isBackgroundElement(el: CanvasElement): boolean {
  return (
    el.type === 'image' &&
    el.zIndex === 0 &&
    el.x === 0 &&
    el.w === 100
  );
}

export function filterOutBackgroundElements(elements: CanvasElement[]): CanvasElement[] {
  return elements.filter((el) => !isBackgroundElement(el));
}

export function nextElementId(usedIds: Set<string>, counter: number) {
  let candidate = `${USER_ELEMENT_PREFIX}${Date.now().toString(36)}-${counter.toString(36)}`;
  let salt = 0;
  while (usedIds.has(candidate)) {
    salt += 1;
    candidate = `${USER_ELEMENT_PREFIX}${Date.now().toString(36)}-${counter.toString(36)}-${salt}`;
  }
  return candidate;
}

export function getElementId(obj: { get?: (key: string) => unknown; data?: { elementId?: string } }): string | undefined {
  if (typeof obj.get === 'function') {
    return (obj.get('data') as { elementId?: string } | undefined)?.elementId;
  }
  return obj.data?.elementId;
}

/**
 * Calculates uniform contain or cover scaling and centering offsets for an image
 * inside a container box so the image's native aspect ratio is strictly preserved.
 */
export function calculateImageFit(
  box: { left: number; top: number; width: number; height: number },
  natural: { width: number; height: number },
  objectFit: 'contain' | 'cover' | 'fill' = 'contain'
): {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  left: number;
  top: number;
} {
  const natW = natural.width || box.width || 1;
  const natH = natural.height || box.height || 1;

  if (objectFit === 'fill') {
    return {
      width: natW,
      height: natH,
      scaleX: box.width / natW,
      scaleY: box.height / natH,
      left: box.left,
      top: box.top,
    };
  }

  const scale =
    objectFit === 'cover'
      ? Math.max(box.width / natW, box.height / natH)
      : Math.min(box.width / natW, box.height / natH);

  return {
    width: natW,
    height: natH,
    scaleX: scale,
    scaleY: scale,
    left: box.left + (box.width - natW * scale) / 2,
    top: box.top + (box.height - natH * scale) / 2,
  };
}

export function buildTextFabricOptions(
  element: CanvasElement,
  options?: { editable?: boolean; fabric?: any }
) {
  const left = pctToPx(element.x, CANVAS_WIDTH);
  const top = pctToPx(element.y, CANVAS_HEIGHT);
  const width = pctToPx(element.w, CANVAS_WIDTH);
  const height = pctToPx(element.h, CANVAS_HEIGHT);
  const editable = options?.editable ?? false;
  const common = {
    left,
    top,
    width,
    height,
    angle: typeof element.rotation === 'number' ? element.rotation : 0,
    selectable: editable,
    evented: editable,
    hasControls: editable,
    lockRotation: false,
    data: { elementId: element.id, authoredWidth: width, authoredHeight: height },
  };

  const style = element.style;
  const fabricModule = options?.fabric;

  let shadow: any;
  if (style?.textShadow) {
    const shadowOpts = {
      color: 'rgba(0,0,0,0.8)',
      blur: typeof style.textShadowBlur === 'number' ? style.textShadowBlur : 4,
      offsetX: 2,
      offsetY: 2,
    };
    shadow =
      typeof fabricModule?.Shadow === 'function'
        ? new fabricModule.Shadow(shadowOpts)
        : shadowOpts;
  }

  return {
    ...common,
    fill: style?.fontColor ?? DEFAULT_FONT_COLOR,
    fontSize: normalizeFontSize(style?.fontSize),
    fontFamily: getFontStack(style?.fontFamily),
    lineHeight: style?.lineHeight ?? TEXT_LINE_HEIGHT,
    // Fabric v6 assigns an explicit `undefined` straight over its own class
    // default and then dies in `Cache.getFontCache` (`fontStyle.toLowerCase`
    // of undefined), so an unset key must be omitted, not passed as
    // undefined. Every shipped text element omits fontStyle.
    ...(style?.fontWeight !== undefined ? { fontWeight: style.fontWeight } : {}),
    ...(style?.fontStyle !== undefined ? { fontStyle: style.fontStyle } : {}),
    ...(style?.textDecoration === 'underline' ? { underline: true } : {}),
    ...(typeof style?.letterSpacing === 'number' && Number.isFinite(style.letterSpacing)
      ? { charSpacing: (style.letterSpacing / normalizeFontSize(style?.fontSize)) * 1000 }
      : {}),
    ...(shadow ? { shadow } : {}),
    textAlign: style?.textAlign ?? DEFAULT_TEXT_ALIGN,
    splitByGrapheme: false,
    editable,
  };
}

export function buildShapeFabricOptions(
  element: CanvasElement,
  options?: { editable?: boolean }
) {
  const left = pctToPx(element.x, CANVAS_WIDTH);
  const top = pctToPx(element.y, CANVAS_HEIGHT);
  const width = pctToPx(element.w, CANVAS_WIDTH);
  const height = pctToPx(element.h, CANVAS_HEIGHT);
  const editable = options?.editable ?? false;
  const common = {
    left,
    top,
    width,
    height,
    angle: typeof element.rotation === 'number' ? element.rotation : 0,
    selectable: editable,
    evented: editable,
    hasControls: editable,
    lockRotation: false,
    data: {
      elementId: element.id,
      authoredWidth: width,
      authoredHeight: height,
      style: { ...element.style },
    },
  };

  const isUnfilled =
    element.style?.fillColor === 'transparent' ||
    (!element.style?.fillColor && Boolean(element.style?.strokeColor));
  const strokeColor = element.style?.strokeColor || (isUnfilled ? '#FFFFFF' : undefined);
  const strokeWidth =
    typeof element.style?.strokeWidth === 'number'
      ? element.style.strokeWidth
      : isUnfilled
        ? 2
        : 0;
  const fillColor = element.style?.fillColor ?? (isUnfilled ? 'transparent' : '#5C2E16');

  return {
    ...common,
    fill: fillColor,
    stroke: strokeColor,
    strokeWidth,
    opacity: element.style?.opacity ?? 1,
    perPixelTargetFind: false,
  };
}

export function applyFabricTextFit(
  tb: any,
  element: CanvasElement,
  fabric: any
): void {
  const text = element.content ?? '';
  const baseFontSize = normalizeFontSize(element.style?.fontSize);
  const baseLetterSpacing =
    typeof element.style?.letterSpacing === 'number' &&
    Number.isFinite(element.style.letterSpacing)
      ? element.style.letterSpacing
      : 0;
  const boxWidth = pctToPx(element.w, CANVAS_WIDTH);
  const boxHeight = pctToPx(element.h, CANVAS_HEIGHT);
  const roundedBoxW = Math.round(boxWidth);
  const roundedBoxH = Math.round(boxHeight);

  let bestScale = 1;
  if (text.trim().length > 0) {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function' && document.body) {
      const outer = document.createElement('div');
      outer.style.cssText = `position:fixed; left:-9999px; top:-9999px; width:${roundedBoxW}px; height:${roundedBoxH}px; display:flex; flex-direction:column; overflow:hidden;`;
      const inner = document.createElement('div');
      inner.style.cssText = 'width:100%; white-space:pre-wrap;';
      inner.style.fontFamily = getFontStack(element.style?.fontFamily);
      inner.style.lineHeight = String(typeof element.style?.lineHeight === 'number' ? element.style.lineHeight : TEXT_LINE_HEIGHT);
      inner.style.fontWeight = element.style?.fontWeight ? String(element.style.fontWeight) : 'normal';
      inner.style.fontStyle = element.style?.fontStyle ?? 'normal';
      if (baseLetterSpacing !== 0) {
        inner.style.letterSpacing = `${baseLetterSpacing}px`;
      }
      inner.textContent = text;
      outer.appendChild(inner);
      document.body.appendChild(outer);

      const fitsAt = (scale: number): boolean => {
        inner.style.fontSize = `${baseFontSize * scale}px`;
        if (baseLetterSpacing !== 0) {
          inner.style.letterSpacing = `${baseLetterSpacing * scale}px`;
        }
        return (
          textFitRatio({
            contentWidth: inner.scrollWidth,
            contentHeight: inner.scrollHeight,
            boxWidth: outer.clientWidth,
            boxHeight: outer.clientHeight,
            fontSizePx: baseFontSize * scale,
          }) >= 1
        );
      };

      bestScale = largestFittingTextScale(fitsAt);
      outer.remove();
    } else if (typeof tb?.initDimensions === 'function') {
      const fitsAt = (scale: number): boolean => {
        tb.fontSize = baseFontSize * scale;
        tb.set('width', boxWidth);
        tb.initDimensions();

        if (tb.dynamicMinWidth > boxWidth) {
          return false;
        }

        const contentHeight = tb.calcTextHeight();
        let contentWidth = 0;
        if (tb.textLines) {
          for (let i = 0; i < tb.textLines.length; i++) {
            const lw = tb.getLineWidth(i);
            if (lw > contentWidth) contentWidth = lw;
          }
        }
        if (tb.dynamicMinWidth > contentWidth) {
          contentWidth = tb.dynamicMinWidth;
        }

        return (
          textFitRatio({
            contentWidth,
            contentHeight,
            boxWidth,
            boxHeight,
            fontSizePx: baseFontSize * scale,
          }) >= 1
        );
      };

      bestScale = largestFittingTextScale(fitsAt);
    }
  }

  tb.fontSize = baseFontSize * bestScale;
  tb.set('width', boxWidth);
  if (typeof tb.initDimensions === 'function') {
    tb.initDimensions();
  }
  // Enforce authored box bounds: dynamicMinWidth must not widen box width past authored
  tb.set('width', boxWidth);
  tb.set('height', boxHeight);

  if (tb.data) {
    tb.data.fitScale = bestScale;
    tb.data.authoredWidth = boxWidth;
    tb.data.authoredHeight = boxHeight;
  }

  // Clip text overflow outside authored box
  if (typeof fabric?.Rect === 'function') {
    tb.clipPath = new fabric.Rect({
      left: tb.left,
      top: tb.top,
      width: boxWidth,
      height: boxHeight,
      absolutePositioned: true,
    });
  }

  if (typeof tb.setCoords === 'function') {
    tb.setCoords();
  }
}

export function syncTextClipOnMove(target: any): boolean {
  if (!target || !target.clipPath) return false;
  const clip = target.clipPath;
  clip.set({
    left: target.left ?? 0,
    top: target.top ?? 0,
  });
  if (typeof clip.setCoords === 'function') {
    clip.setCoords();
  }
  return true;
}

export function syncTextClipOnScale(target: any): boolean {
  if (!target || !target.clipPath) return false;
  const clip = target.clipPath;
  const authoredW =
    typeof target.data?.authoredWidth === 'number' && target.data.authoredWidth > 0
      ? target.data.authoredWidth
      : target.width ?? 0;
  const authoredH =
    typeof target.data?.authoredHeight === 'number' && target.data.authoredHeight > 0
      ? target.data.authoredHeight
      : target.height ?? 0;
  const w = authoredW * (target.scaleX ?? 1);
  const h = authoredH * (target.scaleY ?? 1);
  clip.set({
    left: target.left ?? 0,
    top: target.top ?? 0,
    width: w,
    height: h,
  });
  if (typeof clip.setCoords === 'function') {
    clip.setCoords();
  }
  return true;
}

export function elementToFabricObject(
  fabric: any,
  element: CanvasElement,
  editable: boolean = false,
  options?: { isHealing?: boolean; transparentProxy?: boolean }
): any {
  const left = pctToPx(element.x, CANVAS_WIDTH);
  const top = pctToPx(element.y, CANVAS_HEIGHT);
  const width = pctToPx(element.w, CANVAS_WIDTH);
  const height = pctToPx(element.h, CANVAS_HEIGHT);
  const isProxy = Boolean(options?.transparentProxy);
  const common = {
    left,
    top,
    width,
    height,
    angle: typeof element.rotation === 'number' ? element.rotation : 0,
    selectable: editable,
    evented: editable,
    hasControls: editable,
    lockRotation: false,
    data: { elementId: element.id, authoredWidth: width, authoredHeight: height },
    ...(isProxy
      ? {
          cornerColor: '#2563EB',
          borderColor: '#2563EB',
          cornerSize: 8,
          transparentCorners: false,
        }
      : {}),
  };

  if (element.type === 'text') {
    if (typeof fabric?.Textbox === 'function') {
      try {
        const textOpts: any = buildTextFabricOptions(element, { editable, fabric });
        if (isProxy) {
          textOpts.fill = 'transparent';
          textOpts.stroke = 'transparent';
          textOpts.shadow = null;
          textOpts.strokeWidth = 0;
          textOpts.cornerColor = '#2563EB';
          textOpts.borderColor = '#2563EB';
          textOpts.cornerSize = 8;
          textOpts.transparentCorners = false;
        }
        const tb = new fabric.Textbox(element.content ?? '', textOpts);
        const authoredH = typeof element.h === 'number' && element.h > 0 ? pctToPx(element.h, CANVAS_HEIGHT) : height;
        const origCalcTextHeight = typeof tb.calcTextHeight === 'function' ? tb.calcTextHeight.bind(tb) : null;
        if (origCalcTextHeight) {
          tb.calcTextHeight = function() {
            const naturalH = origCalcTextHeight();
            const targetAuthoredH = typeof (this as any).data?.authoredHeight === 'number' && (this as any).data.authoredHeight > 0
              ? (this as any).data.authoredHeight
              : authoredH;
            return Math.max(naturalH, targetAuthoredH);
          };
        }
        if (typeof tb.setControlsVisibility === 'function') {
          tb.setControlsVisibility({
            tl: true,
            tr: true,
            bl: true,
            br: true,
            ml: true,
            mr: true,
            mt: true,
            mb: true,
            mtr: true,
          });
        }
        tb.set({
          width,
          height: authoredH,
        });
        if (typeof tb.initDimensions === 'function') {
          tb.initDimensions();
        }
        if (isProxy) {
          tb.set({
            fill: 'transparent',
            stroke: 'transparent',
            shadow: null,
            strokeWidth: 0,
          });
          tb.data = {
            ...(tb.data || {}),
            isTransparentProxy: true,
            elementId: element.id,
            authoredWidth: width,
            authoredHeight: authoredH,
            style: { ...element.style },
          };
        } else {
          applyFabricTextFit(tb, element, fabric);
        }
        return tb;
      } catch {
        // Fallback for headless test environments where 2D rendering context is missing (Node jsdom)
      }
    }
    // Fallback object for headless test mocks
    const text = element.content ?? '';
    const words = text.split(/\s+/).filter(Boolean);
    let longestWord = '';
    for (const w of words) {
      if (w.length > longestWord.length) longestWord = w;
    }
    const em = normalizeFontSize(element.style?.fontSize);
    const longestWordPx = longestWord.length * em * 0.55;
    const fallbackData = {
      ...common,
      type: 'text',
      text,
      fontSize: em,
      fontFamily: element.style?.fontFamily ?? DEFAULT_FONT_FAMILY,
      fontWeight: element.style?.fontWeight ?? 'normal',
      fontStyle: element.style?.fontStyle ?? 'normal',
      dynamicMinWidth: longestWordPx,
      textLines: words.length > 0 ? [text] : [],
      fill: isProxy ? 'transparent' : (element.style?.fontColor ?? DEFAULT_FONT_COLOR),
      stroke: isProxy ? 'transparent' : undefined,
      textAlign: element.style?.textAlign ?? DEFAULT_TEXT_ALIGN,
      lineHeight: element.style?.lineHeight ?? TEXT_LINE_HEIGHT,
      underline: element.style?.textDecoration === 'underline',
      shadow: isProxy
        ? null
        : element.style?.textShadow
          ? { blur: typeof element.style.textShadowBlur === 'number' ? element.style.textShadowBlur : 4 }
          : undefined,
      data: {
        ...common.data,
        isTransparentProxy: isProxy,
        elementId: element.id,
        authoredWidth: width,
        authoredHeight: height,
        style: { ...element.style },
      },
    };

    if (typeof fabric?.Rect === 'function') {
      const standIn = new fabric.Rect(fallbackData);
      Object.defineProperty(standIn, 'type', { value: 'text', writable: true, configurable: true });
      Object.assign(standIn, fallbackData);
      return standIn;
    }

    return fallbackData;
  }

  if (element.type === 'line') {
    const strokeColor = element.style?.strokeColor || '#FFFFFF';
    const strokeWidth = typeof element.style?.strokeWidth === 'number' ? element.style.strokeWidth : 2;
    const lineCoords = [0, 0, width, Math.max(0, height)];
    const lineOpts: any = {
      ...common,
      stroke: strokeColor,
      strokeWidth,
      perPixelTargetFind: false,
      padding: 6,
      lockUniScaling: false,
      data: {
        ...common.data,
        isLine: true,
        style: { ...element.style },
      },
    };
    if (typeof fabric?.Line === 'function') {
      return new fabric.Line(lineCoords, lineOpts);
    }
    return {
      ...common,
      type: 'line',
      stroke: strokeColor,
      strokeWidth,
      perPixelTargetFind: false,
      data: lineOpts.data,
    };
  }

  if (element.type === 'shape') {
    const isUnfilled =
      element.style?.fillColor === 'transparent' ||
      (!element.style?.fillColor && Boolean(element.style?.strokeColor));
    const strokeColor = element.style?.strokeColor || (isUnfilled ? '#FFFFFF' : undefined);
    const strokeWidth =
      typeof element.style?.strokeWidth === 'number'
        ? element.style.strokeWidth
        : isUnfilled
          ? 2
          : 0;
    const fillColor = element.style?.fillColor ?? (isUnfilled ? 'transparent' : '#5C2E16');

    if (typeof fabric?.Rect === 'function') {
      const shapeOpts: any = buildShapeFabricOptions(element, { editable });
      if (isProxy) {
        shapeOpts.fill = 'transparent';
        shapeOpts.stroke = strokeColor ?? 'transparent';
        shapeOpts.strokeWidth = strokeWidth;
        shapeOpts.cornerColor = '#2563EB';
        shapeOpts.borderColor = '#2563EB';
        shapeOpts.cornerSize = 8;
        shapeOpts.transparentCorners = false;
        shapeOpts.perPixelTargetFind = false;
        shapeOpts.data = {
          ...(shapeOpts.data || {}),
          isTransparentProxy: true,
          elementId: element.id,
          authoredWidth: width,
          authoredHeight: height,
          style: { ...element.style },
        };
      }
      const rect = new fabric.Rect(shapeOpts);
      rect.data = shapeOpts.data;
      return rect;
    }
    return {
      ...common,
      type: 'shape',
      fill: isProxy ? 'transparent' : fillColor,
      stroke: strokeColor,
      strokeWidth,
      opacity: isProxy ? 0 : (element.style?.opacity ?? 1),
      perPixelTargetFind: false,
      data: {
        ...common.data,
        isTransparentProxy: isProxy,
        style: { ...element.style },
      },
    };
  }

  const isHealing = options?.isHealing ?? false;

  if (isProxy && typeof fabric?.Rect === 'function') {
    const isImage = element.type === 'image' || element.type === 'image-placeholder';
    return new fabric.Rect({
      ...common,
      fill: 'transparent',
      stroke: 'transparent',
      cornerColor: '#2563EB',
      borderColor: '#2563EB',
      cornerSize: 8,
      transparentCorners: false,
      data: {
        ...common.data,
        isTransparentProxy: true,
        imageRef: element.imageRef,
        placeholderKey: element.placeholderKey,
        isImage,
        objectFit: element.style?.objectFit,
        style: { ...element.style },
      },
    });
  }

  if (element.type === 'image' && element.imageRef) {
    if (!isHealing && typeof Image !== 'undefined' && typeof fabric?.FabricImage === 'function') {
      const imgEl = new Image();
      imgEl.crossOrigin = 'anonymous';
      imgEl.src = element.imageRef;

      const calcFit = () =>
        calculateImageFit(
          { left, top, width, height },
          { width: imgEl.naturalWidth, height: imgEl.naturalHeight },
          element.style?.objectFit
        );

      const initial = calcFit();
      const clipBox =
        typeof fabric?.Rect === 'function'
          ? new fabric.Rect({
              left,
              top,
              width,
              height,
              absolutePositioned: true,
            })
          : undefined;

      const fabricImg = new fabric.FabricImage(imgEl, {
        ...common,
        width: initial.width,
        height: initial.height,
        left: initial.left,
        top: initial.top,
        scaleX: initial.scaleX,
        scaleY: initial.scaleY,
        clipPath: clipBox,
        data: {
          elementId: element.id,
          imageRef: element.imageRef,
          objectFit: element.style?.objectFit,
          clipOffset: { x: left - initial.left, y: top - initial.top },
          clipDimensions: { width, height },
          baseScaleX: initial.scaleX,
          baseScaleY: initial.scaleY,
        },
      });
      imgEl.onload = () => {
        const updated = calcFit();
        if ((fabricImg as any).data) {
          (fabricImg as any).data.clipOffset = { x: left - updated.left, y: top - updated.top };
          (fabricImg as any).data.clipDimensions = { width, height };
          (fabricImg as any).data.baseScaleX = updated.scaleX;
          (fabricImg as any).data.baseScaleY = updated.scaleY;
        }
        fabricImg.set({
          width: updated.width,
          height: updated.height,
          left: updated.left,
          top: updated.top,
          scaleX: updated.scaleX,
          scaleY: updated.scaleY,
          clipPath: clipBox,
        });
        fabricImg.canvas?.requestRenderAll();
      };
      imgEl.onerror = () => {
        // Missing asset fallback: render safe outline box instead of crashing
        if ((fabricImg as any).data) {
          (fabricImg as any).data.imageMissing = true;
        }
        fabricImg.set({
          opacity: 0.4,
        });
        fabricImg.canvas?.requestRenderAll();
      };
      return fabricImg;
    }

    if (typeof fabric?.Rect === 'function') {
      return new fabric.Rect({
        ...common,
        fill: '#333333',
        stroke: '#888888',
        strokeWidth: 1,
        data: { elementId: element.id, imageRef: element.imageRef },
      });
    }

    return {
      ...common,
      type: 'image',
      data: { elementId: element.id, imageRef: element.imageRef },
    };
  }

  if (typeof fabric?.Rect === 'function') {
    return new fabric.Rect({
      ...common,
      fill: 'rgba(255,255,255,0.08)',
      stroke: '#cccccc',
      strokeDashArray: [6, 4],
      data: { elementId: element.id, placeholderKey: element.placeholderKey },
    });
  }

  return {
    ...common,
    type: element.type,
    data: { elementId: element.id, placeholderKey: element.placeholderKey },
  };
}

export type FabricTextLike = {
  type: string;
  text?: string;
  fill?: unknown;
  fontSize?: unknown;
  fontFamily?: string;
  fontWeight?: unknown;
  fontStyle?: string;
  underline?: unknown;
  textAlign?: string;
  lineHeight?: unknown;
  data?: any;
};

export function isFabricTextObject(
  obj: unknown
): obj is import('fabric').FabricObject & FabricTextLike {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    ((obj as { type: unknown }).type === 'text' ||
      (obj as { type: unknown }).type === 'textbox')
  );
}

/**
 * SPEC-28-03: Computes the intrinsic minimum single-line height for a text element
 * in reference-canvas pixels: Math.max(fontSizePx, fontSizePx * lineHeight).
 */
export function computeMinTextHeightRefPx(
  fontSizePx: number,
  lineHeight: number = TEXT_LINE_HEIGHT
): number {
  const normFontSize = normalizeFontSize(fontSizePx);
  const effLineHeight = typeof lineHeight === 'number' && lineHeight > 0 ? lineHeight : TEXT_LINE_HEIGHT;
  return Number(Math.max(normFontSize, normFontSize * effLineHeight).toFixed(2));
}

/**
 * SPEC-28-03: Measures scale-1 content height in reference-canvas pixels.
 * Uses 2D canvas font measurement when available (browser), falling back to character-advance estimation (headless).
 * Expands to at least the single-line minimum height.
 */
export function measureScale1ContentHeightPx(
  text: string,
  boxWidthPx: number,
  fontSizePx: number,
  lineHeight: number = TEXT_LINE_HEIGHT,
  fontFamily: string = DEFAULT_FONT_FAMILY,
  fontWeight: string = 'normal',
  fontStyle: string = 'normal'
): number {
  const normFontSize = normalizeFontSize(fontSizePx);
  const effLineHeight = typeof lineHeight === 'number' && lineHeight > 0 ? lineHeight : TEXT_LINE_HEIGHT;
  const minSingleLine = computeMinTextHeightRefPx(normFontSize, effLineHeight);
  if (!text || typeof text !== 'string') return minSingleLine;

  const paragraphs = text.split('\n');
  let totalLines = 0;
  const safeBoxWidth = Math.max(20, boxWidthPx);

  // When 2D canvas context is available (browser), measure text lines accurately
  let ctx: CanvasRenderingContext2D | null = null;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
      if (ctx) {
        const stack = getFontStack(fontFamily);
        ctx.font = `${fontStyle} ${fontWeight} ${normFontSize}px ${stack}`;
      }
    } catch {}
  }

  for (const para of paragraphs) {
    if (!para.trim()) {
      totalLines += 1;
      continue;
    }

    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      totalLines += 1;
      continue;
    }

    if (ctx) {
      let currentLineWidth = 0;
      let paraLines = 1;
      const spaceWidth = ctx.measureText(' ').width;
      for (const word of words) {
        const wordWidth = ctx.measureText(word).width;
        if (currentLineWidth === 0) {
          currentLineWidth = wordWidth;
        } else if (currentLineWidth + spaceWidth + wordWidth <= safeBoxWidth) {
          currentLineWidth += spaceWidth + wordWidth;
        } else {
          paraLines += 1;
          currentLineWidth = wordWidth;
        }
      }
      totalLines += paraLines;
    } else {
      // Deterministic fallback for headless / jsdom
      const charAdvance = normFontSize * 0.55;
      const estimatedCharsPerLine = Math.max(1, Math.floor(safeBoxWidth / charAdvance));
      let currentLineChars = 0;
      let paraLines = 1;
      for (const word of words) {
        const wordLen = word.length;
        if (currentLineChars === 0) {
          currentLineChars = wordLen;
        } else if (currentLineChars + 1 + wordLen <= estimatedCharsPerLine) {
          currentLineChars += 1 + wordLen;
        } else {
          paraLines += 1;
          currentLineChars = wordLen;
        }
      }
      totalLines += paraLines;
    }
  }

  const measuredHeight = Number((totalLines * normFontSize * effLineHeight).toFixed(2));
  return Math.max(minSingleLine, measuredHeight);
}

export interface ComputeAutoExpandedHeightParams {
  textContent: string;
  authoredWidthPx: number;
  authoredHeightPx: number;
  fontSizePx: number;
  lineHeight?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  topPx: number;
  canvasHeight?: number;
}

/**
 * SPEC-29-02: Shared pure helper to compute auto-expanded text box height.
 * Accurately measures scale-1 wrapped text height against authored width and
 * bounds the expansion strictly within remaining canvas height (CANVAS_HEIGHT - topPx).
 */
export function computeAutoExpandedHeight(params: ComputeAutoExpandedHeightParams): {
  requiredHeight: number;
  boundedRequiredHeight: number;
  shouldExpand: boolean;
} {
  const {
    textContent,
    authoredWidthPx,
    authoredHeightPx,
    fontSizePx,
    lineHeight = TEXT_LINE_HEIGHT,
    fontFamily = DEFAULT_FONT_FAMILY,
    fontWeight = 'normal',
    fontStyle = 'normal',
    topPx,
    canvasHeight = CANVAS_HEIGHT,
  } = params;

  const normFontSize = normalizeFontSize(fontSizePx);
  const effLineHeight = typeof lineHeight === 'number' && lineHeight > 0 ? lineHeight : TEXT_LINE_HEIGHT;
  const minSingleLine = computeMinTextHeightRefPx(normFontSize, effLineHeight);
  const measuredReqH = measureScale1ContentHeightPx(
    textContent,
    authoredWidthPx,
    normFontSize,
    effLineHeight,
    fontFamily,
    fontWeight,
    fontStyle
  );
  const requiredHeight = Math.max(minSingleLine, measuredReqH);
  const remainingCanvasH = Math.max(0, canvasHeight - Math.max(0, topPx));
  const boundedRequiredHeight = Math.min(requiredHeight, remainingCanvasH);
  const shouldExpand = boundedRequiredHeight > authoredHeightPx;

  return {
    requiredHeight,
    boundedRequiredHeight,
    shouldExpand,
  };
}

export function serializeTextStyle(
  source: CanvasElement,
  textObj: {
    fill?: unknown;
    fontSize?: unknown;
    fontFamily?: string;
    fontWeight?: unknown;
    fontStyle?: string;
    underline?: unknown;
    textAlign?: string;
    lineHeight?: unknown;
    shadow?: unknown;
    data?: any;
  }
): CanvasElement['style'] | undefined {
  const isProxy =
    (textObj as any).data?.isTransparentProxy === true ||
    textObj.fill === 'transparent';
  const proxyStyle = ((textObj as any).data?.style as CanvasElement['style']) || {};
  const style: NonNullable<CanvasElement['style']> = { ...source.style, ...proxyStyle };

  const setIfMeaningful = <K extends keyof NonNullable<CanvasElement['style']>>(
    key: K,
    current: NonNullable<CanvasElement['style']>[K] | undefined,
    constructionDefault: NonNullable<CanvasElement['style']>[K]
  ) => {
    if (current === undefined) return;
    if (source.style?.[key] === undefined && current === constructionDefault) return;
    style[key] = current;
  };

  if (!isProxy) {
    setIfMeaningful(
      'fontColor',
      toStrictHexColor(textObj.fill, source.style?.fontColor),
      DEFAULT_FONT_COLOR
    );
  } else if (proxyStyle.fontColor) {
    setIfMeaningful('fontColor', proxyStyle.fontColor, DEFAULT_FONT_COLOR);
  } else if (source.style?.fontColor) {
    setIfMeaningful('fontColor', source.style.fontColor, DEFAULT_FONT_COLOR);
  }

  setIfMeaningful(
    'fontSize',
    typeof textObj.fontSize === 'number' ? textObj.fontSize : undefined,
    DEFAULT_FONT_SIZE
  );
  setIfMeaningful(
    'fontFamily',
    typeof textObj.fontFamily === 'string'
      ? resolveCatalogFontFamily(textObj.fontFamily)
      : undefined,
    DEFAULT_FONT_FAMILY
  );
  setIfMeaningful(
    'fontWeight',
    textObj.fontWeight === undefined ? undefined : String(textObj.fontWeight),
    'normal'
  );
  setIfMeaningful('fontStyle', textObj.fontStyle, 'normal');
  if (textObj.underline !== undefined) {
    if (Boolean(textObj.underline)) {
      style.textDecoration = 'underline';
    } else if (source.style?.textDecoration === 'underline') {
      delete style.textDecoration;
    }
  }
  if (typeof textObj.lineHeight === 'number') {
    setIfMeaningful('lineHeight', Number(textObj.lineHeight.toFixed(2)), TEXT_LINE_HEIGHT);
  }
  if (!isProxy) {
    if (textObj.shadow) {
      style.textShadow = true;
      const blur = (textObj.shadow as { blur?: unknown })?.blur;
      const numBlur = typeof blur === 'number' && Number.isFinite(blur) ? blur : Number(blur);
      style.textShadowBlur = Number.isFinite(numBlur)
        ? Math.max(0, Math.min(20, Math.round(numBlur)))
        : 4;
    } else {
      if (source.style?.textShadow || style.textShadow) {
        delete style.textShadow;
      }
      if (source.style?.textShadowBlur !== undefined || style.textShadowBlur !== undefined) {
        delete style.textShadowBlur;
      }
    }
  } else {
    if (proxyStyle.textShadow !== undefined) {
      if (proxyStyle.textShadow) {
        style.textShadow = true;
        style.textShadowBlur = proxyStyle.textShadowBlur ?? 4;
      } else {
        delete style.textShadow;
        delete style.textShadowBlur;
      }
    }
  }
  setIfMeaningful(
    'textAlign',
    textObj.textAlign === 'left' ||
      textObj.textAlign === 'center' ||
      textObj.textAlign === 'right'
      ? (textObj.textAlign as 'left' | 'center' | 'right')
      : undefined,
    DEFAULT_TEXT_ALIGN
  );

  // SPEC-32-03: letterSpacing preservation
  if (typeof (textObj as any).charSpacing === 'number' && Number.isFinite((textObj as any).charSpacing)) {
    const fs = typeof textObj.fontSize === 'number' ? textObj.fontSize : DEFAULT_FONT_SIZE;
    style.letterSpacing = Number((((textObj as any).charSpacing / 1000) * fs).toFixed(4));
  } else if (typeof proxyStyle.letterSpacing === 'number') {
    style.letterSpacing = proxyStyle.letterSpacing;
  } else if (typeof source.style?.letterSpacing === 'number') {
    style.letterSpacing = source.style.letterSpacing;
  }

  // SPEC-32-03: Invalidate pptxTypeface when font family, weight, or style is edited
  const prevFamily = source.style?.fontFamily;
  const prevWeight = source.style?.fontWeight;
  const prevStyle = source.style?.fontStyle;
  const currentFamily = style.fontFamily;
  const currentWeight = style.fontWeight;
  const currentStyle = style.fontStyle;

  const typographyChanged =
    (currentFamily !== undefined && prevFamily !== undefined && currentFamily !== prevFamily) ||
    (currentWeight !== undefined && prevWeight !== undefined && currentWeight !== prevWeight) ||
    (currentStyle !== undefined && prevStyle !== undefined && currentStyle !== prevStyle);

  if (source.style?.pptxTypeface && !typographyChanged) {
    style.pptxTypeface = source.style.pptxTypeface;
  } else {
    delete style.pptxTypeface;
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

export function serializeCanvas(
  canvas: { getObjects: () => Array<any> },
  layout: ArtifactLayout,
  added: Map<string, CanvasElement>,
  options?: { isHealingSave?: boolean }
): CanvasElement[] {
  const byId = new Map<string, CanvasElement>([
    ...added,
    ...layout.elements.map((e) => [e.id, e] as const),
  ]);
  // Canvas order is zIndex order; the stored array keeps template order so that
  // `hydrate`'s source-order tie-break — and diffs against the seed — stay put.
  const sourceRank = new Map(layout.elements.map((e, i) => [e.id, i] as const));

  // Determine if canvas stacking order of existing elements has changed relative
  // to the initial painted ordering (sorted by zIndex, tie-broken by template/source order).
  // If not reordered, preserve each element's source zIndex untouched (setIfMeaningful discipline).
  const canvasObjects = canvas.getObjects();
  const existingObjects = canvasObjects
    .map((obj, canvasIndex) => {
      const elementId = getElementId(obj);
      return { elementId, canvasIndex };
    })
    .filter((entry): entry is { elementId: string; canvasIndex: number } =>
      typeof entry.elementId === 'string' && sourceRank.has(entry.elementId)
    );

  const survivingIds = new Set(existingObjects.map((e) => e.elementId));
  const initialOrder = layout.elements
    .filter((element) => survivingIds.has(element.id))
    .map((element, sourceIndex) => ({
      id: element.id,
      zIndex: element.zIndex,
      sourceIndex,
    }))
    .sort((a, b) => a.zIndex - b.zIndex || a.sourceIndex - b.sourceIndex);

  // Check if surviving elements are in their initial relative order on canvas,
  // and check if any added elements have moved relative to the existing elements
  // (e.g. newly added element was moved behind/below existing elements).
  const hasReorderedExisting = existingObjects.some(
    (entry, idx) => entry.elementId !== initialOrder[idx]?.id
  );

  // Check if any added element is positioned before (underneath) any existing element on canvas
  const minExistingIndex = existingObjects.length > 0 ? existingObjects[0].canvasIndex : -1;
  const maxExistingIndex = existingObjects.length > 0 ? existingObjects[existingObjects.length - 1].canvasIndex : -1;
  const hasReorderedAdded = canvasObjects.some((obj, canvasIndex) => {
    const elementId = getElementId(obj);
    if (!elementId || !added.has(elementId)) return false;
    // Added element was created at the top (zIndex = maxZ + 1).
    // If it is located below any existing element in canvas index order, it was explicitly reordered.
    return maxExistingIndex !== -1 && canvasIndex < maxExistingIndex;
  });

  const isOrderModified = hasReorderedExisting || hasReorderedAdded;
  const isHealing = options?.isHealingSave === true;

  const serialized = canvasObjects.flatMap((obj, canvasIndex) => {
    const elementId = getElementId(obj);
    if (!elementId) return [];
    const source = byId.get(elementId);
    if (!source) return [];

    const left = obj.left ?? 0;
    const top = obj.top ?? 0;
    const scaleX = Math.abs(obj.scaleX ?? 1);
    const scaleY = Math.abs(obj.scaleY ?? 1);
    const isText = source.type === 'text' && isFabricTextObject(obj);

    const authoredLeft = pctToPx(source.x, CANVAS_WIDTH);
    const authoredTop = pctToPx(source.y, CANVAS_HEIGHT);
    const authoredWidth = pctToPx(source.w, CANVAS_WIDTH);
    const authoredHeight = pctToPx(source.h, CANVAS_HEIGHT);
    const isUserResizedW = (obj as any).data?.userResizedWidth === true;
    const isUserResizedH = (obj as any).data?.userResizedHeight === true;
    const effWidth = isUserResizedW
      ? (obj.width ?? (obj as any).data?.authoredWidth ?? 0)
      : typeof (obj as any).data?.authoredWidth === 'number' && (obj as any).data.authoredWidth > 0
        ? (obj as any).data.authoredWidth
        : (obj.width ?? 0);
    const effHeight = isUserResizedH
      ? (obj.height ?? (obj as any).data?.authoredHeight ?? 0)
      : typeof (obj as any).data?.authoredHeight === 'number' && (obj as any).data.authoredHeight > 0
        ? (obj as any).data.authoredHeight
        : (obj.height ?? 0);
    const measuredWidth = Math.abs(effWidth) * scaleX;
    const measuredHeight = Math.abs(effHeight) * scaleY;

    const isWidthResized = Math.abs(measuredWidth - authoredWidth) > 1;
    const isHeightResized = Math.abs(measuredHeight - authoredHeight) > 1;

    const measuredTextHeightPct = pxToPct(measuredHeight, CANVAS_HEIGHT);
    const measuredTextWidthPct = pxToPct(measuredWidth, CANVAS_WIDTH);

    const hasAuthoredWidth = typeof (obj as any).data?.authoredWidth === 'number';
    const hasAuthoredHeight = typeof (obj as any).data?.authoredHeight === 'number';
    const isFontSizeAutoH = (obj as any).data?.heightChange === 'font-size-auto';
    const isUserMoved = (obj as any).data?.userMoved === true;

    const isPlaceholder =
      Boolean(source.placeholderKey) ||
      (typeof source.content === 'string' && /\{[a-zA-Z0-9_]+\}/.test(source.content));

    // SPEC-20-04 / SPEC-26-02 / BUG-35:
    // A dimension Fabric computed MUST NOT be written back as authored geometry.
    // Only a dimension the operator actually changed — a drag of a resize handle — may be persisted.
    let w = source.w;
    if (isHealing) {
      w = source.w;
    } else if (hasAuthoredWidth) {
      if (isUserResizedW) {
        w = pxToPct(measuredWidth, CANVAS_WIDTH);
      } else {
        w = source.w;
      }
    } else if (isWidthResized) {
      w = pxToPct(measuredWidth, CANVAS_WIDTH);
    } else if (isText) {
      w = Math.max(source.w, measuredTextWidthPct);
    }

    let longestWordPx: number | undefined;
    let didSlackWiden = false;

    // SPEC-23-01: Longest-word slack invariant on Textbox widening
    // Only applied to static text (placeholders are measured only on runtime display/export)
    if (isText) {
      const dynamicMinWidth = (obj as any).dynamicMinWidth ?? (obj as any).longestWordPx;
      if (typeof dynamicMinWidth === 'number' && Number.isFinite(dynamicMinWidth) && dynamicMinWidth > 0) {
        longestWordPx = dynamicMinWidth * scaleX;
        if (!isPlaceholder && (isHealing || isUserResizedW || !hasAuthoredWidth)) {
          const slackedW = applyWrapSlack(w, longestWordPx);
          if (Math.abs(slackedW - w) > 0.001) {
            w = slackedW;
            didSlackWiden = true;
          }
        }
      }
    }

    // SPEC-23-05 Req 3 / SPEC-26-02 / SPEC-28-03: Preserves authored h on save unless user actively resized height or font size auto-expanded
    const autoExpandedH =
      typeof (obj as any).data?.authoredHeight === 'number' && (obj as any).data.authoredHeight > 0
        ? (obj as any).data.authoredHeight
        : measuredHeight;
    const h = isHealing
      ? source.h
      : hasAuthoredHeight
        ? (isUserResizedH
            ? pxToPct(measuredHeight, CANVAS_HEIGHT)
            : isFontSizeAutoH
              ? pxToPct(autoExpandedH, CANVAS_HEIGHT)
              : source.h)
        : isText
          ? Math.max(source.h, measuredTextHeightPct)
          : isHeightResized
            ? pxToPct(measuredHeight, CANVAS_HEIGHT)
            : source.h;

    // SPEC-24-03: Non-destructive canvas serialization.
    // Coordinates reflect live Fabric object positions when moved; never force source.x/y when left/top has moved.
    const computedX = left === authoredLeft ? source.x : pxToPct(left, CANVAS_WIDTH);
    const computedY = top === authoredTop ? source.y : pxToPct(top, CANVAS_HEIGHT);

    // SPEC-21-02: Retain minimum dimension floor, but do not truncate off-canvas bleeding
    const clampedW = isHealing ? w : Math.max(MIN_ELEMENT_W_PCT, w);
    const clampedH = isHealing ? h : (source.type === 'line' ? Math.max(0, h) : Math.max(MIN_ELEMENT_H_PCT, h));

    const rawAngle = typeof obj.angle === 'number' && Number.isFinite(obj.angle) ? obj.angle : undefined;
    let rotation: number | undefined = source.rotation;
    if (rawAngle !== undefined) {
      const normalized = Math.round(((rawAngle % 360) + 360) % 360) % 360;
      if (normalized > 0 || source.rotation !== undefined) {
        rotation = normalized;
      }
    }

    const next: CanvasElement = {
      ...source,
      x: computedX,
      y: computedY,
      w: clampedW,
      h: clampedH,
      zIndex: isHealing ? source.zIndex : (isOrderModified ? canvasIndex : source.zIndex),
      ...(rotation !== undefined ? { rotation } : {}),
    };

    if (isText) {
      const text = obj.text ?? '';
      // SPEC-24-03: Never overwrite modified text content on save
      if (source.content !== undefined || text !== '') {
        next.content = text;
      }

      // SPEC-23-01 requirement 6: Re-wrap after widening, or write no wrap at all.
      // If width was modified by slack widening, re-wrap object to ensure wrapLines matches new box width.
      let rawLines = (obj as any).textLines;
      if (didSlackWiden) {
        const newWidthPx = pctToPx(clampedW, CANVAS_WIDTH) / scaleX;
        if (typeof (obj as any).set === 'function' && typeof (obj as any)._initDimensions === 'function') {
          (obj as any).set('width', newWidthPx);
          (obj as any)._initDimensions();
          rawLines = (obj as any).textLines;
        } else if (typeof (obj as any).set === 'function' && typeof (obj as any).initDimensions === 'function') {
          (obj as any).set('width', newWidthPx);
          (obj as any).initDimensions();
          rawLines = (obj as any).textLines;
        } else {
          rawLines = undefined;
        }
      }

      // SPEC-22-02 / SPEC-29-01: Persist canvas soft-wrap lines snapshot from Fabric Textbox (textLines)
      // Only for fixed authored text; dynamic placeholder tokens rely on runtime substitution.
      // Candidate lines must be validated as a lossless, whole-word partition of the source text.
      const isPlaceholderToken = Boolean(source.placeholderKey) || /\{[a-zA-Z0-9_]+\}/.test(text);
      const validWrapLines = !isPlaceholderToken && Array.isArray(rawLines)
        ? validateWrapLines(text, rawLines)
        : null;
      if (validWrapLines !== null) {
        next.wrapLines = validWrapLines;
      } else {
        delete next.wrapLines;
      }

      // SPEC-24-03: Never overwrite modified text styles on save
      const style = serializeTextStyle(source, obj);
      if (style) {
        next.style = style;
      } else {
        delete next.style;
      }

      // SPEC-23-01: Persist longestWordPx and measuredWith stamp
      if (!isPlaceholderToken && typeof longestWordPx === 'number' && longestWordPx > 0) {
        const rawFamily = next.style?.fontFamily ?? source.style?.fontFamily ?? (obj as any).fontFamily ?? DEFAULT_FONT_FAMILY;
        const fontFamily = resolveCatalogFontFamily(rawFamily);
        const fontSize = next.style?.fontSize ?? source.style?.fontSize ?? (obj as any).fontSize ?? DEFAULT_FONT_SIZE;
        const fontWeight = String(next.style?.fontWeight ?? source.style?.fontWeight ?? (obj as any).fontWeight ?? 'normal');
        const fontStyle = String(next.style?.fontStyle ?? source.style?.fontStyle ?? (obj as any).fontStyle ?? 'normal');

        next.longestWordPx = longestWordPx;
        next.measuredWith = {
          fontFamily,
          fontSize,
          fontWeight,
          fontStyle,
        };
      } else {
        delete next.longestWordPx;
        delete next.measuredWith;
      }
    }

    if (source.type === 'shape') {
      const isProxy = Boolean((obj as any).data?.isTransparentProxy);
      const proxyStyle = ((obj as any).data?.style as CanvasElement['style']) || {};
      const effFillColor = isProxy
        ? (proxyStyle.fillColor ?? source.style?.fillColor)
        : ((obj as any).fill ?? source.style?.fillColor);
      const effStrokeColor = isProxy
        ? (proxyStyle.strokeColor ?? source.style?.strokeColor)
        : ((obj as any).stroke ?? source.style?.strokeColor);

      const isUnfilled =
        effFillColor === 'transparent' ||
        (!effFillColor && Boolean(effStrokeColor));

      const fill = isUnfilled
        ? undefined
        : (toStrictHexColor(effFillColor, undefined) ??
          (typeof effFillColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(effFillColor)
            ? effFillColor.toUpperCase()
            : undefined));
      const opacity = typeof (obj as any).opacity === 'number' ? (obj as any).opacity : undefined;

      const strokeRaw = effStrokeColor;
      const strokeColor =
        toStrictHexColor(strokeRaw, undefined) ??
        (typeof strokeRaw === 'string' && /^#[0-9A-Fa-f]{6}$/.test(strokeRaw)
          ? strokeRaw.toUpperCase()
          : undefined);

      const strokeWidth =
        typeof (obj as any).strokeWidth === 'number'
          ? (obj as any).strokeWidth
          : (isProxy ? (proxyStyle.strokeWidth ?? source.style?.strokeWidth) : source.style?.strokeWidth);

      const mergedStyle = {
        ...source.style,
        ...(isUnfilled ? { fillColor: 'transparent' } : fill ? { fillColor: fill } : {}),
        ...(opacity !== undefined ? { opacity } : {}),
        ...(strokeColor ? { strokeColor } : {}),
        ...(typeof strokeWidth === 'number' && strokeWidth > 0 ? { strokeWidth } : {}),
      };
      if (Object.keys(mergedStyle).length > 0) {
        next.style = mergedStyle;
      } else {
        delete next.style;
      }
    }

    if (source.type === 'line') {
      const strokeRaw = (obj as any).stroke ?? source.style?.strokeColor;
      const strokeColor =
        toStrictHexColor(strokeRaw, undefined) ??
        (typeof strokeRaw === 'string' && /^#[0-9A-Fa-f]{6}$/.test(strokeRaw)
          ? strokeRaw.toUpperCase()
          : undefined);

      const strokeWidth =
        typeof (obj as any).strokeWidth === 'number'
          ? (obj as any).strokeWidth
          : source.style?.strokeWidth;

      const opacity = typeof (obj as any).opacity === 'number' ? (obj as any).opacity : undefined;

      const mergedStyle = {
        ...source.style,
        ...(opacity !== undefined ? { opacity } : {}),
        ...(strokeColor ? { strokeColor } : {}),
        ...(typeof strokeWidth === 'number' && strokeWidth > 0 ? { strokeWidth } : {}),
      };
      if (Object.keys(mergedStyle).length > 0) {
        next.style = mergedStyle;
      } else {
        delete next.style;
      }
    }

    if (source.type === 'image' || source.type === 'image-placeholder') {
      const isProxy = Boolean((obj as any).data?.isTransparentProxy);
      const proxyStyle = ((obj as any).data?.style as CanvasElement['style']) || {};
      const effOpacity = isProxy
        ? (proxyStyle.opacity ?? source.style?.opacity)
        : (typeof (obj as any).opacity === 'number' ? (obj as any).opacity : source.style?.opacity);
      const effObjectFit = isProxy
        ? (proxyStyle.objectFit ?? (obj as any).data?.objectFit ?? source.style?.objectFit)
        : ((obj as any).data?.objectFit ?? source.style?.objectFit);

      const isExplicitContain = (obj as any).data?.objectFit === 'contain' || proxyStyle.objectFit === 'contain';
      const hasResized = isWidthResized || isHeightResized || isUserResizedW || isUserResizedH;
      const finalFit = isExplicitContain
        ? 'contain'
        : (effObjectFit || (hasResized ? 'fill' : undefined));

      const mergedStyle = {
        ...source.style,
        ...(typeof effOpacity === 'number' && effOpacity >= 0 && effOpacity <= 1 ? { opacity: effOpacity } : {}),
        ...(finalFit === 'fill' || finalFit === 'cover' ? { objectFit: finalFit } : {}),
      };
      if (finalFit === 'contain' && mergedStyle.objectFit !== undefined) {
        delete mergedStyle.objectFit;
      }
      if (Object.keys(mergedStyle).length > 0) {
        next.style = mergedStyle;
      } else {
        delete next.style;
      }
    }

    const rank =
      sourceRank.get(elementId) ?? layout.elements.length + canvasIndex;
    return [{ rank, next }];
  });

  return serialized
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.next);
}

/**
 * Resolves the initial slide to select on editor mount or list load.
 * If nothing is currently selected and no explicit initialSelectedId was provided,
 * auto-selects the first available slide (BUG-1, BUG-8).
 * Guards against the empty list case by returning null.
 */
export function resolveInitialSelectedId(
  currentSelectedId: string | null,
  initialSelectedId: string | null,
  summaries: Array<{ id: string }>
): string | null {
  if (!currentSelectedId && !initialSelectedId && summaries && summaries.length > 0) {
    return summaries[0].id;
  }
  return currentSelectedId ?? initialSelectedId ?? null;
}

/**
 * Determines whether right-clicking on a canvas target should preserve the existing
 * selection or replace it.
 * If the target object is already part of the active selection (including multi-selection),
 * the entire active selection is preserved (so actions like duplicate, delete, or
 * layer reordering apply to all selected elements).
 * If the target is NOT currently selected, the selection changes to that single target.
 */
export function shouldPreserveSelectionOnContextMenu(
  activeObjects: unknown[],
  target: unknown
): boolean {
  if (!target || !Array.isArray(activeObjects)) return false;
  return activeObjects.includes(target);
}

/**
 * Computes context menu popup coordinates clamped within the canvas shell bounding box.
 */
export function computeContextMenuCoords(
  clientX: number,
  clientY: number,
  shellRect: { left: number; top: number; width: number; height: number },
  menuWidth = 170,
  menuHeight = 220
): { x: number; y: number } {
  const x = Math.max(10, Math.min(clientX - shellRect.left, shellRect.width - menuWidth));
  const y = Math.max(10, Math.min(clientY - shellRect.top, shellRect.height - menuHeight));
  return { x, y };
}

/**
 * Handles context menu event logic on a canvas.
 * Dispatches target discovery and updates selection and context menu coordinates.
 */
export function handleContextMenuTrigger(
  e: MouseEvent | { clientX: number; clientY: number; nativeEvent?: MouseEvent },
  canvas: {
    findTarget: (e: any) => any;
    getActiveObjects: () => any[];
    setActiveObject: (obj: any) => void;
    discardActiveObject: () => void;
    requestRenderAll: () => void;
  },
  shellRect: { left: number; top: number; width: number; height: number } | null,
  syncSelection: (canvas: any) => void,
  setContextMenu: (coords: { x: number; y: number } | null) => void,
  explicitTarget?: any
) {
  if (!shellRect) return;
  const nativeEvt = 'nativeEvent' in e && e.nativeEvent ? e.nativeEvent : (e as MouseEvent);
  const coords = computeContextMenuCoords(nativeEvt.clientX ?? 0, nativeEvt.clientY ?? 0, shellRect);
  const target = explicitTarget ?? canvas.findTarget(nativeEvt);

  if (target) {
    const active = canvas.getActiveObjects();
    if (!shouldPreserveSelectionOnContextMenu(active, target)) {
      canvas.setActiveObject(target);
      canvas.requestRenderAll();
      syncSelection(canvas);
    }
    setContextMenu(coords);
  } else {
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    syncSelection(canvas);
    setContextMenu(null);
  }
}

/**
 * Re-fits a Fabric image object to its updated bounding box (e.g. after user scales via handles)
 * preserving its natural aspect ratio with uniform contain fit and updated clipPath.
 */
export function updateImageElementFit(
  imgObj: any,
  fabric: any
): boolean {
  if (!imgObj || !imgObj.data?.imageRef) return false;
  const element = imgObj._element as HTMLImageElement | undefined;
  const naturalWidth = element?.naturalWidth || imgObj.width || 0;
  const naturalHeight = element?.naturalHeight || imgObj.height || 0;
  if (naturalWidth <= 0 || naturalHeight <= 0) return false;

  // Current outer bounding box in canvas coordinates, accounting for scaling ratio relative to base fit
  const scaleX = Math.abs(imgObj.scaleX ?? 1);
  const scaleY = Math.abs(imgObj.scaleY ?? 1);
  const baseScaleX = imgObj.data?.baseScaleX || imgObj.data?.fitScaleX || scaleX || 1;
  const baseScaleY = imgObj.data?.baseScaleY || imgObj.data?.fitScaleY || scaleY || 1;
  const ratioX = baseScaleX !== 0 ? scaleX / baseScaleX : 1;
  const ratioY = baseScaleY !== 0 ? scaleY / baseScaleY : 1;

  const origClipWidth = imgObj.data?.clipDimensions?.width ?? (imgObj.width ?? 0) * baseScaleX;
  const origClipHeight = imgObj.data?.clipDimensions?.height ?? (imgObj.height ?? 0) * baseScaleY;
  const boxWidth = origClipWidth * ratioX;
  const boxHeight = origClipHeight * ratioY;
  if (boxWidth <= 0 || boxHeight <= 0) return false;

  const boxLeft = (imgObj.left ?? 0) + (imgObj.data?.clipOffset?.x ?? 0) * ratioX;
  const boxTop = (imgObj.top ?? 0) + (imgObj.data?.clipOffset?.y ?? 0) * ratioY;
  const objectFit =
    imgObj.data?.objectFit === 'cover'
      ? 'cover'
      : imgObj.data?.objectFit === 'fill'
        ? 'fill'
        : 'contain';
  const fit = calculateImageFit(
    { left: boxLeft, top: boxTop, width: boxWidth, height: boxHeight },
    { width: naturalWidth, height: naturalHeight },
    objectFit
  );

  let clipBox = imgObj.clipPath;
  if (!clipBox && fabric?.Rect) {
    clipBox = new fabric.Rect({
      left: boxLeft,
      top: boxTop,
      width: boxWidth,
      height: boxHeight,
      scaleX: 1,
      scaleY: 1,
      absolutePositioned: true,
    });
  } else if (clipBox) {
    clipBox.set({
      left: boxLeft,
      top: boxTop,
      width: boxWidth,
      height: boxHeight,
      scaleX: 1,
      scaleY: 1,
      absolutePositioned: true,
    });
  }

  if (clipBox && typeof clipBox.setCoords === 'function') {
    clipBox.setCoords();
  }

  if (imgObj.data) {
    imgObj.data.clipOffset = {
      x: boxLeft - fit.left,
      y: boxTop - fit.top,
    };
    imgObj.data.clipDimensions = {
      width: boxWidth,
      height: boxHeight,
    };
    imgObj.data.baseScaleX = fit.scaleX;
    imgObj.data.baseScaleY = fit.scaleY;
  }

  imgObj.set({
    width: fit.width,
    height: fit.height,
    scaleX: fit.scaleX,
    scaleY: fit.scaleY,
    left: fit.left,
    top: fit.top,
    clipPath: clipBox,
  });
  imgObj.setCoords();
  return true;
}

/**
 * Synchronizes an image object's clipPath coordinates during active movement (object:moving),
 * ensuring the clipping mask translates synchronously with the image so that no clipping
 * or visual disappearance occurs while dragging.
 */
export function syncImageClipOnMove(target: any): boolean {
  if (!target || !target.data?.imageRef) return false;
  const clip = target.clipPath;
  if (!clip) return false;

  const offsetX = target.data?.clipOffset?.x ?? 0;
  const offsetY = target.data?.clipOffset?.y ?? 0;
  const targetLeft = target.left ?? 0;
  const targetTop = target.top ?? 0;

  clip.set({
    left: targetLeft + offsetX,
    top: targetTop + offsetY,
  });
  if (typeof clip.setCoords === 'function') {
    clip.setCoords();
  }
  return true;
}

/**
 * Synchronizes an image object's clipPath dimensions and coordinates during active scaling (object:scaling),
 * ensuring the clipping mask expands or shrinks synchronously with the image so that no clipping
 * or visual boundary cutoff occurs while dragging resize handles.
 */
export function syncImageClipOnScale(target: any): boolean {
  if (!target || !target.data?.imageRef) return false;
  const clip = target.clipPath;
  if (!clip) return false;

  if (target.data && (!target.data.baseScaleX || !target.data.clipDimensions)) {
    target.data.baseScaleX = target.data.baseScaleX || target.scaleX || 1;
    target.data.baseScaleY = target.data.baseScaleY || target.scaleY || 1;
    target.data.clipDimensions = target.data.clipDimensions || {
      width: clip.width ?? target.width ?? 0,
      height: clip.height ?? target.height ?? 0,
    };
  }

  const baseScaleX = target.data?.baseScaleX || target.data?.fitScaleX || 1;
  const baseScaleY = target.data?.baseScaleY || target.data?.fitScaleY || 1;
  const currentScaleX = target.scaleX ?? 1;
  const currentScaleY = target.scaleY ?? 1;

  const ratioX = baseScaleX !== 0 ? currentScaleX / baseScaleX : 1;
  const ratioY = baseScaleY !== 0 ? currentScaleY / baseScaleY : 1;

  const origClipWidth = target.data?.clipDimensions?.width ?? clip.width ?? target.width ?? 0;
  const origClipHeight = target.data?.clipDimensions?.height ?? clip.height ?? target.height ?? 0;
  const offsetX = target.data?.clipOffset?.x ?? 0;
  const offsetY = target.data?.clipOffset?.y ?? 0;

  const targetLeft = target.left ?? 0;
  const targetTop = target.top ?? 0;

  clip.set({
    left: targetLeft + offsetX * ratioX,
    top: targetTop + offsetY * ratioY,
    width: origClipWidth * ratioX,
    height: origClipHeight * ratioY,
    scaleX: 1,
    scaleY: 1,
    angle: target.angle ?? 0,
    absolutePositioned: true,
  });
  if (typeof clip.setCoords === 'function') {
    clip.setCoords();
  }
  return true;
}

/**
 * SPEC-23-05: Checks if an authored text element lacks measurements (wrapLines, longestWordPx, measuredWith)
 * or carries a measurement invalid for its current style.
 * Substituted placeholder elements are excluded (placeholders are measured only on runtime display/export).
 */
export function isElementUnmeasured(element: CanvasElement): boolean {
  if (element.type !== 'text') return false;
  if (Boolean(element.placeholderKey)) return false;
  if (typeof element.content === 'string' && /\{[a-zA-Z0-9_]+\}/.test(element.content)) {
    return false;
  }
  return (
    !element.wrapLines ||
    element.wrapLines.length === 0 ||
    element.longestWordPx === undefined ||
    !element.measuredWith ||
    !isMeasurementValid(element)
  );
}

/**
 * SPEC-23-05: Healing pass over a template.
 * Measures any unmeasured text elements using Fabric and serializes with { isHealingSave: true }
 * so that h, zIndex, x, y, content and style remain byte-identical while only measurement fields
 * (wrapLines, longestWordPx, measuredWith) and slack-widened w are updated.
 *
 * Idempotent: running twice on the same template produces zero additional changes and measuredCount === 0.
 */
export function healTemplate(
  template: any,
  fabric: any
): {
  updatedTemplate: any;
  measuredCount: number;
  skippedCount: number;
  changed: boolean;
} {
  const layout = template?.layouts?.default;
  if (!layout || !Array.isArray(layout.elements)) {
    return { updatedTemplate: template, measuredCount: 0, skippedCount: 0, changed: false };
  }

  const unmeasured = layout.elements.filter(isElementUnmeasured);
  const alreadyMeasured = layout.elements.filter(
    (e: CanvasElement) =>
      e.type === 'text' &&
      !e.placeholderKey &&
      !(typeof e.content === 'string' && /\{[a-zA-Z0-9_]+\}/.test(e.content)) &&
      !isElementUnmeasured(e)
  );

  if (unmeasured.length === 0) {
    return {
      updatedTemplate: template,
      measuredCount: 0,
      skippedCount: alreadyMeasured.length,
      changed: false,
    };
  }

  let canvas: any;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const el = document.createElement('canvas');
    el.width = CANVAS_WIDTH;
    el.height = CANVAS_HEIGHT;
    canvas = new fabric.Canvas(el, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
  } else {
    // In Node / test harness environment
    if (typeof fabric?.StaticCanvas === 'function') {
      canvas = new fabric.StaticCanvas(null, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        renderOnAddRemove: false,
      });
    } else {
      const objects: any[] = [];
      canvas = {
        getObjects: () => objects,
        add: (...objs: any[]) => objects.push(...objs),
        dispose: () => {},
      };
    }
  }

  const painted = layout.elements
    .map((element: CanvasElement, index: number) => ({ element, index }))
    .sort((a: any, b: any) => a.element.zIndex - b.element.zIndex || a.index - b.index);

  for (const { element } of painted) {
    const obj = elementToFabricObject(fabric, element, false, { isHealing: true });
    canvas.add(obj);
  }

  const updatedElements = serializeCanvas(
    canvas,
    layout,
    new Map(),
    { isHealingSave: true }
  );

  if (typeof canvas?.dispose === 'function') {
    canvas.dispose();
  }

  const updatedTemplate = {
    ...template,
    layouts: {
      ...template.layouts,
      default: {
        ...layout,
        elements: updatedElements,
      },
    },
  };

  return {
    updatedTemplate,
    measuredCount: unmeasured.length,
    skippedCount: alreadyMeasured.length,
    changed: true,
  };
}


