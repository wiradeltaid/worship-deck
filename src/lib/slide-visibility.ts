/**
 * Slide visibility control (hide/show) and linear navigation skip helpers.
 *
 * SPEC-85-04:
 * - Linear advance strictly skips hidden slides so they are never presented.
 * - If all remaining slides in a direction are hidden, navigation halts at boundary without crashing.
 * - Hiding the active slide auto-transitions to the nearest visible slide.
 * - Explicit slide selection unhides if hidden so a slide is NEVER projected while marked hidden.
 */

export interface VisibilityItem {
  id?: string;
  hidden?: boolean;
}

/**
 * Linear navigation skip rule: skips hidden slides in the given direction (1 or -1).
 * If all remaining slides in that direction are hidden, returns currentIndex (halts at boundary).
 */
export function findNextVisibleIndex(
  slides: VisibilityItem[],
  currentIndex: number,
  direction: 1 | -1
): number {
  if (slides.length === 0) return 0;
  let target = currentIndex + direction;

  while (target >= 0 && target < slides.length) {
    if (!slides[target]?.hidden) {
      return target;
    }
    target += direction;
  }

  // Boundary halted: no visible slide found in this direction
  return currentIndex;
}

/**
 * Active slide hide transition: searches forward, then backward, to find the nearest visible slide index.
 * If all slides are hidden, returns hiddenIndex.
 */
export function findNearestVisibleIndex(
  slides: VisibilityItem[],
  hiddenIndex: number
): number {
  if (slides.length === 0) return 0;

  // Search forward first
  for (let i = hiddenIndex + 1; i < slides.length; i++) {
    if (!slides[i]?.hidden) return i;
  }

  // Search backward
  for (let i = hiddenIndex - 1; i >= 0; i--) {
    if (!slides[i]?.hidden) return i;
  }

  // All slides are hidden
  return hiddenIndex;
}

/**
 * Toggles presence of slideId within hiddenSlideIds array.
 */
export function toggleHiddenSlideId(
  hiddenSlideIds: string[] | undefined,
  slideId: string
): string[] {
  const current = new Set(hiddenSlideIds || []);
  if (current.has(slideId)) {
    current.delete(slideId);
  } else {
    current.add(slideId);
  }
  return Array.from(current);
}

/**
 * Checks whether slide is hidden given the current hiddenSlideIds list.
 */
export function isSlideHidden(
  hiddenSlideIds: string[] | undefined,
  slideId: string
): boolean {
  if (!hiddenSlideIds || hiddenSlideIds.length === 0) return false;
  return hiddenSlideIds.includes(slideId);
}

/**
 * Controller orchestrating slide visibility mutations, server persistence verification,
 * all-hidden projector blanking, and direct selection unhiding.
 */
export function createSlideVisibilityController({
  getSlides,
  setSlides,
  getCurrentIndex,
  setCurrentIndex,
  getIsBlank,
  setIsBlank,
  serviceId,
  fetchFn = globalThis.fetch,
  onError,
}: {
  getSlides: () => VisibilityItem[];
  setSlides: (slides: VisibilityItem[]) => void;
  getCurrentIndex: () => number;
  setCurrentIndex: (index: number) => void;
  getIsBlank: () => boolean;
  setIsBlank: (blank: boolean) => void;
  serviceId?: number;
  fetchFn?: typeof fetch;
  onError?: (msg: string) => void;
}) {
  const toggleSlideVisibility = async (targetIdx: number): Promise<boolean> => {
    const currentSlides = getSlides();
    if (targetIdx < 0 || targetIdx >= currentSlides.length) return false;
    const targetSlide = currentSlides[targetIdx];
    const willBeHidden = !targetSlide?.hidden;

    const updated = currentSlides.map((s, i) =>
      i === targetIdx ? { ...s, hidden: willBeHidden } : s
    );
    const hiddenIds = updated.filter((s) => s.hidden).map((s) => s.id || `slide-${s}`);

    if (serviceId) {
      try {
        const res = await fetchFn(`/api/services/${serviceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hidden_slide_ids: hiddenIds }),
        });
        if (!res.ok) {
          onError?.('Gagal memperbarui status visibilitas slide di server');
          return false;
        }
      } catch {
        onError?.('Gagal menghubungi server');
        return false;
      }
    }

    // Persist state and trigger transitions only upon confirmed persistence
    setSlides(updated);

    const allHidden = updated.every((s) => s.hidden);
    if (allHidden) {
      setIsBlank(true);
    } else if (willBeHidden && targetIdx === getCurrentIndex()) {
      const nextVisible = findNearestVisibleIndex(updated, targetIdx);
      setCurrentIndex(nextVisible);
    }

    return true;
  };

  const safeNavigate = async (targetIdx: number): Promise<boolean> => {
    const currentSlides = getSlides();
    if (targetIdx < 0 || targetIdx >= currentSlides.length) return false;
    if (currentSlides[targetIdx]?.hidden) {
      const ok = await toggleSlideVisibility(targetIdx);
      if (!ok) return false;
      if (getIsBlank()) {
        setIsBlank(false);
      }
    }
    setCurrentIndex(targetIdx);
    return true;
  };

  const checkInitialAllHidden = () => {
    const currentSlides = getSlides();
    if (currentSlides.length > 0 && currentSlides.every((s) => s.hidden)) {
      setIsBlank(true);
    }
  };

  return {
    toggleSlideVisibility,
    safeNavigate,
    checkInitialAllHidden,
  };
}
