/**
 * slide-selection.ts
 *
 * React-free pure selection and bulk-delete helpers for the Deck Sequence (SPEC-34).
 */

export interface SlideSelectionState {
  selectedIds: string[];
  anchorId: string | null;
  activeId: string | null;
}

export interface ResolveMultiSelectClickParams {
  clickedId: string;
  isCtrlOrCmd: boolean;
  isShift: boolean;
  currentSelectedIds: Set<string> | string[];
  currentAnchorId: string | null;
  currentActiveId: string | null;
  orderedIds: string[];
}

export interface ResolveMultiSelectClickResult {
  selectedIds: string[];
  anchorId: string | null;
  activeId: string | null;
  requiresDiscardConfirmation: boolean;
}

/**
 * Computes an inclusive range of slide IDs between anchor and target in deck order.
 * If targetId is not in orderedIds, returns empty array.
 * If anchorId is null or not in orderedIds, returns [targetId].
 */
export function computeRangeSelection(
  anchorId: string | null,
  targetId: string,
  orderedIds: string[]
): string[] {
  const targetIndex = orderedIds.indexOf(targetId);
  if (targetIndex === -1) return [];

  if (!anchorId) return [targetId];
  const anchorIndex = orderedIds.indexOf(anchorId);
  if (anchorIndex === -1) return [targetId];

  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  return orderedIds.slice(start, end + 1);
}

/**
 * Returns all slide IDs in deck order.
 */
export function selectAllSlides(orderedIds: string[]): string[] {
  return [...orderedIds];
}

/**
 * Reconciles selection state against authoritative ordered IDs:
 * - Prunes IDs absent from orderedIds
 * - Ensures activeId is a member of selectedIds if selectedIds is non-empty
 * - Falls back to null/empty when list is empty
 */
export function reconcileSlideSelection(
  currentSelectedIds: Set<string> | string[],
  currentAnchorId: string | null,
  currentActiveId: string | null,
  orderedIds: string[]
): SlideSelectionState {
  const currentSet = new Set(currentSelectedIds);
  const validSelectedIds = orderedIds.filter((id) => currentSet.has(id));

  if (validSelectedIds.length === 0) {
    return {
      selectedIds: [],
      anchorId: null,
      activeId: null,
    };
  }

  let nextActiveId =
    currentActiveId && validSelectedIds.includes(currentActiveId) ? currentActiveId : null;
  if (!nextActiveId) {
    nextActiveId = validSelectedIds[0];
  }

  const nextAnchorId =
    currentAnchorId && orderedIds.includes(currentAnchorId) ? currentAnchorId : nextActiveId;

  return {
    selectedIds: validSelectedIds,
    anchorId: nextAnchorId,
    activeId: nextActiveId,
  };
}

/**
 * Resolves pure pointer click semantics for File Explorer-style slide selection:
 * 1. Plain click: single-select target, target becomes anchor and active.
 * 2. Ctrl/Cmd click: toggles target; if target was active and is removed, picks next survivor.
 * 3. Shift click: range selection from anchor to target.
 * 4. Ctrl/Cmd + Shift: unions range selection into existing selection.
 */
export function resolveMultiSelectClick(
  params: ResolveMultiSelectClickParams
): ResolveMultiSelectClickResult {
  const {
    clickedId,
    isCtrlOrCmd,
    isShift,
    currentSelectedIds,
    currentAnchorId,
    currentActiveId,
    orderedIds,
  } = params;

  const currentSet = new Set(currentSelectedIds);
  const isClickedValid = orderedIds.includes(clickedId);
  if (!isClickedValid) {
    return {
      selectedIds: orderedIds.filter((id) => currentSet.has(id)),
      anchorId: currentAnchorId,
      activeId: currentActiveId,
      requiresDiscardConfirmation: false,
    };
  }

  // 1. Plain click
  if (!isCtrlOrCmd && !isShift) {
    const isSameActive = currentActiveId === clickedId;
    return {
      selectedIds: [clickedId],
      anchorId: clickedId,
      activeId: clickedId,
      requiresDiscardConfirmation: !isSameActive && currentActiveId !== null,
    };
  }

  // 2. Ctrl/Cmd click (toggle single item)
  if (isCtrlOrCmd && !isShift) {
    if (currentSet.has(clickedId)) {
      // Removing clickedId
      const nextSelected = orderedIds.filter((id) => currentSet.has(id) && id !== clickedId);
      if (nextSelected.length === 0) {
        return {
          selectedIds: [],
          anchorId: null,
          activeId: null,
          requiresDiscardConfirmation: currentActiveId !== null,
        };
      }
      if (clickedId === currentActiveId) {
        // Removing active slide: choose first remaining selected item in current deck order
        const newActive = nextSelected[0];
        const newAnchor = currentAnchorId === clickedId ? newActive : currentAnchorId;
        return {
          selectedIds: nextSelected,
          anchorId: newAnchor,
          activeId: newActive,
          requiresDiscardConfirmation: true,
        };
      }
      // Removing non-active item: active slide & dirty state untouched
      const newAnchor = currentAnchorId === clickedId ? currentActiveId : currentAnchorId;
      return {
        selectedIds: nextSelected,
        anchorId: newAnchor,
        activeId: currentActiveId,
        requiresDiscardConfirmation: false,
      };
    } else {
      // Adding clickedId
      const nextSelected = orderedIds.filter((id) => currentSet.has(id) || id === clickedId);
      return {
        selectedIds: nextSelected,
        anchorId: clickedId,
        activeId: currentActiveId ?? clickedId,
        requiresDiscardConfirmation: false,
      };
    }
  }

  // Range-based clicks (Shift or Ctrl+Shift)
  const validAnchor =
    currentAnchorId && orderedIds.includes(currentAnchorId)
      ? currentAnchorId
      : currentActiveId && orderedIds.includes(currentActiveId)
        ? currentActiveId
        : null;

  if (!validAnchor) {
    // Fallback to plain click on clickedId
    const isSameActive = currentActiveId === clickedId;
    return {
      selectedIds: [clickedId],
      anchorId: clickedId,
      activeId: clickedId,
      requiresDiscardConfirmation: !isSameActive && currentActiveId !== null,
    };
  }

  const range = computeRangeSelection(validAnchor, clickedId, orderedIds);

  // 3. Plain Shift click (replace selection with range)
  if (!isCtrlOrCmd && isShift) {
    const rangeSet = new Set(range);
    const excludesActive = currentActiveId !== null && !rangeSet.has(currentActiveId);
    const nextActive = excludesActive ? clickedId : currentActiveId ?? clickedId;

    return {
      selectedIds: range,
      anchorId: validAnchor, // preserve valid original anchor for subsequent range expansion
      activeId: nextActive,
      requiresDiscardConfirmation: excludesActive,
    };
  }

  // 4. Ctrl/Cmd + Shift click (union range with existing selection)
  const unionSet = new Set([...currentSet, ...range]);
  const unionSelected = orderedIds.filter((id) => unionSet.has(id));
  const activeExluded = currentActiveId !== null && !unionSet.has(currentActiveId);
  const nextActive = activeExluded ? clickedId : currentActiveId ?? clickedId;

  return {
    selectedIds: unionSelected,
    anchorId: validAnchor,
    activeId: nextActive,
    requiresDiscardConfirmation: activeExluded,
  };
}

/**
 * Moves selected items as one contiguous relative-order-preserving block when draggedId
 * is in selectedIds.
 * If draggedId is not in selectedIds, moves only draggedId.
 * If drop occurs inside the selected block, returns unchanged list (no-op).
 */
export function moveSelectedBlock<T extends { id: string }>(params: {
  orderedItems: T[];
  selectedIds: Set<string> | string[];
  draggedId: string;
  targetIndex: number;
}): T[] {
  const { orderedItems, selectedIds, draggedId, targetIndex } = params;
  if (targetIndex < 0 || targetIndex >= orderedItems.length) return orderedItems;

  const selectedSet = new Set(selectedIds);

  // If draggedId is not selected, move only draggedId
  if (!selectedSet.has(draggedId)) {
    const sourceIndex = orderedItems.findIndex((item) => item.id === draggedId);
    if (sourceIndex === -1 || sourceIndex === targetIndex) return orderedItems;
    const next = [...orderedItems];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    return next;
  }

  // Selected block move
  const targetItem = orderedItems[targetIndex];
  if (selectedSet.has(targetItem.id)) {
    // Dropping inside the selected block is a no-op
    return orderedItems;
  }

  const selectedItems = orderedItems.filter((item) => selectedSet.has(item.id));
  const unselectedItems = orderedItems.filter((item) => !selectedSet.has(item.id));

  const unselectedTargetIndex = unselectedItems.findIndex((item) => item.id === targetItem.id);
  if (unselectedTargetIndex === -1) return orderedItems;

  // Determine whether insertion is before or after targetItem based on original positions
  const sourceFirstIndex = orderedItems.findIndex((item) => selectedSet.has(item.id));
  const insertIndex =
    sourceFirstIndex < targetIndex ? unselectedTargetIndex + 1 : unselectedTargetIndex;

  const result = [...unselectedItems];
  result.splice(insertIndex, 0, ...selectedItems);
  return result;
}

/**
 * Resolves the next active slide ID after deletion:
 * - If current active slide survived, keep it.
 * - If current active slide was deleted, pick the survivor at former index clamped to survivors.
 * - If no survivors remain, return null.
 */
export function resolveNextActiveSlide<T extends { id: string }>(
  actualDeletedIds: string[],
  currentActiveId: string | null,
  preDeleteOrderedItems: T[]
): string | null {
  if (!currentActiveId) return null;
  const deletedSet = new Set(actualDeletedIds);
  if (!deletedSet.has(currentActiveId)) {
    return currentActiveId;
  }

  const survivors = preDeleteOrderedItems.filter((item) => !deletedSet.has(item.id));
  if (survivors.length === 0) return null;

  const formerIndex = preDeleteOrderedItems.findIndex((item) => item.id === currentActiveId);
  const clampedIndex = Math.min(Math.max(0, formerIndex), survivors.length - 1);
  return survivors[clampedIndex].id;
}

export interface BulkDeleteRunnerParams<T extends { id: string; updatedAt: string | number }> {
  selectedIds: string[];
  orderedSummaries: T[];
  deleteFn: (
    id: string,
    updatedAt: any
  ) => Promise<{
    ok: boolean;
    status?: number;
    error?: string;
    templates?: T[];
  }>;
  listFn: () => Promise<T[]>;
}

export interface BulkDeleteRunnerResult<T extends { id: string; updatedAt: string | number }> {
  completed: boolean;
  deletedCount: number;
  deletedIds: string[];
  failedId?: string;
  status?: number;
  error?: string;
  survivors: T[];
}

/**
 * Injected asynchronous bulk-delete runner (SPEC-34-02).
 * Consumes a fresh updatedAt token for every sequential deletion:
 * - Uses templates from delete response if provided, otherwise calls listFn().
 * - Stops immediately on 409, 404, or any error without making subsequent calls.
 */
export async function runBulkDelete<T extends { id: string; updatedAt: string | number }>(
  params: BulkDeleteRunnerParams<T>
): Promise<BulkDeleteRunnerResult<T>> {
  const { selectedIds, orderedSummaries, deleteFn, listFn } = params;

  let currentSummaries = [...orderedSummaries];
  const deletedIds: string[] = [];

  // Filter selected IDs to only those currently in summaries, in deck order
  const summaryMap = new Map(currentSummaries.map((s) => [s.id, s]));
  const targetIds = selectedIds.filter((id) => summaryMap.has(id));

  for (const id of targetIds) {
    const item = currentSummaries.find((s) => s.id === id);
    if (!item) {
      // Item missing from authoritative current summaries
      let freshList = currentSummaries;
      try {
        freshList = await listFn();
      } catch {
        // preserve current
      }
      return {
        completed: false,
        deletedCount: deletedIds.length,
        deletedIds,
        failedId: id,
        status: 404,
        error: 'Item missing before delete',
        survivors: freshList,
      };
    }

    let res: { ok: boolean; status?: number; error?: string; templates?: T[] };
    try {
      res = await deleteFn(item.id, item.updatedAt);
    } catch (err) {
      let freshList = currentSummaries;
      try {
        freshList = await listFn();
      } catch {
        // preserve current
      }
      return {
        completed: false,
        deletedCount: deletedIds.length,
        deletedIds,
        failedId: id,
        status: 500,
        error: err instanceof Error ? err.message : 'Network error during delete',
        survivors: freshList,
      };
    }

    if (!res.ok || res.status === 409 || res.status === 404) {
      let freshList = currentSummaries;
      try {
        freshList = await listFn();
      } catch {
        // preserve current
      }
      return {
        completed: false,
        deletedCount: deletedIds.length,
        deletedIds,
        failedId: id,
        status: res.status ?? 500,
        error: res.error,
        survivors: freshList,
      };
    }

    deletedIds.push(id);
    try {
      if (res.templates && Array.isArray(res.templates)) {
        currentSummaries = res.templates;
      } else {
        currentSummaries = await listFn();
      }
    } catch (err) {
      return {
        completed: false,
        deletedCount: deletedIds.length,
        deletedIds,
        failedId: id,
        status: 500,
        error: err instanceof Error ? err.message : 'Failed to refresh list after delete',
        survivors: currentSummaries.filter((s) => s.id !== id),
      };
    }
  }

  return {
    completed: true,
    deletedCount: deletedIds.length,
    deletedIds,
    survivors: currentSummaries,
  };
}
