import { useEffect, useRef, useState } from 'react';
import type { SlidePlanItem } from '@/lib/slide-plan';
import SlideView from '@/components/SlideView';
import ScriptureOverlayView from '@/components/ScriptureOverlayView';
import {
  adoptsSharedState,
  blankStateOf,
  liveBackgroundOf,
  liveTransitionOf,
  openPresentChannel,
  slidePatchOf,
  syncPatchesOf,
  type PresentMessage,
} from '@/lib/present-channel';
import { validateProjectorSlidePatchAdmission } from '@/lib/emergency-canvas';
import { PROJECTOR_HEARTBEAT_INTERVAL_MS } from '@/lib/projector-liveness';
import { transitionLayerStyle, type SlideTransition } from '@/lib/transitions';
import { hydrateImportedFonts } from '@/lib/registry/font-catalog';
import { useProjectedShell } from '@/lib/use-projected-shell';
import { useSlideTransition } from '@/lib/use-slide-transition';
import '@/projected/projected.css';

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
  const [overlay, setOverlay] = useState<{
    reference: string;
    text: string;
  } | null>(null);

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
  const planIdentityRef = useRef(planIdentity);
  useEffect(() => {
    goToRef.current = goTo;
  }, [goTo]);
  useEffect(() => {
    planIdentityRef.current = planIdentity;
  }, [planIdentity]);

  useEffect(() => {
    const ch = openPresentChannel(serviceId);
    if (!ch) return;

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
        setOverlay(msg.scripture ?? null);
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
        setOverlay({ reference: msg.reference, text: msg.text });
      } else if (msg.type === 'clear-scripture') {
        setOverlay(null);
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
      clearInterval(heartbeat);
      ch.removeEventListener('message', onMessage);
      ch.close();
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
        {overlay ? (
          <ScriptureOverlayView
            reference={overlay.reference}
            text={overlay.text}
          />
        ) : slide ? (
          <SlideView slide={slide} backgroundOverride={backgroundOverride} />
        ) : null}
      </div>
      {/* Outside the transition wrapper on purpose. Blanking has to preserve
          whatever is underneath — slide index and scripture overlay both — so
          it covers rather than replaces, and it must not inherit the wrapper's
          opacity or it would fade away with the next slide change. No
          animation either: "get this off the screen" is a cut, not an effect.
          `z-50` keeps it above any layered slide the transition mounts. */}
      {blank ? (
        <div aria-hidden="true" className="absolute inset-0 z-50 bg-black" />
      ) : null}
    </div>
  );
}
