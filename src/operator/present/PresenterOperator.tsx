/**
 * Operator console, arranged the way PowerPoint's presenter view is: the
 * current slide top-left, the next slide top-right, a thumbnail filmstrip and
 * the slide list bottom-left, and the operator's own panels (scripture,
 * run-sheet) bottom-right, with an "All slides" grid for jumping anywhere in
 * the deck.
 *
 * Two sizing rules make it comfortable from FullHD to 4K:
 *  - the current slide is capped in *both* axes by `--presenter-stage`, so a
 *    large monitor gives its extra pixels to the strip, the list and the
 *    run-sheet instead of inflating one slide;
 *  - below `lg` the two columns stack and the page scrolls, so a narrow window
 *    never overflows horizontally.
 *
 * The shell declares `dark` rather than hardcoding zinc colours. Every control
 * inside it is a theme-token component, so marking the surface dark is what
 * makes `--background` / `--foreground` resolve dark for them; painting zinc on
 * top while the tokens stayed light is what made the "Open projector" button
 * white-on-white.
 */
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { toast } from 'sonner';
import { Repeat } from 'lucide-react';
import Link from '@/components/Link';
import type { SlidePlanItem } from '@/lib/slide-plan';
import type { ParsedItem } from '@/lib/parser';
import SlideView from '@/components/SlideView';
import {
  isProjectorMessage,
  openPresentChannel,
  type PresentMessage,
} from '@/lib/present-channel';
import {
  INITIAL_LIVENESS_STATE,
  nextLivenessState,
  type LivenessEvent,
  type LivenessState,
} from '@/lib/projector-liveness';
import {
  parseSlideTransition,
  SLIDE_TRANSITIONS,
  SLIDE_TRANSITION_SPECS,
  type SlideTransition,
} from '@/lib/transitions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScriptureRefAutocomplete } from '@/components/ScriptureRefAutocomplete';
import { useT } from '@/lib/i18n/operator';
import {
  PresenterRemoteSession,
  type PresenterRemoteConnectionState,
} from '@/lib/presenter-remote-client';
import { hydrateImportedFonts } from '@/lib/registry/font-catalog';
import SlideGridDialog from './SlideGridDialog';
import {
  PRESENTER_TONE_CLASS,
  activePresenterEntry,
  buildPresenterEntries,
  buildPresenterRows,
  clampSlideIndex,
  computeNextLoopIndex,
  findAnnouncementSectionBounds,
  rowContainsIndex,
  type PresenterEntry,
} from './presenter-model';

type CssVars = CSSProperties & Record<`--${string}`, string>;

function blurFocusedControl() {
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

/**
 * The cap on the current slide. Width is the smaller of a fixed maximum and the
 * width a 16:9 stage may have before it would push the rest of the column off
 * the viewport, with a floor so a very short window still shows something.
 * Capping the width of an `aspect-video` box caps the height with it, so the box
 * stays exactly 16:9 and the slide never letterboxes inside its own frame.
 *
 * `30rem` is everything else in that column, measured rather than guessed:
 * header 3.75, page padding 2, three 0.75 gaps 2.25, the "Current" label 1.25,
 * transport row 2, filmstrip 7.95 (thumbnail 4.5 + its frame 0.75 + caption
 * 1.15 + strip padding 0.75 + the horizontal scrollbar ~0.8), and 10.8 for the
 * slide list.
 *
 * It was 21rem before the filmstrip. Note what that arithmetic means: while the
 * `min()` binds, the stage takes exactly the height this term does *not*, so
 * every rem added here lands on the slide list one-for-one at any viewport. The
 * strip is therefore paid for by the current slide (about 6% of its width at
 * FullHD, nothing at all at 2K and above where the 64rem cap binds instead) and
 * the vertical list keeps the room it had.
 *
 * The floor went 20rem -> 24rem for the same reason, in the other direction. On
 * a short window (a 1366x768 laptop leaves ~660px) the fixed costs dominate and
 * the floor is what binds, so the reserve stops being a guarantee and the
 * leftover falls to the list instead; measured there, 20rem spent the
 * filmstrip's height out of the current slide and left the list with more than
 * it needs. 24rem keeps the slide readable and still fits — the column needs
 * ~525px at that floor, against the ~516px the 20rem floor needed before, so it
 * adds no clipping risk that the shipped layout did not already carry.
 */
const STAGE_VARS: CssVars = {
  '--presenter-stage': 'max(24rem, min(64rem, calc((100dvh - 30rem) * 16 / 9)))',
};

const BADGE_BASE =
  'rounded border px-1 py-px text-[9px] font-bold uppercase tracking-wider';

const BADGE_CLASS = `shrink-0 ${BADGE_BASE}`;

const PANEL_CLASS = 'rounded-lg border border-border bg-card/40';

/**
 * A popup rather than a tab, because the operator drags this onto the second
 * screen the way PowerPoint's presenter setup expects. Width and height alone
 * already make most browsers open a window; `popup` states the intent.
 */
const PROJECTOR_FEATURES = 'popup=1,width=1280,height=720,left=120,top=120';

/**
 * How often the retained handle's `.closed` is read, and how often a stale
 * acknowledgement is checked for even when nothing new arrives (`AD-29`).
 * Deliberately **not** exported alongside the shared cadence pair in
 * `projector-liveness.ts`: the heartbeat interval and the freshness window
 * are the one pair both windows must agree on, but this poll cadence is a
 * purely local implementation detail of *how* the presenter drives the
 * evaluator, never a value the projector needs to know. Sub-second so a clean
 * window close is reported "in well under a second" (AC-4), well inside the
 * freshness window so it never itself causes a false `lost`.
 */
const LIVENESS_POLL_INTERVAL_MS = 200;

/**
 * Stable per service, so a second click — or a Presenter reload that lost the
 * handle — targets the *same* window instead of opening a second projector.
 * Two projectors answering `request-sync` on one `BroadcastChannel` would fight
 * over the deck, so the browser's own named-window reuse is the backstop behind
 * the handle we keep.
 */
function projectorWindowName(serviceId: number): string {
  return `bic-projector-${serviceId}`;
}

function SlideListRow({
  entry,
  active,
  activeRef,
  onSelect,
}: {
  entry: PresenterEntry;
  active: boolean;
  activeRef: RefObject<HTMLButtonElement | null>;
  onSelect: (index: number) => void;
}) {
  return (
    <Button
      ref={active ? activeRef : null}
      type="button"
      variant="ghost"
      aria-current={active ? 'true' : undefined}
      onClick={() => onSelect(entry.index)}
      className={`flex h-auto w-full justify-start gap-2 rounded px-2 py-1.5 text-left font-normal ${
        active
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'text-foreground hover:bg-muted'
      }`}
    >
      <span
        className={`w-7 shrink-0 text-right font-mono text-[11px] ${
          active ? 'text-primary-foreground/70' : 'text-muted-foreground'
        }`}
      >
        {entry.index + 1}
      </span>
      <span
        className={`${BADGE_CLASS} ${
          active
            ? 'border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground'
            : PRESENTER_TONE_CLASS[entry.tone]
        }`}
      >
        {entry.label}
      </span>
      <span className="truncate text-xs">{entry.title ?? ''}</span>
    </Button>
  );
}

/**
 * One frame of the filmstrip: the real slide at thumbnail size, its number and
 * its semantic label. `ArtifactSlide` letterboxes itself, so the frame is a
 * fixed-width 16:9 box and the slide fills it exactly.
 *
 * Memoized deliberately. Every arrow press re-renders the Presenter, and
 * without this the whole strip — one `ArtifactSlide` tree per slide, each with
 * its own text-fit measurement — reconciles on every slide change. All props
 * are stable except `active`, so only the two frames whose highlight actually
 * moved re-render.
 */
const FilmstripFrame = memo(function FilmstripFrame({
  slide,
  entry,
  active,
  activeRef,
  onSelect,
}: {
  slide: SlidePlanItem | undefined;
  entry: PresenterEntry;
  active: boolean;
  activeRef: RefObject<HTMLButtonElement | null>;
  onSelect: (index: number) => void;
}) {
  // The caption is clipped at 8rem, so the full text lives in the tooltip —
  // minus the headline when it only repeats the label ("Thank You · Thank You").
  const detail =
    entry.title && entry.title !== entry.label ? ` · ${entry.title}` : '';
  return (
    <Button
      ref={active ? activeRef : null}
      type="button"
      variant="ghost"
      aria-current={active ? 'true' : undefined}
      title={`${entry.index + 1} · ${entry.label}${detail}`}
      onClick={() => onSelect(entry.index)}
      className={`h-auto w-32 shrink-0 flex-col items-stretch rounded-md border p-1 text-left font-normal ${
        active
          ? 'border-primary bg-primary/15 ring-2 ring-primary hover:bg-primary/15'
          : 'border-border hover:bg-muted'
      }`}
    >
      <span className="block aspect-video overflow-hidden rounded-sm bg-black">
        {slide ? <SlideView slide={slide} /> : null}
      </span>
      <span className="mt-1 flex items-center gap-1 overflow-hidden">
        <span
          className={`shrink-0 font-mono text-[10px] ${
            active ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {entry.index + 1}
        </span>
        <span
          className={`${BADGE_BASE} truncate ${PRESENTER_TONE_CLASS[entry.tone]}`}
        >
          {entry.label}
        </span>
      </span>
    </Button>
  );
});

export default function PresenterOperator({
  serviceId,
  serviceDate,
  slides,
  runSheetItems,
  planIdentity,
  transition: deckTransition,
}: {
  serviceId: number;
  serviceDate: string;
  slides: SlidePlanItem[];
  runSheetItems: ParsedItem[];
  /** Fingerprint of the deck this console fetched (AD-10). */
  planIdentity: string;
  /**
   * The deck's configured style, read server-side — the same one every PPTX
   * download is generated from. It is where a session starts and what a new
   * session starts from again, because the live override below is never
   * written anywhere.
   */
  transition: SlideTransition;
}) {
  const { t } = useT();
  const [index, setIndex] = useState(0);
  const [gridOpen, setGridOpen] = useState(false);
  const [blank, setBlank] = useState(false);
  // Session-local, deliberately. Nothing persists it: no fetch, no setting, no
  // storage. Closing this window is what makes the deck's own style the truth
  // again, which is the whole contract of the control.
  const [liveTransition, setLiveTransition] =
    useState<SlideTransition>(deckTransition);
  const [liveBackground, setLiveBackground] = useState<string | null>(null);
  const [backgroundLibrary, setBackgroundLibrary] = useState<
    Array<{ id: number; url: string; isDefault: boolean }>
  >([]);
  const [scriptureRef, setScriptureRef] = useState('');
  const [scriptureBusy, setScriptureBusy] = useState(false);
  const [scriptureError, setScriptureError] = useState<string | null>(null);
  const [scriptureTranslation, setScriptureTranslation] = useState('');
  const [bibleTranslations, setBibleTranslations] = useState<
    Array<{ code: string; name: string }>
  >([]);
  const [bibleDefaultMissing, setBibleDefaultMissing] = useState(false);
  const [projectorBlocked, setProjectorBlocked] = useState(false);
  const [remoteState, setRemoteState] =
    useState<PresenterRemoteConnectionState>('idle');
  const [remoteCode, setRemoteCode] = useState<string | null>(null);
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false);
  const [remoteActionBusy, setRemoteActionBusy] = useState(false);
  const remoteSessionRef = useRef<PresenterRemoteSession | null>(null);
  // The liveness verdict (`AD-29`): whether the projector is answering. Never
  // a second flag alongside it — the whole point of `nextLivenessState` is
  // that this is the only place the verdict is decided, so a boundary added
  // here is a boundary added to the shared evaluator, not a local shortcut.
  const [liveness, setLiveness] = useState<LivenessState>(INITIAL_LIVENESS_STATE);
  const [isLooping, setIsLooping] = useState(false);
  const isLoopingRef = useRef(false);
  isLoopingRef.current = isLooping;

  const [loopInterval, setLoopInterval] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('wpw_presenter_loop_interval');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if ([5, 7, 10, 15].includes(parsed)) return parsed;
      }
    } catch {}
    return 7;
  });

  const channelRef = useRef<BroadcastChannel | null>(null);
  const indexRef = useRef(0);
  const blankRef = useRef(false);
  const transitionRef = useRef<SlideTransition>(deckTransition);
  const backgroundRef = useRef<string | null>(null);
  const planIdentityRef = useRef(planIdentity);
  planIdentityRef.current = planIdentity;
  const activeRowRef = useRef<HTMLButtonElement | null>(null);
  const activeFrameRef = useRef<HTMLButtonElement | null>(null);
  const projectorRef = useRef<Window | null>(null);
  // Mirrors `liveness` for the same reason `indexRef`/`blankRef`/`transitionRef`
  // exist: the message listener and the poll below are installed once per
  // service and would otherwise close over mount-time state.
  const livenessRef = useRef<LivenessState>(INITIAL_LIVENESS_STATE);

  const projectorUrl = `/services/${serviceId}/present/projector`;

  useEffect(() => {
    let active = true;
    void hydrateImportedFonts();
    void fetch('/api/background-library', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as {
          images?: Array<{ id: number; url: string; isDefault: boolean }>;
        };
      })
      .then((body) => {
        if (!active || !body) return;
        const images = Array.isArray(body.images) ? body.images : [];
        setBackgroundLibrary(images);
      })
      .catch(() => {});
    void fetch('/api/bible-translations', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as {
          translations?: Array<{ code: string; name: string }>;
          default_bible_translation_resolved?: string;
          default_bible_translation_installed?: boolean;
        };
      })
      .then((body) => {
        if (!active || !body) return;
        const rows = Array.isArray(body.translations) ? body.translations : [];
        setBibleTranslations(rows);
        const resolved = body.default_bible_translation_resolved?.trim();
        if (resolved) setScriptureTranslation(resolved);
        else if (rows[0]?.code) setScriptureTranslation(rows[0].code);
        setBibleDefaultMissing(body.default_bible_translation_installed === false);
      })
      .catch(() => {
        /* lookup still works via the server default */
      });
    return () => {
      active = false;
    };
  }, []);

  const entries = useMemo(() => buildPresenterEntries(slides), [slides]);
  const rows = useMemo(() => buildPresenterRows(entries), [entries]);

  /**
   * The one place `nextLivenessState` is called. Every signal that can move
   * the verdict — an inbound projector message, the closed poll, the
   * freshness tick — comes through here rather than keeping its own copy of
   * the precedence rules.
   */
  const dispatchLiveness = useCallback((event: LivenessEvent) => {
    const next = nextLivenessState(livenessRef.current, event, Date.now());
    if (next === livenessRef.current) return;
    // An `ack` always returns a fresh object (it refreshes `lastAckAtMs`
    // every time, live or not), but the render below reads only
    // `liveness.verdict` — re-rendering on every heartbeat while the verdict
    // does not change would cost a render every 2s for the whole session.
    // The ref always holds the latest state either way, so the next `tick`
    // or `handle-closed` still sees the refreshed `lastAckAtMs`.
    const verdictChanged = next.verdict !== livenessRef.current.verdict;
    livenessRef.current = next;
    if (verdictChanged) setLiveness(next);
  }, []);

  /**
   * Focus the projector if it is already up, otherwise open it. Never a second
   * one: the live handle answers first, and the stable window name catches the
   * case where this component was remounted and lost it.
   *
   * An open-but-not-answering handle (`existing.closed === false` while the
   * liveness verdict is `lost`) is exactly AC-4's crashed/frozen/navigated-away
   * case — the window still exists, so `.closed` never trips, but nothing is
   * going to answer it either. `.focus()` alone cannot revive that window, so
   * this is the one case that also navigates it back to the projector route
   * before focusing (Review finding [High, blocking]): the recovery the header
   * advertises must actually be able to reattach a frozen projector, not just
   * bring an unresponsive window to the front.
   */
  const openProjector = useCallback(() => {
    const existing = projectorRef.current;
    if (existing && !existing.closed) {
      if (livenessRef.current.verdict === 'lost') {
        existing.location.href = projectorUrl;
      }
      existing.focus();
      dispatchLiveness({ type: 'opened' });
      return;
    }
    const opened = window.open(
      projectorUrl,
      projectorWindowName(serviceId),
      PROJECTOR_FEATURES
    );
    projectorRef.current = opened;
    // `null` means the popup blocker ate it — surface the plain link instead of
    // leaving the operator clicking a button that does nothing.
    setProjectorBlocked(opened === null);
    opened?.focus();
    // Records the attempt so a projector that opens and never sends its
    // first ack ages out of `never-opened` into `lost` after the freshness
    // window, instead of staying silently unopened for the rest of the
    // service (`AD-29`, Review finding [High, blocking]).
    dispatchLiveness({ type: 'opened' });
  }, [projectorUrl, serviceId, dispatchLiveness]);

  const broadcast = useCallback((msg: PresentMessage) => {
    channelRef.current?.postMessage(msg);
  }, []);

  const setIndexAndSync = useCallback(
    (next: number) => {
      const clamped = clampSlideIndex(next, slides.length);
      indexRef.current = clamped;
      setIndex(clamped);
      // Carries the blank state and the live style unchanged rather than
      // dropping either: advancing while blanked must move the deck and leave
      // the projector black, and advancing after a style change must not put
      // the projector back on the deck's configured style.
      broadcast({
        type: 'sync',
        index: clamped,
        blank: blankRef.current,
        transition: transitionRef.current,
        background: backgroundRef.current,
        planIdentity: planIdentityRef.current,
      });
    },
    [broadcast, slides.length]
  );

  const manualNavigate = useCallback(
    (next: number) => {
      isLoopingRef.current = false;
      setIsLooping(false);
      setIndexAndSync(next);
    },
    [setIndexAndSync]
  );

  useEffect(() => {
    if (!isLooping) return;

    const bounds = findAnnouncementSectionBounds(slides, indexRef.current);
    if (!bounds) {
      isLoopingRef.current = false;
      setIsLooping(false);
      return;
    }

    const timer = setInterval(() => {
      if (!isLoopingRef.current) return;
      const currentIdx = indexRef.current;
      const curBounds = findAnnouncementSectionBounds(slides, currentIdx);
      if (!curBounds) {
        isLoopingRef.current = false;
        setIsLooping(false);
        return;
      }
      const nextIdx = computeNextLoopIndex(currentIdx, curBounds);
      setIndexAndSync(nextIdx);
    }, loopInterval * 1000);

    return () => {
      clearInterval(timer);
    };
  }, [isLooping, loopInterval, slides, setIndexAndSync]);

  /**
   * Blanks or restores the projector. Takes the state it wants rather than
   * flipping whatever the receiver happens to hold, so a projector that missed
   * a message — or two of them, or the same one twice — converges instead of
   * ending up inverted. The deck index is untouched by design.
   */
  const setBlankAndSync = useCallback(
    (next: boolean) => {
      blankRef.current = next;
      setBlank(next);
      broadcast({
        type: 'blank',
        blank: next,
        planIdentity: planIdentityRef.current,
      });
    },
    [broadcast]
  );

  const toggleBlank = useCallback(() => {
    setBlankAndSync(!blankRef.current);
  }, [setBlankAndSync]);

  /**
   * Redirects the projector to another style for the rest of this session and
   * stores nothing. Names the style it wants rather than asking for the next
   * one, so two projector windows converge on the same answer however many
   * messages either of them missed.
   */
  const setTransitionAndSync = useCallback(
    (next: SlideTransition) => {
      transitionRef.current = next;
      setLiveTransition(next);
      broadcast({
        type: 'transition',
        transition: next,
        planIdentity: planIdentityRef.current,
      });
    },
    [broadcast]
  );

  /**
   * Overrides the projected Verse/Reff background for the rest of this session (AD-34).
   */
  const setBackgroundAndSync = useCallback(
    (next: string | null) => {
      backgroundRef.current = next;
      setLiveBackground(next);
      broadcast({
        type: 'background',
        background: next,
        planIdentity: planIdentityRef.current,
      });
    },
    [broadcast]
  );

  useEffect(() => {
    const ch = openPresentChannel(serviceId);
    channelRef.current = ch;
    if (!ch) return;

    // Read from the refs, never from the rendered values: this listener is
    // installed once per service and would otherwise answer with whatever the
    // deck looked like at mount.
    const currentState = (): PresentMessage => ({
      type: 'sync',
      index: indexRef.current,
      blank: blankRef.current,
      transition: transitionRef.current,
      background: backgroundRef.current,
      planIdentity: planIdentityRef.current,
    });

    const onMessage = (ev: MessageEvent<PresentMessage>) => {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;
      // Only a genuine projector-originated message is evidence of life
      // (`AD-29`) — the heartbeat and `request-sync` alike, recorded here
      // without changing how `request-sync` is answered below. A second
      // Presenter tab on the same service shares this channel too, and its
      // own broadcast state (`sync`, `blank`, `transition`, ...) must never
      // be mistaken for the projector answering (Review finding
      // [High, blocking]) — `isProjectorMessage` is the one place that
      // distinction is made, so it cannot drift from `present-channel.ts`'s
      // own account of who sends what.
      if (isProjectorMessage(msg)) {
        dispatchLiveness({ type: 'ack' });
      }
      if (msg.type === 'request-sync') {
        ch.postMessage(currentState());
      }
    };
    ch.addEventListener('message', onMessage);
    ch.postMessage(currentState());
    return () => {
      ch.removeEventListener('message', onMessage);
      ch.close();
      channelRef.current = null;
    };
  }, [serviceId, dispatchLiveness]);

  // The retained handle's `closed` poll, and the freshness tick, feeding the
  // same evaluator as the listener above (`AD-29`) — never a second liveness
  // mechanism. A `null` handle is not evidence of anything and raises no
  // event; only an explicit, non-null `closed === true` reading may move the
  // verdict toward `lost` ahead of the freshness window, which is what makes
  // a clean window close reportable in well under a second rather than after
  // a timeout.
  useEffect(() => {
    const session = new PresenterRemoteSession({
      serviceId,
      getPlanIdentity: () => planIdentityRef.current,
      handlers: {
        setIndexAndSync: manualNavigate,
        setBlankAndSync,
        setTransitionAndSync,
        setBackgroundAndSync,
        broadcast,
      },
      onCode: (code) => {
        setRemoteCode(code);
      },
      onStateChange: (state) => {
        setRemoteState(state);
      },
    });
    remoteSessionRef.current = session;
    void session.start();
    return () => {
      session.stop();
      remoteSessionRef.current = null;
    };
  }, [
    serviceId,
    manualNavigate,
    setBlankAndSync,
    setTransitionAndSync,
    setBackgroundAndSync,
    broadcast,
  ]);

  useEffect(() => {
    const poll = setInterval(() => {
      if (projectorRef.current && projectorRef.current.closed) {
        dispatchLiveness({ type: 'handle-closed' });
      } else {
        dispatchLiveness({ type: 'tick' });
      }
    }, LIVENESS_POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [dispatchLiveness]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // While the jump grid is open the arrows belong to its selection.
      if (gridOpen) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      // `SELECT` for the same reason as the text fields: while the transition
      // picker holds focus the arrows and space are its own, and a handler that
      // also advanced the deck would move a slide the operator did not ask for
      // every time they opened the list.
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        manualNavigate(index + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        manualNavigate(index - 1);
      } else if (e.key === 'b' || e.key === 'B' || e.key === '.') {
        // PowerPoint's own black-screen keys, so an operator who already runs
        // slides does not have to learn a second habit. Modifier chords are
        // left to the browser — Ctrl+B and friends are not ours to take.
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        toggleBlank();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gridOpen, index, manualNavigate, toggleBlank]);

  // Keeps both slide indexes following the deck: the same mechanism for the
  // filmstrip as for the list, one axis apart. Reads and scrolls the DOM only —
  // nothing here belongs in state. `nearest` on both axes means neither call
  // can scroll an ancestor that was already showing the target.
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' });
    activeFrameRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [index]);

  const current = slides[index];
  const next = slides[index + 1];
  const atEnd = index >= slides.length - 1;
  const activeEntry = activePresenterEntry(entries, index);

  const pushScripture = async () => {
    setScriptureBusy(true);
    setScriptureError(null);
    try {
      const params = new URLSearchParams({ ref: scriptureRef.trim() });
      if (scriptureTranslation) params.set('translation', scriptureTranslation);
      const res = await fetch(`/api/scripture?${params.toString()}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        reference?: string;
        text?: string;
      };
      if (!res.ok) {
        setScriptureError(
          data.error ||
            (res.status === 404
              ? t('presenter.scripture.notFound')
              : t('presenter.scripture.lookupFailed'))
        );
        return;
      }
      if (!data.reference || !data.text) {
        setScriptureError(t('presenter.scripture.lookupFailed'));
        return;
      }
      broadcast({
        type: 'scripture',
        reference: data.reference,
        text: data.text,
        planIdentity: planIdentityRef.current,
      });
    } catch {
      setScriptureError(t('presenter.scripture.lookupFailed'));
    } finally {
      setScriptureBusy(false);
    }
  };

  return (
    <div className="dark flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh lg:overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">
            Presenter · {serviceDate}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            Slide {slides.length === 0 ? 0 : index + 1} / {slides.length}
            {activeEntry ? ` · ${activeEntry.label}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => setGridOpen(true)}
            disabled={slides.length === 0}
          >
            All slides
          </Button>
          <Button variant="outline" onClick={openProjector}>
            Open projector
          </Button>
          <Button
            variant="outline"
            onClick={() => setRemoteDialogOpen(true)}
            className="flex items-center gap-1.5"
            title="Mobile remote control pairing"
          >
            <span
              className={cn(
                'inline-block h-2 w-2 rounded-full',
                remoteState === 'connected'
                  ? 'bg-emerald-500'
                  : remoteState === 'pairing'
                  ? 'bg-amber-400 animate-pulse'
                  : remoteState === 'error' || remoteState === 'role-lost'
                  ? 'bg-destructive'
                  : 'bg-muted-foreground/50'
              )}
            />
            <span>Remote</span>
            {remoteCode ? (
              <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground ml-0.5">
                {remoteCode}
              </span>
            ) : null}
          </Button>
          {/* `nativeButton={false}` because this one really is a link: Base UI
              otherwise warns that a component acting as a button was handed
              something that is not a native `<button>`. */}
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/services/${serviceId}`} />}
          >
            Run-Sheet
          </Button>
        </div>
        {projectorBlocked ? (
          <p className="basis-full text-xs text-amber-300">
            The browser blocked the projector window. Allow popups for this site,
            or{' '}
            <a
              className="underline underline-offset-2"
              href={projectorUrl}
              target="_blank"
              rel="noreferrer"
            >
              open the projector in a tab
            </a>
            .
          </p>
        ) : null}
        {/* Independent of `projectorBlocked` above — either, both or neither
            may show (AC-5). Silent in `never-opened`: a presenter opened
            without a projector must not warn about one, or the line trains
            the operator to ignore it before it has ever meant anything.
            States the recovery, never the cause — the operator is told what
            to do, never that a heartbeat timed out. */}
        {liveness.verdict === 'lost' ? (
          <p role="status" className="basis-full text-xs text-amber-300">
            The projector is not answering. Use{' '}
            <span className="font-medium">Open projector</span> above to
            reconnect it.
          </p>
        ) : null}
        {remoteState === 'role-lost' ? (
          <p role="status" className="basis-full text-xs text-amber-300">
            Remote link disconnected. Another device claimed presenting control or the connection was lost.
          </p>
        ) : null}
      </header>

      <main
        style={STAGE_VARS}
        className="mx-auto flex min-h-0 w-full max-w-[96rem] flex-1 flex-col gap-4 p-4 lg:flex-row"
      >
        <div className="flex min-h-0 min-w-0 flex-col gap-3 lg:grow-0 lg:basis-[var(--presenter-stage)]">
          {/* Blanking is announced *around* the stage, never over it: the whole
              point of the control is that the congregation loses the slide and
              the operator does not, so current and next keep rendering exactly
              as before and only the frame and the badge change. */}
          <section>
            <p className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current
              {blank ? (
                <span
                  role="status"
                  className={`${BADGE_CLASS} border-amber-400/50 bg-amber-400/15 text-amber-300`}
                >
                  Projector blanked
                </span>
              ) : null}
            </p>
            <div
              className={`aspect-video w-full overflow-hidden rounded-lg border bg-black relative ${
                blank ? 'border-amber-400/70' : 'border-border'
              }`}
            >
              {isLooping ? (
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 rounded-full bg-amber-500 text-black px-2.5 py-0.5 text-[11px] font-bold shadow-md animate-pulse">
                  <Repeat className="w-3 h-3" />
                  Looping ({loopInterval}s)
                </div>
              ) : null}
              {current ? <SlideView slide={current} /> : null}
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => manualNavigate(index - 1)}
              disabled={index <= 0}
            >
              ← Prev
            </Button>
            <Button
              onClick={() => manualNavigate(index + 1)}
              disabled={atEnd}
            >
              Next →
            </Button>
            <div className="flex items-center gap-1.5 border border-border rounded-lg px-2 py-0.5 bg-card/60">
              <Button
                type="button"
                variant={isLooping ? 'destructive' : 'outline'}
                size="sm"
                className="text-xs font-semibold gap-1.5 h-8"
                onClick={() => {
                  if (isLooping) {
                    isLoopingRef.current = false;
                    setIsLooping(false);
                    return;
                  }
                  const bounds = findAnnouncementSectionBounds(slides, index);
                  if (!bounds) {
                    toast.error('Current slide is not in an announcement section');
                    return;
                  }
                  isLoopingRef.current = true;
                  setIsLooping(true);
                }}
                title={isLooping ? 'Stop Announcement Loop' : 'Start Announcement Loop'}
                aria-pressed={isLooping}
              >
                <Repeat className={`w-3.5 h-3.5 ${isLooping ? 'animate-spin' : ''}`} />
                {isLooping ? 'Stop Loop' : 'Auto Loop'}
              </Button>
              <Select
                value={String(loopInterval)}
                onValueChange={(val) => {
                  const secs = Number(val);
                  setLoopInterval(secs);
                  try {
                    localStorage.setItem('wpw_presenter_loop_interval', String(secs));
                  } catch {}
                }}
              >
                <SelectTrigger className="h-8 text-xs font-medium w-[68px]">
                  <SelectValue placeholder="7s" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5s</SelectItem>
                  <SelectItem value="7">7s</SelectItem>
                  <SelectItem value="10">10s</SelectItem>
                  <SelectItem value="15">15s</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={blank ? 'destructive' : 'outline'}
              aria-pressed={blank}
              onClick={toggleBlank}
            >
              {blank ? 'Resume screen (B)' : 'Blank screen (B)'}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                broadcast({
                  type: 'clear-scripture',
                  planIdentity: planIdentityRef.current,
                })
              }
            >
              Clear scripture
            </Button>

            {/* Live-only, and it has to read that way at a glance. An operator
                who believed this had changed the deck would stop asking for the
                real setting to be fixed, and the next download would surprise
                them; hence the badge on the label rather than a tooltip, and
                the explicit line below whenever the two disagree. */}
            <Label
              htmlFor="live-transition"
              className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                Transition
                <span
                  className={`${BADGE_CLASS} border-border bg-muted text-muted-foreground`}
                >
                  Live only · not saved
                </span>
              </span>
              <Select
                value={liveTransition}
                onValueChange={(value) => {
                  setTransitionAndSync(parseSlideTransition(value));
                  // Hand the keyboard straight back to the deck. A focused select
                  // owns the arrow keys, so the very next press for "next slide"
                  // would silently pick another style instead of moving on.
                  blurFocusedControl();
                }}
              >
                <SelectTrigger id="live-transition" size="sm" className="w-[9.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLIDE_TRANSITIONS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {SLIDE_TRANSITION_SPECS[id].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>

            {/* Live background override (AD-34, UC-27) */}
            <Label
              htmlFor="live-background"
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                Background
                <span
                  className={`${BADGE_CLASS} border-border bg-muted text-muted-foreground`}
                >
                  Live only · not saved
                </span>
              </span>
              <Select
                value={liveBackground || 'default'}
                onValueChange={(value) => {
                  setBackgroundAndSync(value === 'default' ? null : value);
                  blurFocusedControl();
                }}
              >
                <SelectTrigger id="live-background" size="sm" className="w-[9.5rem]">
                  <SelectValue placeholder="Deck default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Deck default</SelectItem>
                  {backgroundLibrary.map((bg) => (
                    <SelectItem key={bg.id} value={bg.url}>
                      {bg.url.split('/').pop() || `Image ${bg.id}`} {bg.isDefault ? '(Default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>

            {liveTransition !== deckTransition ? (
              <p role="status" className="basis-full text-xs text-amber-300">
                Projecting with {SLIDE_TRANSITION_SPECS[liveTransition].label}{' '}
                for this session only — nothing was saved. The deck stays on{' '}
                {SLIDE_TRANSITION_SPECS[deckTransition].label}, and so do PPTX
                downloads and the next Presenter you open.
              </p>
            ) : null}
          </div>

          {/* The filmstrip. Scrolling lives inside this container, so a 62-slide
              deck never widens the page — `min-w-0` on the column is what lets
              the flex child be narrower than its content. */}
          <section
            aria-label="Slide filmstrip"
            className={`min-w-0 shrink-0 overflow-hidden ${PANEL_CLASS}`}
          >
            <div className="flex gap-2 overflow-x-auto p-1.5 [scrollbar-width:thin]">
              {entries.map((entry) => (
                <FilmstripFrame
                  key={entry.instanceId}
                  slide={slides[entry.index]}
                  entry={entry}
                  active={entry.index === index}
                  activeRef={activeFrameRef}
                  onSelect={manualNavigate}
                />
              ))}
            </div>
          </section>

          <section
            className={`flex min-h-0 flex-1 flex-col overflow-hidden ${PANEL_CLASS}`}
          >
            <h2 className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Slides
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5 max-lg:max-h-[45vh]">
              {rows.map((row) =>
                row.kind === 'slide' ? (
                  <SlideListRow
                    key={row.key}
                    entry={row.entry}
                    active={row.entry.index === index}
                    activeRef={activeRowRef}
                    onSelect={manualNavigate}
                  />
                ) : (
                  <div
                    key={row.key}
                    className={`my-1 rounded ${
                      rowContainsIndex(row, index) ? 'bg-muted/40' : ''
                    }`}
                  >
                    <p className="flex items-center gap-1.5 px-2 pt-1.5 pb-1 text-xs">
                      <span
                        className={`${BADGE_CLASS} ${
                          row.groupKind === 'announcement'
                            ? 'border-purple-400/40 bg-purple-400/15 text-purple-200 dark:border-purple-400/40 dark:bg-purple-400/15 dark:text-purple-200'
                            : 'border-primary/40 bg-primary/15 text-primary'
                        }`}
                      >
                        {row.groupKind === 'announcement' ? 'Announcement' : 'Song Set'}
                      </span>
                      <span className="truncate font-medium">{row.label}</span>
                    </p>
                    <div className="ml-3 border-l border-border pl-1">
                      {row.entries.map((entry) => (
                        <SlideListRow
                          key={entry.instanceId}
                          entry={entry}
                          active={entry.index === index}
                          activeRef={activeRowRef}
                          onSelect={manualNavigate}
                        />
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        </div>

        <aside className="flex min-h-0 min-w-0 flex-col gap-4 lg:flex-1 lg:basis-[18rem]">
          <section>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Next
            </p>
            <div className="aspect-video w-full max-w-[32rem] overflow-hidden rounded-lg border border-border bg-black">
              {next ? (
                <SlideView slide={next} />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  End of deck — nothing after this slide.
                </div>
              )}
            </div>
          </section>

          <section className={`p-3 ${PANEL_CLASS}`}>
            <h2 className="mb-2 text-sm font-semibold">
              {t('presenter.scripture.title')}
            </h2>
            <p className="mb-2 text-xs text-muted-foreground">
              {t('presenter.scripture.hint')}
            </p>
            {bibleTranslations.length > 0 ? (
              <div className="mb-2">
                <Label
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                  htmlFor="presenter-bible-translation"
                >
                  {t('presenter.scripture.translation')}
                </Label>
                <Select
                  value={scriptureTranslation}
                  onValueChange={(value) => {
                    if (value) setScriptureTranslation(value);
                    blurFocusedControl();
                  }}
                >
                  <SelectTrigger id="presenter-bible-translation" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bibleTranslations.map((row) => (
                      <SelectItem key={row.code} value={row.code}>
                        {row.name ? `${row.name} (${row.code})` : row.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bibleDefaultMissing ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('presenter.scripture.defaultMissing')}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="mb-2">
              <ScriptureRefAutocomplete
                value={scriptureRef}
                onChange={setScriptureRef}
                translation={scriptureTranslation || undefined}
                placeholder={t('presenter.scripture.placeholder')}
                inputClassName="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void pushScripture();
                  }
                }}
              />
            </div>
            <Button
              size="sm"
              onClick={() => void pushScripture()}
              disabled={scriptureBusy || !scriptureRef.trim()}
            >
              {scriptureBusy
                ? t('presenter.scripture.lookingUp')
                : t('presenter.scripture.push')}
            </Button>
            {scriptureError && (
              <p className="mt-2 text-xs text-amber-300">{scriptureError}</p>
            )}
          </section>

          <section
            className={`flex min-h-0 flex-1 flex-col overflow-hidden ${PANEL_CLASS}`}
          >
            <h2 className="border-b border-border px-3 py-2 text-sm font-semibold">
              Run-Sheet
            </h2>
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm max-lg:max-h-[45vh]">
              {runSheetItems.map((item, i) => (
                <li key={i} className="border-b border-border/70 pb-2">
                  {item.type === 'section' ? (
                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                      {item.title}
                      {item.timing ? (
                        <span className="ml-2 font-normal normal-case">
                          ({item.timing})
                        </span>
                      ) : null}
                    </div>
                  ) : item.type === 'role' ? (
                    <div className="flex justify-between gap-2">
                      <span>{item.role}</span>
                      <span className="text-muted-foreground">
                        {item.name}
                        {item.timing ? ` · ${item.timing}` : ''}
                      </span>
                    </div>
                  ) : item.type === 'hymn' ? (
                    <div>
                      #{item.number} · {item.title}
                      {item.timing ? (
                        <span className="text-muted-foreground">
                          {' '}
                          ({item.timing})
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </main>

      <SlideGridDialog
        open={gridOpen}
        onOpenChange={setGridOpen}
        slides={slides}
        entries={entries}
        currentIndex={index}
        onPick={(picked) => {
          manualNavigate(picked);
          setGridOpen(false);
        }}
      />

      <Dialog open={remoteDialogOpen} onOpenChange={setRemoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mobile Remote Pairing</DialogTitle>
            <DialogDescription>
              Scan or enter this 6-digit code on a mobile device to control presentation slides remotely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/40 p-4">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pairing Code
              </span>
              <div className="mt-1 font-mono text-4xl font-bold tracking-[0.25em] text-foreground select-all">
                {remoteCode || '------'}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Code expires in 60 seconds if unclaimed.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
              <span className="text-muted-foreground font-medium">Status</span>
              <span className="flex items-center gap-1.5 font-medium">
                <span
                  className={cn(
                    'inline-block h-2 w-2 rounded-full',
                    remoteState === 'connected'
                      ? 'bg-emerald-500'
                      : remoteState === 'pairing'
                      ? 'bg-amber-400 animate-pulse'
                      : remoteState === 'error' || remoteState === 'role-lost'
                      ? 'bg-destructive'
                      : 'bg-muted-foreground/50'
                  )}
                />
                <span className="capitalize">
                  {remoteState === 'connected'
                    ? 'Presenter Ready · Awaiting Mobile'
                    : remoteState === 'pairing'
                    ? 'Awaiting Connection'
                    : remoteState === 'role-lost'
                    ? 'Role Reassigned'
                    : remoteState === 'error'
                    ? 'Connection Error'
                    : 'Disconnected'}
                </span>
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">
                Mobile URL
              </span>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={
                    typeof window !== 'undefined'
                      ? `${window.location.origin}/services/${serviceId}/remote`
                      : `/services/${serviceId}/remote`
                  }
                  className="font-mono text-xs select-all"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      void navigator.clipboard?.writeText(
                        `${window.location.origin}/services/${serviceId}/remote`
                      );
                    }
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={remoteActionBusy}
                onClick={async () => {
                  setRemoteActionBusy(true);
                  try {
                    await remoteSessionRef.current?.start();
                  } finally {
                    setRemoteActionBusy(false);
                  }
                }}
              >
                Regenerate Code
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={remoteActionBusy}
                onClick={async () => {
                  setRemoteActionBusy(true);
                  try {
                    await remoteSessionRef.current?.disconnect();
                    setRemoteCode(null);
                  } finally {
                    setRemoteActionBusy(false);
                  }
                }}
              >
                Disconnect
              </Button>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setRemoteDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
