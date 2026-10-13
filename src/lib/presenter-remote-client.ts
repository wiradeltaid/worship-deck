import type { SlideTransition } from './transitions';
import type { PresentMessage, ProjectedSource } from './present-channel';
import { paginateScriptureVerses } from './scripture-format';
import type { GuestFeedUiState, FrameHealthStatus } from '@/operator/present/presenter-guest-feed-controller';

export type PresenterRemoteIntent =
  | {
      type: 'sync';
      index: number;
      blank: boolean;
      transition: SlideTransition;
      background?: string | null;
      planIdentity: string;
    }
  | { type: 'blank'; blank: boolean; planIdentity: string }
  | { type: 'transition'; transition: SlideTransition; planIdentity: string }
  | {
      type: 'background';
      background: string | null;
      planIdentity: string;
    }
  | {
      type: 'scripture';
      reference: string;
      text: string;
      verses?: Array<{ verse: number; text: string }>;
      is_whole_chapter?: boolean;
      mode?: 'per-verse' | 'inline';
      pageIndex?: number;
      planIdentity: string;
    }
  | { type: 'clear-scripture'; planIdentity: string }
  | { type: 'media-play'; planIdentity: string }
  | { type: 'media-pause'; planIdentity: string }
  | { type: 'media-stop'; planIdentity: string }
  | { type: 'media-fade'; planIdentity: string }
  | { type: 'media-seek'; timeSeconds: number; planIdentity: string }
  | { type: 'media-toggle-project'; planIdentity: string }
  | { type: 'media-select-item'; id: string; planIdentity: string }
  | { type: 'media-reorder-item'; id: string; direction: 'up' | 'down'; planIdentity: string }
  | { type: 'media-set-volume'; volume: number; planIdentity: string }
  | { type: 'media-set-mute'; muted: boolean; planIdentity: string }
  | { type: 'media-toggle-shuffle'; planIdentity: string }
  | { type: 'media-cycle-repeat'; planIdentity: string }
  | { type: 'guest-arm'; planIdentity: string }
  | { type: 'guest-disarm'; planIdentity: string }
  | { type: 'guest-project'; projected: boolean; planIdentity: string }
  | { type: 'request-reopen-projector'; planIdentity: string };

export interface PresenterActionHandlers {
  setIndexAndSync: (index: number) => Promise<boolean | void> | boolean | void;
  setBlankAndSync: (blank: boolean) => void;
  setTransitionAndSync: (transition: SlideTransition) => void;
  setBackgroundAndSync: (background: string | null) => void;
  setScriptureAndSync?: (data: {
    reference: string;
    text: string;
    verses?: Array<{ verse: number; text: string }>;
    mode?: 'per-verse' | 'inline';
    is_whole_chapter?: boolean;
    pageIndex?: number;
  }) => void;
  clearScriptureAndSync?: () => void;
  broadcast: (msg: PresentMessage) => void;
  handleMediaPlay?: () => void;
  handleMediaPause?: () => void;
  handleMediaStop?: () => void;
  handleMediaFade?: () => void;
  handleMediaSeek?: (timeSeconds: number) => void;
  handleMediaToggleProject?: () => void;
  handleMediaSelectItem?: (id: string) => void;
  handleMediaReorderItem?: (id: string, direction: 'up' | 'down') => void;
  handleMediaSetVolume?: (volume: number) => void;
  handleMediaSetMute?: (muted: boolean) => void;
  handleMediaToggleShuffle?: () => void;
  handleMediaCycleRepeat?: () => void;
  handleGuestArm?: () => void;
  handleGuestDisarm?: () => void;
  handleGuestProject?: (projected: boolean) => void;
  handleRequestReopenProjector?: () => void;
}

/**
 * Applies an arriving remote intent by calling the local presenter handler methods.
 *
 * Rules:
 * 1. An arriving intent calls the exact same handler function as local UI/key presses.
 * 2. If the intent's planIdentity does not match current planIdentity, the intent is refused
 *    and the deck does not move (AD-10 / Story 5-2 AC-2).
 * 3. Returns true if the intent was applied, false if refused or unrecognized.
 */
export function applyRemoteIntent(
  rawIntent: unknown,
  currentPlanIdentity: string,
  handlers: PresenterActionHandlers
): Promise<boolean> | boolean {
  if (!rawIntent || typeof rawIntent !== 'object') {
    return false;
  }

  const intent = rawIntent as Partial<PresenterRemoteIntent>;
  if (typeof intent.planIdentity !== 'string' || intent.planIdentity !== currentPlanIdentity) {
    return false;
  }

  switch (intent.type) {
    case 'sync': {
      if (typeof intent.index === 'number') {
        const res = handlers.setIndexAndSync(intent.index);
        if (res instanceof Promise) {
          return res.then((ok) => ok !== false);
        }
        return res !== false;
      }
      return false;
    }
    case 'blank': {
      if (typeof intent.blank === 'boolean') {
        handlers.setBlankAndSync(intent.blank);
        return true;
      }
      return false;
    }
    case 'transition': {
      if (typeof intent.transition === 'string') {
        handlers.setTransitionAndSync(intent.transition as SlideTransition);
        return true;
      }
      return false;
    }
    case 'background': {
      if (intent.background === null || typeof intent.background === 'string') {
        handlers.setBackgroundAndSync(intent.background ?? null);
        return true;
      }
      return false;
    }
    case 'scripture': {
      if (typeof intent.reference === 'string' && typeof intent.text === 'string') {
        const verses = Array.isArray((intent as any).verses)
          ? (intent as any).verses
          : [{ verse: 1, text: intent.text }];
        const rawMode = (intent as any).mode;
        const explicitMode: 'per-verse' | 'inline' | undefined =
          rawMode === 'inline' || rawMode === 'per-verse' ? rawMode : undefined;
        const isWholeChapter = Boolean((intent as any).is_whole_chapter || !intent.reference.includes(':'));
        const typographyMode =
          (intent as any).typographyMode ||
          (isWholeChapter || verses.length > 4 ? 'chapter' : 'verse');
        const pageIndex =
          typeof (intent as any).pageIndex === 'number' && (intent as any).pageIndex >= 0
            ? (intent as any).pageIndex
            : 0;

        if (typeof handlers.setScriptureAndSync === 'function') {
          handlers.setScriptureAndSync({
            reference: intent.reference,
            text: intent.text,
            verses,
            mode: explicitMode,
            is_whole_chapter: isWholeChapter,
            pageIndex,
          });
          return true;
        }

        // Normalize incoming remote scripture through the canonical visual line-budget paginator
        const fallbackMode = explicitMode || 'per-verse';
        const chunks = paginateScriptureVerses(intent.reference, verses, fallbackMode, typographyMode);
        const activeChunk = chunks[pageIndex] || chunks[0] || {
          page: 1,
          totalPages: 1,
          verses,
          text: intent.text,
          displayReference: intent.reference,
          typographyMode,
          isContinuation: false,
          continuationIndex: 1,
          continuationCount: 1,
        };

        handlers.broadcast({
          type: 'scripture',
          reference: intent.reference,
          displayReference: activeChunk.displayReference,
          text: activeChunk.text,
          mode: fallbackMode,
          verses: activeChunk.verses,
          currentPage: activeChunk.page,
          totalPages: activeChunk.totalPages,
          typographyMode: activeChunk.typographyMode,
          isContinuation: activeChunk.isContinuation,
          continuationIndex: activeChunk.continuationIndex,
          continuationCount: activeChunk.continuationCount,
          planIdentity: currentPlanIdentity,
        });
        return true;
      }
      return false;
    }
    case 'clear-scripture': {
      if (typeof handlers.clearScriptureAndSync === 'function') {
        handlers.clearScriptureAndSync();
        return true;
      }
      handlers.broadcast({
        type: 'clear-scripture',
        planIdentity: currentPlanIdentity,
      });
      return true;
    }
    case 'media-play': {
      if (typeof handlers.handleMediaPlay === 'function') {
        handlers.handleMediaPlay();
        return true;
      }
      return false;
    }
    case 'media-pause': {
      if (typeof handlers.handleMediaPause === 'function') {
        handlers.handleMediaPause();
        return true;
      }
      return false;
    }
    case 'media-stop': {
      if (typeof handlers.handleMediaStop === 'function') {
        handlers.handleMediaStop();
        return true;
      }
      return false;
    }
    case 'media-fade': {
      if (typeof handlers.handleMediaFade === 'function') {
        handlers.handleMediaFade();
        return true;
      }
      return false;
    }
    case 'media-seek': {
      if (
        typeof intent.timeSeconds === 'number' &&
        Number.isFinite(intent.timeSeconds) &&
        intent.timeSeconds >= 0 &&
        typeof handlers.handleMediaSeek === 'function'
      ) {
        handlers.handleMediaSeek(intent.timeSeconds);
        return true;
      }
      return false;
    }
    case 'media-toggle-project': {
      if (typeof handlers.handleMediaToggleProject === 'function') {
        handlers.handleMediaToggleProject();
        return true;
      }
      return false;
    }
    case 'media-select-item': {
      if (
        typeof intent.id === 'string' &&
        intent.id.trim() &&
        typeof handlers.handleMediaSelectItem === 'function'
      ) {
        handlers.handleMediaSelectItem(intent.id.trim());
        return true;
      }
      return false;
    }
    case 'media-reorder-item': {
      if (
        typeof intent.id === 'string' &&
        intent.id.trim() &&
        (intent.direction === 'up' || intent.direction === 'down') &&
        typeof handlers.handleMediaReorderItem === 'function'
      ) {
        handlers.handleMediaReorderItem(intent.id.trim(), intent.direction);
        return true;
      }
      return false;
    }
    case 'media-set-volume': {
      if (
        typeof intent.volume === 'number' &&
        Number.isFinite(intent.volume) &&
        intent.volume >= 0 &&
        intent.volume <= 1 &&
        typeof handlers.handleMediaSetVolume === 'function'
      ) {
        handlers.handleMediaSetVolume(intent.volume);
        return true;
      }
      return false;
    }
    case 'media-set-mute': {
      if (
        typeof intent.muted === 'boolean' &&
        typeof handlers.handleMediaSetMute === 'function'
      ) {
        handlers.handleMediaSetMute(intent.muted);
        return true;
      }
      return false;
    }
    case 'media-toggle-shuffle': {
      if (typeof handlers.handleMediaToggleShuffle === 'function') {
        handlers.handleMediaToggleShuffle();
        return true;
      }
      return false;
    }
    case 'media-cycle-repeat': {
      if (typeof handlers.handleMediaCycleRepeat === 'function') {
        handlers.handleMediaCycleRepeat();
        return true;
      }
      return false;
    }
    case 'guest-arm': {
      if (typeof handlers.handleGuestArm === 'function') {
        handlers.handleGuestArm();
        return true;
      }
      return false;
    }
    case 'guest-disarm': {
      if (typeof handlers.handleGuestDisarm === 'function') {
        handlers.handleGuestDisarm();
        return true;
      }
      return false;
    }
    case 'guest-project': {
      if (
        typeof intent.projected === 'boolean' &&
        typeof handlers.handleGuestProject === 'function'
      ) {
        handlers.handleGuestProject(intent.projected);
        return true;
      }
      return false;
    }
    case 'request-reopen-projector': {
      if (typeof handlers.handleRequestReopenProjector === 'function') {
        handlers.handleRequestReopenProjector();
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

export type PresenterRemoteConnectionState =
  | 'idle'
  | 'pairing'
  | 'connected'
  | 'role-lost'
  | 'error';

export interface PresenterRemoteSessionOptions {
  serviceId: number;
  getPlanIdentity: () => string;
  handlers: PresenterActionHandlers;
  onCode?: (code: string, expiresIn: number) => void;
  onStateChange?: (state: PresenterRemoteConnectionState) => void;
}

/**
 * Manages the presenting client's pairing code and incoming SSE stream.
 * Connects on start, handles incoming intents, and cleans up on stop.
 * Strictly stateless regarding queue/retry: no queue, no replay, no buffer (SCN-6).
 */
export class PresenterRemoteSession {
  private serviceId: number;
  private getPlanIdentity: () => string;
  private handlers: PresenterActionHandlers;
  private onCode?: (code: string, expiresIn: number) => void;
  private onStateChange?: (state: PresenterRemoteConnectionState) => void;
  private eventSource: EventSource | null = null;
  private abortController: AbortController | null = null;
  private queue: Promise<void> = Promise.resolve();
  private generation = 0;
  private startRequestedEpoch = 0;
  private stopEpoch = 0;
  private stopped = false;

  constructor(options: PresenterRemoteSessionOptions) {
    this.serviceId = options.serviceId;
    this.getPlanIdentity = options.getPlanIdentity;
    this.handlers = options.handlers;
    this.onCode = options.onCode;
    this.onStateChange = options.onStateChange;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.then(
      () => {},
      () => {}
    );
    return next;
  }

  public async start(): Promise<void> {
    this.stopped = false;
    const epoch = ++this.startRequestedEpoch;
    return this.enqueue(async () => {
      if (epoch <= this.stopEpoch) {
        return;
      }
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }
      const controller = new AbortController();
      this.abortController = controller;
      const gen = ++this.generation;

      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      this.onStateChange?.('pairing');
      try {
        const res = await fetch(`/api/present/${this.serviceId}/remote/pair`, {
          method: 'POST',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (this.stopped || epoch <= this.stopEpoch || this.generation !== gen) return;
        if (!res.ok) {
          this.onStateChange?.('error');
          return;
        }
        const body = (await res.json()) as { code?: string; expiresIn?: number };
        if (this.stopped || epoch <= this.stopEpoch || this.generation !== gen) return;
        if (body.code) {
          this.onCode?.(body.code, body.expiresIn ?? 60);
        }
        this.openStream(gen);
      } catch (err: unknown) {
        if (this.stopped || epoch <= this.stopEpoch || this.generation !== gen) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        this.onStateChange?.('error');
      }
    });
  }

  private openStream(gen: number): void {
    if (this.stopped || this.generation !== gen) return;
    if (typeof EventSource === 'undefined') return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const url = `/api/present/${this.serviceId}/remote/stream?role=presenter`;
    const es = new EventSource(url, { withCredentials: true });
    this.eventSource = es;

    es.onopen = () => {
      if (this.stopped || this.generation !== gen || this.eventSource !== es) return;
      this.onStateChange?.('connected');
    };

    es.onmessage = async (event) => {
      if (this.stopped || this.generation !== gen || this.eventSource !== es) return;
      try {
        const data = JSON.parse(event.data);
        await applyRemoteIntent(data, this.getPlanIdentity(), this.handlers);
      } catch {
        // Ignore unparseable data
      }
    };

    es.onerror = () => {
      if (this.stopped || this.generation !== gen || this.eventSource !== es) return;
      this.onStateChange?.('role-lost');
      es.close();
      if (this.eventSource === es) {
        this.eventSource = null;
      }
    };
  }

  public stop(): void {
    this.stopped = true;
    this.stopEpoch = this.startRequestedEpoch;
    this.generation++;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.onStateChange?.('idle');
  }

  /**
   * Revokes the pairing session server-side via DELETE /pair,
   * closes local stream listeners, and transitions state to idle.
   */
  public async disconnect(): Promise<void> {
    this.stop();
    return this.enqueue(async () => {
      try {
        await fetch(`/api/present/${this.serviceId}/remote/pair`, {
          method: 'DELETE',
          credentials: 'same-origin',
        });
      } catch {
        // Ignore network error on teardown
      }
    });
  }

  /**
   * Broadcasts live presentation and media state updates to paired remote client(s).
   */
  public async broadcastState(state: Partial<RemoteControlSessionState>): Promise<void> {
    return this.enqueue(async () => {
      try {
        const res = await fetch(`/api/present/${this.serviceId}/remote/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(state),
        });
        await res.text().catch(() => {});
      } catch {
        // Ignore network error on broadcast
      }
    });
  }
}

export type RemoteControlSessionState = {
  index?: number;
  blank?: boolean;
  transition?: SlideTransition;
  background?: string | null;
  planIdentity?: string;
  presentationLock?: boolean;
  media?: {
    activeId?: string | null;
    isPlaying?: boolean;
    isProjected?: boolean;
    currentTime?: number;
    duration?: number;
    shuffle?: boolean;
    repeatMode?: 'off' | 'all' | 'one';
    volume?: number;
    isMuted?: boolean;
  };
  scripture?: {
    reference: string;
    text: string;
    verses?: Array<{ verse: number; text: string }>;
    mode?: 'per-verse' | 'inline';
    is_whole_chapter?: boolean;
    pageIndex?: number;
    totalPages?: number;
  } | null;
  guestFeed?: {
    uiState: GuestFeedUiState;
    projection: ProjectedSource;
    frameHealth: FrameHealthStatus;
    errorMessage: string | null;
  } | null;
  projector?: {
    hasOpen: boolean;
  } | null;
};

export type RemoteControlConnectionState =
  | 'idle'
  | 'claiming'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export interface RemoteControlSessionOptions {
  serviceId: number;
  onState: (state: RemoteControlSessionState) => void;
  onConnectionChange?: (state: RemoteControlConnectionState) => void;
  maxRetries?: number;
  retryDelayBaseMs?: number;
}

export class RemoteControlSession {
  private serviceId: number;
  private onState: (state: RemoteControlSessionState) => void;
  private onConnectionChange?: (state: RemoteControlConnectionState) => void;
  private maxRetries: number;
  private retryDelayBaseMs: number;
  private eventSource: EventSource | null = null;
  private stopped = false;
  private generation = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: RemoteControlSessionOptions) {
    this.serviceId = options.serviceId;
    this.onState = options.onState;
    this.onConnectionChange = options.onConnectionChange;
    this.maxRetries = options.maxRetries ?? 5;
    this.retryDelayBaseMs = options.retryDelayBaseMs ?? 1000;
  }

  public async checkPairStatus(): Promise<{ paired: boolean; hasGrant: boolean }> {
    try {
      const res = await fetch(`/api/present/${this.serviceId}/remote/pair`, {
        credentials: 'same-origin',
      });
      if (res.ok) {
        const body = (await res.json()) as { paired?: boolean; has_grant?: boolean };
        return {
          paired: Boolean(body?.paired),
          hasGrant: Boolean(body?.has_grant),
        };
      }
      return { paired: false, hasGrant: false };
    } catch {
      return { paired: false, hasGrant: false };
    }
  }

  public async claim(code: string): Promise<{ ok: boolean; error?: string }> {
    this.stopped = false;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.onConnectionChange?.('claiming');
    try {
      const res = await fetch(`/api/present/${this.serviceId}/remote/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
        credentials: 'same-origin',
      });
      if (!res.ok) {
        this.onConnectionChange?.('error');
        return { ok: false, error: res.status === 409 ? 'conflict' : 'invalid' };
      }
      const data = (await res.json()) as { paired?: boolean; state?: RemoteControlSessionState };
      if (data.state) {
        this.onState(data.state);
      }
      this.openStream();
      return { ok: true };
    } catch {
      this.onConnectionChange?.('error');
      return { ok: false, error: 'network' };
    }
  }

  public reconnect(): void {
    if (this.stopped) return;
    this.clearReconnectTimer();
    this.openStream();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private openStream(): void {
    if (this.stopped) return;
    if (typeof EventSource === 'undefined') return;

    this.generation++;
    const currentGen = this.generation;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const url = `/api/present/${this.serviceId}/remote/stream?role=remote`;
    const es = new EventSource(url, { withCredentials: true });
    this.eventSource = es;

    es.onopen = () => {
      if (this.stopped || currentGen !== this.generation) {
        es.close();
        return;
      }
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();
      this.onConnectionChange?.('connected');
    };

    es.onmessage = (event) => {
      if (this.stopped || currentGen !== this.generation) return;
      try {
        const data = JSON.parse(event.data) as RemoteControlSessionState;
        this.onState(data);
      } catch {
        // Ignore unparseable data
      }
    };

    es.onerror = async () => {
      if (this.stopped || currentGen !== this.generation) {
        es.close();
        return;
      }
      es.close();
      if (this.eventSource === es) {
        this.eventSource = null;
      }

      // Check pairing status to decide whether to reconnect directly without re-pairing
      let hasGrant = true;
      try {
        const res = await fetch(`/api/present/${this.serviceId}/remote/pair`, {
          credentials: 'same-origin',
        });
        if (res.ok) {
          const body = (await res.json()) as { paired?: boolean; has_grant?: boolean };
          if (body && body.has_grant === false) {
            hasGrant = false;
          }
        } else if (res.status === 401 || res.status === 403 || res.status === 404) {
          hasGrant = false;
        }
      } catch {
        // Network error — transient network blip; keep hasGrant true to attempt retry
      }

      if (this.stopped || currentGen !== this.generation) return;

      if (!hasGrant || this.reconnectAttempts >= this.maxRetries) {
        this.reconnectAttempts = 0;
        this.onConnectionChange?.('disconnected');
        return;
      }

      this.reconnectAttempts++;
      this.onConnectionChange?.('reconnecting');

      const delay = Math.min(
        this.retryDelayBaseMs * Math.pow(1.5, this.reconnectAttempts - 1),
        5000
      );
      this.clearReconnectTimer();
      this.reconnectTimer = setTimeout(() => {
        if (!this.stopped && currentGen === this.generation) {
          this.openStream();
        }
      }, delay);
    };
  }

  public async sendIntent(intent: PresenterRemoteIntent): Promise<boolean> {
    if (this.stopped) return false;
    try {
      const res = await fetch(`/api/present/${this.serviceId}/remote/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intent),
        credentials: 'same-origin',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public stop(): void {
    this.stopped = true;
    this.generation++;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.onConnectionChange?.('idle');
  }
}
