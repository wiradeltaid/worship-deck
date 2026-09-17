# SPEC-25-03 — Canvas vs Presenter Crop: Reproduce, Diagnose, Then Fix

**Status:** open

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`
- **Files**: `src/components/artifacts/ArtifactSlide.tsx` and/or `src/lib/artifacts/render-model.ts` —
  **which file(s) actually change is not yet known; this ticket's own investigation decides that.**
- **Tests**: `tests/smoke-spec-25.test.mjs` (a real-browser stage-framing assertion; see requirement 7)
- **Blocked by**: `SPEC-25-02` — not a genuine dependency (this ticket touches a different file and a
  different root cause than SPEC-25-01/02), but this repo's `parallel-tickets-blocked` validator forbids two
  tickets in the same spec sharing a `touches` value with no blocking edge between them, and every ticket in
  this spec that changes `ArtifactSlide.tsx`/canvas-authoring code is `component: registry`,
  `touches: [artifacts]` by unanimous precedent (SPEC-19-05 is the one prior ticket that used
  `component: presenter` / `touches: [present-channel]`, and it changed remote-control/live-channel code, not
  `ArtifactSlide.tsx` — SPEC-20-04, SPEC-21-02, SPEC-21-03, and SPEC-23-03 all touched `ArtifactSlide.tsx` or
  its rendering model and are all `component: registry`, `touches: [artifacts]`). This ticket is chained after
  SPEC-25-02 for that reason alone, not because its investigation depends on the test suite landing first.

## Context

Owner UAT on `presenter-dev.bic.my.id` (2026-09-13) found the same template renders differently on two
surfaces: the Canvas (Fabric) editor shows the "Bandung international community" fixture inset with a visible
margin on all four edges; the Presenter/Projector output (`ArtifactSlide.tsx`, the shared component every
`SlideView` caller uses) shows the identical content scaled up and cropped — the top of a letter clipped, the
bottom of another touching the frame edge, the coloured blocks reaching the right edge with no margin. Filed
as BUG-34.

`ArtifactSlide.tsx`'s own doc comment states the invariant this defect breaks: *"The stage is letterboxed
inside its parent rather than stretched to fill it."* No `DEC-` or accepted `OQ-` treats this framing
difference as intentional. This is scoped as a violated promise, not a new feature — but **no root cause has
been confirmed.**

**An elimination already narrows the search, from static reading alone:** `ShapeElement` (`ArtifactSlide.tsx`)
has no fit or measurement logic — it is a `div` with percentage `boxStyle()` and a background colour. The
owner's screenshot shows the *coloured blocks* losing their margin, and both text and shape elements sit at
the same stored percentage of the same stage. `TextElement`'s `applyFit`/`largestFittingTextScale` therefore
**cannot** be the mechanism — no per-element measurement difference can crop a plain-`div` shape. The
mechanism has to be in the stage box itself, not in any element's own rendering.

**A stated, testable, NOT YET CONFIRMED hypothesis:** the stage wrapper's CSS (`ArtifactSlide.tsx` ~285:
`width: '100%'`, `maxHeight: '100%'`, `aspectRatio: '16 / 9'`) can resolve `max-height` to `none` when its
ancestor's height is indefinite. If that happens, `width: 100%` plus `aspectRatio: 16/9` can produce a height
taller than the visible area while width still fills it exactly — the ancestor's own `overflow: hidden`
(`ArtifactSlide.tsx` ~281) would then crop the excess top and bottom while the stage still touches the
left/right edges. That matches the reported symptom exactly: top-of-letter and bottom-of-letter clipped,
right edge flush with no margin. This is falsifiable in one browser check of the ancestor height chain (does
it resolve to a definite height, or `auto`/indefinite, at the point `ArtifactSlide` mounts inside
`ProjectorClient`/`SlideshowClient`/`PresenterOperator`). It has not been checked. `wdi-systematic-debugging`'s
Iron Law ("no fix without root cause investigation first") applies without exception: this hypothesis
narrows where to look; it does not authorize a fix.

**Canvas is always exactly 960×540** (`CANVAS_WIDTH`/`CANVAS_HEIGHT`, `src/lib/registry/canvas-utils.ts`),
viewport-independent — the Fabric editor has no equivalent letterbox math to get wrong. Presenter's stage
sizing is the only side with a CSS-computed, viewport-dependent height. These are two independent sizing
mechanisms with no shared scale authority between them.

## Implementation Requirements

Numbered steps are the work; MUST / MUST NOT marks a constraint the finished code has to satisfy.

1. **Reproduce before anything else.** Invoke `wdi-systematic-debugging` and reproduce the crop in a real
   browser. This requires the owner's actual viewport/window dimensions at the time the discrepancy is
   observed, which browser and OS produced the screenshots, and whether the screenshot followed a hard
   refresh (ruling out a stale cached bundle) — the browser/OS matters because the stated hypothesis is a CSS
   `aspect-ratio`/`max-height` resolution question, which has known cross-browser differences (older Safari
   in particular). If any of this cannot be obtained, this ticket MUST stop and ask rather than guess.
2. **Check the hypothesis first, as the cheapest falsification available.** Inspect the actual computed
   height of `ArtifactSlide`'s ancestor chain in `ProjectorClient.tsx`/`SlideshowClient.tsx`/
   `PresenterOperator.tsx` at the reproduction. If `max-height: 100%` is resolving against an indefinite
   ancestor height, that confirms the hypothesis in this document's Context; if it is not, the hypothesis is
   wrong and a new one MUST be formed per `wdi-systematic-debugging` Phase 3 — MUST NOT stack a fix on a
   falsified hypothesis.
3. **Name the exact mechanism**, with file:line evidence, before writing any fix. A hypothesis MUST be tested
   with the smallest possible change before being accepted.
4. **Fix only the confirmed mechanism.** The fix MUST NOT touch `CANVAS_WIDTH`/`CANVAS_HEIGHT` or the Fabric
   editor's own sizing unless the investigation specifically implicates them — the Canvas editor is not
   reported as broken; Presenter is.
5. **Parity invariant.** Once fixed, the same template MUST render with the same relative framing (no element
   newly clipped, no new margin appearing) in both the Canvas editor and the Presenter/Projector output, for
   at least the fixture that exposed this defect (`"Bandung international community"`, the four-colour-block
   layout from the owner's screenshots).
6. **No regression to SPEC-23's wrap-slack or fit-width invariants**, or to SPEC-25-01/02's healing fixes —
   this ticket's file scope does not overlap theirs, and MUST stay that way.
7. **Answer the owner's actual question with a test, not a deferral.** The owner asked directly why no test
   case already covers Canvas-vs-Presenter parity ("Bukankah masalah canvas vs present vs pptx yang menjadi
   masalah utama, kenapa test case tidak ada highlight itu?") — no test anywhere in this repo currently
   asserts the rendered Presenter stage is 16:9 or matches Canvas's framing; every `aspectRatio` hit in
   `tests/` is fixture data, never a rendered assertion. This ticket MUST NOT leave that question unanswered
   by silently filing the general cross-renderer harness as future work. At minimum, land one real-browser
   assertion (`tests/helpers/browser-harness.mjs`, the existing Playwright + Go API + Chromium harness three
   acceptance tests already use, is the prior art) that the Presenter stage's rendered bounding box stays
   16:9 — and shows no clipped/cropped content at its edges for the fixture that exposed this defect — at
   more than one realistic viewport size. If that is genuinely infeasible within this ticket's scope, it MUST
   be filed explicitly via `wdi-question` as a deferred, owner-visible gap — not silently dropped into
   `Out of Scope`.
