# 05: Main Spine editor fits the viewport height, no outer page scroll

**What to build:** The Main Spine editor (Deck Sequence list + canvas) fits the visible browser
viewport, with a sane minimum height floor, instead of forcing the whole page to scroll to reach
most of the Deck Sequence list.

**Blocked by:** 04

**Status:** done

- [x] Start with `wdi-systematic-debugging` — this has not been code-inspected yet, only reported
      (`defects.yaml` BUG-11).
- [x] Trace the height/flex chain from the route shell down through the Main Spine editor layout to
      the Deck Sequence list container; find and fix the missing/broken `height`/flex constraint.
- [x] Add a `min-height` floor on the outer editor container so the canvas stays usable on a very
      short viewport.
- [x] Add a static structural guard test (`tests/artifact-editor-layout.test.mjs`, in
      `tests/operator-shadcn-guard.test.mjs`'s style — a class-string/JSX check, not a rendered
      measurement, since this codebase's `node --test` suite has no browser-layout harness)
      asserting the height/flex classes this fix adds are present, so a later edit cannot silently
      drop them.
- [x] Verify the actual visual result manually in the running app (`run` skill) — a rendered-layout
      measurement is not feasible in this test style.
