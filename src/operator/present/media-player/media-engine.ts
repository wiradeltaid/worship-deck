export interface MediaEngineOptions {
  getMediaElement: () => HTMLMediaElement | null | undefined;
  isMutedOverride?: () => boolean;
}

export interface FadeOptions {
  durationMs?: number;
  stepIntervalMs?: number;
  onStep?: (currentVolume: number) => void;
}

export interface PlayResult {
  success: boolean;
  error?: string;
}

export interface MediaEngine {
  play: () => Promise<PlayResult>;
  pause: () => void;
  seek: (timeSeconds: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  getBaseVolume: () => number;
  fade: (options?: FadeOptions) => Promise<void>;
  cancelFade: () => void;
  isFading: () => boolean;
}

export function createMediaEngine(options: MediaEngineOptions): MediaEngine {
  let baseVolume = 1.0;
  let activeFadeTimer: ReturnType<typeof setInterval> | null = null;
  let fadeRejectFn: ((reason?: unknown) => void) | null = null;
  let isCurrentlyFading = false;

  function cancelFadeInternal(restoreVolume = true) {
    if (activeFadeTimer) {
      clearInterval(activeFadeTimer);
      activeFadeTimer = null;
    }
    isCurrentlyFading = false;

    if (restoreVolume) {
      const el = options.getMediaElement();
      if (el) {
        if (options.isMutedOverride?.()) {
          el.volume = 0;
          el.muted = true;
        } else {
          el.volume = Math.max(0, Math.min(1, baseVolume));
        }
      }
    }

    if (fadeRejectFn) {
      const reject = fadeRejectFn;
      fadeRejectFn = null;
      reject(new Error('Fade cancelled'));
    }
  }

  return {
    async play(): Promise<PlayResult> {
      cancelFadeInternal(true);
      const el = options.getMediaElement();
      if (!el) {
        return { success: false, error: 'No media element available' };
      }

      if (options.isMutedOverride?.()) {
        el.volume = 0;
        el.muted = true;
      }

      try {
        await el.play();
        return { success: true };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { success: false, error: errorMsg };
      }
    },

    pause() {
      cancelFadeInternal(true);
      const el = options.getMediaElement();
      if (el) {
        el.pause();
      }
    },

    seek(timeSeconds: number) {
      const el = options.getMediaElement();
      if (el && Number.isFinite(timeSeconds)) {
        el.currentTime = Math.max(0, timeSeconds);
      }
    },

    setVolume(volume: number) {
      if (options.isMutedOverride?.()) {
        baseVolume = 0;
        const el = options.getMediaElement();
        if (el) {
          el.volume = 0;
        }
        return;
      }
      const clamped = Math.max(0, Math.min(1, volume));
      baseVolume = clamped;
      const el = options.getMediaElement();
      if (el && !isCurrentlyFading) {
        el.volume = clamped;
      }
    },

    setMuted(muted: boolean) {
      if (options.isMutedOverride?.()) {
        const el = options.getMediaElement();
        if (el) {
          el.muted = true;
          el.volume = 0;
        }
        return;
      }
      const el = options.getMediaElement();
      if (el) {
        el.muted = muted;
      }
    },

    getBaseVolume() {
      if (options.isMutedOverride?.()) {
        return 0;
      }
      return baseVolume;
    },

    isFading() {
      return isCurrentlyFading;
    },

    cancelFade() {
      cancelFadeInternal(true);
    },

    fade(fadeOpts?: FadeOptions): Promise<void> {
      cancelFadeInternal(false);

      const el = options.getMediaElement();
      if (!el) {
        return Promise.resolve();
      }

      if (options.isMutedOverride?.()) {
        el.volume = 0;
        el.muted = true;
        return Promise.resolve();
      }

      const durationMs = fadeOpts?.durationMs ?? 3000;
      const stepIntervalMs = fadeOpts?.stepIntervalMs ?? 50;
      const startVolume = el.volume;
      const totalSteps = Math.max(1, Math.floor(durationMs / stepIntervalMs));
      const volumeStep = startVolume / totalSteps;

      isCurrentlyFading = true;
      let currentStep = 0;

      return new Promise<void>((resolve, reject) => {
        fadeRejectFn = reject;

        activeFadeTimer = setInterval(() => {
          currentStep++;
          const nextVolume = Math.max(0, startVolume - volumeStep * currentStep);
          el.volume = nextVolume;

          if (fadeOpts?.onStep) {
            fadeOpts.onStep(nextVolume);
          }

          if (currentStep >= totalSteps || nextVolume <= 0.001) {
            clearInterval(activeFadeTimer!);
            activeFadeTimer = null;
            isCurrentlyFading = false;
            fadeRejectFn = null;

            el.pause();
            el.volume = baseVolume;
            resolve();
          }
        }, stepIntervalMs);
      });
    },
  };
}
