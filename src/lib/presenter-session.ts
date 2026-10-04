import type { ScriptureOverlay } from './present-channel';
import { SLIDE_TRANSITIONS, type SlideTransition } from './transitions';

export const PRESENTER_SESSION_STORAGE_PREFIX = 'worship_deck_present_';
export const PRESENTER_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours
export const PRESENTER_SESSION_FUTURE_TOLERANCE_MS = 60 * 1000; // 60 seconds

export interface PresenterSavedSessionV1 {
  version: 1;
  planIdentity: string;
  updatedAt: number;
  activeSessionId: string;
  index: number;
  blank: boolean;
  scriptureOverlay: ScriptureOverlay | null;
  loadedScripture: {
    reference: string;
    verses: Array<{ verse: number; text: string }>;
    typographyMode: 'chapter' | 'verse';
  } | null;
  scripturePageIndex: number;
  liveTransition?: SlideTransition;
  liveBackground?: string | null;
}

export interface PeekPresenterSessionResult {
  hasSession: boolean;
  slideNumber: number;
  isBlank: boolean;
  hasScripture: boolean;
}

export function getPresenterStorageKey(serviceId: number | string): string {
  return `${PRESENTER_SESSION_STORAGE_PREFIX}${serviceId}`;
}

export function isValidSlideTransition(val: any): val is SlideTransition {
  return typeof val === 'string' && (SLIDE_TRANSITIONS as readonly string[]).includes(val);
}

export function isValidScriptureOverlay(o: any): o is ScriptureOverlay {
  return (
    o !== null &&
    typeof o === 'object' &&
    typeof o.reference === 'string' &&
    o.reference.trim().length > 0 &&
    typeof o.text === 'string' &&
    o.text.trim().length > 0
  );
}

function safeGetStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // In private browsing or storage disabled
  }
  return null;
}

export function loadPresenterSession(
  serviceId: number | string,
  currentPlanIdentity: string,
  planLength: number
): PresenterSavedSessionV1 | null {
  const storage = safeGetStorage();
  if (!storage) return null;

  const key = getPresenterStorageKey(serviceId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      storage.removeItem(key);
      return null;
    }

    // Plan identity matching
    if (typeof parsed.planIdentity !== 'string' || parsed.planIdentity !== currentPlanIdentity) {
      storage.removeItem(key);
      return null;
    }

    // Expiration and future clock skew check
    const now = Date.now();
    const updatedAt = Number(parsed.updatedAt);
    if (
      !Number.isFinite(updatedAt) ||
      now - updatedAt > PRESENTER_SESSION_MAX_AGE_MS ||
      updatedAt > now + PRESENTER_SESSION_FUTURE_TOLERANCE_MS
    ) {
      storage.removeItem(key);
      return null;
    }

    // Sanitization & Clamping
    const rawIndex = Number(parsed.index);
    const safeIndex = Number.isFinite(rawIndex)
      ? Math.max(0, Math.min(Math.floor(rawIndex), Math.max(0, planLength - 1)))
      : 0;

    const blank = typeof parsed.blank === 'boolean' ? parsed.blank : false;
    const activeSessionId = typeof parsed.activeSessionId === 'string' ? parsed.activeSessionId : '';

    let liveTransition: SlideTransition | undefined = undefined;
    if (isValidSlideTransition(parsed.liveTransition)) {
      liveTransition = parsed.liveTransition;
    }

    let liveBackground: string | null | undefined = undefined;
    if (parsed.liveBackground === null || typeof parsed.liveBackground === 'string') {
      liveBackground = parsed.liveBackground;
    }

    let scriptureOverlay: ScriptureOverlay | null = null;
    if (isValidScriptureOverlay(parsed.scriptureOverlay)) {
      const o = parsed.scriptureOverlay;
      const mode: 'per-verse' | 'inline' = o.mode === 'inline' ? 'inline' : 'per-verse';
      const verses = Array.isArray(o.verses)
        ? o.verses.map((v: any) => ({
            verse: Number(v?.verse) || 1,
            text: String(v?.text || ''),
          }))
        : [];
      scriptureOverlay = {
        reference: o.reference,
        displayReference: typeof o.displayReference === 'string' ? o.displayReference : o.reference,
        text: o.text,
        mode,
        verses,
        currentPage: typeof o.currentPage === 'number' ? Math.max(1, o.currentPage) : 1,
        totalPages: typeof o.totalPages === 'number' ? Math.max(1, o.totalPages) : 1,
        typographyMode: o.typographyMode === 'chapter' ? 'chapter' : 'verse',
        isContinuation: Boolean(o.isContinuation),
        continuationIndex: typeof o.continuationIndex === 'number' ? o.continuationIndex : 0,
        continuationCount: typeof o.continuationCount === 'number' ? o.continuationCount : 1,
        estimatedVisualLines: typeof o.estimatedVisualLines === 'number' ? o.estimatedVisualLines : undefined,
      };
    }

    let loadedScripture: PresenterSavedSessionV1['loadedScripture'] = null;
    if (parsed.loadedScripture && typeof parsed.loadedScripture === 'object') {
      const ls = parsed.loadedScripture;
      if (typeof ls.reference === 'string' && Array.isArray(ls.verses)) {
        loadedScripture = {
          reference: ls.reference,
          verses: ls.verses.map((v: any) => ({
            verse: Number(v?.verse) || 1,
            text: String(v?.text || ''),
          })),
          typographyMode: ls.typographyMode === 'verse' ? 'verse' : 'chapter',
        };
      }
    }

    const rawPageIndex = Number(parsed.scripturePageIndex);
    const scripturePageIndex = Number.isFinite(rawPageIndex) ? Math.max(0, Math.floor(rawPageIndex)) : 0;

    return {
      version: 1,
      planIdentity: currentPlanIdentity,
      updatedAt,
      activeSessionId,
      index: safeIndex,
      blank,
      scriptureOverlay,
      loadedScripture,
      scripturePageIndex,
      liveTransition,
      liveBackground,
    };
  } catch {
    return null;
  }
}

export function savePresenterSession(
  serviceId: number | string,
  session: Omit<PresenterSavedSessionV1, 'version' | 'updatedAt'>
): void {
  const storage = safeGetStorage();
  if (!storage) return;

  const key = getPresenterStorageKey(serviceId);
  try {
    const payload: PresenterSavedSessionV1 = {
      ...session,
      version: 1,
      updatedAt: Date.now(),
    };
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // QuotaExceededError or security block
  }
}

export function clearPresenterSession(serviceId: number | string): void {
  const storage = safeGetStorage();
  if (!storage) return;

  const key = getPresenterStorageKey(serviceId);
  try {
    storage.removeItem(key);
  } catch {
    // Safe swallow
  }
}

export function peekPresenterSession(
  serviceId: number | string,
  currentPlanIdentity: string
): PeekPresenterSessionResult {
  const defaultRes: PeekPresenterSessionResult = {
    hasSession: false,
    slideNumber: 1,
    isBlank: false,
    hasScripture: false,
  };

  if (!currentPlanIdentity) return defaultRes;

  const storage = safeGetStorage();
  if (!storage) return defaultRes;

  const key = getPresenterStorageKey(serviceId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return defaultRes;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return defaultRes;
    }

    if (parsed.planIdentity !== currentPlanIdentity) {
      return defaultRes;
    }

    const now = Date.now();
    const updatedAt = Number(parsed.updatedAt);
    if (
      !Number.isFinite(updatedAt) ||
      now - updatedAt > PRESENTER_SESSION_MAX_AGE_MS ||
      updatedAt > now + PRESENTER_SESSION_FUTURE_TOLERANCE_MS
    ) {
      return defaultRes;
    }

    const index = Number(parsed.index) || 0;
    const isBlank = typeof parsed.blank === 'boolean' ? parsed.blank : false;
    const hasScripture = isValidScriptureOverlay(parsed.scriptureOverlay);

    // Active session if advanced past slide 0, or blanked, or scripture overlay active
    const hasSession = index > 0 || isBlank || hasScripture;

    return {
      hasSession,
      slideNumber: Math.max(1, Math.floor(index) + 1),
      isBlank,
      hasScripture,
    };
  } catch {
    return defaultRes;
  }
}
