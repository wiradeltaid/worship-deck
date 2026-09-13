# SPEC-26 second opinion — measured findings

Date: 2026-09-13. Every number here came out of Chromium against this working tree. Nothing below
is inferred from reading code alone; where code is cited it is cited *because* a measurement pointed
at it.

## How to re-run

```bash
node .work/spec-26-diagnostics/run-parity.mjs welcome   # one template, both engines, same stage
node .work/spec-26-diagnostics/run-sweep.mjs            # all 32 templates, five divergence classes
node .work/spec-26-diagnostics/run-shell.mjs            # editor stage scaling at 5 viewport sizes
node .work/spec-26-diagnostics/run-real-app.mjs         # real /admin/artifacts, real Go API
node .work/spec-26-diagnostics/run-ab.mjs               # real editor vs real /slideshow screenshots
node .work/spec-26-diagnostics/run-diff.mjs             # pixel-diff the two (needs run-ab first)
node .work/spec-26-diagnostics/run-aspect.mjs           # projected routes at 5 aspect ratios
node .work/spec-26-diagnostics/run-save-roundtrip.mjs   # BUG-35 reproduction
```

`run-real-app`, `run-ab`, `run-aspect` and `run-save-roundtrip` drive the **real application** via
`tests/helpers/browser-harness.mjs`. They need `npm run spa:build` to have been run and a working
Go toolchain. The others are standalone and need neither.

Screenshots were deleted after reading — they are ~25 MB and every runner regenerates them.

## 1. SPEC-25-03 is not the residual defect

`run-aspect.mjs`, real `/services/1/slideshow` and `/services/1/present/projector`:

| viewport | stage | ratio | bars L/R | bars T/B | element escapes | text clipped |
|---|---|---|---|---|---|---|
| 1600x900 | 1600.0x900.0 | 1.7778 | 0 | 0 | none | none |
| 2560x1080 (21:9) | 1920.0x1080.0 | 1.7778 | 320.0 | 0 | none | none |
| 1920x600 | 1066.7x600.0 | 1.7778 | 426.7 | 0 | none | none |
| 1000x1000 | 1000.0x562.5 | 1.7778 | 0 | 218.8 | none | none |
| 1080x1920 | 1080.0x607.5 | 1.7778 | 0 | 656.3 | none | none |

Identical on both routes. Every item on the owner's checklist passes on this build. The bundle
under test contains the fix — `grep "100cqh" spa/dist/assets/main-*.js` hits.

**Therefore: if `presenter-dev.bic.my.id` still shows the letterbox symptom, check what build that
host is serving before changing any code.**

## 2. The `welcome` example slide is one of the clean ones

`run-parity.mjs welcome` — Fabric 960x540 vs `ArtifactSlide` 960x540:

| element | fabric box | css box | fabric font | css font | lines |
|---|---|---|---|---|---|
| e1 "Welcome to" | 54.05, 300.35 w541.63 | 54.05, 300.34 w541.63 | 101.75 | 101.75 | 1 / 1 |
| e2 "BANDUNG INTERNATIONAL COMMUNITY" | 54.05, 434.59 w739.58 | 54.05, 434.58 w739.58 | 20.7 | 20.70 | 1 / 1 |
| e3 "{service_date}" | 54.05, 483.30 w480.00 | 54.05, 483.30 w480.00 | 14.67 | 14.67 | 1 / 1 |

Line widths agree to 0.01px (535.33 vs 535.34). `run-ab.mjs` + `run-diff.mjs` on the *live* editor
and the *live* slideshow: mean channel difference 7.15/255, and the diff image shows glyph
**outlines only** — the signature of sub-pixel offset plus rescaling, not of a layout difference.

Background `cover`-vs-stretch was a plausible suspect and is ruled out: `welcome-bg.png` is
1672x941, AR 1.77683 against 16:9's 1.77778, so `background-size: cover` crops **0.14px** per side
in 960x540 space.

## 3. The real defect: two text engines with opposite rules

`run-sweep.mjs`, 32 templates / 64 elements:

```
GEOM (box geometry disagrees >1px) : 2
WRAP (different line breaking)     : 7
FIT  (presenter shrinks, canvas not): 20
CLIP (presenter clips, canvas not) : 11
OVERRUN (canvas paints outside box): 20
```

Worst offenders:

- `sermon` e1 — Fabric box **424.4px** vs authored **300.1px**; `ArtifactSlide` keeps 300.1 and
  shrinks the font to **70%**.
- `closing-prayer-ds` e1 — CSS **74%**; Fabric paints **50.8px** below the box bottom.
- `intercessory-671-lyric-1` e1 — CSS **80%**; Fabric paints **213.0px** below the box bottom.
- `hope-lyric-1` e1 — Fabric **5** lines, CSS **9** lines.
- `intercessory-prayer-during` e1 — Fabric **9** lines, CSS **16** lines.

Mechanism, confirmed in `node_modules/fabric/dist/index.mjs`:

- **:22960** `this.height = this.calcTextHeight()` — `Textbox` discards the constructor's `height`.
  The `height` passed at `src/lib/registry/canvas-utils.ts:171` never survives. Fabric has no box
  bottom to clip against and no vertical alignment.
- **:22952-22954** `if (this.dynamicMinWidth > this.width) this._set('width', this.dynamicMinWidth)`
  — `Textbox` widens itself for an unbreakable run. `{sermon_title}` is one.
- Fabric has no shrink-to-fit. `ArtifactSlide` has `overflow: hidden`
  (`ArtifactSlide.tsx:44`) and `largestFittingTextScale` (`ArtifactSlide.tsx:69-139`).

## 4. BUG-35 — save without edit mutates stored geometry

`run-save-roundtrip.mjs`, real API:

```
BEFORE save: [{"id":"e1","x":58.32,"y":34.67,"w":31.26,"h":17.35}, ...]
AFTER  save: [{"id":"e1","x":58.32,"y":34.67,"w":45.095105926513675,"h":17.35}, ...]
  *** e1.w: 31.26 -> 45.095105926513675  (44.3%)
>>> SAVE-WITHOUT-EDIT MUTATES STORED GEOMETRY
```

Fabric's self-widened `width` is written back as authored geometry at
`src/lib/registry/canvas-utils.ts:625-630`. Filed as BUG-35.

`h` is protected — `serializeCanvas` uses `Math.max(source.h, measuredTextHeightPct)` for text, so
Fabric's shrunken height never overwrites the authored one. Only `w` drifts.

## 5. A latent one, not currently firing

`fitCanvasToShell` (`ArtifactEditor.tsx:263-283`) calls `canvas.setZoom(scale)` and resizes the
`.canvas-container` wrapper, but never calls `setDimensions` — the `<canvas>` elements stay at
960x540 CSS px. Whenever the shell exceeds 960x540 the zoomed paint is clipped by the canvas
element itself. `run-shell.mjs` at a full-width shell:

| shell | zoom | painted | canvas | never drawn |
|---|---|---|---|---|
| 1366x458 | 0.8481 | 814x458 | 960x540 | 0% |
| 1600x590 | 1.0926 | 1049x590 | 960x540 | 8.5% |
| 1920x770 | 1.4259 | 1369x770 | 960x540 | 29.9% |
| 2560x1130 | 2.0926 | 2009x1130 | 960x540 | 52.2% |
| 3840x1850 | 3.4259 | 3289x1850 | 960x540 | 70.8% |

**It does not fire today**: `run-real-app.mjs` shows the real shell pinned at 762x428 at 1366x768,
1920x1080 and 2560x1440 alike, so the zoom stays at 0.79. But `max-h-[calc(100vh-310px)]` on that
shell (`ArtifactEditor.tsx:3048`) reads as an intent to grow, and the day the editor column gets
wider than 960 CSS px the editor starts silently cropping. Worth a `setDimensions` call or a
`max-w`, not worth a spec of its own.

## 6. Why the existing suite stayed green

`T-25-07` (`tests/smoke-spec-25.test.mjs:410`) asserts 16:9 framing against a `page.setContent`
**copy** of `ArtifactSlide`'s markup. The copy is correct and the assertions are correct, so it
passes — but it can never fail for a defect in the real component, because it never loads it.
That is the shape of guard SPEC-26-03 must not repeat.
