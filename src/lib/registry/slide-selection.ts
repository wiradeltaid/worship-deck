/**
 * slide-selection.ts
 *
 * Slide sequence multi-selection helper functions (SPEC-34).
 */

export interface SlideSelectionState {
  selectedIds: Set<string>;
  anchorId: string | null;
}
