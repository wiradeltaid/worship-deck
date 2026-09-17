# 03: Inserted image grows when its resize handles are dragged

**What to build:** Resizing an already-inserted canvas image by its selection handles grows the
rendered image content with the handles, instead of leaving it at its original small size.

**Blocked by:** 02

**Status:** done

- [x] Start with `wdi-systematic-debugging`. `BUG-7`'s aspect-ratio fit at insert time is confirmed
      correct (SPEC-12 closed that half). This is a different symptom: the handles/bounding box
      visibly enlarge on drag, but the image content inside does not follow.
- [x] Trace which Fabric event(s) the resize handle drives for an image object (`scaling`,
      `modified`, or both) and confirm whether the contain-fit `scaleX`/`scaleY` computed once at
      insert time is ever recomputed against the new box dimensions on that event.
- [x] Fix so a resized image's rendered content tracks the handle drag continuously (or at least on
      `modified`), preserving aspect ratio the same way `BUG-7`'s insert-time fix already does.
- [x] Covers both directions: shrinking the handles smaller than the current size recomputes the
      contain-fit scale symmetrically too, not only growing — an asymmetric fix would leave the
      same bug class live in the opposite direction.
- [x] The regression is seen failing (handles grow, image content does not) before the fix, then
      passing after — assert against the Fabric object's actual rendered dimensions, not just that
      a resize handler ran. Assert both a grow and a shrink case.

