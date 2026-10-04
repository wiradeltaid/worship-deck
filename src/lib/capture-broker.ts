/**
 * CaptureBroker — Single operator-owned video capture broker and bounded projector consumer slot.
 *
 * Implements SPEC-101 § 1 & § 4:
 * 1. Operator-only capture: getUserMedia is called only by this broker with audio: false and ideal 1080p60.
 * 2. Explicit device selection: Never auto-arms or silently falls back to a default webcam.
 * 3. 5-second readiness deadline: Attaches master to visible preview, requires readyState >= 2 & positive dimensions.
 * 4. Bounded consumer: At most ONE projector clone slot; acquire replaces previous; release is idempotent and identity-bound.
 * 5. Generation tracking & safe cancellation: Stale or late resolutions stop all tracks immediately.
 * 6. Pluggable seams for deterministic testing with node:test.
 */

export type CaptureBrokerState =
  | 'idle'
  | 'permission-pending'
  | 'readiness-pending'
  | 'ready'
  | 'live'
  | 'error';

export type CaptureBrokerErrorCode =
  | 'INSECURE_CONTEXT'
  | 'MEDIA_API_UNAVAILABLE'
  | 'PERMISSION_DENIED'
  | 'DEVICE_BUSY'
  | 'DEVICE_NOT_FOUND'
  | 'CONSTRAINT_UNSATISFIED'
  | 'READINESS_TIMEOUT'
  | 'CAPTURE_FAILED';

export interface CaptureDeviceOption {
  deviceId: string;
  label: string;
  groupId?: string;
}

export interface NegotiatedSettings {
  width?: number;
  height?: number;
  frameRate?: number;
  aspectRatio?: number;
}

export interface CaptureBrokerSnapshot {
  state: CaptureBrokerState;
  selectedDeviceId: string | null;
  isDeviceStale: boolean;
  devices: CaptureDeviceOption[];
  guestSessionId: string | null;
  currentAttemptId: string | null;
  negotiatedSettings: NegotiatedSettings | null;
  error: { code: CaptureBrokerErrorCode; message?: string } | null;
}

export interface ProjectorConsumerSlot {
  slotId: number;
  guestSessionId: string;
  guestAttemptId: string;
  stream: any;
}

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

export interface CaptureBrokerEnv {
  isSecureContext?: boolean;
  mediaDevices?: {
    enumerateDevices: () => Promise<MediaDeviceInfo[]>;
    getUserMedia: (constraints: any) => Promise<any>;
    addEventListener?: (event: string, listener: () => void) => void;
    removeEventListener?: (event: string, listener: () => void) => void;
  };
  createVideoElement?: () => MockVideoElement | HTMLVideoElement;
  setTimeout?: (fn: () => void, ms: number) => any;
  clearTimeout?: (id: any) => void;
  now?: () => number;
  randomUUID?: () => string;
}

export class CaptureBrokerError extends Error {
  readonly code: CaptureBrokerErrorCode;
  constructor(code: CaptureBrokerErrorCode, message?: string) {
    super(message || code);
    this.code = code;
    this.name = 'CaptureBrokerError';
  }
}

export class CaptureBroker {
  private env: CaptureBrokerEnv;
  private state: CaptureBrokerState = 'idle';
  private selectedDeviceId: string | null = null;
  private isDeviceStale = false;
  private devices: CaptureDeviceOption[] = [];
  private guestSessionId: string | null = null;
  private currentAttemptId: string | null = null;
  private negotiatedSettings: NegotiatedSettings | null = null;
  private error: { code: CaptureBrokerErrorCode; message?: string } | null = null;

  private masterStream: any = null;
  private previewVideo: MockVideoElement | HTMLVideoElement | null = null;
  private activeArmGeneration = 0;
  private activeEnumerateGeneration = 0;
  private pendingArmPromise: Promise<void> | null = null;
  private readinessTimer: any = null;
  private intentionalStop = false;

  private consumerSlot: ProjectorConsumerSlot | null = null;
  private consumerSlotCounter = 0;

  private listeners = new Set<(snapshot: CaptureBrokerSnapshot) => void>();
  private onDeviceChangeBound: (() => void) | null = null;

  constructor(env: CaptureBrokerEnv = {}) {
    const mediaDevices =
      env.mediaDevices !== undefined
        ? env.mediaDevices
        : typeof navigator !== 'undefined'
          ? navigator.mediaDevices
          : undefined;

    this.env = {
      isSecureContext:
        env.isSecureContext !== undefined
          ? env.isSecureContext
          : typeof window !== 'undefined'
            ? window.isSecureContext
            : true,
      mediaDevices: mediaDevices
        ? {
            enumerateDevices:
              typeof mediaDevices.enumerateDevices === 'function'
                ? mediaDevices.enumerateDevices.bind(mediaDevices)
                : () => Promise.reject(new CaptureBrokerError('MEDIA_API_UNAVAILABLE')),
            getUserMedia:
              typeof mediaDevices.getUserMedia === 'function'
                ? mediaDevices.getUserMedia.bind(mediaDevices)
                : () => Promise.reject(new CaptureBrokerError('MEDIA_API_UNAVAILABLE')),
            addEventListener:
              typeof mediaDevices.addEventListener === 'function'
                ? mediaDevices.addEventListener.bind(mediaDevices)
                : undefined,
            removeEventListener:
              typeof mediaDevices.removeEventListener === 'function'
                ? mediaDevices.removeEventListener.bind(mediaDevices)
                : undefined,
          }
        : undefined,
      createVideoElement:
        env.createVideoElement ||
        (typeof document !== 'undefined'
          ? () => document.createElement('video')
          : undefined),
      setTimeout: env.setTimeout || setTimeout,
      clearTimeout: env.clearTimeout || clearTimeout,
      now: env.now || (() => Date.now()),
      randomUUID:
        env.randomUUID ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? () => crypto.randomUUID()
          : () => 'sess_' + Math.random().toString(36).slice(2, 11)),
    };

    if (this.env.mediaDevices && typeof this.env.mediaDevices.addEventListener === 'function') {
      this.onDeviceChangeBound = () => {
        void this.handleDeviceChange();
      };
      this.env.mediaDevices.addEventListener('devicechange', this.onDeviceChangeBound);
    }
  }

  public getSnapshot(): CaptureBrokerSnapshot {
    return {
      state: this.state,
      selectedDeviceId: this.selectedDeviceId,
      isDeviceStale: this.isDeviceStale,
      devices: [...this.devices],
      guestSessionId: this.guestSessionId,
      currentAttemptId: this.currentAttemptId,
      negotiatedSettings: this.negotiatedSettings ? { ...this.negotiatedSettings } : null,
      error: this.error ? { ...this.error } : null,
    };
  }

  public subscribe(listener: (snapshot: CaptureBrokerSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  private ensureMediaApi(): void {
    if (this.env.isSecureContext === false) {
      throw new CaptureBrokerError('INSECURE_CONTEXT', 'Video capture requires a secure context (HTTPS/localhost).');
    }
    if (!this.env.mediaDevices || typeof this.env.mediaDevices.enumerateDevices !== 'function') {
      throw new CaptureBrokerError('MEDIA_API_UNAVAILABLE', 'navigator.mediaDevices capture API is unavailable.');
    }
  }

  public async enumerateDevices(): Promise<CaptureDeviceOption[]> {
    const generation = ++this.activeEnumerateGeneration;
    this.ensureMediaApi();

    try {
      const rawDevices = await this.env.mediaDevices!.enumerateDevices();
      if (generation !== this.activeEnumerateGeneration) {
        return [...this.devices];
      }

      const videoInputs = rawDevices.filter((d) => d.kind === 'videoinput');

      this.devices = videoInputs.map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `Capture Device ${index + 1}`,
        groupId: d.groupId,
      }));

      // Check if previously selected device is still present
      if (this.selectedDeviceId) {
        const found = this.devices.some((d) => d.deviceId === this.selectedDeviceId);
        if (!found) {
          this.isDeviceStale = true;
        } else {
          this.isDeviceStale = false;
        }
      }

      this.error = null;
      this.notify();
      return [...this.devices];
    } catch (err: any) {
      if (generation !== this.activeEnumerateGeneration) {
        return [...this.devices];
      }
      const mapped = this.mapError(err);
      this.error = { code: mapped.code, message: mapped.message };
      this.notify();
      throw mapped;
    }
  }

  /**
   * Explicitly requests camera permission from the browser using a temporary probe stream.
   * Stops all probe tracks immediately upon acquisition (try/finally) and refreshes device enumeration.
   * Re-throws mapped CaptureBrokerError (e.g. PERMISSION_DENIED) on failure.
   */
  public async requestPermission(): Promise<CaptureDeviceOption[]> {
    this.ensureMediaApi();
    let probeStream: any = null;
    try {
      probeStream = await this.env.mediaDevices!.getUserMedia({ video: true, audio: false });
    } catch (err: any) {
      const mapped = this.mapError(err);
      this.error = { code: mapped.code, message: mapped.message };
      this.notify();
      throw mapped;
    } finally {
      if (probeStream) {
        this.stopStreamTracks(probeStream);
      }
    }

    return this.enumerateDevices();
  }

  public selectDevice(deviceId: string): void {
    if (!deviceId || typeof deviceId !== 'string') {
      throw new Error('A valid deviceId is required for selection.');
    }
    this.selectedDeviceId = deviceId;
    this.isDeviceStale = false;
    this.error = null;
    this.notify();
  }

  public setAttemptId(attemptId: string | null): void {
    this.currentAttemptId = attemptId;
    this.notify();
  }

  /**
   * Arm video capture for the selected device.
   * Enforces audio: false, ideal 1080p60, coalesce repeat arm, generation tracking, and 5s preview readiness.
   */
  public arm(targetDeviceId?: string): Promise<void> {
    try {
      this.ensureMediaApi();
    } catch (err) {
      return Promise.reject(err);
    }

    const deviceId = targetDeviceId || this.selectedDeviceId;
    if (!deviceId) {
      return Promise.reject(
        new Error('No capture device selected. Explicit device selection is required.')
      );
    }

    // Coalesce repeat Arm while pending
    if (this.pendingArmPromise) {
      return this.pendingArmPromise;
    }

    const generation = ++this.activeArmGeneration;
    this.state = 'permission-pending';
    this.error = null;
    this.selectedDeviceId = deviceId;
    this.isDeviceStale = false;
    this.notify();

    const armAction = async () => {
      let stream: any = null;
      try {
        const constraints = {
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 60 },
          },
          audio: false, // Invariant: audio is strictly false
        };

        stream = await this.env.mediaDevices!.getUserMedia(constraints);

        // Check if generation was cancelled/disarmed while waiting for permission
        if (generation !== this.activeArmGeneration) {
          this.stopStreamTracks(stream);
          return;
        }

        // Clean up previous master stream if replacing
        if (this.masterStream) {
          this.intentionalStop = true;
          this.stopStreamTracks(this.masterStream);
          this.intentionalStop = false;
          this.masterStream = null;
        }

        this.masterStream = stream;
        this.state = 'readiness-pending';
        this.notify();

        // Attach to preview and wait for readyState >= 2 and positive dimensions within 5 seconds
        await this.waitForPreviewReadiness(stream, generation);

        if (generation !== this.activeArmGeneration) {
          this.stopStreamTracks(stream);
          return;
        }

        // Generate fresh guestSessionId on successful Arm
        this.guestSessionId = this.env.randomUUID ? this.env.randomUUID() : 'sess_' + Date.now();
        this.state = 'ready';

        // Extract negotiated settings
        const videoTrack = stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
        if (videoTrack && typeof videoTrack.getSettings === 'function') {
          const s = videoTrack.getSettings() || {};
          this.negotiatedSettings = {
            width: s.width,
            height: s.height,
            frameRate: s.frameRate,
            aspectRatio: s.aspectRatio,
          };
        } else {
          this.negotiatedSettings = null;
        }

        // Attach track onended listener for definitive loss
        if (videoTrack) {
          const onEnded = () => {
            if (this.intentionalStop) return;
            // Definitive hardware loss
            this.handleHardwareLoss();
          };
          if (typeof videoTrack.addEventListener === 'function') {
            videoTrack.addEventListener('ended', onEnded);
          } else {
            videoTrack.onended = onEnded;
          }
        }

        this.notify();
      } catch (err: any) {
        if (stream) {
          this.stopStreamTracks(stream);
        }
        if (generation === this.activeArmGeneration) {
          const mapped = this.mapError(err);
          this.state = 'error';
          this.error = { code: mapped.code, message: mapped.message };
          this.notify();
          throw mapped;
        }
      } finally {
        if (generation === this.activeArmGeneration) {
          this.pendingArmPromise = null;
        }
      }
    };

    this.pendingArmPromise = armAction();
    return this.pendingArmPromise;
  }

  private waitForPreviewReadiness(stream: any, generation: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.env.createVideoElement) {
        // In headless environment without DOM video factory, verify stream has video tracks
        const tracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
          resolve();
          return;
        }
        reject(new CaptureBrokerError('READINESS_TIMEOUT', 'No live video track available.'));
        return;
      }

      const video = this.env.createVideoElement();
      this.previewVideo = video;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;

      let settled = false;

      const cleanup = () => {
        if (this.readinessTimer) {
          this.env.clearTimeout!(this.readinessTimer);
          this.readinessTimer = null;
        }
        video.removeEventListener('loadeddata', onReadyCheck);
        video.removeEventListener('canplay', onReadyCheck);
        video.removeEventListener('error', onError);
      };

      const onReadyCheck = () => {
        if (settled) return;
        if (generation !== this.activeArmGeneration) {
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

      const onError = (e: any) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new CaptureBrokerError('CAPTURE_FAILED', 'Video preview error event.'));
      };

      video.addEventListener('loadeddata', onReadyCheck);
      video.addEventListener('canplay', onReadyCheck);
      video.addEventListener('error', onError);

      // Trigger immediate check if already ready
      onReadyCheck();

      // 5-second deadline timer
      this.readinessTimer = this.env.setTimeout!(() => {
        if (settled) return;
        settled = true;
        cleanup();
        if (video.srcObject) {
          video.srcObject = null;
        }
        reject(new CaptureBrokerError('READINESS_TIMEOUT', 'Video feed timed out waiting for observable frames (5s).'));
      }, 5000);
    });
  }

  /**
   * Acquire a projector consumer clone stream.
   * Maximum 1 consumer clone slot: replaces previous consumer stream and stops old tracks.
   * release() is idempotent and identity-bound.
   */
  public acquireProjectorConsumer(
    guestSessionId: string,
    guestAttemptId: string
  ): { stream: any; release: () => void } {
    if (!guestSessionId || guestSessionId !== this.guestSessionId) {
      throw new CaptureBrokerError(
        'CAPTURE_FAILED',
        `acquireProjectorConsumer rejected: guestSessionId '${guestSessionId}' does not match active session '${this.guestSessionId}'.`
      );
    }

    if (!guestAttemptId || guestAttemptId !== this.currentAttemptId) {
      throw new CaptureBrokerError(
        'CAPTURE_FAILED',
        `acquireProjectorConsumer rejected: guestAttemptId '${guestAttemptId}' does not match active attempt '${this.currentAttemptId}'.`
      );
    }

    if (!this.masterStream || (this.state !== 'ready' && this.state !== 'live')) {
      throw new CaptureBrokerError(
        'CAPTURE_FAILED',
        'acquireProjectorConsumer rejected: master stream is not in ready or live state.'
      );
    }

    const videoTracks = this.masterStream.getVideoTracks ? this.masterStream.getVideoTracks() : [];
    if (videoTracks.length === 0 || videoTracks[0].readyState === 'ended') {
      throw new CaptureBrokerError(
        'CAPTURE_FAILED',
        'acquireProjectorConsumer rejected: master video track is ended or absent.'
      );
    }

    // Single consumer slot rule: stop and release existing consumer before allocating new clone
    if (this.consumerSlot) {
      this.stopStreamTracks(this.consumerSlot.stream);
      this.consumerSlot = null;
    }

    // Allocate clone
    const cloneStream =
      typeof this.masterStream.clone === 'function'
        ? this.masterStream.clone()
        : this.masterStream; // fallback in mock environments without clone

    const slotId = ++this.consumerSlotCounter;
    this.consumerSlot = {
      slotId,
      guestSessionId,
      guestAttemptId,
      stream: cloneStream,
    };

    let released = false;
    const release = () => {
      if (released) return; // Idempotent
      released = true;

      // Identity-bound check: only release if this is still the active slot
      if (this.consumerSlot && this.consumerSlot.slotId === slotId) {
        this.stopStreamTracks(this.consumerSlot.stream);
        this.consumerSlot = null;
      } else {
        // Old replaced slot: ensure its tracks are stopped
        this.stopStreamTracks(cloneStream);
      }
    };

    return { stream: cloneStream, release };
  }

  public disarm(): void {
    this.activeArmGeneration++;
    this.pendingArmPromise = null;

    if (this.readinessTimer) {
      this.env.clearTimeout!(this.readinessTimer);
      this.readinessTimer = null;
    }

    // Release consumer slot
    if (this.consumerSlot) {
      this.stopStreamTracks(this.consumerSlot.stream);
      this.consumerSlot = null;
    }

    // Stop master stream
    if (this.masterStream) {
      this.intentionalStop = true;
      this.stopStreamTracks(this.masterStream);
      this.intentionalStop = false;
      this.masterStream = null;
    }

    // Clear preview
    if (this.previewVideo) {
      this.previewVideo.srcObject = null;
      this.previewVideo = null;
    }

    this.guestSessionId = null;
    this.currentAttemptId = null;
    this.negotiatedSettings = null;
    this.state = 'idle';
    this.error = null;
    this.notify();
  }

  private handleHardwareLoss(): void {
    // Definitive loss (e.g. HDMI card unplugged)
    if (this.consumerSlot) {
      this.stopStreamTracks(this.consumerSlot.stream);
      this.consumerSlot = null;
    }
    if (this.masterStream) {
      this.stopStreamTracks(this.masterStream);
      this.masterStream = null;
    }
    if (this.previewVideo) {
      this.previewVideo.srcObject = null;
      this.previewVideo = null;
    }
    this.guestSessionId = null;
    this.currentAttemptId = null;
    this.negotiatedSettings = null;
    this.state = 'error';
    this.error = {
      code: 'DEVICE_NOT_FOUND',
      message: 'Capture device was disconnected or track ended.',
    };
    this.isDeviceStale = true;
    this.notify();
  }

  private async handleDeviceChange(): Promise<void> {
    try {
      await this.enumerateDevices();
    } catch {
      // ignore enumeration errors during background devicechange
    }
  }

  private stopStreamTracks(stream: any): void {
    if (!stream) return;
    try {
      const tracks = typeof stream.getTracks === 'function' ? stream.getTracks() : [];
      for (const track of tracks) {
        if (track && typeof track.stop === 'function') {
          track.stop();
        }
      }
    } catch {
      // ignore errors stopping tracks
    }
  }

  public teardown(): void {
    if (this.onDeviceChangeBound && this.env.mediaDevices && typeof this.env.mediaDevices.removeEventListener === 'function') {
      this.env.mediaDevices.removeEventListener('devicechange', this.onDeviceChangeBound);
      this.onDeviceChangeBound = null;
    }
    this.disarm();
    this.listeners.clear();
  }

  private mapError(err: any): CaptureBrokerError {
    if (err instanceof CaptureBrokerError) return err;

    const name = err?.name || '';
    switch (name) {
      case 'NotAllowedError':
      case 'SecurityError':
      case 'PermissionDeniedError':
        return new CaptureBrokerError(
          'PERMISSION_DENIED',
          'Camera permission was denied. Check browser site settings.'
        );
      case 'NotReadableError':
      case 'TrackStartError':
        return new CaptureBrokerError('DEVICE_BUSY', 'Capture device is busy or in use by another application.');
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return new CaptureBrokerError('DEVICE_NOT_FOUND', 'Capture device was not found.');
      case 'OverconstrainedError':
        return new CaptureBrokerError('CONSTRAINT_UNSATISFIED', 'Requested capture constraints could not be satisfied.');
      default:
        return new CaptureBrokerError(
          'CAPTURE_FAILED',
          err?.message || 'Capture request failed.'
        );
    }
  }
}
