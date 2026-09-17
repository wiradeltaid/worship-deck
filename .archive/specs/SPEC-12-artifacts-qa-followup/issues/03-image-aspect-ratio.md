# 03: Inserted image preserves native aspect ratio

**What to build:** An image dropped into a drag-created bounding box on the canvas renders at its
own native aspect ratio, not stretched or squashed to fill the box on both axes independently.

**Blocked by:** 02

**Status:** done

- [x] Start with `wdi-systematic-debugging` to confirm the stretch live. `defects.yaml` BUG-7 names
      the hypothesis: `ArtifactEditor.tsx` sets `scaleX`/`scaleY` independently from
      `naturalWidth`/`naturalHeight` against the box's `width`/`height`, both at element creation
      and again in `imgEl.onload`.
- [x] An image inserted into a box whose aspect ratio does not match the image's native ratio
      renders at its native ratio (contain-style fit, or the box is resized to match at insert
      time — whichever keeps the canvas preview consistent with what the PPTX exporter and
      slideshow actually draw).
- [x] The PPTX render path (`src/lib/pptx.ts`) and the slideshow render path draw the same
      aspect-correct result as the canvas editor preview, not just the editor.
- [x] The regression is seen failing against current code before the fix, then passing after.
