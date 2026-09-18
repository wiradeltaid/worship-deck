# 03: Scripture Projector Current Stage Mirroring and Dynamic Typography Scaling

**What to build:**
Mirror pushed scripture overlays onto the Current stage in `PresenterOperator.tsx`, extend the existing "Clear scripture" action to dismiss both local preview and live projector simultaneously, and implement dynamic scripture text sizing in both projector and operator consoles so short verses fill ~40-50% of screen height while long passages remain fully contained and legible.

**Blocked by:** 02 (Presenter Mode Height Relaxation and Vertical Scrolling)

**Status:** closed

- [x] Pushing scripture updates the local `Current` stage in `PresenterOperator.tsx` to display the active scripture overlay preview.
- [x] Extend the existing "Clear scripture" button (`PresenterOperator.tsx:939-949`) so it clears the local `scriptureOverlay` state in tandem with the projector broadcast.
- [x] Scripture text size dynamically scales according to text length, allowing short verses (under 80 characters) to render prominently (4.5rem-5.5rem / ~40-50% vertical screen presence).
- [x] Longer scripture passages scale down gracefully with a minimum font floor (e.g. 1.75rem-2rem) and line height containment to guarantee text remains fully contained without viewport overflow.
- [x] Shared font scaling formula is used by both `ProjectorClient.tsx` and `PresenterOperator.tsx` ensuring 100% visual preview parity.
