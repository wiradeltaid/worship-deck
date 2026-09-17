import type { CanvasElement } from './types';

export interface CanvasClipboardItem {
  sourceSlideId?: string;
  element: CanvasElement;
}

export function setCanvasClipboard(items: CanvasClipboardItem[]): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('wpw_canvas_clipboard', JSON.stringify(items));
    }
  } catch {}
}

export function getCanvasClipboard(): CanvasClipboardItem[] | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem('wpw_canvas_clipboard');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as CanvasClipboardItem[]) : null;
    }
  } catch {}
  return null;
}
