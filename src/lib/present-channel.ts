import { parseSlideTransition, type SlideTransition } from './transitions';

/**
 * The Presenter → projector wire.
 *
 * The Presenter is the single authority. Every message that touches shared
 * state carries the *intended* value rather than an instruction to flip one:
 * a bare "toggle blank" is fragile because two windows that missed different
 * messages disagree about whose turn it is, and they stay disagreeing. With the
 * state on the wire, a late or duplicated message is idempotent. The same rule
 * is why `transition` names the style it wants rather than saying "next style":
 * two projectors given a cycle instruction would end up on different styles the
 * moment one of them missed a message, and they would never converge again.
 *
 * `sync` therefore answers `request-sync` with the deck position, the blank
 * state *and* the live transition, so a projector opened or reloaded mid-session
 * comes up correct on the one round trip it already makes.
 */
export type SlidePatch = {
  index: number;
  artifact: any;
  patchRevision: number;
};

export type PresentMessage =
  | {
      type: 'sync';
      index: number;
      blank: boolean;
      transition: SlideTransition;
      background?: string | null;
      scripture?: { reference: string; text: string } | null;
      planIdentity: string;
      patches?: SlidePatch[];
    }
  | {
      type: 'slide-patch';
      index: number;
      artifact: any;
      patchRevision: number;
      planIdentity: string;
    }
  | { type: 'request-sync' }
  /**
   * The projector reporting its own liveness, and nothing else (`AD-29`).
   * Sent unprompted by the projector window for as long as it is mounted;
   * the presenter only ever observes it. It carries no `index`, no `blank`,
   * no `transition`, no `planIdentity` and no other shared state, which is
   * what puts it outside this file's own header contract above rather than
   * in tension with it — that contract governs every message that touches
   * shared state, and this one touches none. `request-sync` already is the
   * projector's first hello (`ProjectorClient.tsx`'s mount-time post), so
   * this is not a second one: it is the same announcement, repeated for as
   * long as the window lives. Idempotent by construction — two in one
   * window, or one arriving late, both mean only "something was alive at
   * that moment" — so no sequence number or request/response pairing may
   * be layered over it.
   */
  | { type: 'projector-alive' }
  | { type: 'blank'; blank: boolean; planIdentity: string }
  /**
   * A live-only override of the deck's configured transition. Nothing stores
   * it: it exists for the length of a Presenter session and no longer.
   */
  | { type: 'transition'; transition: SlideTransition; planIdentity: string }
  /**
   * A live-only override of the Verse/Reff background (AD-34). Nothing stores
   * it: it exists for the length of a Presenter session and no longer.
   */
  | {
      type: 'background';
      background: string | null;
      planIdentity: string;
    }
  | {
      type: 'scripture';
      reference: string;
      text: string;
      planIdentity: string;
    }
  | { type: 'clear-scripture'; planIdentity: string };

/**
 * The blank state a message asserts, or `null` when it says nothing about it —
 * blanking must not disturb the scripture overlay or the deck position, so
 * `scripture` and `clear-scripture` deliberately leave it alone.
 *
 * The coercion matters at the boundary: the payload comes from another window,
 * which may still be running the build that had no `blank` field at all. Absent
 * reads as "not blanked" rather than leaving the projector in an undefined
 * state.
 */
export function blankStateOf(msg: PresentMessage): boolean | null {
  if (msg.type === 'sync' || msg.type === 'blank') return msg.blank === true;
  return null;
}

/**
 * The transition a message asserts, or `null` when it says nothing about it.
 *
 * Note where this deliberately parts company with `blankStateOf`. Absent is not
 * a value here. A projector already holds the deck's configured style, handed
 * to it by its own server render, so a message that carries no transition at
 * all — a payload from a window still running the build that had no such field
 * — must leave that setting alone rather than assert the default over it. There
 * is no equivalent fallback for blanking, which is why absent resolves to
 * `false` there and to `null` here.
 *
 * A field that *is* present but unrecognised is a different case: something on
 * the wire is wrong, and the projector still has to render. `parseSlideTransition`
 * coerces it to the default rather than throwing, exactly as a junk settings row
 * does on the server.
 */
export function liveTransitionOf(msg: PresentMessage): SlideTransition | null {
  if (msg.type !== 'sync' && msg.type !== 'transition') return null;
  // Widened on purpose: the declared type says this field is there, and the
  // sending window is the one thing that cannot be trusted to agree.
  const value: unknown = msg.transition;
  return value === undefined ? null : parseSlideTransition(value);
}

/**
 * The live background override a message asserts, or `undefined` when it says
 * nothing about it (`null` means clearing the live session override back to
 * Deck default, not wiping the slide background).
 */
export function liveBackgroundOf(msg: PresentMessage): string | null | undefined {
  if (msg.type === 'sync') {
    return msg.background !== undefined ? msg.background : undefined;
  }
  if (msg.type === 'background') {
    return msg.background !== undefined ? msg.background : null;
  }
  return undefined;
}

/**
 * Returns the slide patch from a slide-patch message, or null if invalid/irrelevant.
 * Enforces strict integer indexing, finite positive monotonic revisions, and structured layout.
 */
export function slidePatchOf(msg: PresentMessage): SlidePatch | null {
  if (!msg || typeof msg !== 'object') return null;
  if (msg.type !== 'slide-patch') return null;
  if (typeof msg.index !== 'number' || !Number.isInteger(msg.index) || msg.index < 0) {
    return null;
  }
  if (
    typeof msg.patchRevision !== 'number' ||
    !Number.isFinite(msg.patchRevision) ||
    !Number.isInteger(msg.patchRevision) ||
    msg.patchRevision <= 0
  ) {
    return null;
  }
  if (
    !msg.artifact ||
    typeof msg.artifact !== 'object' ||
    !msg.artifact.layout ||
    typeof msg.artifact.layout !== 'object' ||
    !Array.isArray(msg.artifact.layout.elements)
  ) {
    return null;
  }
  return {
    index: msg.index,
    artifact: msg.artifact,
    patchRevision: msg.patchRevision,
  };
}

/**
 * Returns any slide patches carried by a sync message, or null if absent.
 */
export function syncPatchesOf(msg: PresentMessage): SlidePatch[] | null {
  if (msg.type !== 'sync' || !Array.isArray(msg.patches)) return null;
  return msg.patches.filter(
    (p) =>
      typeof p.index === 'number' &&
      Number.isInteger(p.index) &&
      p.index >= 0 &&
      typeof p.patchRevision === 'number' &&
      Number.isFinite(p.patchRevision) &&
      Number.isInteger(p.patchRevision) &&
      p.patchRevision > 0 &&
      p.artifact &&
      typeof p.artifact === 'object' &&
      p.artifact.layout &&
      typeof p.artifact.layout === 'object' &&
      Array.isArray(p.artifact.layout.elements)
  );
}

/**
 * Whether `msg` is one the *projector* itself would send — the only two
 * variants that may count as liveness evidence (`AD-29`, Review finding
 * [High, blocking]). Every other variant on this channel is presenter-
 * authored state (`sync`, `blank`, `transition`, `scripture`,
 * `clear-scripture`); a second Presenter tab open on the same service
 * broadcasts those too, on the same channel, and none of them is the
 * projector answering. The presenter's liveness listener gates its
 * acknowledgement on this predicate rather than treating every inbound
 * object as evidence of life.
 */
export function isProjectorMessage(msg: PresentMessage): boolean {
  return msg.type === 'request-sync' || msg.type === 'projector-alive';
}

/**
 * The plan identity a shared-state message asserts, or `null` when the
 * message is projector-originated (AD-29: no shared state) or the field is
 * missing. A missing field is not "match whatever I hold" — AD-10 is
 * fail-closed, so the receiver must refuse.
 */
export function sharedStatePlanIdentity(msg: PresentMessage): string | null {
  if (isProjectorMessage(msg)) return null;
  const value: unknown = (msg as { planIdentity?: unknown }).planIdentity;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Whether the receiver may adopt index, blank, transition, or overlay. */
export function adoptsSharedState(
  msg: PresentMessage,
  ownIdentity: string
): boolean {
  const theirs = sharedStatePlanIdentity(msg);
  return theirs !== null && theirs === ownIdentity;
}

export function presentChannelName(serviceId: number | string): string {
  return `worship-deck-present-${serviceId}`;
}

export function openPresentChannel(
  serviceId: number | string
): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(presentChannelName(serviceId));
}
