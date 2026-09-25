import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  assertRuntimeVersion,
  type ArtifactInstance,
  type ResolvedElement,
} from '@/lib/artifacts/runtime-contract';
import { getFontStack } from '@/lib/registry/font-catalog';
import {
  TEXT_LINE_HEIGHT,
  largestFittingTextScale,
  resolveBold,
  resolveElementImage,
  resolveElementText,
  resolveItalic,
  resolveUnderline,
  resolveObjectFit,
  resolveOpacity,
  resolveTextAlign,
  textFitRatio,
  toCssAlignItems,
  toCssColor,
  toCssGeometry,
  toCssJustifyContent,
  resolveEffectiveBackgroundImage,
} from '@/lib/artifacts/render-model';

/**
 * Written by the measurement effect below; `1` (the `var()` fallback) until the
 * browser has laid the text out, and on a server render.
 */
const FIT_SCALE_VAR = '--artifact-fit-scale';

function boxStyle(element: ResolvedElement): CSSProperties {
  const geometry = toCssGeometry(element);
  return {
    position: 'absolute',
    left: geometry.left,
    top: geometry.top,
    width: geometry.width,
    height: geometry.height,
    fontSize: geometry.fontSize,
    zIndex: typeof element.zIndex === 'number' ? element.zIndex : undefined,
    opacity: resolveOpacity(element.style),
    transform:
      typeof element.rotation === 'number' && element.rotation !== 0
        ? `rotate(${element.rotation}deg)`
        : undefined,
    transformOrigin: 'center center',
    // Policy: an element never paints outside its own box. This clips the
    // element's own content only — the box itself is never clamped, so
    // deck-inherited off-canvas geometry survives untouched.
    overflow: 'hidden',
  };
}

/**
 * Shrink-to-fit, measured in the browser.
 *
 * Font sizes arrive as `cqh` against the stage, so the same slide is laid out at
 * wildly different pixel sizes (4K projector vs. a 340px presenter thumbnail)
 * and no pixel assumption can be baked in — the fit has to be measured after
 * layout, at whatever size the stage happens to be.
 *
 * Each pass searches from scratch over a fixed range of scales, so its result
 * depends only on the box and never on the scale the previous pass applied: the
 * pass is idempotent and cannot walk the size down over time. The observer
 * watches the *box*, whose size is fixed by the stage and is unaffected by the
 * font size we write, so it cannot feed itself.
 *
 * Style is written straight through the refs. Nothing here belongs in React
 * state: the value is derived from layout, not from anything that renders.
 */
function TextElement({
  element,
  editorMode = false,
}: {
  element: ResolvedElement;
  editorMode?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return;
    if (resolveElementText(element) === undefined) return;

    const applyVerticalAnchor = () => {
      const isOverflowing = content.scrollHeight > box.clientHeight;
      const baseJustify = toCssJustifyContent(element.style);
      if (isOverflowing) {
        box.style.justifyContent = 'flex-start';
      } else {
        box.style.justifyContent = baseJustify === 'center' ? 'safe center' : baseJustify;
      }
    };

    if (editorMode) {
      content.style.setProperty(FIT_SCALE_VAR, '1');
      applyVerticalAnchor();
      return;
    }

    const applyFit = () => {
      const boxWidth = box.clientWidth;
      const boxHeight = box.clientHeight;

      const fitsAt = (scale: number): boolean => {
        content.style.setProperty(FIT_SCALE_VAR, String(scale));
        // Reading a layout property here forces the probe to settle before the
        // next one is written; nothing paints between probes.
        return (
          textFitRatio({
            contentWidth: content.scrollWidth,
            contentHeight: content.scrollHeight,
            boxWidth,
            boxHeight,
            fontSizePx: Number.parseFloat(
              window.getComputedStyle(content).fontSize
            ),
          }) >= 1
        );
      };

      content.style.setProperty(
        FIT_SCALE_VAR,
        String(largestFittingTextScale(fitsAt))
      );
      applyVerticalAnchor();
    };

    applyFit();

    // SPEC-23-03: Re-run applyFit on web font readiness / loadingdone event
    let cancelled = false;
    let onFontLoaded: (() => void) | undefined;
    if (typeof document !== 'undefined' && 'fonts' in document && document.fonts) {
      onFontLoaded = () => {
        if (!cancelled) applyFit();
      };
      document.fonts.addEventListener('loadingdone', onFontLoaded);
      if (document.fonts.ready && typeof document.fonts.ready.then === 'function') {
        document.fonts.ready
          .then(() => {
            if (!cancelled) applyFit();
          })
          .catch(() => {});
      }
    }

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        cancelled = true;
        if (onFontLoaded && typeof document !== 'undefined' && 'fonts' in document && document.fonts) {
          document.fonts.removeEventListener('loadingdone', onFontLoaded);
        }
      };
    }

    const observer = new ResizeObserver(applyFit);
    observer.observe(box);
    return () => {
      cancelled = true;
      observer.disconnect();
      if (onFontLoaded && typeof document !== 'undefined' && 'fonts' in document && document.fonts) {
        document.fonts.removeEventListener('loadingdone', onFontLoaded);
      }
    };
  }, [element]);

  const text = resolveElementText(element);
  if (text === undefined) return null;

  const style = element.style;
  const effectiveLineHeight =
    typeof style?.lineHeight === 'number' && style.lineHeight > 0
      ? style.lineHeight
      : TEXT_LINE_HEIGHT;
  const topHalfLeadingComp =
    effectiveLineHeight < 1.0 ? (1.0 - effectiveLineHeight) / 2 : 0;

  return (
    <div
      ref={boxRef}
      data-element-id={element.id}
      style={{
        ...boxStyle(element),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: toCssJustifyContent(style),
        alignItems: toCssAlignItems(style),
        textAlign: resolveTextAlign(style),
        fontFamily: getFontStack(style.fontFamily),
        color: toCssColor(style.fontColor) ?? '#FFFFFF',
        fontWeight:
          typeof style?.fontWeight === 'string' && /^[1-9]00$/.test(style.fontWeight)
            ? Number(style.fontWeight)
            : resolveBold(style)
              ? 700
              : 400,
        fontStyle:
          typeof style?.fontStyle === 'string' &&
          (style.fontStyle === 'italic' || style.fontStyle === 'oblique')
            ? style.fontStyle
            : resolveItalic(style)
              ? 'italic'
              : 'normal',
        letterSpacing:
          typeof style?.letterSpacing === 'number' && Number.isFinite(style.letterSpacing)
            ? `${style.letterSpacing / (typeof style.fontSize === 'number' && style.fontSize > 0 ? style.fontSize : 32)}em`
            : undefined,
        textDecoration: resolveUnderline(style) ? 'underline' : 'none',
      }}
    >
      {/* `em` in `font-size` resolves against the box, so the scale multiplies
          the `cqh` size without re-deriving it. Flex keeps the shrunken block
          on the same `textAlign` / `verticalAlign` anchor, and the box itself
          never moves. */}
      <div
        ref={contentRef}
        style={{
          width: '100%',
          whiteSpace: 'pre-wrap',
          lineHeight: effectiveLineHeight,
          paddingTop: topHalfLeadingComp > 0 ? `${topHalfLeadingComp}em` : undefined,
          textShadow: style?.textShadow
            ? `2px 2px ${typeof style.textShadowBlur === 'number' ? style.textShadowBlur : 4}px rgba(0, 0, 0, 0.8)`
            : undefined,
          fontSize: `calc(1em * var(${FIT_SCALE_VAR}, 1))`,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function ImageElement({ element }: { element: ResolvedElement }) {
  const imageUrl = resolveElementImage(element);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // An unfilled `image-placeholder` simply draws nothing.
  if (imageUrl === undefined) return null;

  const loadFailed = Boolean(imageUrl && failedUrl === imageUrl);

  if (loadFailed) {
    return (
      <div
        data-element-id={element.id}
        data-image-missing="true"
        style={{
          ...boxStyle(element),
          border: '1px dashed rgba(160, 160, 160, 0.4)',
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    );
  }

  return (
    <div data-element-id={element.id} style={boxStyle(element)}>
      {/* Sources are remote allow-listed URLs and hub-local `/api/uploads/*`
          routes resolved at request time. */}
      <img
        src={imageUrl}
        alt=""
        onError={() => setFailedUrl(imageUrl)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: resolveObjectFit(element.style),
          display: 'block',
        }}
      />
    </div>
  );
}

function ShapeElement({ element }: { element: ResolvedElement }) {
  const strokeColor = toCssColor(element.style.strokeColor);
  const strokeWidth =
    typeof element.style.strokeWidth === 'number' ? element.style.strokeWidth : undefined;
  return (
    <div
      data-element-id={element.id}
      style={{
        ...boxStyle(element),
        backgroundColor: toCssColor(element.style.fillColor) ?? 'transparent',
        border: strokeColor && strokeWidth ? `${strokeWidth}px solid ${strokeColor}` : undefined,
        boxSizing: 'border-box',
        opacity: resolveOpacity(element.style),
      }}
    />
  );
}

function LineElement({ element }: { element: ResolvedElement }) {
  const strokeColor = toCssColor(element.style.strokeColor) ?? '#FFFFFF';
  const strokeWidth =
    typeof element.style.strokeWidth === 'number' ? element.style.strokeWidth : 2;
  const isDiagonal = element.h > 0;
  return (
    <div
      data-element-id={element.id}
      style={{
        ...boxStyle(element),
        overflow: 'visible',
        opacity: resolveOpacity(element.style),
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{
          overflow: 'visible',
          display: 'block',
        }}
      >
        <line
          x1="0"
          y1="0"
          x2="100%"
          y2={isDiagonal ? '100%' : '0'}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      </svg>
    </div>
  );
}

function ArtifactElement({
  element,
  editorMode,
}: {
  element: ResolvedElement;
  editorMode?: boolean;
}) {
  switch (element.type) {
    case 'text':
      return <TextElement element={element} editorMode={editorMode} />;
    case 'image':
    case 'image-placeholder':
      return <ImageElement key={`${element.id}-${resolveElementImage(element) ?? ''}`} element={element} />;
    case 'shape':
      return <ShapeElement element={element} />;
    case 'line':
      return <LineElement element={element} />;
    default: {
      const unsupported: never = element.type;
      throw new Error(
        `Unsupported artifact element type "${String(unsupported)}"`
      );
    }
  }
}

/**
 * Browser twin of the PPTX renderer: a 16:9 stage of absolutely positioned
 * elements. Geometry and colours come from the runtime contract only — there is
 * no per-`SlideKind` styling here. Elements may extend past the stage; the
 * `overflow: hidden` clip is the intended, deck-inherited behaviour. Each
 * element box clips its own content too — see the shrink-to-fit policy in
 * `render-model` — but no box is ever clamped to the stage.
 *
 * The stage is letterboxed inside its parent rather than stretched to fill it.
 * Percentage geometry and `cqh` font sizes are only in agreement with the PPTX
 * output while the stage is exactly 16:9 — filling a 16:10 projector or laptop
 * viewport would scale boxes to the viewport ratio while text kept scaling to
 * height alone, so browser and deck would drift apart.
 *
 * It takes **no `className`**, and the omission is load-bearing rather than
 * tidy. This wrapper is the element the congregation sees, so a `className`
 * parameter is a hole straight through AC-4 of Story 17.1: any caller could put
 * `bg-card` on a projected slide without touching a file that story's guards
 * read. `SlideView` — the only caller — stopped forwarding one for the same
 * reason, and removing the parameter here turns the invariant into a compile
 * error instead of a regex over `.tsx` files, which a `{...props}` spread, a
 * `React.createElement` call, a renamed import or a `.ts` call site all escape.
 */
export default function ArtifactSlide({
  instance,
  backgroundOverride,
  editorMode,
}: {
  instance: ArtifactInstance;
  backgroundOverride?: string | null;
  editorMode?: boolean;
}) {
  assertRuntimeVersion(instance);

  const isEditor = editorMode ?? Boolean(instance.instanceId?.startsWith('editor-'));
  const { layout } = instance;
  const effectiveBgImage = resolveEffectiveBackgroundImage(instance, backgroundOverride);

  const sortedElements = useMemo(() => {
    return [...(layout.elements ?? [])]
      .map((element, index) => ({ element, index }))
      .sort((a, b) => (a.element.zIndex ?? 0) - (b.element.zIndex ?? 0) || a.index - b.index)
      .map((entry) => entry.element);
  }, [layout.elements]);

  const instanceKey = instance.instanceId || `${instance.templateId || 'slide'}-${instance.layoutKey || ''}`;

  return (
    <div
      key={instanceKey}
      data-instance-id={instance.instanceId}
      className="flex h-full w-full items-center justify-center overflow-hidden"
      style={{ containerType: 'size' }}
    >
      <div
        style={{
          position: 'relative',
          width: 'min(100cqw, calc(100cqh * 16 / 9))',
          maxHeight: '100cqh',
          aspectRatio: '16 / 9',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            // Makes the `cqh` font sizing from `toCssGeometry` resolve against
            // the rendered stage rather than the viewport.
            containerType: 'size',
            backgroundColor: toCssColor(layout.backgroundColor) ?? '#000000',
            ...(effectiveBgImage
              ? {
                  backgroundImage: `url(${JSON.stringify(effectiveBgImage)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }
              : {}),
          }}
        >
          {sortedElements.map((element) => (
            <ArtifactElement
              key={element.id}
              element={element}
              editorMode={isEditor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
