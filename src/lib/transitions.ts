/**
 * Slide transitions: one table, two surfaces.
 *
 * The generated PPTX and the browser (projector + slideshow) have to agree — a
 * deck that fades in PowerPoint must fade on the projector. They agree because
 * each style is described exactly once, here, carrying both its PowerPoint
 * element and its browser animation parameters. Neither surface may hardcode
 * either half; that is the whole point of this file.
 *
 * PowerPoint side: every element below is a plain `p:` child of
 * `<p:transition>`, and `spd` is an attribute of `p:transition` itself. Nothing
 * here needs the `p14` extension namespace or an `mc:AlternateContent`
 * fallback, so nothing silently degrades to "no transition" when the deck is
 * opened — which is exactly why morph, ripple, glitter and the rest are not
 * offered.
 *
 * Browser side: a run keeps the outgoing slide mounted underneath the incoming
 * one for `durationMs` and animates each layer from its `from` styles to its
 * `to` styles. `outgoing: null` means the old slide is not kept mounted at all
 * and the swap is instantaneous.
 */

export const SLIDE_TRANSITIONS = [
  'none',
  'cut',
  'fade',
  'dissolve',
  'push',
] as const;

export type SlideTransition = (typeof SLIDE_TRANSITIONS)[number];

/**
 * Fade, so an operator who configures nothing gets exactly the behaviour this
 * app had before transitions were selectable.
 */
export const DEFAULT_SLIDE_TRANSITION: SlideTransition = 'fade';

/**
 * Inline style for one transition layer. Structurally a subset of React's
 * `CSSProperties`, declared locally so this module stays free of React and can
 * be imported by the PPTX writer on the server.
 */
export type TransitionLayerStyle = {
  readonly opacity?: number;
  readonly transform?: string;
  readonly transition?: string;
  readonly visibility?: 'visible' | 'hidden' | 'collapse';
};

type TransitionLayerKeyframes = {
  readonly from: TransitionLayerStyle;
  readonly to: TransitionLayerStyle;
};

export type SlideTransitionSpec = {
  readonly id: SlideTransition;
  /** Admin-facing name. */
  readonly label: string;
  /** Admin-facing one-liner; says plainly where deck and browser differ. */
  readonly hint: string;
  /**
   * The `<p:transition>` element spliced into each eligible slide part, or
   * `null` for a style that deliberately writes nothing at all.
   */
  readonly pptx: string | null;
  readonly browser: {
    /** How long the outgoing slide stays mounted. `0` means an instant swap. */
    readonly durationMs: number;
    /** CSS `transition-property` while a run is active. */
    readonly property: string;
    /** CSS `transition-timing-function` while a run is active. */
    readonly easing: string;
    readonly incoming: TransitionLayerKeyframes;
    /** `null` keeps the outgoing slide unmounted — nothing to animate. */
    readonly outgoing: TransitionLayerKeyframes | null;
  };
};

/**
 * Tailwind's default transition curve, kept verbatim so `fade` looks exactly
 * like the `transition-opacity duration-500` it replaces.
 */
const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

/** No animation: the incoming slide is simply there, fully opaque. */
const INSTANT: SlideTransitionSpec['browser'] = {
  durationMs: 0,
  property: 'opacity',
  easing: EASING,
  incoming: { from: { opacity: 1 }, to: { opacity: 1 } },
  outgoing: null,
};

/**
 * Smooth crossfade: the outgoing slide fades smoothly from 1 to 0 while
 * the incoming slide fades in from 0 to 1 on top, eliminating text ghosting
 * and stale text lingering across slide transitions.
 */
const CROSSFADE: SlideTransitionSpec['browser'] = {
  durationMs: 500,
  property: 'opacity',
  easing: EASING,
  incoming: { from: { opacity: 0 }, to: { opacity: 1 } },
  outgoing: { from: { opacity: 1 }, to: { opacity: 0 } },
};

export const SLIDE_TRANSITION_SPECS: {
  readonly [K in SlideTransition]: SlideTransitionSpec;
} = {
  none: {
    id: 'none',
    label: 'None',
    hint: 'No transition is written into the deck at all; the projector swaps instantly.',
    pptx: null,
    browser: INSTANT,
  },
  cut: {
    id: 'cut',
    label: 'Cut',
    hint: 'An explicit hard cut in the deck. On screen it is the same instant swap as None.',
    pptx: '<p:transition spd="fast"><p:cut/></p:transition>',
    browser: INSTANT,
  },
  fade: {
    id: 'fade',
    label: 'Fade',
    hint: 'The default. Cross-fades in both PowerPoint and the browser.',
    pptx: '<p:transition spd="slow"><p:fade/></p:transition>',
    browser: CROSSFADE,
  },
  dissolve: {
    id: 'dissolve',
    label: 'Dissolve',
    hint: "PowerPoint's pixel dissolve. The browser has no faithful equivalent and cross-fades instead — an approximation, not a match.",
    pptx: '<p:transition spd="slow"><p:dissolve/></p:transition>',
    // Deliberately the same object as `fade`: the browser approximation is a
    // cross-fade, and saying so once here is what keeps it honest.
    browser: CROSSFADE,
  },
  push: {
    id: 'push',
    label: 'Push',
    hint: 'The new slide pushes the old one off to the left, in the deck and in the browser.',
    // `dir="l"` is the direction the content travels: the incoming slide comes
    // in from the right and shoves the outgoing one out to the left. The
    // browser keyframes below are the same motion.
    pptx: '<p:transition spd="med"><p:push dir="l"/></p:transition>',
    browser: {
      durationMs: 450,
      property: 'transform',
      easing: EASING,
      incoming: {
        from: { transform: 'translateX(100%)' },
        to: { transform: 'translateX(0)' },
      },
      outgoing: {
        from: { transform: 'translateX(0)' },
        to: { transform: 'translateX(-100%)' },
      },
    },
  },
};

export function isSlideTransition(value: unknown): value is SlideTransition {
  return (
    typeof value === 'string' &&
    (SLIDE_TRANSITIONS as readonly string[]).includes(value)
  );
}

/**
 * Coerce anything at all to a usable style. Unknown input is never an error:
 * the offline deck is the Sabbath path, so a junk settings row falls back to
 * the default rather than failing generation.
 */
export function parseSlideTransition(value: unknown): SlideTransition {
  return isSlideTransition(value) ? value : DEFAULT_SLIDE_TRANSITION;
}

export function slideTransitionSpec(
  transition: SlideTransition
): SlideTransitionSpec {
  return SLIDE_TRANSITION_SPECS[transition];
}

/** The `<p:transition>` element for a style, or `null` to write nothing. */
export function slideTransitionXml(transition: SlideTransition): string | null {
  return SLIDE_TRANSITION_SPECS[transition].pptx;
}

export type TransitionLayer = 'incoming' | 'outgoing';

/**
 * `initial` is the frame the layers are mounted at; `active` is what the
 * browser animates towards. `initial` pins `transition: none` so restarting a
 * run mid-flight snaps back rather than playing itself in reverse.
 */
export type TransitionPhase = 'initial' | 'active';

export function transitionLayerStyle(
  transition: SlideTransition,
  layer: TransitionLayer,
  phase: TransitionPhase
): TransitionLayerStyle {
  const { browser } = SLIDE_TRANSITION_SPECS[transition];
  const keyframes = layer === 'incoming' ? browser.incoming : browser.outgoing;
  if (!keyframes) return {};
  if (phase === 'initial') return { ...keyframes.from, transition: 'none' };
  return {
    ...keyframes.to,
    transition: `${browser.property} ${browser.durationMs}ms ${browser.easing}`,
  };
}

export type GuestMediaPhase = 'hidden' | 'entering-start' | 'active' | 'exiting';

/**
 * Computes canonical AD-23 transition styling for the Projector Guest Video Media layer.
 * Conforms to SLIDE_TRANSITION_SPECS: opacity crossfade for fade/dissolve (500ms),
 * transform translateX for push (450ms), and 0ms empty style for cut/none.
 */
export function getGuestTransitionStyle(
  transition: SlideTransition,
  phase: GuestMediaPhase
): TransitionLayerStyle {
  const spec = SLIDE_TRANSITION_SPECS[transition] || SLIDE_TRANSITION_SPECS.fade;
  const durationMs = spec.browser.durationMs;
  const isAnimated = durationMs > 0;
  const easing = spec.browser.easing || EASING;

  if (!isAnimated || phase === 'hidden') {
    return {};
  }

  if (spec.browser.property === 'transform') {
    let transform = 'translateX(0)';
    if (phase === 'entering-start') {
      transform = 'translateX(100%)';
    } else if (phase === 'exiting') {
      transform = 'translateX(-100%)';
    }
    return {
      transform,
      transition: `transform ${durationMs}ms ${easing}`,
    };
  }

  let opacity = 1;
  if (phase === 'entering-start' || phase === 'exiting') {
    opacity = 0;
  }
  return {
    opacity,
    transition: `opacity ${durationMs}ms ${easing}`,
  };
}

export type ScriptureTransitionPhase = 'entering-start' | 'active' | 'exiting';
export type ScripturePageDirection = 'next' | 'prev' | 'initial' | 'same-page';

/**
 * Computes canonical AD-23 transition styling for the Projector Scripture Overlay layer.
 * Conforms to SLIDE_TRANSITION_SPECS:
 * - cut/none: 0ms instant swap (returns empty object {})
 * - fade/dissolve: 500ms opacity transition
 * - push: 450ms transform translateX transition bidirectional according to ScripturePageDirection
 *   (next/initial slides from +100% to 0, prev slides from -100% to 0, same-page crossfades opacity in-place).
 */
export function getScriptureTransitionStyle(
  transition: SlideTransition,
  phase: ScriptureTransitionPhase,
  direction: ScripturePageDirection = 'next'
): TransitionLayerStyle {
  const spec = SLIDE_TRANSITION_SPECS[transition] || SLIDE_TRANSITION_SPECS.fade;
  const durationMs = spec.browser.durationMs;
  const isAnimated = durationMs > 0;
  const easing = spec.browser.easing || EASING;

  if (!isAnimated) {
    return {};
  }

  if (spec.browser.property === 'transform') {
    if (direction === 'same-page') {
      if (phase === 'entering-start') {
        return { opacity: 0 };
      }
      if (phase === 'active') {
        return {
          opacity: 1,
          transition: `opacity ${durationMs}ms ${easing}`,
        };
      }
      // phase === 'exiting'
      return {
        opacity: 0,
        transition: `opacity ${durationMs}ms ${easing}`,
      };
    }

    if (direction === 'prev') {
      if (phase === 'entering-start') {
        return { transform: 'translateX(-100%)' };
      }
      if (phase === 'active') {
        return {
          transform: 'translateX(0)',
          transition: `transform ${durationMs}ms ${easing}`,
        };
      }
      // phase === 'exiting'
      return {
        transform: 'translateX(100%)',
        transition: `transform ${durationMs}ms ${easing}`,
      };
    }

    // direction === 'next' || direction === 'initial'
    if (phase === 'entering-start') {
      return { transform: 'translateX(100%)' };
    }
    if (phase === 'active') {
      return {
        transform: 'translateX(0)',
        transition: `transform ${durationMs}ms ${easing}`,
      };
    }
    // phase === 'exiting'
    return {
      transform: 'translateX(-100%)',
      transition: `transform ${durationMs}ms ${easing}`,
    };
  }

  // fade, dissolve, etc.
  if (phase === 'entering-start') {
    return { opacity: 0 };
  }
  if (phase === 'active') {
    return {
      opacity: 1,
      transition: `opacity ${durationMs}ms ${easing}`,
    };
  }
  // phase === 'exiting'
  return {
    opacity: 0,
    transition: `opacity ${durationMs}ms ${easing}`,
  };
}

/**
 * Computes canonical AD-23 blackout layer styling for the Projector Blank Screen.
 * - cut/none: 0ms instant cut (transition: 'none')
 * - fade/dissolve/push: smooth 300ms opacity fade (adaptive blackout policy: avoids sliding black box across sanctuary display).
 */
export function getBlankTransitionStyle(
  transition: SlideTransition,
  blank: boolean
): TransitionLayerStyle {
  const spec = SLIDE_TRANSITION_SPECS[transition] || SLIDE_TRANSITION_SPECS.fade;
  const durationMs = spec.browser.durationMs;

  if (durationMs === 0) {
    return {
      opacity: blank ? 1 : 0,
      visibility: blank ? 'visible' : 'hidden',
      transition: 'none',
    };
  }

  return {
    opacity: blank ? 1 : 0,
    visibility: blank ? 'visible' : 'hidden',
    transition: 'opacity 300ms ease-in-out, visibility 300ms ease-in-out',
  };
}

export type ScriptureBackdropPhase = 'hidden' | 'entering-start' | 'active' | 'exiting';

/**
 * Computes canonical AD-23 transition styling for the Projector Scripture Backdrop layer (SPEC-109).
 * Conforms to SLIDE_TRANSITION_SPECS:
 * - hidden: opacity 0, visibility hidden
 * - none/cut: 0ms instant swap (opacity 1, visibility visible, transition: 'none')
 * - fade/dissolve: 500ms opacity transition (opacity 500ms cubic-bezier(0.4, 0, 0.2, 1))
 * - push: 450ms opacity transition (adapts to opacity fade using canonical push duration, avoiding sliding black seams)
 */
export function getScriptureBackdropStyle(
  transition: SlideTransition,
  phase: ScriptureBackdropPhase
): TransitionLayerStyle {
  if (phase === 'hidden') {
    return {
      opacity: 0,
      visibility: 'hidden',
    };
  }

  const spec = SLIDE_TRANSITION_SPECS[transition] || SLIDE_TRANSITION_SPECS.fade;
  const durationMs = spec.browser.durationMs;
  const easing = spec.browser.easing || EASING;

  if (durationMs === 0) {
    return {
      opacity: 1,
      visibility: 'visible',
      transition: 'none',
    };
  }

  if (phase === 'entering-start') {
    return {
      opacity: 0,
      visibility: 'visible',
    };
  }

  if (phase === 'active') {
    return {
      opacity: 1,
      visibility: 'visible',
      transition: `opacity ${durationMs}ms ${easing}`,
    };
  }

  // phase === 'exiting'
  return {
    opacity: 0,
    visibility: 'visible',
    transition: `opacity ${durationMs}ms ${easing}`,
  };
}

export interface ScriptureOverlayItem {
  reference: string;
  displayReference?: string;
  text: string;
  mode?: 'per-verse' | 'inline';
  verses?: Array<{ reference: string; text: string }>;
  currentPage?: number;
  totalPages?: number;
  typographyMode?: 'chapter' | 'verse';
  isContinuation?: boolean;
  continuationIndex?: number;
  continuationCount?: number;
  estimatedVisualLines?: number;
}

/**
 * Authoritative lifecycle state machine for Projector scripture overlay and persistent backdrop (SPEC-104, SPEC-108, SPEC-109).
 * Preserves AD-23 transition durations, eliminates alpha bleed through continuous backdrop opacity,
 * and maintains synchronous ref authority against race conditions.
 */
export class ScriptureOverlayStateMachine {
  transition: SlideTransition;
  activeOverlay: ScriptureOverlayItem | null = null;
  outgoingOverlay: ScriptureOverlayItem | null = null;
  overlayPhase: 'hidden' | 'entering-start' | 'active' | 'exiting' = 'hidden';
  outgoingPhase: 'hidden' | 'exiting-start' | 'exiting' = 'hidden';
  backdropPhase: ScriptureBackdropPhase = 'hidden';
  direction: ScripturePageDirection = 'initial';

  private timer: ReturnType<typeof setTimeout> | null = null;
  private outgoingTimer: ReturnType<typeof setTimeout> | null = null;
  private backdropTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(transition: SlideTransition = 'fade') {
    this.transition = transition;
  }

  setTransition(nextTransition: SlideTransition) {
    this.transition = nextTransition;
    const durationMs = SLIDE_TRANSITION_SPECS[nextTransition]?.browser.durationMs ?? 0;
    if (durationMs === 0) {
      if (this.overlayPhase === 'exiting') {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        this.activeOverlay = null;
        this.overlayPhase = 'hidden';
      }
      if (this.backdropPhase === 'exiting') {
        if (this.backdropTimer) {
          clearTimeout(this.backdropTimer);
          this.backdropTimer = null;
        }
        this.backdropPhase = 'hidden';
      }
      if (this.outgoingOverlay) {
        if (this.outgoingTimer) {
          clearTimeout(this.outgoingTimer);
          this.outgoingTimer = null;
        }
        this.outgoingOverlay = null;
        this.outgoingPhase = 'hidden';
      }
    }
  }

  onSync(scripture: ScriptureOverlayItem | null, isMountTime = false) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.outgoingTimer) {
      clearTimeout(this.outgoingTimer);
      this.outgoingTimer = null;
    }
    if (this.backdropTimer) {
      clearTimeout(this.backdropTimer);
      this.backdropTimer = null;
    }

    if (isMountTime) {
      if (scripture) {
        this.activeOverlay = scripture;
        this.outgoingOverlay = null;
        this.overlayPhase = 'active';
        this.outgoingPhase = 'hidden';
        this.backdropPhase = 'active';
      } else {
        this.activeOverlay = null;
        this.outgoingOverlay = null;
        this.overlayPhase = 'hidden';
        this.outgoingPhase = 'hidden';
        this.backdropPhase = 'hidden';
      }
      return;
    }

    if (scripture) {
      this.applyScripture(scripture);
    } else {
      this.clearScripture();
    }
  }

  applyScripture(newScripture: ScriptureOverlayItem) {
    const currentActive = this.activeOverlay;
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

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.outgoingTimer) {
      clearTimeout(this.outgoingTimer);
      this.outgoingTimer = null;
    }
    if (this.backdropTimer) {
      clearTimeout(this.backdropTimer);
      this.backdropTimer = null;
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
    this.direction = dir;

    const durationMs = SLIDE_TRANSITION_SPECS[this.transition]?.browser.durationMs ?? 0;

    if (durationMs === 0) {
      this.outgoingOverlay = null;
      this.outgoingPhase = 'hidden';
      this.activeOverlay = newScripture;
      this.overlayPhase = 'active';
      this.backdropPhase = 'active';
      return;
    }

    if (!currentActive) {
      this.outgoingOverlay = null;
      this.outgoingPhase = 'hidden';
      this.activeOverlay = newScripture;
      this.overlayPhase = 'entering-start';
      this.backdropPhase = 'entering-start';

      this.timer = setTimeout(() => {
        this.overlayPhase = 'active';
        this.timer = null;
      }, 20);
      this.backdropTimer = setTimeout(() => {
        this.backdropPhase = 'active';
        this.backdropTimer = null;
      }, 20);
    } else {
      this.backdropPhase = 'active';
      this.outgoingOverlay = currentActive;
      this.outgoingPhase = 'exiting-start';
      this.activeOverlay = newScripture;
      this.overlayPhase = 'entering-start';

      this.timer = setTimeout(() => {
        this.outgoingPhase = 'exiting';
        this.overlayPhase = 'active';
        this.outgoingTimer = setTimeout(() => {
          this.outgoingOverlay = null;
          this.outgoingPhase = 'hidden';
          this.outgoingTimer = null;
        }, durationMs);
        this.timer = null;
      }, 20);
    }
  }

  clearScripture() {
    if (!this.activeOverlay || this.overlayPhase === 'exiting' || this.overlayPhase === 'hidden') {
      return;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.outgoingTimer) {
      clearTimeout(this.outgoingTimer);
      this.outgoingTimer = null;
    }
    if (this.backdropTimer) {
      clearTimeout(this.backdropTimer);
      this.backdropTimer = null;
    }

    this.outgoingOverlay = null;
    this.outgoingPhase = 'hidden';

    const durationMs = SLIDE_TRANSITION_SPECS[this.transition]?.browser.durationMs ?? 0;
    if (durationMs === 0) {
      this.activeOverlay = null;
      this.overlayPhase = 'hidden';
      this.backdropPhase = 'hidden';
      return;
    }

    this.overlayPhase = 'exiting';
    this.backdropPhase = 'exiting';

    this.timer = setTimeout(() => {
      this.activeOverlay = null;
      this.overlayPhase = 'hidden';
      this.timer = null;
    }, durationMs);
    this.backdropTimer = setTimeout(() => {
      this.backdropPhase = 'hidden';
      this.backdropTimer = null;
    }, durationMs);
  }

  handleStalePlan() {
    this.activeOverlay = null;
    this.outgoingOverlay = null;
    this.overlayPhase = 'hidden';
    this.outgoingPhase = 'hidden';
    this.backdropPhase = 'hidden';
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.outgoingTimer) {
      clearTimeout(this.outgoingTimer);
      this.outgoingTimer = null;
    }
    if (this.backdropTimer) {
      clearTimeout(this.backdropTimer);
      this.backdropTimer = null;
    }
  }

  teardown() {
    this.handleStalePlan();
  }
}


