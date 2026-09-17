/**
 * Live Preview projection of a hydrated artifact plan.
 *
 * Operators read the preview list to sanity-check a rundown before generating,
 * so it must speak their vocabulary ("Song Lyric", "Theme Verse") rather than
 * the registry's PascalCase template labels or the planner's internal slide
 * kinds. That translation lives here and nowhere else — the forms only pick a
 * CSS class for the tone this module returns.
 *
 * Entries stay a flat, linearly indexed list: `index` is the presentation
 * position of the slide, identical to its position in `buildSlidePlan` output.
 * SongSet grouping is expressed *on the children* (`groupId` / `groupLabel` /
 * `role`) instead of as a node of its own, so nesting the UI can never reorder
 * or renumber slides.
 */
import { kindChipLabel, type ArtifactBaseType } from '@/lib/registry/types';
import type { I18nKey } from '@/lib/i18n';
import {
  flattenArtifactPlan,
  type ArtifactInstance,
  type ArtifactNode,
} from './runtime-contract';

export type PreviewEntry = {
  /** Stable 0-based linear presentation index across the whole plan. */
  index: number;
  instanceId: string;
  templateId: string;
  /** Operator-recognizable label; never a raw PascalCase template label. */
  label: string;
  baseType: ArtifactBaseType;
  /** Present only on members of a group (currently SongSets). */
  groupId?: string;
  groupLabel?: string;
  role?: 'title' | 'lyric';
  roleLabel?: string;
};

export type PreviewBadgeTone =
  | 'song-title'
  | 'song-lyric'
  | 'scripture'
  | 'image'
  | 'default';

/** SongSet reuses one template across three layouts; the layout names the slide. */
const SONG_SET_LABELS: Readonly<Record<string, string>> = {
  title: 'Song Title',
  verse: 'Song Verse',
  reff: 'Song Reff',
  chorus: 'Song Reff',
  lyric: 'Song Verse',
  default: 'Song Verse',
};

/** Templates whose content is scripture, regardless of their base type. */
export const SCRIPTURE_TEMPLATE_IDS: ReadonlySet<string> = new Set([
  'verse-reading',
  'bible-verse-contemplation',
]);

/**
 * Templates whose slide is primarily a picture. Story 20.5 may replace this
 * id-list with a Placeholder Catalog key check.
 */
export const IMAGE_TEMPLATE_IDS: ReadonlySet<string> = new Set([
  'sermon-flyer',
]);

/** `ClosingPrayer_DS` → `Closing Prayer DS`; `family-youth` → `Family Youth`. */
function humanize(raw: string): string {
  const spaced = raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return raw;
  return spaced
    .split(' ')
    .map((word) => (/[A-Z]/.test(word) ? word : word[0].toUpperCase() + word.slice(1)))
    .join(' ');
}

/** The label an operator should see for one hydrated slide. */
export function previewLabel(instance: ArtifactInstance): string {
  // Non-throwing on purpose: this is reached from the Presenter render and from
  // /api/services/preview, and an unrecognised key must fall through to the
  // label rather than 500 the preview or crash the page.
  if (instance.baseType && kindChipLabel(instance.baseType) === 'song-set') {
    if (instance.layoutKey === 'title' || instance.group?.role === 'title') {
      return 'Song Title';
    }
    const roleLabel = instance.group?.roleLabel?.trim().toLowerCase() || '';
    if (
      instance.layoutKey === 'reff' ||
      roleLabel === 'reff' ||
      roleLabel.startsWith('reff') ||
      roleLabel === 'chorus' ||
      roleLabel.startsWith('chorus')
    ) {
      return 'Song Reff';
    }
    if (
      instance.layoutKey === 'verse' ||
      instance.layoutKey === 'lyric' ||
      instance.group?.role === 'lyric'
    ) {
      return 'Song Verse';
    }
    return SONG_SET_LABELS[instance.layoutKey] ?? 'Song Verse';
  }
  const trimmed = instance.label?.trim();
  if (trimmed) {
    return trimmed;
  }
  return humanize(instance.templateId);
}

function ordinalBadge(prefix: 'song-set' | 'ann-set', ordinal?: number): string {
  return ordinal !== undefined ? `${prefix}-${ordinal}` : prefix;
}

/**
 * Resolves the badge string for a SongSet group header given its ordinal.
 * No translator is needed because group-ordinal badges are closed English identifiers ('song-set-N').
 */
export function resolveSongSetGroupBadge(groupOrdinal?: number): string {
  return ordinalBadge('song-set', groupOrdinal);
}

/**
 * Resolves the badge string for a preview row following DEC-004:
 * - song-set child with role 'title': localized role 'title'
 * - song-set child with role 'lyric': localized lyric role ('verse N', 'reff', 'chorus')
 * - standalone song-set row: 'song-set-N' (or 'song-set' if no ordinal)
 * - standalone ann-set row: 'ann-set-N' (or 'ann-set' if no ordinal)
 * - every other row: 'general'. The badge vocabulary is a closed set, so a
 *   slide's internal kind is never surfaced in it; the title cell beside the
 *   badge carries the specifics.
 */
export function resolvePreviewBadge(
  slide: { title?: string; kind?: string } | undefined,
  entry:
    | {
        label?: string;
        baseType?: ArtifactBaseType;
        role?: 'title' | 'lyric';
        groupId?: string;
        roleLabel?: string;
      }
    | undefined,
  options:
    | {
        groupOrdinal?: number;
      }
    | undefined,
  t: (key: I18nKey) => string
): string {
  // 1. Song set child rows
  if (entry?.groupId || entry?.role) {
    if (entry.role === 'title') {
      return t('form.preview.role.title');
    }
    if (entry.role === 'lyric' || slide?.kind === 'song-lyric') {
      const lyricLabel = entry.roleLabel?.trim() || slide?.title?.trim() || '';
      const lower = lyricLabel.toLowerCase();
      if (lower === 'reff' || lower.startsWith('reff')) {
        return t('form.preview.role.reff');
      }
      if (lower === 'chorus' || lower.startsWith('chorus')) {
        return t('form.preview.role.chorus');
      }
      // Check for verse number like "1/3", "1", "Verse 1", etc.
      const match = lyricLabel.match(/^(\d+)(?:\/\d+)?$/) || lyricLabel.match(/^verse\s*(\d+)/i);
      if (match) {
        return t('form.preview.role.verse').replace(/\{n\}/g, match[1]);
      }
      if (lyricLabel) {
        return lyricLabel.toLowerCase();
      }
      return t('form.preview.role.lyric');
    }
  }

  // 2. Base type / kind check
  const baseType = entry?.baseType;
  const chip = baseType ? kindChipLabel(baseType) : (slide?.kind?.trim() || 'general');

  if (chip === 'song-set') {
    return ordinalBadge('song-set', options?.groupOrdinal);
  }

  if (chip === 'marker' || baseType === 'ann-set-marker' || chip === 'announcement') {
    return ordinalBadge('ann-set', options?.groupOrdinal);
  }

  return 'general';
}

/**
 * Derives the title displayed for a preview row following the priority chain:
 * explicit slide title -> entry label -> entry baseType chip -> slide kind -> fallback.
 */
export function resolvePreviewTitle(
  slide?: { title?: string; kind?: string },
  entry?: {
    label?: string;
    baseType?: ArtifactBaseType;
    role?: 'title' | 'lyric';
    groupId?: string;
    groupLabel?: string;
  },
  fallback = 'Untitled slide'
): string {
  // If it's a song-set lyric child, the badge says the verse role (e.g. "verse 1", "reff"),
  // so the title cell may be empty or show slide.title if it is a real title (not just the verse label).
  if (entry?.role === 'lyric') {
    // If slide.title is just a verse number/reff label (e.g. "1/3", "Reff"), omit it so title cell is empty
    const slideTitle = slide?.title?.trim();
    if (slideTitle) {
      const lower = slideTitle.toLowerCase();
      if (
        lower === 'reff' ||
        lower === 'chorus' ||
        /^\d+(\/\d+)?$/.test(slideTitle) ||
        /^verse\s*\d+/i.test(slideTitle)
      ) {
        return '';
      }
      return slideTitle;
    }
    return '';
  }

  // If it's a song-set title child, show the groupLabel (hymn title) or slide.title
  if (entry?.role === 'title') {
    const slideTitle = slide?.title?.trim();
    if (slideTitle) return slideTitle;
    if (entry.groupLabel?.trim()) return entry.groupLabel.trim();
    if (entry.label?.trim() && entry.label !== 'Song Title') return entry.label.trim();
    return '';
  }

  const slideTitle = slide?.title?.trim();
  if (slideTitle) return slideTitle;

  const entryLabel = entry?.label?.trim();
  if (entryLabel) return entryLabel;

  if (entry?.baseType) {
    const chip = kindChipLabel(entry.baseType);
    if (chip !== 'unknown') return chip;
  }

  const slideKind = slide?.kind?.trim();
  if (slideKind) return slideKind;

  return fallback;
}

/**
 * Stable tone key both forms map to their own class table, so the two preview
 * panes cannot drift into different colours for the same kind of slide.
 */
export function previewBadgeTone(entry: PreviewEntry): PreviewBadgeTone {
  if (entry.role === 'title') return 'song-title';
  if (entry.role === 'lyric') return 'song-lyric';
  if (SCRIPTURE_TEMPLATE_IDS.has(entry.templateId)) return 'scripture';
  // `kindChipLabel`, not `kindOf`: this runs inside SlidePreviewList's render and
  // there is no ErrorBoundary in src/, so an unrecognised key must degrade to a
  // tone rather than take the whole preview list down. The old `IMAGE_BASE_TYPES`
  // lookup could not throw; this keeps that property.
  if (
    kindChipLabel(entry.baseType) === 'announcement' ||
    IMAGE_TEMPLATE_IDS.has(entry.templateId)
  ) {
    return 'image';
  }
  return 'default';
}

function toEntry(instance: ArtifactInstance, index: number): PreviewEntry {
  const entry: PreviewEntry = {
    index,
    instanceId: instance.instanceId,
    templateId: instance.templateId,
    label: previewLabel(instance),
    baseType: instance.baseType,
  };
  if (instance.group) {
    entry.groupId = instance.group.id;
    entry.groupLabel = instance.group.label;
    entry.role = instance.group.role;
    if (instance.group.roleLabel) {
      entry.roleLabel = instance.group.roleLabel;
    }
  }
  return entry;
}

/**
 * Flat preview entries in presentation order. Group nodes contribute their
 * children only — a group never occupies an index of its own.
 */
export function buildPreviewEntries(plan: ArtifactNode[]): PreviewEntry[] {
  return flattenArtifactPlan(plan).map(toEntry);
}
