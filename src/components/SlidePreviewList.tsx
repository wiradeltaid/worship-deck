/**
 * Live Slide Preview list, shared verbatim by the create and edit forms.
 *
 * Both forms used to inline the same badge if-chain and drifted apart; the list
 * lives here exactly once so they cannot. Labels, grouping and badge tone come
 * from `@/lib/artifacts/preview-model` — this file only owns the tone → CSS
 * class table and the nesting markup.
 */
import {
  previewBadgeTone,
  resolveAnnouncementGroupBadge,
  resolvePreviewBadge,
  resolvePreviewTitle,
  resolveSongSetGroupBadge,
  type PreviewBadgeTone,
  type PreviewEntry,
} from '@/lib/artifacts/preview-model';
import { useT } from '@/lib/i18n/operator';

/** Legacy slide payload the API still returns; used for the visible content. */
export type SlidePreviewItem = {
  id?: string;
  kind?: string;
  title?: string;
  subtitle?: string;
  body?: string;
};

/**
 * The `song-title` and `default` tones paint from theme tokens and follow the
 * operator's theme on their own — measured on the dark surface at 11.09:1 and
 * 5.86:1. The three chromatic tones do not: their `-600` shades were chosen
 * against white, and Story 17.1 made this list dark-switchable (it renders in
 * both forms' Live Slide Preview, which is hub chrome). Measured on dark `--card`
 * they were `text-emerald-600` **4.23:1**, `text-amber-600` 4.76:1 and
 * `text-indigo-600` **2.54:1** — the last below even the 3:1 large-text floor.
 *
 * The `dark:` halves are the shades from `PRESENTER_TONE_CLASS`
 * (`present/presenter-model.ts`), which exists because that surface has always
 * been dark and needed shades that survive it. Ported rather than re-invented,
 * and re-measured here: 10.56:1, 10.57:1, 9.72:1. Two tables still, for the
 * reason stated there — the Presenter is dark under either theme, so it cannot
 * express itself in `dark:` variants at all.
 */
const TONE_CLASS: Record<PreviewBadgeTone, string> = {
  'song-title': 'bg-primary/10 text-primary border-primary/20',
  'song-lyric':
    'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-400/15 dark:text-emerald-200 dark:border-emerald-400/40',
  scripture:
    'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-400/15 dark:text-amber-200 dark:border-amber-400/40',
  image:
    'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-400/15 dark:text-indigo-200 dark:border-indigo-400/40',
  default: 'bg-muted text-muted-foreground border-border/40',
};

const BADGE_CLASS =
  'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.25 border rounded';

/** Pre-`previewEntries` responses (older cached fetch) keep the old colours. */
function legacyToneClass(kind: string | undefined): string {
  if (kind === 'song-title') return TONE_CLASS['song-title'];
  if (kind === 'song-lyric') return TONE_CLASS['song-lyric'];
  if (kind === 'scripture') return TONE_CLASS.scripture;
  if (kind === 'image') return TONE_CLASS.image;
  return TONE_CLASS.default;
}

/**
 * One rendered block: either a standalone slide or a SongSet group whose
 * children keep their own linear slide numbers.
 */
type PreviewRow =
  | {
      kind: 'slide';
      key: string;
      entry?: PreviewEntry;
      slide?: SlidePreviewItem;
      index: number;
      groupOrdinal?: number;
    }
  | {
      kind: 'group';
      key: string;
      label: string;
      groupKind: 'song-set' | 'announcement';
      groupOrdinal?: number;
      children: Array<{
        key: string;
        entry: PreviewEntry;
        slide?: SlidePreviewItem;
        index: number;
      }>;
    };

function buildRows(
  entries: PreviewEntry[],
  slides: SlidePreviewItem[]
): PreviewRow[] {
  if (entries.length === 0) {
    return slides.map((slide, index) => ({
      kind: 'slide' as const,
      key: slide.id || `slide-${index}`,
      slide,
      index,
    }));
  }

  const rows: PreviewRow[] = [];
  let songSetCount = 0;
  let annSetCount = 0;

  for (const entry of entries) {
    const slide = slides[entry.index];
    const child = {
      key: entry.instanceId || `entry-${entry.index}`,
      entry,
      slide,
      index: entry.index,
    };

    if (!entry.groupId) {
      let groupOrdinal: number | undefined;
      if (entry.baseType === 'song-set-entry' || entry.baseType === 'song-set') {
        songSetCount += 1;
        groupOrdinal = songSetCount;
      } else if (entry.baseType === 'ann-set-marker' || entry.baseType === 'announcement') {
        annSetCount += 1;
        groupOrdinal = annSetCount;
      }
      rows.push({ kind: 'slide', ...child, groupOrdinal });
      continue;
    }

    const last = rows[rows.length - 1];
    if (last && last.kind === 'group' && last.key === entry.groupId) {
      last.children.push(child);
      continue;
    }

    const isAnn =
      entry.role === 'announcement' ||
      (entry.groupId != null && entry.groupId.startsWith('ann-'));
    const groupKind: 'song-set' | 'announcement' = isAnn ? 'announcement' : 'song-set';

    if (groupKind === 'song-set') {
      songSetCount += 1;
    } else {
      annSetCount += 1;
    }
    const groupOrdinal = groupKind === 'song-set' ? songSetCount : annSetCount;

    rows.push({
      kind: 'group',
      key: entry.groupId,
      label: entry.groupLabel || (groupKind === 'announcement' ? 'Announcement' : ''),
      groupKind,
      groupOrdinal,
      children: [child],
    });
  }
  return rows;
}

function SlideRow({
  entry,
  slide,
  index,
  groupOrdinal,
}: {
  entry?: PreviewEntry;
  slide?: SlidePreviewItem;
  index: number;
  groupOrdinal?: number;
}) {
  const { t } = useT();
  const toneClass = entry
    ? TONE_CLASS[previewBadgeTone(entry)]
    : legacyToneClass(slide?.kind);
  const badge = resolvePreviewBadge(slide, entry, { groupOrdinal }, t);

  const title = resolvePreviewTitle(
    slide,
    entry,
    t('form.preview.untitledSlide')
  );

  return (
    <div className="p-3 flex items-start gap-3 hover:bg-muted/30 transition-all">
      <span className="text-[10px] text-muted-foreground font-bold font-mono pt-1">
        #{index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`${BADGE_CLASS} ${toneClass}`}>{badge}</span>
          {title ? (
            <span className="font-bold text-xs truncate text-foreground">
              {title}
            </span>
          ) : null}
        </div>
        {slide?.subtitle && (
          <p className="text-[10px] text-muted-foreground/80 mt-1 truncate">
            {slide.subtitle}
          </p>
        )}
        {slide?.body && (
          <p className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap font-mono line-clamp-3 bg-background/30 p-1.5 rounded border border-border/30">
            {slide.body}
          </p>
        )}
      </div>
    </div>
  );
}

export function SlidePreviewList({
  entries,
  slides,
}: {
  entries: PreviewEntry[];
  slides: SlidePreviewItem[];
}) {
  if (slides.length === 0 && entries.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground italic">
        Slide plan is empty. Paste a rundown on the left to see the generated
        slides sequence.
      </div>
    );
  }

  return (
    <>
      {buildRows(entries, slides).map((row) =>
        row.kind === 'slide' ? (
          <SlideRow
            key={row.key}
            entry={row.entry}
            slide={row.slide}
            index={row.index}
            groupOrdinal={row.groupOrdinal}
          />
        ) : (
          <div key={row.key} className="bg-muted/20">
            <div className="px-3 pt-3 pb-1 flex items-center gap-1.5">
              <span
                className={`${BADGE_CLASS} ${
                  row.groupKind === 'announcement'
                    ? 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-400/15 dark:text-purple-200 dark:border-purple-400/40'
                    : 'bg-primary/10 text-primary border-primary/20'
                }`}
              >
                {row.groupKind === 'announcement'
                  ? resolveAnnouncementGroupBadge(row.groupOrdinal)
                  : resolveSongSetGroupBadge(row.groupOrdinal)}
              </span>
              {row.label ? (
                <span className="font-bold text-xs truncate text-foreground">
                  {row.label}
                </span>
              ) : null}
            </div>
            <div
              className={`ml-4 divide-y divide-border/40 ${
                row.groupKind === 'announcement'
                  ? 'border-l-2 border-purple-500/30 dark:border-purple-400/30'
                  : 'border-l-2 border-primary/30'
              }`}
            >
              {row.children.map((child) => (
                <SlideRow
                  key={child.key}
                  entry={child.entry}
                  slide={child.slide}
                  index={child.index}
                />
              ))}
            </div>
          </div>
        )
      )}
    </>
  );
}
