/**
 * Pure projection of a slide plan into the Presenter's slide list and jump grid.
 *
 * Labels, ordering and SongSet grouping are *not* decided here: they come from
 * `@/lib/artifacts/preview-model`, which is already the single operator-facing
 * taxonomy (the badge logic drifted once before it was consolidated there). This
 * module only adapts the flat `SlidePlanItem[]` the Presenter receives into that
 * projection and folds contiguous SongSet children into rows the list and the
 * grid can both draw.
 *
 * Everything here is a pure function of its arguments so the arrangement is
 * testable without a browser — see `tests/presenter-model.test.mjs`.
 */
import {
  buildPreviewEntries,
  previewBadgeTone,
  type PreviewBadgeTone,
  type PreviewEntry,
} from '@/lib/artifacts/preview-model';
import type { ArtifactNode } from '@/lib/artifacts/runtime-contract';
import type { SlidePlanItem } from '@/lib/slide-plan';

/**
 * A preview entry plus the legacy headline the plan already carries, so a row
 * can show both what kind of slide it is and which one it is.
 */
export type PresenterEntry = PreviewEntry & {
  tone: PreviewBadgeTone;
  title?: string;
  subtitle?: string;
};

/** One block of the list / grid: a standalone slide or a whole group (SongSet or AnnouncementSet). */
export type PresenterRow =
  | { kind: 'slide'; key: string; entry: PresenterEntry }
  | {
      kind: 'group';
      key: string;
      label: string;
      groupKind: 'song-set' | 'announcement';
      entries: PresenterEntry[];
    };

/**
 * The Presenter is handed the flattened plan, but `buildPreviewEntries` reads
 * the hierarchical one. Rewrapping each item as a leaf loses nothing: SongSet
 * membership travels on `instance.group`, and a group node never occupied an
 * index of its own, so indexes stay identical either way.
 */
function toArtifactNodes(slides: readonly SlidePlanItem[]): ArtifactNode[] {
  return slides.map((slide) => ({ kind: 'artifact', instance: slide.artifact }));
}

/**
 * Badge classes for the Presenter's two surfaces (slide list and jump grid).
 *
 * The tone itself comes from `previewBadgeTone`; only the class table is local,
 * because the Presenter is a dark surface and the light-theme shades the forms
 * use (`text-emerald-600` on `bg-emerald-500/10`) are unreadable on it. Both
 * Presenter surfaces read this one table so they cannot drift from each other.
 */
export const PRESENTER_TONE_CLASS: Readonly<Record<PreviewBadgeTone, string>> = {
  'song-title': 'border-sky-400/40 bg-sky-400/15 text-sky-200',
  'song-lyric': 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200',
  scripture: 'border-amber-400/40 bg-amber-400/15 text-amber-200',
  image: 'border-indigo-400/40 bg-indigo-400/15 text-indigo-200',
  default: 'border-border bg-muted text-muted-foreground',
};

/** Slide-list / grid entries in presentation order; `index` is the slide index. */
export function buildPresenterEntries(
  slides: readonly SlidePlanItem[]
): PresenterEntry[] {
  return buildPreviewEntries(toArtifactNodes(slides)).map((entry) => {
    const slide = slides[entry.index];
    const row: PresenterEntry = { ...entry, tone: previewBadgeTone(entry) };
    const title = slide?.title?.trim();
    const subtitle = slide?.subtitle?.trim();
    if (title) row.title = title;
    if (subtitle) row.subtitle = subtitle;
    return row;
  });
}

/**
 * Contiguous members of one group (SongSet or AnnouncementSet) collapse into a
 * single group row so the operator sees e.g. "Warta Jemaat · 3 slides" rather than
 * three look-alikes. Group children are always contiguous in the plan, so this never reorders.
 */
export function buildPresenterRows(
  entries: readonly PresenterEntry[]
): PresenterRow[] {
  const rows: PresenterRow[] = [];
  for (const entry of entries) {
    if (!entry.groupId) {
      rows.push({ kind: 'slide', key: entry.instanceId, entry });
      continue;
    }
    const last = rows[rows.length - 1];
    if (last && last.kind === 'group' && last.key === entry.groupId) {
      last.entries.push(entry);
      continue;
    }
    const isAnn =
      entry.role === 'announcement' ||
      (entry.groupId != null && entry.groupId.startsWith('ann-'));
    const groupKind: 'song-set' | 'announcement' = isAnn ? 'announcement' : 'song-set';
    const defaultLabel = isAnn ? 'Announcement' : 'Song Set';

    rows.push({
      kind: 'group',
      key: entry.groupId,
      label: entry.groupLabel || defaultLabel,
      groupKind,
      entries: [entry],
    });
  }
  return rows;
}

/** The only place a slide index is bounded; `0` for an empty deck. */
export function clampSlideIndex(index: number, length: number): number {
  if (length <= 0 || !Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), length - 1);
}

/** The entry the Presenter is currently showing, or `null` for an empty deck. */
export function activePresenterEntry(
  entries: readonly PresenterEntry[],
  index: number
): PresenterEntry | null {
  return entries[clampSlideIndex(index, entries.length)] ?? null;
}

/** Whether a row owns the active slide — the list highlights and scrolls it. */
export function rowContainsIndex(row: PresenterRow, index: number): boolean {
  return row.kind === 'slide'
    ? row.entry.index === index
    : row.entries.some((entry) => entry.index === index);
}

/**
 * Grid selection movement. Kept pure (and separate from the DOM) so "arrows move
 * the grid, not the deck" is a property of data rather than of an event handler:
 * the caller passes the measured column count and gets the next index back.
 */
export function moveGridSelection(
  current: number,
  key: string,
  columns: number,
  length: number
): number {
  if (length <= 0) return 0;
  const cols = Math.max(1, Math.trunc(columns));
  const at = clampSlideIndex(current, length);
  switch (key) {
    case 'ArrowRight':
      return clampSlideIndex(at + 1, length);
    case 'ArrowLeft':
      return clampSlideIndex(at - 1, length);
    case 'ArrowDown':
    case 'PageDown':
      return clampSlideIndex(at + cols, length);
    case 'ArrowUp':
    case 'PageUp':
      return clampSlideIndex(at - cols, length);
    case 'Home':
      return 0;
    case 'End':
      return length - 1;
    default:
      return at;
  }
}

/** Keys `moveGridSelection` answers to; the grid swallows exactly these. */
export function isGridNavigationKey(key: string): boolean {
  return (
    key === 'ArrowRight' ||
    key === 'ArrowLeft' ||
    key === 'ArrowDown' ||
    key === 'ArrowUp' ||
    key === 'PageDown' ||
    key === 'PageUp' ||
    key === 'Home' ||
    key === 'End'
  );
}

/** Whether a slide is an announcement slide based on templateId, baseType, or title. */
export function isAnnouncementSlide(slide: SlidePlanItem | undefined): boolean {
  if (!slide) return false;
  if (slide.artifact?.group?.role === 'announcement') return true;
  const templateId = slide.artifact?.templateId ?? '';
  const baseType = (slide.artifact as any)?.baseType ?? '';
  const title = slide.title?.toLowerCase() ?? '';
  return (
    templateId.startsWith('ann-slide-') ||
    templateId.startsWith('announcement') ||
    templateId === 'announcements-header' ||
    templateId === 'announcement-flyer' ||
    baseType === 'announcement' ||
    title.includes('announcement')
  );
}

/**
 * Computes the contiguous [startIndex, endIndex] of the announcement section
 * enclosing currentIndex, or null if currentIndex is not within an announcement slide.
 */
export function findAnnouncementSectionBounds(
  slides: readonly SlidePlanItem[],
  currentIndex: number
): [number, number] | null {
  if (slides.length === 0 || currentIndex < 0 || currentIndex >= slides.length) {
    return null;
  }
  if (!isAnnouncementSlide(slides[currentIndex])) {
    return null;
  }

  let start = currentIndex;
  while (start > 0 && isAnnouncementSlide(slides[start - 1])) {
    start--;
  }

  let end = currentIndex;
  while (end < slides.length - 1 && isAnnouncementSlide(slides[end + 1])) {
    end++;
  }

  return [start, end];
}

/**
 * Given the current slide index and the announcement section [start, end],
 * computes the next slide index in the loop, wrapping from end to start.
 */
export function computeNextLoopIndex(
  currentIndex: number,
  bounds: [number, number]
): number {
  const [start, end] = bounds;
  if (start >= end) {
    return start;
  }
  if (currentIndex < start || currentIndex >= end) {
    return start;
  }
  return currentIndex + 1;
}

/**
 * Model projection for the Presenter's Run-Sheet raw text sidebar (SPEC-67).
 *
 * Resolves raw rundown text into the exact string to render and whether
 * it represents empty content. If empty/whitespace-only, returns the
 * localized fallback key string so the UI can render the empty placeholder.
 * If populated, preserves the raw payload verbatim (100% textContent equality).
 */
export function formatPresenterRunSheet(
  rundownText: string | undefined | null,
  emptyFallback: string
): { text: string; isEmpty: boolean } {
  if (!rundownText || !rundownText.trim()) {
    return { text: emptyFallback, isEmpty: true };
  }
  return { text: rundownText, isEmpty: false };
}

