import type {
  ArtifactLayout,
  CanvasElement,
} from '@/lib/registry/types';
import { DEFAULT_FONT_FAMILY, getFontStack, resolveCatalogFontFamily } from '@/lib/registry/font-catalog';
import { TEXT_LINE_HEIGHT, applyWrapSlack, isMeasurementValid } from '@/lib/artifacts/render-model';

export { TEXT_LINE_HEIGHT };

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
  objectFit: 'contain' | 'cover' = 'contain'
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
  }
): CanvasElement['style'] | undefined {
  const style: NonNullable<CanvasElement['style']> = { ...source.style };

  const setIfMeaningful = <K extends keyof NonNullable<CanvasElement['style']>>(
    key: K,
    current: NonNullable<CanvasElement['style']>[K] | undefined,
    constructionDefault: NonNullable<CanvasElement['style']>[K]
  ) => {
    if (current === undefined) return;
    if (source.style?.[key] === undefined && current === constructionDefault) return;
    style[key] = current;
  };

  setIfMeaningful(
    'fontColor',
    toStrictHexColor(textObj.fill, source.style?.fontColor),
    DEFAULT_FONT_COLOR
  );
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
  setIfMeaningful(
    'textAlign',
    textObj.textAlign === 'left' ||
      textObj.textAlign === 'center' ||
      textObj.textAlign === 'right'
      ? (textObj.textAlign as 'left' | 'center' | 'right')
      : undefined,
    DEFAULT_TEXT_ALIGN
  );

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
    const measuredWidth = Math.abs(obj.width ?? 0) * scaleX;
    const measuredHeight = Math.abs(obj.height ?? 0) * scaleY;

    const isWidthResized = Math.abs(measuredWidth - authoredWidth) > 1;
    const isHeightResized = Math.abs(measuredHeight - authoredHeight) > 1;

    const measuredTextHeightPct = pxToPct(measuredHeight, CANVAS_HEIGHT);
    const measuredTextWidthPct = pxToPct(measuredWidth, CANVAS_WIDTH);

    // SPEC-20-04: Auto-sync bounding box dimensions for text elements so bounding box encapsulates rendered text
    // SPEC-23-05: In healing saves, preserve authored width as the baseline
    let w = isHealing
      ? source.w
      : isWidthResized
        ? pxToPct(measuredWidth, CANVAS_WIDTH)
        : isText
          ? Math.max(source.w, measuredTextWidthPct)
          : source.w;

    let longestWordPx: number | undefined;
    let didSlackWiden = false;

    // SPEC-23-01: Longest-word slack invariant on Textbox widening
    if (isText) {
      const dynamicMinWidth = (obj as any).dynamicMinWidth ?? (obj as any).longestWordPx;
      if (typeof dynamicMinWidth === 'number' && Number.isFinite(dynamicMinWidth) && dynamicMinWidth > 0) {
        longestWordPx = dynamicMinWidth * scaleX;
        const slackedW = applyWrapSlack(w, longestWordPx);
        if (Math.abs(slackedW - w) > 0.001) {
          w = slackedW;
          didSlackWiden = true;
        }
      }
    }

    // SPEC-23-05 Req 3: Healing saves MUST NOT resize h or rewrite zIndex/x/y
    const h = isHealing
      ? source.h
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
    const clampedH = isHealing ? h : Math.max(MIN_ELEMENT_H_PCT, h);

    const next: CanvasElement = {
      ...source,
      x: computedX,
      y: computedY,
      w: clampedW,
      h: clampedH,
      zIndex: isHealing ? source.zIndex : (isOrderModified ? canvasIndex : source.zIndex),
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

      // SPEC-22-02: Persist canvas soft-wrap lines snapshot from Fabric Textbox (textLines)
      // Only for fixed authored text; dynamic placeholder tokens rely on runtime substitution
      const isPlaceholderToken = Boolean(source.placeholderKey) || /\{[a-zA-Z0-9_]+\}/.test(text);
      if (!isPlaceholderToken && Array.isArray(rawLines) && rawLines.length > 0) {
        next.wrapLines = rawLines.map(String);
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
      const fill =
        toStrictHexColor((obj as any).fill, undefined) ??
        (typeof (obj as any).fill === 'string' && /^#[0-9A-Fa-f]{6}$/.test((obj as any).fill)
          ? (obj as any).fill.toUpperCase()
          : undefined);
      const opacity = typeof (obj as any).opacity === 'number' ? (obj as any).opacity : undefined;
      const mergedStyle = {
        ...source.style,
        ...(fill ? { fillColor: fill } : {}),
        ...(opacity !== undefined ? { opacity } : {}),
      };
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
  const objectFit = imgObj.data?.objectFit === 'cover' ? 'cover' : 'contain';
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
      canvas = new fabric.StaticCanvas(null, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
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
    const left = pctToPx(element.x, CANVAS_WIDTH);
    const top = pctToPx(element.y, CANVAS_HEIGHT);
    const width = pctToPx(element.w, CANVAS_WIDTH);
    const height = pctToPx(element.h, CANVAS_HEIGHT);
    const common = {
      left,
      top,
      width,
      height,
      data: { elementId: element.id, authoredWidth: width, authoredHeight: height },
    };

    if (element.type === 'text') {
      const style = element.style;
      const text = element.content ?? '';
      let textObj: any;
      if (typeof fabric?.Textbox === 'function') {
        textObj = new fabric.Textbox(text, {
          ...common,
          fontSize: normalizeFontSize(style?.fontSize),
          fontFamily: getFontStack(style?.fontFamily),
          fontWeight: style?.fontWeight ?? 'normal',
          fontStyle: style?.fontStyle ?? 'normal',
          splitByGrapheme: false,
        });
      } else {
        // Fallback object for headless test mocks
        const words = text.split(/\s+/).filter(Boolean);
        let longestWord = '';
        for (const w of words) {
          if (w.length > longestWord.length) longestWord = w;
        }
        const em = normalizeFontSize(style?.fontSize);
        const longestWordPx = longestWord.length * em * 0.55;
        textObj = {
          ...common,
          type: 'text',
          text,
          fontSize: em,
          fontFamily: style?.fontFamily ?? DEFAULT_FONT_FAMILY,
          fontWeight: style?.fontWeight ?? 'normal',
          fontStyle: style?.fontStyle ?? 'normal',
          dynamicMinWidth: longestWordPx,
          textLines: words.length > 0 ? [text] : [],
        };
      }
      canvas.add(textObj);
    } else {
      canvas.add({ ...common, type: element.type });
    }
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


