/**
 * "All slides" jump grid — the Presenter's equivalent of PowerPoint's slide
 * sorter. Every slide in the deck is drawn at thumbnail size with the same
 * operator-facing label the slide list uses, and picking one jumps the deck
 * (and therefore the projector, through the caller's `setIndexAndSync`).
 *
 * While the grid is open the arrow keys belong to the *grid selection*, not to
 * the deck: the caller suspends its own window handler and this component
 * swallows the navigation keys at the popup. Escape is deliberately left alone
 * so Base UI's own dismissal still closes the dialog.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import SlideView from '@/components/SlideView';
import { Button } from '@/components/ui/button';
import type { SlidePlanItem } from '@/lib/slide-plan';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  PRESENTER_TONE_CLASS,
  clampSlideIndex,
  isGridNavigationKey,
  moveGridSelection,
  type PresenterEntry,
} from './presenter-model';

const BADGE_CLASS =
  'rounded border px-1 py-px text-[9px] font-bold uppercase tracking-wider';

/**
 * The grid is responsive, so the column count that arrow-down must step by is
 * whatever the browser actually laid out — read it rather than hard-coding a
 * number that would silently disagree with the Tailwind template.
 */
function measureColumns(grid: HTMLElement | null): number {
  if (!grid) return 1;
  const template = window.getComputedStyle(grid).gridTemplateColumns;
  const count = template.split(' ').filter((part) => part.length > 0).length;
  return count > 0 ? count : 1;
}

function SlideGrid({
  slides,
  entries,
  currentIndex,
  onPick,
}: {
  slides: SlidePlanItem[];
  entries: PresenterEntry[];
  currentIndex: number;
  onPick: (index: number) => Promise<boolean | void> | boolean | void;
}) {
  // Mounted fresh each time the dialog opens, so the selection always starts on
  // the slide the operator is actually showing without an effect to reset it.
  const [selected, setSelected] = useState(() =>
    clampSlideIndex(currentIndex, entries.length)
  );
  const gridRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const tile = selectedRef.current;
    if (!tile) return;
    tile.focus({ preventScroll: true });
    tile.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      // Activation is the focused tile's own job; nothing to do here.
      return;
    }
    if (!isGridNavigationKey(event.key)) return;
    event.preventDefault();
    // Keeps the key off the Presenter's window handler as well as the guard it
    // already applies, so the deck can never move underneath the grid.
    event.stopPropagation();
    setSelected((at) =>
      moveGridSelection(
        at,
        event.key,
        measureColumns(gridRef.current),
        entries.length
      )
    );
  };

  return (
    <div className="flex min-h-0 flex-col gap-3" onKeyDown={onKeyDown}>
      <DialogHeader>
        <DialogTitle>All slides</DialogTitle>
        <DialogDescription>
          {entries.length} slides · arrow keys move the selection, Enter or a
          click jumps the deck and the projector.
        </DialogDescription>
      </DialogHeader>

      <div
        ref={gridRef}
        className="grid min-h-0 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        {entries.map((entry) => {
          const slide = slides[entry.index];
          const isSelected = entry.index === selected;
          const isCurrent = entry.index === currentIndex;
          return (
            <Button
              key={entry.instanceId}
              ref={isSelected ? selectedRef : null}
              type="button"
              variant="ghost"
              tabIndex={isSelected ? 0 : -1}
              aria-current={isCurrent ? 'true' : undefined}
              onFocus={() => setSelected(entry.index)}
              onClick={() => onPick(entry.index)}
              className={`h-auto flex-col items-stretch gap-1 rounded-lg border p-1.5 text-left font-normal ${
                slide?.hidden ? 'opacity-50 bg-muted/20' : ''
              } ${
                isSelected
                  ? 'border-primary bg-muted ring-2 ring-primary hover:bg-muted'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <span className="relative block aspect-video overflow-hidden rounded border border-border bg-black">
                {slide ? <SlideView slide={slide} /> : null}
                {isCurrent ? (
                  <span className="absolute top-1 left-1 rounded bg-primary px-1 py-px text-[9px] font-bold uppercase text-primary-foreground">
                    Now
                  </span>
                ) : null}
                {slide?.hidden ? (
                  <span
                    data-testid="grid-hidden-badge"
                    className="absolute top-1 right-1 rounded border border-zinc-700 bg-zinc-900/90 px-1 py-px text-[9px] font-bold uppercase text-zinc-300"
                  >
                    Hidden
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {entry.index + 1}
                </span>
                <span
                  className={`${BADGE_CLASS} ${PRESENTER_TONE_CLASS[entry.tone]}`}
                >
                  {entry.label}
                </span>
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {entry.groupLabel ?? entry.title ?? ' '}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export default function SlideGridDialog({
  open,
  onOpenChange,
  slides,
  entries,
  currentIndex,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slides: SlidePlanItem[];
  entries: PresenterEntry[];
  currentIndex: number;
  onPick: (index: number) => Promise<boolean | void> | boolean | void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // The dialog is portalled to the body, outside the Presenter shell, so
        // it has to declare the dark surface itself or every theme token in it
        // would resolve against the light theme.
        className="dark flex max-h-[85dvh] w-[min(96rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col sm:max-w-[min(96rem,calc(100vw-2rem))]"
      >
        {open ? (
          <SlideGrid
            slides={slides}
            entries={entries}
            currentIndex={currentIndex}
            onPick={onPick}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
