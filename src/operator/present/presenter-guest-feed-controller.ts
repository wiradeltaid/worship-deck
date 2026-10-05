/**
 * PresenterGuestFeedController — State machine and coordination for Guest Speaker HDMI Video feed.
 *
 * Implements SPEC-101 §§ 2–4:
 * 1. State machine: idle -> arming -> ready -> guest-pending -> confirmed-live.
 * 2. Strict gating: Switch requires healthy master, visible preview, and responding named projector.
 * 3. Diagnostic attempt correlation: Issues fresh guestAttemptId on Switch and before reload/relocate.
 * 4. Telemetry admission: Admits projector-media-status only matching current session and attempt.
 * 5. 5-second attach deadline: Auto-reverts to Deck if attached is not received within 5s.
 * 6. Exclusivity: Scripture display/paging automatically reverts guest to Deck in one complete sync.
 * 7. Keyboard admission: Escape panics pending/live anywhere; G is revert-only and respects editable/composition.
 */

import {
  type ProjectedSource,
  type ProjectorMediaStatusMessage,
  isProjectorMediaStatus,
} from '@/lib/present-channel';
import {
  CaptureBroker,
  type CaptureBrokerSnapshot,
  type CaptureDeviceOption,
} from '@/lib/capture-broker';

export type GuestFeedUiState =
  | 'idle'
  | 'arming'
  | 'ready'
  | 'guest-pending'
  | 'confirmed-live'
  | 'error';

export type FrameHealthStatus = 'healthy' | 'stalled' | 'unknown';

export interface PresenterGuestFeedSnapshot {
  uiState: GuestFeedUiState;
  projection: ProjectedSource;
  guestAttemptId: string | null;
  guestSessionId: string | null;
  selectedDeviceId: string | null;
  isDeviceStale: boolean;
  devices: Array<{ deviceId: string; label: string }>;
  frameHealth: FrameHealthStatus;
  errorMessage: string | null;
  isConsoleFocused: boolean;
}

export interface ControllerEnv {
  broker: CaptureBroker;
  broadcastSync: () => void;
  setTimeout?: (fn: () => void, ms: number) => any;
  clearTimeout?: (id: any) => void;
  now?: () => number;
  randomUUID?: () => string;
}

export class PresenterGuestFeedController {
  private broker: CaptureBroker;
  private broadcastSync: () => void;
  private envSetTimeout: (fn: () => void, ms: number) => any;
  private envClearTimeout: (id: any) => void;
  private envNow: () => number;
  private envRandomUUID: () => string;

  private uiState: GuestFeedUiState = 'idle';
  private projection: ProjectedSource = { kind: 'deck' };
  private guestAttemptId: string | null = null;
  private frameHealth: FrameHealthStatus = 'unknown';
  private errorMessage: string | null = null;
  private isConsoleFocused = true;

  private attachDeadlineTimer: any = null;
  private frameWatchdogTimer: any = null;
  private lastFrameTime = 0;
  private activeEnumerateGeneration = 0;
  private listeners = new Set<(snap: PresenterGuestFeedSnapshot) => void>();
  private unsubscribeBroker: (() => void) | null = null;

  constructor(env: ControllerEnv) {
    this.broker = env.broker;
    this.broadcastSync = env.broadcastSync;
<<<<<<< Updated upstream
    const timerTarget = typeof window !== 'undefined' ? window : globalThis;
    const rawSetTimeout =
      env.setTimeout ??
      (typeof window !== 'undefined' && typeof window.setTimeout === 'function'
        ? window.setTimeout
        : globalThis.setTimeout);
    const rawClearTimeout =
      env.clearTimeout ??
      (typeof window !== 'undefined' && typeof window.clearTimeout === 'function'
        ? window.clearTimeout
        : globalThis.clearTimeout);
    this.envSetTimeout = (fn: () => void, ms: number) => rawSetTimeout.call(timerTarget, fn, ms);
    this.envClearTimeout = (id: any) => rawClearTimeout.call(timerTarget, id);
=======
    const rawSetTimeout = env.setTimeout;
    const rawClearTimeout = env.clearTimeout;
    const timerTarget = typeof window !== 'undefined' ? window : globalThis;

    this.envSetTimeout = rawSetTimeout
      ? (fn: () => void, ms: number) => rawSetTimeout.call(timerTarget, fn, ms)
      : (fn: () => void, ms: number) => setTimeout(fn, ms);
    this.envClearTimeout = rawClearTimeout
      ? (id: any) => rawClearTimeout.call(timerTarget, id)
      : (id: any) => clearTimeout(id);
>>>>>>> Stashed changes
    this.envNow = env.now || (() => Date.now());
    this.envRandomUUID =
      env.randomUUID ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? () => crypto.randomUUID()
        : () => 'att_' + Math.random().toString(36).slice(2, 10));

    this.unsubscribeBroker = this.broker.subscribe((brokerSnap) => {
      this.handleBrokerSnapshot(brokerSnap);
    });
  }

  public getSnapshot(): PresenterGuestFeedSnapshot {
    const brokerSnap = this.broker.getSnapshot();
    return {
      uiState: this.uiState,
      projection: this.projection,
      guestAttemptId: this.guestAttemptId,
      guestSessionId: brokerSnap.guestSessionId,
      selectedDeviceId: brokerSnap.selectedDeviceId,
      isDeviceStale: brokerSnap.isDeviceStale,
      devices: brokerSnap.devices,
      frameHealth: this.frameHealth,
      errorMessage: this.errorMessage,
      isConsoleFocused: this.isConsoleFocused,
    };
  }

  public subscribe(listener: (snap: PresenterGuestFeedSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const l of this.listeners) {
      try {
        l(snap);
      } catch {
        // ignore
      }
    }
  }

  public setConsoleFocused(focused: boolean): void {
    this.isConsoleFocused = focused;
    this.notify();
  }

  public selectDevice(deviceId: string): void {
    this.errorMessage = null;
    this.broker.selectDevice(deviceId);
  }

  public async enumerateDevices(): Promise<CaptureDeviceOption[]> {
    const generation = ++this.activeEnumerateGeneration;
    try {
      const devices = await this.broker.enumerateDevices();
      if (generation === this.activeEnumerateGeneration) {
        this.errorMessage = null;
        this.notify();
      }
      return devices;
    } catch (err: any) {
      if (generation === this.activeEnumerateGeneration) {
        this.errorMessage = err?.message || 'Device enumeration failed';
        this.notify();
      }
      return [];
    }
  }

  public async requestPermission(): Promise<CaptureDeviceOption[]> {
    try {
      const devices = await this.broker.requestPermission();
      this.errorMessage = null;
      this.notify();
      return devices;
    } catch (err: any) {
      this.errorMessage = err?.message || 'Permission request failed';
      this.notify();
      return [];
    }
  }

  public async arm(deviceId?: string): Promise<void> {
    this.errorMessage = null;
    this.uiState = 'arming';
    this.notify();

    try {
      await this.broker.arm(deviceId);
      // Success handled in broker snapshot
    } catch (err: any) {
      console.error('Guest capture arm failed:', err);
      this.uiState = 'error';
      this.errorMessage = err?.message || 'Arm failed';
      this.notify();
    }
  }

  public disarm(): void {
    this.clearAttachDeadline();
    this.stopFrameWatchdog();

    // If currently projecting guest or waiting, return globally to Deck first
    if (this.uiState === 'guest-pending' || this.uiState === 'confirmed-live') {
      this.projection = { kind: 'deck' };
      this.guestAttemptId = null;
      this.broker.setAttemptId(null);
      this.broadcastSync();
    }

    this.broker.disarm();
    this.projection = { kind: 'deck' };
    this.guestAttemptId = null;
    this.uiState = 'idle';
    this.errorMessage = null;
    this.frameHealth = 'unknown';
    this.notify();
  }

  public switch(projectorResponding: boolean): void {
    if (this.uiState !== 'ready') {
      throw new Error(`Cannot switch to guest: broker is in '${this.uiState}' state (must be 'ready').`);
    }

    if (!projectorResponding) {
      throw new Error('Cannot switch to guest: congregation screen is not responding or not opened.');
    }

    const brokerSnap = this.broker.getSnapshot();
    if (!brokerSnap.guestSessionId) {
      throw new Error('Cannot switch to guest: no active guest session available.');
    }

    // Issue fresh guestAttemptId
    const attemptId = this.envRandomUUID();
    this.guestAttemptId = attemptId;
    this.broker.setAttemptId(attemptId);

    // Set projection intent to guest
    this.projection = {
      kind: 'guest',
      guestSessionId: brokerSnap.guestSessionId,
    };

    this.uiState = 'guest-pending';
    this.errorMessage = null;

    // Start 5-second attach deadline
    this.startAttachDeadline();

    // Broadcast complete sync
    this.broadcastSync();
    this.startFrameWatchdog();
    this.notify();
  }

  public revertToDeck(reason?: string): void {
    this.clearAttachDeadline();

    if (this.uiState === 'guest-pending' || this.uiState === 'confirmed-live') {
      this.projection = { kind: 'deck' };
      this.guestAttemptId = null;
      this.broker.setAttemptId(null);

      const brokerSnap = this.broker.getSnapshot();
      if (brokerSnap.state === 'ready') {
        this.uiState = 'ready';
      } else {
        this.uiState = 'idle';
      }

      this.broadcastSync();
      this.notify();
    }
  }

  public onScriptureAction(): void {
    // Exclusivity: entering scripture clears guest intent and returns to Deck
    if (this.uiState === 'guest-pending' || this.uiState === 'confirmed-live') {
      this.revertToDeck('scripture-activated');
    }
  }

  public handleProjectorMediaStatus(msg: any): void {
    if (!isProjectorMediaStatus(msg)) {
      return;
    }

    const brokerSnap = this.broker.getSnapshot();
    if (!brokerSnap.guestSessionId || !this.guestAttemptId) {
      return;
    }

    // Correlation check: must match active session AND current attempt
    if (
      msg.guestSessionId !== brokerSnap.guestSessionId ||
      msg.guestAttemptId !== this.guestAttemptId
    ) {
      return; // Ignore stale or mismatched attempt telemetry
    }

    if (msg.state === 'attached') {
      if (this.uiState === 'guest-pending' || this.uiState === 'confirmed-live') {
        this.clearAttachDeadline();
        this.uiState = 'confirmed-live';
        this.notify();
      }
    } else if (msg.state === 'unavailable') {
      // Auto-revert globally to Deck on accepted unavailable
      this.revertToDeck(msg.reason || 'consumer-attach-failed');
    }
  }

  public handleKeyDown(e: {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    repeat?: boolean;
    isComposing?: boolean;
    target?: any;
  }): void {
    if (e.isComposing) return;

    const isGuestActive = this.uiState === 'guest-pending' || this.uiState === 'confirmed-live';

    // 1. Escape is capture-phase one-way panic (works everywhere, even inside inputs/dialogs)
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (isGuestActive) {
        this.revertToDeck('escape-panic');
      }
      return;
    }

    // 2. 'G' / 'g' is REVERT ONLY
    if (e.key === 'g' || e.key === 'G') {
      if (!isGuestActive) {
        // Never Arm or Switch via G
        return;
      }

      // Revert via G respects editable inputs, modifiers, repeat
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) {
        return;
      }

      const target = e.target;
      if (target && typeof target === 'object') {
        const tagName = (target.tagName || '').toUpperCase();
        if (
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          tagName === 'SELECT' ||
          target.isContentEditable === true
        ) {
          return;
        }
      }

      this.revertToDeck('g-hotkey-revert');
    }
  }

  public recordFrameProgress(): void {
    this.lastFrameTime = this.envNow();
    if (this.frameHealth !== 'healthy') {
      this.frameHealth = 'healthy';
      this.notify();
    }
  }

  private startAttachDeadline(): void {
    this.clearAttachDeadline();
    this.attachDeadlineTimer = this.envSetTimeout(() => {
      this.attachDeadlineTimer = null;
      if (this.uiState === 'guest-pending') {
        // 5s deadline expired without attached status: auto-revert to Deck
        this.errorMessage = 'Congregation screen failed to attach guest feed within 5 seconds.';
        this.revertToDeck('attach-timeout');
      }
    }, 5000);
  }

  private clearAttachDeadline(): void {
    if (this.attachDeadlineTimer !== null) {
      this.envClearTimeout(this.attachDeadlineTimer);
      this.attachDeadlineTimer = null;
    }
  }

  private startFrameWatchdog(): void {
    this.stopFrameWatchdog();
    this.lastFrameTime = this.envNow();
    this.frameHealth = 'unknown';

    this.frameWatchdogTimer = this.envSetTimeout(() => {
      this.checkFrameWatchdog();
    }, 1000);
  }

  private checkFrameWatchdog(): void {
    if (this.uiState !== 'guest-pending' && this.uiState !== 'confirmed-live' && this.uiState !== 'ready') {
      this.frameHealth = 'unknown';
      return;
    }

    const elapsed = this.envNow() - this.lastFrameTime;
    if (elapsed > 3000 && this.lastFrameTime > 0) {
      if (this.frameHealth !== 'stalled') {
        this.frameHealth = 'stalled';
        this.notify();
      }
    }

    this.frameWatchdogTimer = this.envSetTimeout(() => {
      this.checkFrameWatchdog();
    }, 1000);
  }

  private stopFrameWatchdog(): void {
    if (this.frameWatchdogTimer !== null) {
      this.envClearTimeout(this.frameWatchdogTimer);
      this.frameWatchdogTimer = null;
    }
  }

  private handleBrokerSnapshot(brokerSnap: CaptureBrokerSnapshot): void {
    if (brokerSnap.state === 'ready') {
      if (this.uiState === 'arming' || this.uiState === 'idle') {
        this.uiState = 'ready';
        this.errorMessage = null;
        this.notify();
      }
    } else if (brokerSnap.state === 'error') {
      this.clearAttachDeadline();
      this.stopFrameWatchdog();

      // If master stream died while on air, auto-revert intent to Deck
      if (this.uiState === 'guest-pending' || this.uiState === 'confirmed-live') {
        this.projection = { kind: 'deck' };
        this.guestAttemptId = null;
        this.broadcastSync();
      }

      this.uiState = 'error';
      this.errorMessage = brokerSnap.error?.message || 'Capture device error';
      this.notify();
    } else if (brokerSnap.state === 'idle') {
      if (this.uiState !== 'idle') {
        this.clearAttachDeadline();
        this.stopFrameWatchdog();
        this.uiState = 'idle';
        this.projection = { kind: 'deck' };
        this.guestAttemptId = null;
        this.notify();
      }
    }
  }

  public teardown(): void {
    this.clearAttachDeadline();
    this.stopFrameWatchdog();
    if (this.unsubscribeBroker) {
      this.unsubscribeBroker();
      this.unsubscribeBroker = null;
    }
    this.disarm();
    this.listeners.clear();
  }
}
