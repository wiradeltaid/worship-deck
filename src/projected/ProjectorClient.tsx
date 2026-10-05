import { useEffect, useRef, useState } from 'react';
import type { SlidePlanItem } from '@/lib/slide-plan';
import SlideView from '@/components/SlideView';
import ScriptureOverlayView from '@/components/ScriptureOverlayView';
import {
  adoptsSharedState,
  blankStateOf,
  isInteractiveOrEditableElement,
  liveBackgroundOf,
  liveTransitionOf,
  openPresentChannel,
  projectionOf,
  slidePatchOf,
  syncPatchesOf,
  type PresentMessage,
  type ScriptureOverlay,
  type ProjectedSource,
} from '@/lib/present-channel';
import { ProjectorGuestMediaBridge } from './projector-guest-media-bridge';
import { validateProjectorSlidePatchAdmission } from '@/lib/emergency-canvas';
import { PROJECTOR_HEARTBEAT_INTERVAL_MS } from '@/lib/projector-liveness';
import {
  transitionLayerStyle,
  getGuestTransitionStyle,
  getScriptureTransitionStyle,
  getBlankTransitionStyle,
  SLIDE_TRANSITION_SPECS,
  type SlideTransition,
  type GuestMediaPhase,
  type ScriptureTransitionPhase,
  type ScripturePageDirection,
} from '@/lib/transitions';
import { hydrateImportedFonts } from '@/lib/registry/font-catalog';
import { useProjectedShell } from '@/lib/use-projected-shell';
import { useSlideTransition } from '@/lib/use-slide-transition';
import '@/projected/projected.css';

export { getGuestTransitionStyle };

export default function ProjectorClient({
  serviceId,
  slides,
  planIdentity,
  transition: configuredTransition,
}: {
  serviceId: number;
  slides: SlidePlanItem[];
  /** Fingerprint of the deck this window fetched (AD-10). */
  planIdentity: string;
  /**
   * The deck's configured style, read server-side. It is where this window
   * starts and what it falls back to; the Presenter may override it live for
   * the length of a session, and that override is never stored anywhere.
   */
  transition: SlideTransition;
}) {
  // Seeded from the configured style rather than mirroring it, so a reload of
  // *this* window alone does not throw away an override the Presenter is still
  // holding — the `request-sync` answer below puts it back.
  const [transition, setTransition] = useState<SlideTransition>(
    configuredTransition
  );
  const transitionRef = useRef<SlideTransition>(configuredTransition);
  transitionRef.current = transition;
  const [activeSlides, setActiveSlides] = useState<SlidePlanItem[]>(slides);
  const patchRevisionsRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    setActiveSlides(slides);
    patchRevisionsRef.current.clear();
  }, [slides]);

  const [backgroundOverride, setBackgroundOverride] = useState<
    string | null | undefined
  >(undefined);
  const { index, outgoing, phase, goTo } = useSlideTransition(
    transition,
    activeSlides.length
  );
  const [blank, setBlank] = useState(false);
  const [stalePlan, setStalePlan] = useState(false);

  // SPEC-104-02 & SPEC-108-03: Decoupled scripture overlay transition state machine
  const [activeOverlay, setActiveOverlay] = useState<ScriptureOverlay | null>(null);
  const [outgoingOverlay, setOutgoingOverlay] = useState<ScriptureOverlay | null>(null);
  const [overlayPhase, setOverlayPhase] = useState<'hidden' | 'entering-start' | 'active' | 'exiting'>('hidden');
  const [outgoingPhase, setOutgoingPhase] = useState<'hidden' | 'exiting-start' | 'exiting'>('hidden');
  const [scriptureDirection, setScriptureDirection] = useState<ScripturePageDirection>('initial');
  const activeOverlayRef = useRef<ScriptureOverlay | null>(null);
  activeOverlayRef.current = activeOverlay;
  const overlayPhaseRef = useRef<'hidden' | 'entering-start' | 'active' | 'exiting'>('hidden');
  overlayPhaseRef.current = overlayPhase;
  const scriptureDirectionRef = useRef<ScripturePageDirection>('initial');
  scriptureDirectionRef.current = scriptureDirection;
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outgoingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialSyncRef = useRef<boolean>(true);

  const applyScriptureOverlay = (newScripture: ScriptureOverlay) => {
    const currentActive = activeOverlayRef.current;

    // Idempotency guard: if all display-relevant fields match, avoid re-triggering animations or flickering
    if (
      currentActive &&
      currentActive.reference === newScripture.reference &&
      currentActive.displayReference === newScripture.displayReference &&
      currentActive.text === newScripture.text &&
      currentActive.mode === newScripture.mode &&
      currentActive.currentPage === newScripture.currentPage &&
      currentActive.totalPages === newScripture.totalPages &&
      currentActive.typographyMode === newScripture.typographyMode &&
      currentActive.isContinuation === newScripture.isContinuation &&
      currentActive.continuationIndex === newScripture.continuationIndex &&
      currentActive.continuationCount === newScripture.continuationCount &&
      currentActive.estimatedVisualLines === newScripture.estimatedVisualLines
    ) {
      return;
    }

    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
    }
    if (outgoingTimerRef.current) {
      clearTimeout(outgoingTimerRef.current);
      outgoingTimerRef.current = null;
    }

    let dir: ScripturePageDirection = 'initial';
    if (currentActive) {
      const newPage = newScripture.currentPage ?? 0;
      const curPage = currentActive.currentPage ?? 0;
      if (newPage === curPage) {
        dir = 'same-page';
      } else if (newPage > curPage) {
        dir = 'next';
      } else {
        dir = 'prev';
      }
    }
    setScriptureDirection(dir);
    scriptureDirectionRef.current = dir;

    // Use current transition through ref to avoid stale closures in BroadcastChannel listeners
    const activeTransition = transitionRef.current;
    const durationMs = SLIDE_TRANSITION_SPECS[activeTransition]?.browser.durationMs ?? 0;

    if (durationMs === 0) {
      // Instantaneous cut / none
      setOutgoingOverlay(null);
      setOutgoingPhase('hidden');
      setActiveOverlay(newScripture);
      setOverlayPhase('active');
      return;
    }

    if (!currentActive) {
      setOutgoingOverlay(null);
      setOutgoingPhase('hidden');
      setActiveOverlay(newScripture);
      setOverlayPhase('entering-start');
      overlayTimerRef.current = setTimeout(() => {
        setOverlayPhase('active');
        overlayTimerRef.current = null;
      }, 20);
    } else {
      setOutgoingOverlay(currentActive);
      setOutgoingPhase('exiting-start');
      setActiveOverlay(newScripture);
      setOverlayPhase('entering-start');

      overlayTimerRef.current = setTimeout(() => {
        setOutgoingPhase('exiting');
        setOverlayPhase('active');
        outgoingTimerRef.current = setTimeout(() => {
          setOutgoingOverlay(null);
          setOutgoingPhase('hidden');
          outgoingTimerRef.current = null;
        }, durationMs);
        overlayTimerRef.current = null;
      }, 20);
    }
  };

  const clearScriptureOverlay = () => {
    // If already exiting or hidden, do not restart or strand the running exit timer
    if (!activeOverlayRef.current || overlayPhaseRef.current === 'exiting') {
      return;
    }
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
    }
    if (outgoingTimerRef.current) {
      clearTimeout(outgoingTimerRef.current);
      outgoingTimerRef.current = null;
    }

    // Atomically reset any outgoing overlay in flight to prevent ghost text or stranded layers
    setOutgoingOverlay(null);
    setOutgoingPhase('hidden');

    // Use current transition through ref to avoid stale closures
    const activeTransition = transitionRef.current;
    const durationMs = SLIDE_TRANSITION_SPECS[activeTransition]?.browser.durationMs ?? 0;
    if (durationMs === 0) {
      setActiveOverlay(null);
      setOverlayPhase('hidden');
      return;
    }

    setOverlayPhase('exiting');
    overlayTimerRef.current = setTimeout(() => {
      setActiveOverlay(null);
      setOverlayPhase('hidden');
      overlayTimerRef.current = null;
    }, durationMs);
  };

  const setOverlay = (scripture: ScriptureOverlay | null) => {
    if (scripture) {
      applyScriptureOverlay(scripture);
    } else {
      clearScriptureOverlay();
    }
  };

  const [guestStream, setGuestStream] = useState<any>(null);
  const [isGuestIntent, setIsGuestIntent] = useState(false);
  const [retainedGuestStream, setRetainedGuestStream] = useState<any>(null);
  const [guestPhase, setGuestPhase] = useState<'hidden' | 'entering-start' | 'active' | 'exiting'>('hidden');
  const guestTimerRef = useRef<any>(null);
  const guestPhaseRef = useRef(guestPhase);
  guestPhaseRef.current = guestPhase;
  const bridgeRef = useRef<ProjectorGuestMediaBridge | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const serviceIdRef = useRef(serviceId);
  serviceIdRef.current = serviceId;

  useEffect(() => {
    if (videoRef.current && retainedGuestStream) {
      videoRef.current.srcObject = retainedGuestStream;
    }
  }, [retainedGuestStream, guestPhase]);

  useEffect(() => {
    if (!guestStream) return;
    const tracks = typeof guestStream.getTracks === 'function' ? guestStream.getTracks() : [];
    const onEnded = () => {
      setGuestStream(null);
    };
    for (const track of tracks) {
      if (typeof track.addEventListener === 'function') {
        track.addEventListener('ended', onEnded);
      } else {
        track.onended = onEnded;
      }
    }
    return () => {
      for (const track of tracks) {
        if (typeof track.removeEventListener === 'function') {
          track.removeEventListener('ended', onEnded);
        } else if (track.onended === onEnded) {
          track.onended = null;
        }
      }
    };
  }, [guestStream]);

  useEffect(() => {
    const spec = SLIDE_TRANSITION_SPECS[transition] || SLIDE_TRANSITION_SPECS.fade;
    const durationMs = spec.browser.durationMs;

    if (isGuestIntent && guestStream) {
      if (guestTimerRef.current) {
        clearTimeout(guestTimerRef.current);
        guestTimerRef.current = null;
      }
      setRetainedGuestStream(guestStream);

      if (durationMs === 0 || guestPhaseRef.current === 'active' || guestPhaseRef.current === 'exiting') {
        setGuestPhase('active');
      } else {
        setGuestPhase('entering-start');
        guestTimerRef.current = setTimeout(() => {
          setGuestPhase('active');
          guestTimerRef.current = null;
        }, 20);
      }
    } else {
      if (guestTimerRef.current) {
        clearTimeout(guestTimerRef.current);
        guestTimerRef.current = null;
      }

      if (isGuestIntent && !guestStream) {
        // Stream loss (e.g. unplugged)
        setRetainedGuestStream(null);
        setGuestPhase('hidden');
        return;
      }

      if (guestPhaseRef.current === 'hidden') {
        return;
      }

      if (durationMs === 0 || !retainedGuestStream) {
        setRetainedGuestStream(null);
        setGuestPhase('hidden');
      } else {
        setGuestPhase('exiting');
        guestTimerRef.current = setTimeout(() => {
          setRetainedGuestStream(null);
          setGuestPhase('hidden');
          guestTimerRef.current = null;
        }, durationMs);
      }
    }
  }, [isGuestIntent, guestStream, transition]);

  useEffect(() => {
    return () => {
      if (guestTimerRef.current) {
        clearTimeout(guestTimerRef.current);
        guestTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onPageHide = () => {
      bridgeRef.current?.releaseMedia();
      setGuestStream(null);
      setRetainedGuestStream(null);
      setGuestPhase('hidden');
      if (guestTimerRef.current) {
        clearTimeout(guestTimerRef.current);
        guestTimerRef.current = null;
      }
    };
    const onPageShow = () => {
      const ch = openPresentChannel(serviceId);
      ch?.postMessage({ type: 'request-sync' });
      ch?.close();
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  // SPEC-94-02: Ephemeral F11 fullscreen guidance onboarding cue.
  // Authorized exception to UC-12 room-facing chrome prohibition:
  // Transient only, auto-dismisses after 5s or upon F11 keydown / fullscreen entry,
  // and positioned strictly below the blanking layer (z-50).
  const [showHint, setShowHint] = useState<boolean>(() =>
    typeof document !== 'undefined' ? !document.fullscreenElement : false
  );

  // SPEC-94-02 / SPEC-99-03: Fullscreen orchestration & F11 guidance cue.
  // When ?fullscreen=1 is present, attempt programmatic fullscreen immediately.
  // If blocked by browser activation policy, preserve floating F11 guidance cue.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('fullscreen') === '1' &&
      typeof document !== 'undefined' &&
      !document.fullscreenElement
    ) {
      if (document.documentElement && typeof document.documentElement.requestFullscreen === 'function') {
        document.documentElement.requestFullscreen().catch(() => {
          setShowHint(true);
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!showHint) return;
    const timer = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(timer);
  }, [showHint]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        setShowHint(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (isInteractiveOrEditableElement(e.target)) {
        return;
      }

      if (
        e.key === ' ' ||
        e.key === 'Spacebar' ||
        e.key === 'ArrowRight' ||
        e.key === 'PageDown'
      ) {
        e.preventDefault();
        channelRef.current?.postMessage({
          type: 'nav-next',
          serviceId: String(serviceIdRef.current),
          planIdentity: planIdentityRef.current,
        });
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        channelRef.current?.postMessage({
          type: 'nav-prev',
          serviceId: String(serviceIdRef.current),
          planIdentity: planIdentityRef.current,
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        setShowHint(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // SPEC-37-02: Hydrate custom fonts in isolated projector window context
  useEffect(() => {
    void hydrateImportedFonts();
  }, []);

  // `goTo` is re-created whenever the live transition changes, and the channel
  // effect must not be: tearing the channel down and re-opening it on a style
  // change would drop whatever the Presenter sent in that gap. The listener
  // reaches the current `goTo` through this ref instead, which keeps the
  // subscription pinned to `serviceId` alone.
  const goToRef = useRef(goTo);
  goToRef.current = goTo;
  const planIdentityRef = useRef(planIdentity);
  planIdentityRef.current = planIdentity;
  useEffect(() => {
    goToRef.current = goTo;
  }, [goTo]);
  useEffect(() => {
    planIdentityRef.current = planIdentity;
  }, [planIdentity]);

  useEffect(() => {
    const ch = openPresentChannel(serviceId);
    if (!ch) return;
    channelRef.current = ch;

    const bridge = new ProjectorGuestMediaBridge({
      postMessage: (m) => ch.postMessage(m),
    });
    bridgeRef.current = bridge;

    const onMessage = (ev: MessageEvent<PresentMessage>) => {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;
      if (!adoptsSharedState(msg, planIdentityRef.current)) {
        if (
          msg.type === 'sync' ||
          msg.type === 'blank' ||
          msg.type === 'transition' ||
          msg.type === 'background' ||
          msg.type === 'scripture' ||
          msg.type === 'clear-scripture' ||
          msg.type === 'slide-patch'
        ) {
          setStalePlan(true);
          bridge.handleStalePlan();
          setGuestStream(null);
          setIsGuestIntent(false);
          setActiveOverlay(null);
          setOutgoingOverlay(null);
          setOverlayPhase('hidden');
          setOutgoingPhase('hidden');
          if (overlayTimerRef.current) {
            clearTimeout(overlayTimerRef.current);
            overlayTimerRef.current = null;
          }
          if (outgoingTimerRef.current) {
            clearTimeout(outgoingTimerRef.current);
            outgoingTimerRef.current = null;
          }
        }
        return;
      }
      setStalePlan(false);
      // Read first and for every message that carries them, so the
      // `request-sync` answer is as authoritative as a deliberate blank or a
      // deliberate style change: a projector opened or reloaded mid-session
      // comes up black, and on the live style, off its own mount handshake —
      // with no second round trip and no frame of the wrong thing leaking out.
      const nextBlank = blankStateOf(msg);
      if (nextBlank !== null) setBlank(nextBlank);
      const nextTransition = liveTransitionOf(msg);
      if (nextTransition !== null) setTransition(nextTransition);
      const nextBg = liveBackgroundOf(msg);
      if (nextBg !== undefined) setBackgroundOverride(nextBg);
      if (msg.type === 'sync') {
        goToRef.current(msg.index);
        const nextScripture = msg.scripture ?? null;
        if (isInitialSyncRef.current) {
          if (overlayTimerRef.current) {
            clearTimeout(overlayTimerRef.current);
            overlayTimerRef.current = null;
          }
          if (outgoingTimerRef.current) {
            clearTimeout(outgoingTimerRef.current);
            outgoingTimerRef.current = null;
          }
          setOutgoingOverlay(null);
          setOutgoingPhase('hidden');
          setActiveOverlay(nextScripture);
          setOverlayPhase(nextScripture ? 'active' : 'hidden');
        } else {
          setOverlay(msg.scripture ?? null);
        }
        isInitialSyncRef.current = false;

        const proj = projectionOf(msg);
        const isGuest = proj?.kind === 'guest';
        setIsGuestIntent(isGuest);
        void bridge.syncProjection(proj, msg.guestAttemptId || null).then(() => {
          setGuestStream(bridge.getActiveStream());
        });

        const patches = syncPatchesOf(msg);
        if (patches !== null) {
          patchRevisionsRef.current.clear();
          // Normalize per slide: retain strictly the highest revision per slideIndex
          const highestBySlide = new Map<number, (typeof patches)[number]>();
          for (const p of patches) {
            const existing = highestBySlide.get(p.index);
            if (!existing || p.patchRevision > existing.patchRevision) {
              highestBySlide.set(p.index, p);
            }
          }
          setActiveSlides(() => {
            const next = [...slides];
            for (const [idx, p] of highestBySlide.entries()) {
              patchRevisionsRef.current.set(idx, p.patchRevision);
              if (idx >= 0 && idx < next.length && p.artifact) {
                next[idx] = {
                  ...next[idx],
                  artifact: p.artifact,
                };
              }
            }
            return next;
          });
        }
      } else if (msg.type === 'slide-patch') {
        const lastRev = patchRevisionsRef.current.get((msg as any)?.index) || 0;
        const admission = validateProjectorSlidePatchAdmission({
          msg,
          activePlanIdentity: planIdentityRef.current,
          lastRevision: lastRev,
        });
        if (admission.admit) {
          const patch = slidePatchOf(msg);
          if (patch && patch.patchRevision > lastRev) {
            patchRevisionsRef.current.set(patch.index, patch.patchRevision);
            setActiveSlides((prev) => {
              if (patch.index < 0 || patch.index >= prev.length) return prev;
              const next = [...prev];
              next[patch.index] = {
                ...next[patch.index],
                artifact: patch.artifact,
              };
              return next;
            });
          }
        }
      } else if (msg.type === 'scripture') {
        applyScriptureOverlay({
          reference: msg.reference,
          displayReference: msg.displayReference || msg.reference,
          text: msg.text,
          mode: msg.mode,
          verses: msg.verses,
          currentPage: msg.currentPage,
          totalPages: msg.totalPages,
          typographyMode: msg.typographyMode,
          isContinuation: msg.isContinuation,
          continuationIndex: msg.continuationIndex,
          continuationCount: msg.continuationCount,
          estimatedVisualLines: msg.estimatedVisualLines,
        });
      } else if (msg.type === 'clear-scripture') {
        clearScriptureOverlay();
      }
    };

    ch.addEventListener('message', onMessage);
    ch.postMessage({ type: 'request-sync' });

    // The projector's own liveness heartbeat (`AD-29`): an unprompted,
    // state-free `projector-alive` for as long as this window is mounted.
    // Registered and cleared in this same effect rather than a second one —
    // a heartbeat effect keyed on anything but `serviceId` would tear this
    // channel down and reopen it on every live transition change, which is
    // exactly what `goToRef` above exists to avoid.
    const heartbeat = setInterval(() => {
      ch.postMessage({ type: 'projector-alive' });
    }, PROJECTOR_HEARTBEAT_INTERVAL_MS);

    return () => {
      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current);
        overlayTimerRef.current = null;
      }
      if (outgoingTimerRef.current) {
        clearTimeout(outgoingTimerRef.current);
        outgoingTimerRef.current = null;
      }
      clearInterval(heartbeat);
      ch.removeEventListener('message', onMessage);
      channelRef.current = null;
      ch.close();
      bridge.teardown();
      bridgeRef.current = null;
    };
  }, [serviceId]);

  // The projector is a full-screen surface that must never scroll, over an app
  // shell that paints `body` with the theme background and reserves a scrollbar
  // gutter. `useProjectedShell` holds both at literal black for as long as this
  // window is mounted and releases them on unmount; the slideshow uses the same
  // hook, because it is the same `fixed inset-0` pattern at an equally
  // room-facing URL. See that file for what the strip down the edge looked like.
  useProjectedShell();

  if (stalePlan) {
    return (
      <div
        className="fixed inset-0 overflow-hidden text-white"
        style={{ backgroundColor: '#000000', color: '#FFFFFF' }}
      >
        <p
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: 0,
            fontFamily: 'sans-serif',
            fontSize: '1.25rem',
          }}
        >
          Unable to continue.
        </p>
      </div>
    );
  }

  const slide = activeSlides[index];
  const outgoingSlide = outgoing === null ? undefined : activeSlides[outgoing];

  // `text-white` on the root is not decoration. `globals.css` puts
  // `body { @apply text-foreground }` on the shell, so any projected node that
  // sets no colour of its own inherits a theme-dependent one — five of eleven
  // nodes here did, and none of them painted it only because `ArtifactSlide`
  // gives every text box an explicit inline colour with a literal `#FFFFFF`
  // fallback. That left the invariant resting on an observation about another
  // file. One word makes it structural, and it matches the wrapper the
  // slideshow already had.
  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      {/* The slide being left behind, kept mounted underneath for exactly as
          long as the run lasts. A cross-fade needs it to fade *over* something,
          and a push needs something to push; `overflow-hidden` above is what
          keeps the pushed slide off the edges of the screen. */}
      {outgoingSlide ? (
        <div
          key="outgoing"
          className="absolute inset-0"
          style={transitionLayerStyle(transition, 'outgoing', phase)}
        >
          <SlideView
            slide={outgoingSlide}
            backgroundOverride={backgroundOverride}
          />
        </div>
      ) : null}
      <div
        key="incoming"
        className="absolute inset-0"
        style={transitionLayerStyle(transition, 'incoming', phase)}
      >
        {slide ? (
          <SlideView slide={slide} backgroundOverride={backgroundOverride} />
        ) : null}
      </div>

      {/* Decoupled Scripture Overlay Layer (SPEC-104-02 & SPEC-108-03):
          Rendered at z-20 above slides (z-0..10) and below guest video (z-30) and blackout (z-50).
          Canonical AD-23 transition styling conforming to SLIDE_TRANSITION_SPECS. */}
      {outgoingOverlay && outgoingPhase !== 'hidden' ? (
        <div
          key="scripture-outgoing"
          data-testid="projector-scripture-outgoing"
          className="absolute inset-0 z-20 pointer-events-none"
          style={
            outgoingPhase === 'exiting'
              ? getScriptureTransitionStyle(transition, 'exiting', scriptureDirection)
              : { transform: 'translateX(0)', opacity: 1, transition: 'none' }
          }
        >
          <ScriptureOverlayView
            reference={outgoingOverlay.displayReference || outgoingOverlay.reference}
            text={outgoingOverlay.text}
            mode={outgoingOverlay.mode}
            verseCount={outgoingOverlay.verses?.length}
            typographyMode={outgoingOverlay.typographyMode}
            isContinuation={outgoingOverlay.isContinuation}
            continuationIndex={outgoingOverlay.continuationIndex}
            continuationCount={outgoingOverlay.continuationCount}
            estimatedVisualLines={outgoingOverlay.estimatedVisualLines}
          />
        </div>
      ) : null}

      {activeOverlay && overlayPhase !== 'hidden' ? (
        <div
          key="scripture-active"
          data-testid="projector-scripture-layer"
          className="absolute inset-0 z-20 pointer-events-none"
          style={
            overlayPhase === 'entering-start'
              ? getScriptureTransitionStyle(transition, 'entering-start', scriptureDirection)
              : overlayPhase === 'active'
              ? getScriptureTransitionStyle(transition, 'active', scriptureDirection)
              : getScriptureTransitionStyle(transition, 'exiting', scriptureDirection)
          }
        >
          <ScriptureOverlayView
            reference={activeOverlay.displayReference || activeOverlay.reference}
            text={activeOverlay.text}
            mode={activeOverlay.mode /* mode={overlay.mode} */}
            verseCount={activeOverlay.verses?.length}
            typographyMode={activeOverlay.typographyMode}
            isContinuation={activeOverlay.isContinuation}
            continuationIndex={activeOverlay.continuationIndex}
            continuationCount={activeOverlay.continuationCount}
            estimatedVisualLines={activeOverlay.estimatedVisualLines}
          />
        </div>
      ) : null}

      {/* Contained Guest Video Layer (SPEC-101 § 3, SPEC-107 § 3): rendered at z-30 under z-40 hint and z-50 blanking */}
      {guestPhase !== 'hidden' && retainedGuestStream ? (
        <div
          data-testid="projector-guest-video-container"
          data-guest-phase={guestPhase}
          data-guest-transition={transition}
          style={getGuestTransitionStyle(transition, guestPhase)}
          className="absolute inset-0 z-30 flex items-center justify-center bg-black overflow-hidden pointer-events-none"
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="max-h-full max-w-full object-contain pointer-events-none"
          />
        </div>
      ) : null}

      {/* Ephemeral F11 fullscreen guidance onboarding banner (SPEC-94-02).
          Authorized exception to UC-12 room-facing chrome prohibition:
          Transient only, auto-dismisses in 5s or upon F11/fullscreen, positioned
          at z-40 strictly below the z-50 emergency blanking layer.
          Suppressed when blanked or when guest intent is active (including pending) (SPEC-101 § 3). */}
      {showHint && !blank && !isGuestIntent && guestPhase === 'hidden' ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none select-none">
          <button
            type="button"
            onClick={() => {
              if (typeof document !== 'undefined' && document.documentElement?.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
              }
              setShowHint(false);
            }}
            className="pointer-events-auto bg-black/80 text-white/90 rounded-full px-4 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm flex items-center gap-2 cursor-pointer transition-opacity hover:bg-black/90 focus-visible:outline-white"
          >
            <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[11px] font-mono">F11</kbd>
            <span>Press F11 for full screen · Tekan F11 untuk layar penuh</span>
          </button>
        </div>
      ) : null}
      {/* Persistent blackout transition overlay layer (SPEC-104-01 & SPEC-108-02).
          Positioned at z-50 above slides (z-0..10), scripture overlay (z-20),
          guest video (z-30), and onboarding guidance hint (z-40).
          Conforms to canonical AD-23 blackout policy: 0ms cut on cut/none, and smooth
          300ms opacity fade on fade/dissolve/push while preserving underlying
          slide and overlay state unperturbed (UC-12, FR-16). */}
      <div
        aria-hidden="true"
        data-testid="projector-blank-layer"
        className="absolute inset-0 z-50 bg-black pointer-events-none"
        style={getBlankTransitionStyle(transition, blank)}
      />
    </div>
  );
}
