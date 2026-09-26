import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { getScriptureScaling, computeScriptureFitScale } from '@/lib/scripture-scaling';

export interface ScriptureOverlayViewProps {
  reference: string;
  text: string;
  style?: CSSProperties;
}

const SCRIPTURE_FIT_SCALE_VAR = '--scripture-fit-scale';

export default function ScriptureOverlayView({
  reference,
  text,
  style,
}: ScriptureOverlayViewProps) {
  const scaling = getScriptureScaling(text);
  const stageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!stage || !textEl) return;

    const applyFit = () => {
      textEl.style.setProperty(SCRIPTURE_FIT_SCALE_VAR, '1');
      const stageHeight = stage.clientHeight;
      const stageWidth = stage.clientWidth;
      if (stageHeight === 0 || stageWidth === 0) return;

      let contentWidth: number | undefined;
      let contentHeight: number | undefined;

      if (container && typeof window !== 'undefined') {
        const cs = window.getComputedStyle(container);
        const padX = parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0');
        const padY = parseFloat(cs.paddingTop || '0') + parseFloat(cs.paddingBottom || '0');
        contentWidth = Math.max(0, container.clientWidth - padX);
        contentHeight = Math.max(0, container.clientHeight - padY);
      }

      const scale = computeScriptureFitScale({
        stageHeight,
        stageWidth,
        naturalHeight: textEl.scrollHeight,
        naturalWidth: textEl.scrollWidth,
        containerHeight: contentHeight,
        containerWidth: contentWidth,
      });

      textEl.style.setProperty(SCRIPTURE_FIT_SCALE_VAR, String(scale));
    };

    applyFit();

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

    // Observe stageRef: its dimensions are governed strictly by 16:9 container geometry
    // and are 100% independent of inner text fitting, eliminating any ResizeObserver loop or oscillation!
    const observer = new ResizeObserver(applyFit);
    observer.observe(stage);
    return () => {
      cancelled = true;
      observer.disconnect();
      if (onFontLoaded && typeof document !== 'undefined' && 'fonts' in document && document.fonts) {
        document.fonts.removeEventListener('loadingdone', onFontLoaded);
      }
    };
  }, [text]);

  return (
    <div
      data-slot="scripture-overlay"
      className="flex h-full w-full items-center justify-center overflow-hidden bg-[#0B1220]"
      style={{ containerType: 'size', ...style }}
    >
      <div
        ref={stageRef}
        data-slot="scripture-stage"
        style={{
          position: 'relative',
          width: 'min(100cqw, calc(100cqh * 16 / 9))',
          height: 'min(100cqh, calc(100cqw * 9 / 16))',
          aspectRatio: '16 / 9',
          containerType: 'size',
          padding: 0,
          boxSizing: 'border-box',
        }}
        className="flex flex-col items-center justify-center text-center text-white select-none"
      >
        <div
          data-slot="scripture-stage-inner"
          style={{
            width: '88cqw',
            maxWidth: '88cqw',
            maxHeight: '100cqh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}
        >
          <p
            data-slot="scripture-reference"
            className="font-semibold tracking-wide text-[#D4A574]"
            style={{
              fontSize: 'clamp(14px, 3.2cqh, 24px)',
              marginBottom: '2cqh',
            }}
          >
            {reference}
          </p>
          <div
            ref={containerRef}
            data-slot="scripture-verse-container"
            className="flex max-h-[78cqh] w-full items-center justify-center overflow-hidden"
            style={{ minHeight: scaling.minHeightStyle, boxSizing: 'border-box' }}
          >
            <p
              ref={textRef}
              data-slot="scripture-text"
              className={`italic leading-relaxed text-balance ${scaling.tailwindClass}`}
              style={{
                fontSize: `calc(${scaling.fontSizeStyle} * var(${SCRIPTURE_FIT_SCALE_VAR}, 1))`,
                lineHeight: 1.35,
              }}
            >
              {text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
