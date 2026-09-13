# SPEC-26-02 — Stop geometry drift on save, then reconcile the two text engines

**Status:** ready-for-agent

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`
- **Touches**: `[artifacts]`
- **Blocked by**: SPEC-26-01

## Problem

Fabric's `Textbox` recomputes the geometry it is handed, and the editor treats the recomputed values
as if the operator had authored them. See `SPEC.md` for the measured mechanism; the three load-bearing
facts are:

- `index.mjs:22960` — `Textbox` discards the constructor's `height`.
- `index.mjs:22952-22954` — `Textbox` widens itself to `dynamicMinWidth`.
- `canvas-utils.ts:625-630` — `serializeCanvas` writes that widened width back as authored `w`.

## Requirements

### 1. Close BUG-35 — save without edit must be a no-op

- Opening any shipped template in `/admin/artifacts` and pressing **Save** with no edit MUST leave
  `x`, `y`, `w`, `h` byte-identical for every element.
- Reproduction that must go from red to green:
  `node .work/spec-26-diagnostics/run-save-roundtrip.mjs` currently reports
  `sermon e1.w: 31.26 -> 45.095105926513675 (+44.3%)`.
- A width or height that Fabric *computed* MUST NOT be written back as authored geometry. Only a
  dimension the operator actually changed — a drag of a resize handle — may be persisted.
  `data.authoredWidth` / `data.authoredHeight` are already carried on every object
  (`canvas-utils.ts:176`, `:234`) and are the intended discriminator.
- `applyWrapSlack` (SPEC-23-01) stays. It is a deliberate widening with a stated reason; the
  defect is the *undeliberate* one.

### 2. Reconcile the text engines

- An element at `(x, y, w, h)` MUST occupy the same proportional position **and be painted at the
  same font size, on the same number of lines**, in the Canvas Editor as in `ArtifactSlide`.
- `render-model.ts` is the reference. The shrink-to-fit policy
  (`largestFittingTextScale`, `textFitRatio`, `MIN_TEXT_FIT_SCALE`) and the box clip are the
  contract PPTX export also honours, so the **Canvas** is the side that moves onto them; do not
  relax the CSS side to match Fabric's unbounded painting.
- The Canvas MUST show the operator the box the text is actually confined to, so that text
  overhanging its box is visible as a problem at authoring time rather than only in Presenter.
- Target: the SPEC-26-01 harness reports `0` for `FIT`, `CLIP`, `WRAP` and `GEOM` across all 32
  shipped templates. `OVERRUN` is expected to reach `0` as a consequence; if a residual remains,
  record why rather than widening the tolerance.

### 3. Preserve invariants

- `toPptxGeometry` output byte-identical for every shipped template.
- SPEC-22 `wrapLines`, SPEC-23 wrap-slack and font-readiness, SPEC-25 healing idempotence and
  style preservation all stay green.
- No change to the `ArtifactSlide` stage wrapper (lines 280-317) — measured correct, out of scope.
- `npm test` green.

## Note

`BUG-35` is not yet in `.control/registry/defects.yaml`. Register it there before shipping this
ticket, or fold it into BUG-34 explicitly — it MUST NOT be fixed silently.
