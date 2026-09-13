import { useEffect, useRef, useState } from 'react';
import { elementToFabricObject } from '@/lib/registry/canvas-utils';
import ArtifactSlide from '@/components/artifacts/ArtifactSlide';
import {
  ARTIFACT_RUNTIME_VERSION,
  type ArtifactInstance,
} from '@/lib/artifacts/runtime-contract';
import type { ArtifactLayout, CanvasElement } from '@/lib/registry/types';

declare global {
  interface Window {
    __LAYOUT__?: ArtifactLayout;
    __SET_LAYOUT__?: (layout: ArtifactLayout) => Promise<void>;
    __READY__?: boolean;
    __FABRIC__?: Record<string, any>;
    __CSS__?: Record<string, any>;
    __STAGE__?: { width: number; height: number };
  }
}

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

export default function ParityDiagnosticPage() {
  const [layout, setLayout] = useState<ArtifactLayout | null>(() => window.__LAYOUT__ ?? null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<any>(null);

  useEffect(() => {
    window.__SET_LAYOUT__ = async (newLayout: ArtifactLayout) => {
      window.__READY__ = false;
      setLayout(newLayout);
    };
  }, []);

  useEffect(() => {
    if (!layout || !canvasElRef.current) return;

    let isCurrent = true;

    async function renderAndMeasure() {
      if (!layout || !canvasElRef.current) return;

      const fabric = await import('fabric');
      (window as any).__FABRIC_LIB__ = fabric;

      // 1. Setup Fabric Canvas
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
      }

      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: layout.backgroundColor || '#000000',
        preserveObjectStacking: true,
      });
      fabricCanvasRef.current = canvas;

      if (layout.backgroundImage) {
        try {
          const bg = await fabric.FabricImage.fromURL(layout.backgroundImage, { crossOrigin: 'anonymous' });
          if (isCurrent) {
            bg.set({
              left: 0,
              top: 0,
              scaleX: CANVAS_WIDTH / (bg.width || CANVAS_WIDTH),
              scaleY: CANVAS_HEIGHT / (bg.height || CANVAS_HEIGHT),
              selectable: false,
              evented: false,
            });
            canvas.backgroundImage = bg;
          }
        } catch {
          // ignore bg image load error
        }
      }

      if (typeof document !== 'undefined' && 'fonts' in document && document.fonts?.ready) {
        await document.fonts.ready;
      }

      if (!isCurrent) return;

      const fabricObjects: Record<string, any> = {};
      const sorted = (layout.elements || []).slice().sort((a: CanvasElement, b: CanvasElement) => a.zIndex - b.zIndex);
      for (const el of sorted) {
        const obj = elementToFabricObject(fabric, el, false);
        canvas.add(obj);
        fabricObjects[el.id] = obj;
      }
      canvas.renderAll();

      const fabricOut: Record<string, any> = {};
      for (const [id, o] of Object.entries(fabricObjects)) {
        const br = o.getBoundingRect();
        fabricOut[id] = {
          authoredLeft: o.left,
          authoredTop: o.top,
          width: o.width,
          height: o.height,
          scaleX: o.scaleX ?? 1,
          scaleY: o.scaleY ?? 1,
          boundingRect: { left: br.left, top: br.top, width: br.width, height: br.height },
          textLines: o.textLines ? o.textLines.slice() : undefined,
          calcTextHeight: typeof o.calcTextHeight === 'function' ? o.calcTextHeight() : undefined,
          lineWidths: o.textLines ? o.textLines.map((_: any, i: number) => o.getLineWidth(i)) : undefined,
          fontSize: o.fontSize,
          fitScale: o.data?.fitScale ?? 1,
          hasClipPath: Boolean(o.clipPath),
          clipHeight: (o.clipPath as any)?.height,
        };
      }

      // Wait a tick for React to finish rendering and ArtifactSlide's useLayoutEffect to run
      await new Promise((r) => setTimeout(r, 60));
      if (!isCurrent) return;

      const cssPane = document.getElementById('cssPane');
      const stageRect = cssPane ? cssPane.getBoundingClientRect() : { left: 0, top: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
      const cssOut: Record<string, any> = {};

      for (const el of layout.elements || []) {
        const boxEl = document.querySelector(`[data-element-id="${el.id}"]`) as HTMLElement | null;
        if (!boxEl) continue;
        const br = boxEl.getBoundingClientRect();
        let contentInfo: any = null;

        if (el.type === 'text') {
          const contentEl = boxEl.firstElementChild as HTMLElement | null;
          if (contentEl) {
            const range = document.createRange();
            range.selectNodeContents(contentEl);
            const rawRects = Array.from(range.getClientRects());
            // Filter zero-size trailing rects and cluster lines by vertical position
            const lineRects: Array<{ left: number; top: number; width: number; height: number }> = [];
            for (const r of rawRects) {
              const relTop = r.top - stageRect.top;
              const midY = relTop + r.height / 2;
              if (!lineRects.some((l) => Math.abs(l.top + l.height / 2 - midY) < 5)) {
                lineRects.push({
                  left: r.left - stageRect.left,
                  top: relTop,
                  width: r.width,
                  height: r.height,
                });
              }
            }
            contentInfo = {
              scrollWidth: contentEl.scrollWidth,
              scrollHeight: contentEl.scrollHeight,
              fitScale: contentEl.style.getPropertyValue('--artifact-fit-scale') || '1',
              computedFontSize: window.getComputedStyle(contentEl).fontSize,
              lineRects,
            };
          }
        }

        cssOut[el.id] = {
          box: {
            left: br.left - stageRect.left,
            top: br.top - stageRect.top,
            width: br.width,
            height: br.height,
          },
          content: contentInfo,
        };
      }

      window.__FABRIC__ = fabricOut;
      window.__CSS__ = cssOut;
      window.__STAGE__ = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
      window.__READY__ = true;
    }

    renderAndMeasure();

    return () => {
      isCurrent = false;
    };
  }, [layout]);

  const instance: ArtifactInstance | null = layout
    ? {
        runtimeVersion: ARTIFACT_RUNTIME_VERSION,
        instanceId: 'parity-instance',
        templateId: 'parity-tpl',
        label: 'Parity Test',
        baseType: 'general',
        layoutKey: 'default',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: layout.backgroundColor || '#000000',
          backgroundImage: layout.backgroundImage,
          elements: (layout.elements || []).map((el: CanvasElement) => ({
            id: el.id,
            type: el.type,
            x: el.x,
            y: el.y,
            w: el.w,
            h: el.h,
            zIndex: el.zIndex,
            text: el.content,
            imageUrl: el.imageRef || (el.type === 'image-placeholder' ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>' : undefined),
            style: el.style || {},
            wrapLines: el.wrapLines,
          })),
        },
      }
    : null;

  return (
    <div style={{ margin: 0, padding: 0, background: '#222', width: 960 }}>
      <div id="fabricPane" style={{ width: 960, height: 540, position: 'relative' }}>
        <canvas ref={canvasElRef} width={960} height={540} />
      </div>
      <div id="cssPane" style={{ width: 960, height: 540, position: 'relative' }}>
        {instance && <ArtifactSlide instance={instance} />}
      </div>
    </div>
  );
}
