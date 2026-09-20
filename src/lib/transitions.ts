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
