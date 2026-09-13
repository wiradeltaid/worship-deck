# SPEC-26 — Canvas vs Presenter Visual & Framing Parity

> **Evidence base.** Every claim below was measured in Chromium against this working tree on
> 2026-09-13, not inferred. The runners live in `.work/spec-26-diagnostics/`; the captured
> numbers are in `sweep-report.txt`, `welcome-report.txt` and `shell-report.txt` in that folder.
> Re-run any of them with `node .work/spec-26-diagnostics/<runner>.mjs`.

> **Relationship to SPEC-25.** SPEC-25 resolved BUG-33. Its BUG-34 work (SPEC-25-03, container
> queries on the `ArtifactSlide` stage) **is correct and is not the residual defect.** Measured on
> the real `/services/:id/slideshow` and `/services/:id/present/projector` routes at 1600x900,
> 2560x1080, 1920x600, 1000x1000 and 1080x1920, the stage holds a 1.7778 ratio at every viewport,
> the letterbox/pillarbox bars appear at the expected sizes, no element box escapes the stage and
> no text box clips. SPEC-26 therefore does **not** revisit the outer stage wrapper.

---

## Problem Statement

### BUG-34 (restated) — the two renderers disagree *inside* the stage, not about the stage

The Canvas Editor paints through Fabric.js onto a 960x540 canvas. Presenter and Projector paint
through `ArtifactSlide.tsx` as absolutely-positioned CSS boxes. At an identical stage size the two
engines place boxes identically — but they **size and clip text by opposite rules**, so the same
element is drawn at a different size, wrapped onto a different number of lines, or drawn outside a
box that the other engine clips.

Measured across the 32 shipped canvas templates (64 elements):

| Divergence | Count | What the operator sees |
|---|---|---|
| `FIT` — `ArtifactSlide` shrinks the text, Fabric never does | **20** | Presenter text 70–97% of the Canvas size |
| `OVERRUN` — Fabric paints below the authored box, CSS clips there | **20** | Text that overhangs on Canvas is cut in Presenter |
| `CLIP` — content taller than its box; clipped in CSS, full on Canvas | **11** | Descenders/ascenders amputated in Presenter only |
| `WRAP` — the engines break the text onto a different line count | **7** | Different layout, different apparent margins |
| `GEOM` — box width itself disagrees by >1px | **2** | Fabric box up to 41% wider than authored |

Worst cases: `sermon` e1 (Fabric box 424.4px vs authored 300.1px, CSS shrinks to 70%),
`closing-prayer-ds` e1 (CSS 74%, Fabric paints 50.8px below the box), `intercessory-671-lyric-1`
e1 (CSS 80%, Fabric paints 213.0px below the box), `hope-lyric-1` e1 (Fabric 5 lines, CSS 9 lines).

The `welcome` / "Bandung International Community" layout the owner used as an example is one of the
**clean** ones — measured mean channel difference between the two live surfaces is 7.15/255, and
that residual is screenshot rescaling noise, not layout. The defect is real but the owner's example
slide does not exhibit it; the templates above do.

### Mechanism — three lines of Fabric, all in `initDimensions()`

`node_modules/fabric/dist/index.mjs`:

- **line 22960** — `this.height = this.calcTextHeight()`. `Textbox` **discards any `height` passed
  to the constructor** and recomputes it from the text. The `height` that
  `buildTextFabricOptions` supplies (`src/lib/registry/canvas-utils.ts:171`) never survives.
  Fabric therefore has no box bottom to clip against and no vertical alignment; it paints the text
  wherever it lands. `ArtifactSlide` gives the box the authored height
  (`toCssGeometry`, `src/lib/artifacts/render-model.ts:259`), applies `overflow: hidden`
  (`ArtifactSlide.tsx:44`) and shrink-to-fit (`ArtifactSlide.tsx:69-139`).
- **lines 22952-22954** — `if (this.dynamicMinWidth > this.width) this._set('width', this.dynamicMinWidth)`.
  `Textbox` **widens itself** when the longest unbreakable run does not fit. An unsubstituted
  placeholder token such as `{sermon_title}` is one such run, so Fabric silently widens the box by
  41%; `ArtifactSlide` keeps the authored width and shrinks the font to 70% instead.
- Fabric has no shrink-to-fit at all, so the `MIN_TEXT_FIT_SCALE` / `largestFittingTextScale`
  policy that governs `ArtifactSlide` has no counterpart on the Canvas.

### BUG-35 (new, confirmed) — opening a template and pressing Save mutates stored geometry

Because `serializeCanvas` writes Fabric's *measured* width back
(`src/lib/registry/canvas-utils.ts:625-630`, `isWidthResized ? pxToPct(measuredWidth, …)`), Fabric's
self-widening is persisted. Measured end-to-end against the real API
(`.work/spec-26-diagnostics/run-save-roundtrip.mjs`): opening `sermon` in `/admin/artifacts` and
pressing **Save with no edit at all** rewrites `e1.w` from `31.26` to `45.0951` — **+44.3%**.
The widening is driven by a placeholder token that is substituted away before the slide is ever
projected, so the stored box is sized for text that never renders. This drags authored geometry
further from the Presenter's rendering on every save and must be closed before, or with, the parity
fix — otherwise the fix is applied to data that is still drifting.

---

## Solution

### SPEC-26-01 — Make the disagreement measurable and permanent
Productionise the throwaway runners in `.work/spec-26-diagnostics/` into a committed harness that
renders both engines at an identical stage and reports the five divergence classes per element.
The repo already ships everything needed: `playwright@1.62.1` and
`tests/helpers/browser-harness.mjs` (boots the Go API, serves the built SPA, logs in, drives real
routes). No new dependency, and no Orca computer-use.

### SPEC-26-02 — Close BUG-35 first, then reconcile the two text engines
Stop Fabric's recomputed `width`/`height` from being treated as authored geometry, then make the
Canvas obey the same box-and-fit policy `ArtifactSlide` already enforces — the policy in
`render-model.ts` is the contract PPTX also honours, so the Canvas is the side that moves.

### SPEC-26-03 — Guard the parity, with the guard proven red first
A per-element parity assertion over every shipped template, plus a regression guard on BUG-35.

---

## User Stories

1. As an operator, I want the slide in the Canvas Editor to match the Presenter and Projector
   output, so that what I design is what the congregation sees.
2. As an operator, I want text near a box edge not to be cut off in Presenter when the Canvas
   showed it whole, so projected typography stays readable.
3. As an admin, I want opening a template and saving it to change nothing, so authored geometry
   does not drift every time someone looks at a slide.
4. As an admin, I want an automated parity check over every shipped template, so this class of
   drift is caught before a Sabbath.

---

## Implementation Decisions

- **The stage wrapper is out of scope.** SPEC-25-03's container-query letterbox is measured
  correct at five aspect ratios on both projected routes; changing it would be a regression risk
  for no gain.
- **`render-model.ts` is the reference, not `ArtifactEditor`.** PPTX export and the browser
  renderer already share it; moving the Canvas onto it keeps one conversion table rather than
  creating a second.
- **Component & scope**: component `registry`, touches `[artifacts]`. Expected files:
  `src/lib/registry/canvas-utils.ts`, `src/components/admin/ArtifactEditor.tsx`,
  `src/components/artifacts/ArtifactSlide.tsx` (only if 26-01 finds a CSS-side cause), and a new
  test module.
- **Preserve existing invariants**: `toPptxGeometry` output unchanged; SPEC-22 `wrapLines`,
  SPEC-23 wrap-slack and font-readiness, SPEC-25 healing and style preservation all stay green.
- **Deployment note.** BUG-34 was re-reported from `presenter-dev.bic.my.id`. The working tree
  passes every check on the owner's list, so confirm the dev host is serving a build that contains
  SPEC-25-03 before attributing any remaining symptom to code. Deploys run through
  `D:\Developer\devops` (`applications/<app>/`), never improvised.
