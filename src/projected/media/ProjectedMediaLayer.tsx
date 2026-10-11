import {
  memo,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import type { SlideTransition } from '@/lib/transitions';
import { getGuestTransitionStyle } from '@/lib/transitions';
import type { ProjectorMediaStatusReason } from '@/lib/present-channel';

export interface ProjectedMediaSource {
  mediaId: string;
  mediaUrl: string;
  isPlaying: boolean;
  mediaTime: number;
  at: number;
  revision: number;
}

export interface ProjectedMediaLayerProps {
  source: ProjectedMediaSource | null;
  phase: 'hidden' | 'entering-start' | 'active' | 'exiting';
  transition: SlideTransition;
  onStatusChange?: (
    mediaId: string,
    state: 'attached' | 'unavailable',
    reason?: ProjectorMediaStatusReason
  ) => void;
}

export const ProjectedMediaLayer = memo(function ProjectedMediaLayer({
  source,
  phase,
  transition,
  onStatusChange,
}: ProjectedMediaLayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSyncRef = useRef<{ revision: number; at: number }>({ revision: 0, at: 0 });

  // Invariant 1: Strict Mute Enforcement at mount and on every render
  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.muted = true;
      el.defaultMuted = true;
    }
  });

  // Source attachment & play/pause synchronization
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !source) return;

    // Enforce muted property in runtime
    el.muted = true;

    // Synchronize play state
    if (source.isPlaying) {
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Handled silently without throwing
        });
      }
    } else {
      el.pause();
    }

    // Drift calculation & seek compensation
    const now = Date.now();
    const elapsedSeconds = source.isPlaying ? Math.max(0, (now - source.at) / 1000) : 0;
    const expectedTime = source.mediaTime + elapsedSeconds;

    const drift = Math.abs(el.currentTime - expectedTime);
    if (drift > 0.5) {
      el.currentTime = expectedTime;
    } else if (drift > 0.05) {
      el.playbackRate = el.currentTime < expectedTime ? 1.05 : 0.95;
    } else {
      el.playbackRate = 1.0;
    }

    lastSyncRef.current = { revision: source.revision, at: source.at };
  }, [source]);

  const handleCanPlay = useCallback(() => {
    const el = videoRef.current;
    if (el) {
      el.muted = true;
    }
    if (source && onStatusChange) {
      onStatusChange(source.mediaId, 'attached');
    }
  }, [source, onStatusChange]);

  const handleError = useCallback(() => {
    if (source && onStatusChange) {
      onStatusChange(source.mediaId, 'unavailable', 'video-error');
    }
  }, [source, onStatusChange]);

  if (phase === 'hidden' || !source) {
    return null;
  }

  return (
    <div
      data-testid="projector-media-video-container"
      data-media-phase={phase}
      data-media-transition={transition}
      style={getGuestTransitionStyle(transition, phase)}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black overflow-hidden pointer-events-none"
    >
      <video
        ref={videoRef}
        autoPlay={source.isPlaying}
        muted
        playsInline
        src={source.mediaUrl}
        onCanPlay={handleCanPlay}
        onError={handleError}
        className="max-h-full max-w-full object-contain pointer-events-none"
      />
    </div>
  );
});
