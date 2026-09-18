import type { CSSProperties } from 'react';
import { getScriptureScaling } from '@/lib/scripture-scaling';

export interface ScriptureOverlayViewProps {
  reference: string;
  text: string;
  style?: CSSProperties;
}

export default function ScriptureOverlayView({
  reference,
  text,
  style,
}: ScriptureOverlayViewProps) {
  const scaling = getScriptureScaling(text);

  return (
    <div
      data-slot="scripture-overlay"
      className="flex h-full w-full items-center justify-center overflow-hidden bg-[#0B1220]"
      style={{ containerType: 'size', ...style }}
    >
      <div
        style={{
          position: 'relative',
          width: 'min(100cqw, calc(100cqh * 16 / 9))',
          maxHeight: '100cqh',
          aspectRatio: '16 / 9',
          containerType: 'size',
        }}
        className="flex flex-col items-center justify-center px-8 sm:px-12 text-center text-white select-none"
      >
        <p
          data-slot="scripture-reference"
          className="font-semibold tracking-wide text-[#D4A574]"
          style={{
            fontSize: 'clamp(0.85rem, 3.2cqh, 1.5rem)',
            marginBottom: 'clamp(0.5rem, 2cqh, 1.5rem)',
          }}
        >
          {reference}
        </p>
        <div
          className="flex max-h-[78cqh] w-full max-w-5xl items-center justify-center overflow-hidden px-4"
          style={{ minHeight: scaling.minHeightStyle }}
        >
          <p
            data-slot="scripture-text"
            className={`italic leading-relaxed text-balance ${scaling.tailwindClass}`}
            style={{
              fontSize: scaling.fontSizeStyle,
              lineHeight: 1.35,
            }}
          >
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
