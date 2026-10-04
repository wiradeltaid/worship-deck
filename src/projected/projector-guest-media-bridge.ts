/**
 * ProjectorGuestMediaBridge — Projector-side guest media consumer attachment and telemetry reporting.
 *
 * Implements SPEC-101 §§ 3 & 5:
 * 1. Safe opener acquisition: Reads same-origin opener consumer clone without crashing if opener is dead or cross-origin.
 * 2. Playback readiness: Muted playsInline autoPlay video element, requiring positive dimensions & readyState >= 2 within 3 seconds.
 * 3. Exact telemetry reasons: Maps opener-unavailable, consumer-attach-failed, and video-error.
 * 4. Diagnostic attempt correlation: Reports current guestSessionId AND guestAttemptId.
 * 5. Re-emission timer: Re-emits status once per second while intent remains authoritative.
 * 6. Clean fallback and stalePlan handling: Releases media and notifies operator.
 */

import {
  type ProjectedSource,
  type ProjectorMediaStatusMessage,
  type ProjectorMediaStatusReason,
} from '@/lib/present-channel';

export interface MockVideoElement {
  muted: boolean;
  playsInline: boolean;
  srcObject: any;
  readyState: number;
  videoWidth: number;
  videoHeight: number;
  addEventListener: (event: string, handler: (e?: any) => void) => void;
  removeEventListener: (event: string, handler: (e?: any) => void) => void;
  play?: () => Promise<void>;
}

export interface ProjectorMediaBridgeEnv {
  getOpener?: () => any;
  postMessage: (msg: ProjectorMediaStatusMessage) => void;
  createVideoElement?: () => MockVideoElement | HTMLVideoElement;
  setTimeout?: (fn: () => void, ms: number) => any;
  clearTimeout?: (id: any) => void;
  setInterval?: (fn: () => void, ms: number) => any;
  clearInterval?: (id: any) => void;
  now?: () => number;
}

export class ProjectorGuestMediaBridge {
  private env: ProjectorMediaBridgeEnv;
  private activeSessionId: string | null = null;
  private activeAttemptId: string | null = null;
  private consumerStream: any = null;
  private releaseFn: (() => void) | null = null;
  private videoElement: MockVideoElement | HTMLVideoElement | null = null;

  private latestStatus: {
    state: 'attached' | 'unavailable';
    reason?: ProjectorMediaStatusReason;
  } | null = null;

  private playbackDeadlineTimer: any = null;
  private statusReemitTimer: any = null;
  private activeAcquireGeneration = 0;

  constructor(env: ProjectorMediaBridgeEnv) {
    const resolveTimer = <T extends Function>(
      override: T | undefined,
      methodName: 'setTimeout' | 'clearTimeout' | 'setInterval' | 'clearInterval'
    ): { fn: T; target: any } => {
      if (override) {
        return { fn: override, target: typeof window !== 'undefined' ? window : globalThis };
      }
      if (typeof window !== 'undefined' && typeof (window as any)[methodName] === 'function') {
        return { fn: (window as any)[methodName], target: window };
      }
      return { fn: (globalThis as any)[methodName], target: globalThis };
    };

    const tSetTimeout = resolveTimer(env.setTimeout, 'setTimeout');
    const tClearTimeout = resolveTimer(env.clearTimeout, 'clearTimeout');
    const tSetInterval = resolveTimer(env.setInterval, 'setInterval');
    const tClearInterval = resolveTimer(env.clearInterval, 'clearInterval');

    this.env = {
      getOpener:
        env.getOpener ||
        (() => (typeof window !== 'undefined' ? window.opener : null)),
      postMessage: env.postMessage,
      createVideoElement:
        env.createVideoElement ||
        (typeof document !== 'undefined'
          ? () => document.createElement('video')
          : undefined),
      setTimeout: (fn: () => void, ms: number) => tSetTimeout.fn.call(tSetTimeout.target, fn, ms),
      clearTimeout: (id: any) => tClearTimeout.fn.call(tClearTimeout.target, id),
      setInterval: (fn: () => void, ms: number) => tSetInterval.fn.call(tSetInterval.target, fn, ms),
      clearInterval: (id: any) => tClearInterval.fn.call(tClearInterval.target, id),
      now: env.now || (() => Date.now()),
    };
  }

  public getActiveStream(): any {
    return this.consumerStream;
  }

  public getActiveSession(): { sessionId: string | null; attemptId: string | null } {
    return {
      sessionId: this.activeSessionId,
      attemptId: this.activeAttemptId,
    };
  }

  public async syncProjection(
    projection: ProjectedSource | null,
    attemptId: string | null
  ): Promise<void> {
    if (projection && projection.kind === 'guest' && attemptId) {
      // Identical sync idempotency: do not re-acquire clone
      if (
        this.activeSessionId === projection.guestSessionId &&
        this.activeAttemptId === attemptId
      ) {
        if (this.latestStatus) {
          this.emitStatus(this.latestStatus.state, this.latestStatus.reason);
        }
        return;
      }

      // New session or attempt: release previous media and invalidate old callbacks
      this.releaseMedia();
      this.activeSessionId = projection.guestSessionId;
      this.activeAttemptId = attemptId;
      const generation = ++this.activeAcquireGeneration;

      // Acquire from opener
      const acquire = this.getOpenerAcquireFunction();
      if (!acquire) {
        this.emitStatus('unavailable', 'opener-unavailable');
        return;
      }

      try {
        const result = acquire(projection.guestSessionId, attemptId);
        if (!result || !result.stream) {
          this.emitStatus('unavailable', 'consumer-attach-failed');
          return;
        }

        if (generation !== this.activeAcquireGeneration) {
          if (typeof result.release === 'function') result.release();
          return;
        }

        this.consumerStream = result.stream;
        this.releaseFn = result.release;

        // Attach to video and await observable playback within 3 seconds
        await this.waitForPlaybackReadiness(result.stream, generation);

        if (generation !== this.activeAcquireGeneration) {
          return;
        }

        this.emitStatus('attached');
        this.startStatusReemitTimer();
      } catch (err: any) {
        if (generation === this.activeAcquireGeneration) {
          this.releaseMedia();
          this.emitStatus('unavailable', 'consumer-attach-failed');
        }
      }
    } else {
      // Deck projection: release guest media cleanly
      this.releaseMedia();
      this.activeSessionId = null;
      this.activeAttemptId = null;
    }
  }

  public handleStalePlan(): void {
    const wasSessionId = this.activeSessionId;
    const wasAttemptId = this.activeAttemptId;

    this.releaseMedia();

    if (wasSessionId && wasAttemptId) {
      // Report unavailable on stalePlan refusal
      this.activeSessionId = wasSessionId;
      this.activeAttemptId = wasAttemptId;
      this.emitStatus('unavailable', 'consumer-attach-failed');
      this.activeSessionId = null;
      this.activeAttemptId = null;
    }
  }

  private waitForPlaybackReadiness(stream: any, generation: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.env.createVideoElement) {
        const videoTracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
        if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
          resolve();
          return;
        }
        reject(new Error('No live video track'));
        return;
      }

      const video = this.env.createVideoElement();
      this.videoElement = video;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;

      if (typeof video.play === 'function') {
        video.play().catch(() => {
          // autoPlay policy warning/catch
        });
      }

      let settled = false;

      const cleanup = () => {
        if (this.playbackDeadlineTimer !== null) {
          this.env.clearTimeout!(this.playbackDeadlineTimer);
          this.playbackDeadlineTimer = null;
        }
        video.removeEventListener('loadeddata', onReadyCheck);
        video.removeEventListener('canplay', onReadyCheck);
        video.removeEventListener('error', onError);
      };

      const onReadyCheck = () => {
        if (settled) return;
        if (generation !== this.activeAcquireGeneration) {
          settled = true;
          cleanup();
          resolve();
          return;
        }

        const isReady =
          video.readyState >= 2 &&
          (video.videoWidth > 0 || video.videoWidth === undefined) &&
          (video.videoHeight > 0 || video.videoHeight === undefined);

        if (isReady) {
          settled = true;
          cleanup();
          resolve();
        }
      };

      const onError = () => {
        if (settled) return;
        settled = true;
        cleanup();
        this.emitStatus('unavailable', 'video-error');
        reject(new Error('Video playback error'));
      };

      video.addEventListener('loadeddata', onReadyCheck);
      video.addEventListener('canplay', onReadyCheck);
      video.addEventListener('error', onError);

      // 3-second playback readiness deadline
      this.playbackDeadlineTimer = this.env.setTimeout!(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Playback readiness timeout (3s)'));
      }, 3000);

      // Check immediately
      onReadyCheck();
    });
  }

  private getOpenerAcquireFunction():
    | ((sessId: string, attId: string) => { stream: any; release: () => void })
    | null {
    try {
      const opener = this.env.getOpener!();
      if (!opener || opener.closed) return null;

      if (typeof opener.__worshipDeckAcquireProjectorConsumer === 'function') {
        return opener.__worshipDeckAcquireProjectorConsumer;
      }
      if (
        opener.__worshipDeckCaptureBroker &&
        typeof opener.__worshipDeckCaptureBroker.acquireProjectorConsumer === 'function'
      ) {
        return (sessId: string, attId: string) =>
          opener.__worshipDeckCaptureBroker.acquireProjectorConsumer(sessId, attId);
      }
    } catch {
      // Cross-origin access or security error reading opener
      return null;
    }
    return null;
  }

  private emitStatus(
    state: 'attached' | 'unavailable',
    reason?: ProjectorMediaStatusReason
  ): void {
    if (!this.activeSessionId || !this.activeAttemptId) return;

    this.latestStatus = { state, reason };
    this.env.postMessage({
      type: 'projector-media-status',
      guestSessionId: this.activeSessionId,
      guestAttemptId: this.activeAttemptId,
      state,
      reason,
    });
  }

  private startStatusReemitTimer(): void {
    this.stopStatusReemitTimer();
    this.statusReemitTimer = this.env.setInterval!(() => {
      if (this.latestStatus && this.activeSessionId && this.activeAttemptId) {
        this.emitStatus(this.latestStatus.state, this.latestStatus.reason);
      }
    }, 1000);
  }

  private stopStatusReemitTimer(): void {
    if (this.statusReemitTimer !== null) {
      this.env.clearInterval!(this.statusReemitTimer);
      this.statusReemitTimer = null;
    }
  }

  public releaseMedia(): void {
    this.activeAcquireGeneration++;
    if (this.playbackDeadlineTimer !== null) {
      this.env.clearTimeout!(this.playbackDeadlineTimer);
      this.playbackDeadlineTimer = null;
    }
    this.stopStatusReemitTimer();

    if (this.releaseFn) {
      try {
        this.releaseFn();
      } catch {}
      this.releaseFn = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.consumerStream = null;
    this.latestStatus = null;
  }

  public teardown(): void {
    this.releaseMedia();
    this.activeSessionId = null;
    this.activeAttemptId = null;
  }
}
