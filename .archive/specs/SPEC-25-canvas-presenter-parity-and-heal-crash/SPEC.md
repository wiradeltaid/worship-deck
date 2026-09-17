# SPEC-25 — Canvas/Presenter Parity Gap & Heal-Crash

> **Relationship to SPEC-23 / SPEC-24**: SPEC-23 closed the wrap-slack/font-readiness gap between Canvas,
> Presenter and PPTX. SPEC-24 closed the dirty-state and destructive-serialization defects in the canvas
> healing pass. Owner UAT on `presenter-dev.bic.my.id` (2026-09-13), the day after SPEC-24 deployed, found two
> further defects: one inside SPEC-24's own scope (the "Re-measure all" action it left untouched), and one
> outside every prior spec's scope (Canvas vs Presenter framing). Neither SPEC-23 nor SPEC-24 is reopened;
> this spec closes what they left.
>
> **Revised after independent review** (see `.work/wdi-daily-what-to-build/spec-25-canvas-presenter-parity-and-heal-crash-second-opinion.md`
> for the reviewer's full findings). The review reproduced BUG-33 independently, corrected two claims this
> document originally made, and found a second, more serious defect at the same root cause that the first
> draft missed entirely — folded into BUG-33 below rather than left unfiled. It also found the original
> ticket split misclassified one ticket to dodge a validator rule rather than fixing the rule violation
> honestly. All three are corrected here; nothing below is the first draft.

---

## Problem Statement

### BUG-33 — "Re-measure all" crashes, and (once the crash is fixed naively) corrupts style data

An admin opens the Artifact editor and clicks **Re-measure all** (`admin.artifacts.remeasureAll`) to batch-heal
legacy templates that predate SPEC-23's measurement fields. The moment the batch reaches a template that
combines an unmeasured text element with a shape or image element, the browser throws:

```
t._set is not a function
```

The action aborts. Some templates in the batch may have saved before the crash, others not — the admin has no
way to tell which, and cannot re-run the heal without the same crash recurring on the same template.

**This is not the whole defect.** Constructing a real Fabric object to fix the crash — without also carrying
every style field the interactive canvas already carries — silently repaints shapes and resets text styling
on save, for every template the batch touches. The crash currently masks most of this by aborting before most
templates save; fixing only the crash would turn "Re-measure all" into a library-wide style-and-colour wipe.
This is the same class of damage SPEC-24 (BUG-32) already closed once, at a different call site.

### BUG-34 — Presenter output crops the slide differently than the Canvas editor

An admin opens a template in the Canvas editor: the slide's content (text and colour blocks) sits comfortably
inset, with a visible margin on all four edges. The same admin then watches the identical slide in the
Presenter/Projector view: the content is visibly larger and cropped — the top of a letter is clipped, the
bottom of another touches the frame edge, and the coloured blocks reach the right edge with no margin. Nothing
was edited between the two views; the same stored template produces two different framings depending only on
which surface renders it.

`ArtifactSlide.tsx`'s own doc comment states the invariant this breaks: *"The stage is letterboxed inside its
parent rather than stretched to fill it."* This is not the same defect SPEC-22/23 already closed — that work
was about a wrapped word's line breaks, never about the whole slide's framing — but it is the same family of
question: does Canvas actually show the operator what gets presented.

---

## Solution

### BUG-33

`healTemplate()` must add every element kind to its offscreen Fabric canvas as a genuine Fabric object
instance carrying the *same style options* the interactive canvas already uses — not a second, partial
construction path — so both the crash and the corruption close in one move. Confirmed root cause, reproduced
independently twice:

- `src/lib/registry/canvas-utils.ts:884`, inside `healTemplate()`: shape and image elements are added via
  `canvas.add({ ...common, type: element.type })` — a bare object literal, never a `fabric.Rect`, `fabric.Image`,
  or any other `fabric.Object` subclass.
- `node_modules/fabric/dist/index.node.mjs:3192-3198` (fabric `6.6.1`, matching the `^6.6.1` pinned in
  `package.json`): `Canvas._onObjectAdded(obj)` unconditionally calls `obj._set('canvas', this)` on every
  object passed to `canvas.add(...)`. A plain object has no `_set` method — that call throws exactly
  `TypeError: t._set is not a function` (the minified production bundle renders the object as `t`).
- **Correction from the first diagnosis**: this needs no real browser. `await import('fabric')` resolves to
  the browser bundle and throws on `window` outside one, but `fabric/node` (or `StaticCanvas` from either)
  reproduces the identical crash in plain Node in well under a second. The crash is not environment-gated; it
  is purely "a plain object was added where a Fabric instance was expected."
- **Correction on the trigger**: `isElementUnmeasured()` returns `false` for every non-text `element.type`, so
  a template holding *only* shapes/images returns from `healTemplate()`'s early exit and never reaches the
  crash. The actual trigger is an unmeasured text element together with at least one shape/image element in
  the same template — narrower than "any template with a shape or image," which is what this document
  originally claimed.
- The **text** branch (`canvas-utils.ts` ~875) already guards for a real Fabric class: `typeof
  fabric?.Textbox === 'function'` before constructing `new fabric.Textbox(...)`. The shape/image branch never
  received the equivalent guard or a real class instance.
- **Not a SPEC-24 regression.** `git log -S'canvas.add({ ...common'` traces this line to `fe8b1f5`
  ("measurement coverage on open & heal with re-measure action", SPEC-23-05). It has been live and reachable
  since SPEC-23 closed (2026-09-10); it surfaced only now because no one had run "Re-measure all" against a
  template combining an unmeasured text element with a shape/image element until this UAT pass.
- **Why no test caught it:** `tests/smoke-spec-23.test.mjs` calls `healTemplate(legacyTemplate, {})` — an empty
  object as `fabric`, and Node's `test` runner has no `document` global. `healTemplate()`'s own environment
  branch therefore always takes its "Node / test harness" fallback for the canvas itself too: a hand-rolled
  object whose `add()` is a bare `Array.push`, which never calls `_onObjectAdded` or `_set` at all. Every
  existing test — for shapes, images, *and* text — has always run through this forgiving fallback. The real
  Fabric construction path this bug lives in has never been exercised by any test in this repository.

**The corruption, found during independent review and not present in the first draft of this document:**
`elementToFabricObject()` (`ArtifactEditor.tsx:149`) is the construction path the interactive canvas already
uses correctly — it supplies `fill`/`opacity` for a shape, and `fill`/`textAlign`/`lineHeight`/
`underline`/`shadow`/`fontWeight`/`fontStyle` for text. `healTemplate()` does not call it; it has its own,
separate, and incomplete construction for text (missing most of those style fields) and none at all for
shape/image. Verified at runtime: a `new fabric.Rect({...common})` with no authored `fillColor` defaults to
`fill: 'rgb(0,0,0)'`, `opacity: 1` — `serializeCanvas`'s `toStrictHexColor` then writes that back as
`#000000`, repainting the shape black. A `new fabric.Textbox(text, {...common, fontSize, fontFamily,
fontWeight, fontStyle})` — today's text construction — strips `fontColor`, resets `textAlign` to Fabric's own
default, and drops `lineHeight`/`underline`/`textShadow` on write-back, verified against a realistic fixture
(white, centred, underlined, drop-shadowed text healed into black, left-aligned, plain text).
`handleRemeasureAll` (`ArtifactEditor.tsx:2114`) loops over and **saves** every template it changes.

The fix extracts `elementToFabricObject()`'s construction into a function `healTemplate()` can share, rather
than growing a second, parallel, partial one — this closes the crash and the corruption together, and removes
the drift between the two call sites permanently.

### BUG-34

Root cause is **not yet established** and this document does not assert one. `wdi-systematic-debugging`'s
Iron Law ("no fix without root cause investigation first," and "if it is not reproducible, gather more data —
you MUST NOT proceed on a guess") applies in full: nobody has reproduced this defect in a real browser yet,
only read the two rendering paths' source. What independent review narrowed, stated as evidence and an
explicit unconfirmed hypothesis, not a diagnosis:

- The Canvas editor (`ArtifactEditor.tsx`, Fabric.js) always operates at a fixed offscreen resolution:
  `CANVAS_WIDTH = 960`, `CANVAS_HEIGHT = 540` (`canvas-utils.ts`) — exactly 16:9, with no viewport dependency.
  It has no letterbox math to get wrong.
- The Presenter/Projector surface (`ArtifactSlide.tsx`, the shared "browser twin of the PPTX renderer" every
  `SlideView` caller uses) sizes its stage with plain CSS against whatever the real browser viewport is:
  `width: 100%`, `maxHeight: 100%`, `aspectRatio: '16 / 9'` on the outer wrapper, with `overflow: hidden` at
  both the stage and per-element level.
- **Elimination**: `ShapeElement` (`ArtifactSlide.tsx`) has no fit or measurement logic at all — a `div` with
  percentage geometry and a background colour. The owner's screenshot shows the *coloured blocks* losing
  their margin, and both element kinds sit at the same stored percentage of the same stage. `TextElement`'s
  `applyFit`/`largestFittingTextScale` shrink-to-fit measurement therefore **cannot** be the mechanism — it
  has no effect on a shape. The mechanism has to be in the stage box itself.
- **Hypothesis, not yet confirmed**: the stage wrapper's `max-height: 100%` can resolve to `none` when its
  ancestor's height is indefinite. If so, `width: 100%` plus `aspectRatio: 16/9` can produce a stage taller
  than the visible area while still filling it exactly in width — the ancestor's own `overflow: hidden` would
  then crop the excess top and bottom while the stage still touches the left/right edges. That matches the
  reported symptom exactly (top/bottom clipped, right edge flush). Falsifiable in one browser check of the
  ancestor height chain; not yet checked.
- These are two independent sizing mechanisms with no shared scale authority between them — a structural
  observation, not by itself a diagnosis.
- The more precise promise this breaks is `ArtifactSlide.tsx`'s own doc comment ("the stage is letterboxed
  inside its parent"), not `.how/registry/06-flows/canvas-authoring-controls.md`'s wrap/glyph-parity language
  (SPEC-22/23), which is about a different axis (line-wrap parity, not stage framing) and was being stretched
  in this document's first draft. No `DEC-` or accepted `OQ-` treats this framing difference as intentional
  either way.

The ticket for BUG-34 is written as **investigate, then fix** — its first requirement is reproduction in a real
browser at the operator's actual viewport dimensions, through `wdi-systematic-debugging`, checking the
hypothesis above as the cheapest available falsification, before any change to `ArtifactSlide.tsx` or the
Fabric canvas sizing is proposed.

---

## User Stories

1. As an admin, clicking "Re-measure all" on the full template library completes without crashing, whatever
   mix of text, shape, and image elements each template holds.
2. As an admin, after "Re-measure all" completes, every touched template's stored geometry *and style* —
   position, size, `fillColor`/`opacity` for shapes, `fontColor`/`textAlign`/`lineHeight`/`textDecoration`/
   `textShadow` for text — is unchanged for every element that required no measurement change, and I can
   re-run the action any number of times with zero additional changes (idempotent).
3. As an admin, when I preview a slide in the Canvas editor, the same slide in the Presenter/Projector view
   shows the same framing — nothing is cropped in one that is fully visible in the other.
4. As a slide operator relying on the Canvas editor as a WYSIWYG preview of what the congregation will see,
   I can trust that preview: what fits inside the frame in the editor also fits inside the frame on the
   projector.
5. As a maintainer, the next engineer reading `healTemplate()` can see, from the code itself, that every
   element kind is built by the same function the interactive canvas already uses — not a silent, drifting
   second construction path for one call site.
6. As a maintainer, a regression test exists that would have caught BUG-33's crash *and* its style corruption
   before either shipped.
7. As the owner, the parity question raised directly in UAT ("kenapa test case tidak ada highlight itu?") gets
   a test case, not only a filed ticket — see SPEC-25-03 requirement 7.

---

## Implementation Decisions

- **SPEC-25-01 (BUG-33 fix)** — `src/lib/registry/canvas-utils.ts`, `ArtifactEditor.tsx`:
  - `healTemplate()` MUST NOT grow a second, parallel construction path. Extract `elementToFabricObject()`'s
    logic into a function `canvas-utils.ts` can import and both call sites share. The interactive canvas's
    existing behaviour MUST NOT change as a result — this is a move, not a rewrite.
  - Every element kind gets a real Fabric instance with full style fidelity via that shared function: shape →
    `fabric.Rect` with `fillColor`/`opacity` from the element's authored style (or `elementToFabricObject`'s
    existing defaults, never Fabric's own un-styled defaults); text → `fabric.Textbox` with the full option
    set `elementToFabricObject`'s text branch already assembles (`fill`, `textAlign`, `lineHeight`,
    `underline`, `shadow`, `fontWeight`, `fontStyle`), not the geometry-plus-font-size-and-family subset
    `healTemplate()` builds today; image/image-placeholder → a real Fabric instance, a lightweight `Rect`
    stand-in is acceptable since only geometry participates in serialization for these.
  - The existing `typeof fabric?.Textbox === 'function'` guard pattern is the model for every element kind:
    fall back to the existing Node-harness plain-object path only when the real class is unavailable, never
    as the default in a real browser or in `fabric/node`.
  - `serializeCanvas()`'s `computedX`/`computedY` (~line 384) has no `isHealing` guard, unlike `w`/`h`/
    `zIndex`. If the chosen image stand-in construction can produce a `left`/`top` different from the
    authored geometry (as `elementToFabricObject`'s real fit-scaled `fabric.FabricImage` branch can), that
    MUST be prevented at construction time (build the stand-in so its geometry exactly matches authored
    values) rather than patched by adding an `isHealing` branch to `computedX`/`computedY` — SPEC-24 exists
    because a special case in that exact function once silently overwrote user data.
  - No unrelated change to `serializeCanvas()`'s reading side.

- **SPEC-25-02 (regression tests)** — `tests/smoke-spec-25.test.mjs`:
  - MUST use `fabric/node` (not bare `fabric`, which is the browser bundle and throws on `window` outside
    one), with a real `StaticCanvas`, to exercise the shape/image construction-and-`add()` path that actually
    crashed — this needs no `document` and no new dependency.
  - MUST NOT attempt to construct a real `fabric.Textbox` in this test environment: it throws (`Cannot set
    properties of null (setting 'textBaseline')`) without a 2D rendering context, and neither `canvas`
    (node-canvas) nor a direct `jsdom` dependency is to be added for this ticket. Text style fidelity is
    instead proven by asserting on the *options object* the shared construction function builds, before it
    reaches `new fabric.Textbox(...)` — which requires SPEC-25-01's extraction to expose that option-building
    step as a plain, callable-in-isolation function, not only as an inline part of Fabric-instance
    construction.
  - MUST prove both absence-guards the way `AGENTS.md` requires — the crash (revert to the bare object
    literal, confirm a `_set` `TypeError`) and the corruption (revert to the partial option set, confirm the
    specific corrupted field fails) — each independently, each demonstrated red then green.

- **SPEC-25-03 (BUG-34 investigation + fix)** — scope confined to whichever of `ArtifactSlide.tsx`'s stage
  sizing the reproduction implicates (the `TextElement` shrink-to-fit measurement is already eliminated as a
  candidate — see Solution above). This ticket MUST NOT presuppose the answer beyond that elimination: its
  first requirements are checking the stated hypothesis and, if it does not hold, forming a new one per
  `wdi-systematic-debugging` Phase 3, before any line changes. It also MUST land a real-browser assertion that
  the Presenter stage stays 16:9 and unclipped — the owner asked directly why no such test case exists; this
  ticket is where that gets answered, not silently deferred.
  - **Classification**: `component: registry` / `satisfies: [UC-14]` / `touches: [artifacts]` — see ticket
    `03`'s own Component & Scope block for why (precedent across every prior `ArtifactSlide.tsx` ticket, and
    the corrected reasoning after an earlier draft misclassified this to dodge a validator rule).

---

## Testing Decisions

- **Seam for BUG-33**: `healTemplate()`'s shared construction function, called via `fabric/node` +
  `StaticCanvas` for the shape/image path (the actual crash trigger), and as a plain function call (no Fabric
  instance needed) for asserting text style-option fidelity. This is the fewest-possible, highest-possible
  seam reachable without adding a DOM dependency to this repo's test suite.
- **Prior art**: `tests/smoke-spec-23.test.mjs`'s existing `healTemplate` idempotency tests (fixture
  construction, `res1`/`res2` pass structure) are the direct template to extend for the crash/geometry side.
  `tests/helpers/browser-harness.mjs` (Playwright + Go API + Chromium, already used by three acceptance
  tests) is the prior art for BUG-34's real-browser stage-framing assertion — heavier, and reserved for that
  ticket only.
- A test MUST NOT assert a literal where the behaviour is what matters (`AGENTS.md`): the shape/image
  regression test asserts "does not throw" and "geometry and style unchanged," not a hardcoded snapshot of
  the whole serialized object.
- **Seam for BUG-34**'s fix is undetermined until the investigation names the actual mechanism; its ticket
  carries that decision once made. Its *parity assertion* (stage stays 16:9, unclipped), however, is not
  deferred — that seam is decided here: `tests/helpers/browser-harness.mjs`.

---

## Out of Scope

- Re-diagnosing BUG-31 or BUG-32 (SPEC-24) — both remain closed on their own evidence; this spec only
  updates `defects.yaml` bookkeeping if `wdi-build`'s own process requires it, never their root cause.
- Reopening SPEC-22 or SPEC-23's wrap-slack, fit-width, or font-readiness work.
- A general cross-renderer image-diff parity harness (Canvas vs Presenter vs PPTX, pixel-level, arbitrary
  fixtures) — that remains future work. SPEC-23's own non-goals section named two things this spec sits
  between: that harness (there provisionally called "SPEC-25," before this SPEC-25 claimed the number for
  this narrower fix — both of SPEC-23's forward references, that one and its "SPEC-24 owns font embedding"
  claim, are now stale; neither is corrected here per the standing rule against reopening SPEC-23) and,
  separately, "a central shaping authority (a `TextLayout` contract computed once, executed by all three
  surfaces)" — BUG-34 is a concrete instance of the second, not the first, and is scoped here to the one
  fixture that exposed it, not a general harness.
- Any embedded-font or PPTX-specific change — untouched by either BUG-33 or BUG-34.
- Building the actual code fix for BUG-34 beyond what its investigation supports — this spec authorizes
  investigation and, only once grounded, a fix; it does not pre-authorize a specific code change sight
  unseen.
- A general Canvas/Presenter/PPTX visual regression suite covering arbitrary fixtures — SPEC-25-03 lands one
  concrete real-browser assertion (16:9, unclipped) for the fixture that exposed BUG-34; it does not build a
  harness for every future fixture. If the owner wants that generalised, it is the harness item above.

---

## Further Notes

- BUG-33 is fully diagnosed, including the corruption risk a naive fix would introduce, and is safe to build
  directly from this document — SPEC-25-01 must reuse `elementToFabricObject`, not add a second construction
  path. BUG-34 is not fully diagnosed: its ticket is written as an investigation gate with a stated,
  falsifiable, unconfirmed hypothesis, and its acceptance criteria are about the investigation's own rigor
  before any code change.
- Both defects were found by the owner in the same manual QA pass that also re-confirmed BUG-31 and BUG-32
  (SPEC-24) as fixed — this spec does not reopen those.
